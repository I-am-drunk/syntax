import { toast } from 'sonner'
import {
  qualifyContributionKey,
  useContributionStore,
  type StagedContributions,
} from './contributions.ts'
import { extensionDiagnostics } from './diagnostics.ts'
import {
  documentStore,
  notifyDocumentsChanged,
  type CreateDocumentInput,
  type SaveDocumentInput,
} from './documents.ts'
import {
  fetchExtensionManifest,
  resolveExtensionAssets,
  type ExtensionManifest,
  type ResolvedExtensionAssets,
} from './manifest.ts'
import { ExtensionError, type SerializedError } from './plugos/protocol.ts'
import { WorkerSandbox } from './plugos/workerSandbox.ts'
import { findServiceCycle, serviceRegistry, type ServiceRegistration } from './services.ts'
import {
  isSafeMode,
  useExtensionStore,
  type ExtensionRecord,
  type ExtensionSettingValue,
} from './store.ts'

export type ExtensionNavigateFn = (path: string) => void

interface ActiveInstance {
  extensionId: string
  activationId: string
  manifest: ExtensionManifest
  assets: ResolvedExtensionAssets
  sandbox: WorkerSandbox | null
}

function toErrorInfo(err: unknown): { code: string; message: string; detail?: string } {
  if (err instanceof ExtensionError) {
    return { code: err.code, message: err.message, detail: err.detail }
  }
  if (err instanceof Error) {
    return { code: 'WORKER_RUNTIME_ERROR', message: err.message, detail: err.stack }
  }
  return { code: 'WORKER_RUNTIME_ERROR', message: String(err) }
}

/**
 * Topologically orders enabled records so service providers boot before their consumers.
 */
function orderForBoot(records: ExtensionRecord[]): ExtensionRecord[] {
  const enabled = records.filter(r => r.enabled)
  const providerByService = new Map<string, string>()
  for (const r of enabled) {
    for (const svc of Object.keys(r.manifest.services.provides)) {
      providerByService.set(svc, r.id)
    }
  }
  const byId = new Map(enabled.map(r => [r.id, r]))
  const visited = new Set<string>()
  const visiting = new Set<string>()
  const ordered: ExtensionRecord[] = []

  function visit(id: string) {
    if (visited.has(id) || visiting.has(id)) return
    visiting.add(id)
    const rec = byId.get(id)
    if (rec) {
      for (const reqSvc of Object.keys(rec.manifest.services.requires)) {
        const provId = providerByService.get(reqSvc)
        if (provId && provId !== id) visit(provId)
      }
      ordered.push(rec)
    }
    visiting.delete(id)
    visited.add(id)
  }

  for (const r of enabled) visit(r.id)
  return ordered
}

const NOTIFY_RATE_LIMIT = 5
const NOTIFY_WINDOW_MS = 10_000
const NAVIGATE_RATE_LIMIT = 3
const NAVIGATE_WINDOW_MS = 5_000

export class ExtensionManager {
  private readonly active = new Map<string, ActiveInstance>()
  private readonly staging = new Map<string, ActiveInstance>()
  private readonly locks = new Map<string, Promise<unknown>>()
  private readonly rateBuckets = new Map<string, number[]>()
  private activationSeq = 0
  private bootInFlight: Promise<void> | null = null
  private navigateFn: ExtensionNavigateFn | null = null

  private consumeRateLimit(
    extId: string,
    bucket: 'notify' | 'openView',
    limit: number,
    windowMs: number,
  ) {
    const key = `${extId}:${bucket}`
    const now = Date.now()
    const recent = (this.rateBuckets.get(key) ?? []).filter(ts => now - ts < windowMs)
    if (recent.length >= limit) {
      throw new ExtensionError(
        'SYSCALL_DENIED',
        bucket === 'notify'
          ? `Notification rate limit exceeded (${limit} per ${Math.round(windowMs / 1000)}s).`
          : `Navigation rate limit exceeded (${limit} per ${Math.round(windowMs / 1000)}s).`,
        { extensionId: extId },
      )
    }
    recent.push(now)
    this.rateBuckets.set(key, recent)
  }

  private clearRateLimits(extId: string) {
    this.rateBuckets.delete(`${extId}:notify`)
    this.rateBuckets.delete(`${extId}:openView`)
  }

  setNavigator(fn: ExtensionNavigateFn | null) {
    this.navigateFn = fn
  }

  private withLock<T>(extId: string, task: () => Promise<T>): Promise<T> {
    const prev = this.locks.get(extId) ?? Promise.resolve()
    const next = prev.then(task, task)
    const settled = next.then(
      () => undefined,
      () => undefined,
    )
    this.locks.set(extId, settled)
    void settled.finally(() => {
      if (this.locks.get(extId) === settled) {
        this.locks.delete(extId)
      }
    })
    return next
  }

  private nextActivationId(extId: string): string {
    return `${extId}:${++this.activationSeq}:${Date.now().toString(36)}`
  }

  getActiveActivationId(extId: string): string | null {
    return this.active.get(extId)?.activationId ?? null
  }

  isActivationCurrent(extId: string, activationId: string): boolean {
    const inst = this.active.get(extId)
    return Boolean(inst && inst.activationId === activationId)
  }

  private lookupContext(extId: string, activationId: string): ActiveInstance | null {
    const staged = this.staging.get(activationId)
    if (staged && staged.extensionId === extId) return staged
    const live = this.active.get(extId)
    if (live && live.activationId === activationId) return live
    return null
  }

  private async handleSyscall(
    extId: string,
    activationId: string,
    name: string,
    args: unknown[],
  ): Promise<unknown> {
    const inst = this.lookupContext(extId, activationId)
    if (!inst) {
      throw new ExtensionError(
        'WORKER_STOPPED',
        `Syscall "${name}" rejected because activation "${activationId}" is no longer active.`,
        { extensionId: extId },
      )
    }

    switch (name) {
      case 'services.call': {
        const [serviceName, method, fnArgs] = args as [string, string, unknown[]]
        if (typeof serviceName !== 'string' || typeof method !== 'string') {
          throw new ExtensionError('SYSCALL_DENIED', 'services.call requires (serviceName, method).')
        }
        return await serviceRegistry.call(
          inst.manifest,
          serviceName,
          method,
          Array.isArray(fnArgs) ? fnArgs : [],
        )
      }

      case 'services.has': {
        const [serviceName] = args as [string]
        return typeof serviceName === 'string' && serviceRegistry.has(inst.manifest, serviceName)
      }

      case 'documents.get': {
        const [id] = args as [string]
        if (typeof id !== 'string' || !id.trim()) {
          throw new ExtensionError('SYSCALL_DENIED', 'documents.get requires a document id.')
        }
        return await documentStore.get(id, inst.extensionId)
      }

      case 'documents.list': {
        const [type] = args as [string | undefined]
        return await documentStore.list(
          typeof type === 'string' && type.trim() ? type : undefined,
          inst.extensionId,
        )
      }

      case 'documents.create': {
        const [raw] = args as [Partial<CreateDocumentInput> | undefined]
        if (!raw || typeof raw !== 'object') {
          throw new ExtensionError('SYSCALL_DENIED', 'documents.create requires an input object.')
        }
        const docType = typeof raw.type === 'string' ? raw.type.trim().slice(0, 64) : ''
        const docTitle =
          typeof raw.title === 'string' ? raw.title.trim().slice(0, 160) || 'Untitled' : 'Untitled'
        const schemaVersion =
          typeof raw.schemaVersion === 'number' &&
          Number.isInteger(raw.schemaVersion) &&
          raw.schemaVersion >= 1
            ? raw.schemaVersion
            : 1
        const created = await documentStore.create({
          id: typeof raw.id === 'string' ? raw.id.trim().slice(0, 128) : undefined,
          type: docType,
          title: docTitle,
          schemaVersion,
          // Always stamped by host identity, never trusted from extension payload
          createdByExtensionId: inst.extensionId,
          data: raw.data,
        })
        notifyDocumentsChanged()
        return created
      }

      case 'documents.save': {
        const [raw] = args as [Partial<SaveDocumentInput> | undefined]
        if (
          !raw ||
          typeof raw !== 'object' ||
          typeof raw.id !== 'string' ||
          typeof raw.expectedRevision !== 'number' ||
          !Number.isInteger(raw.expectedRevision) ||
          raw.expectedRevision < 1
        ) {
          throw new ExtensionError(
            'SYSCALL_DENIED',
            'documents.save requires { id, expectedRevision (>= 1), data }.',
          )
        }
        const saved = await documentStore.save({
          id: raw.id,
          expectedRevision: raw.expectedRevision,
          ownerExtensionId: inst.extensionId,
          title: typeof raw.title === 'string' ? raw.title.trim().slice(0, 160) : undefined,
          schemaVersion:
            typeof raw.schemaVersion === 'number' &&
            Number.isInteger(raw.schemaVersion) &&
            raw.schemaVersion >= 1
              ? raw.schemaVersion
              : undefined,
          data: raw.data,
        })
        notifyDocumentsChanged()
        return saved
      }

      case 'settings.get': {
        const [key] = args as [string]
        if (typeof key !== 'string') return undefined
        return useExtensionStore.getState().getSetting(inst.extensionId, key, inst.manifest)
      }

      case 'settings.getAll': {
        return useExtensionStore.getState().getAllSettings(inst.extensionId, inst.manifest)
      }

      case 'settings.set': {
        const [key, value] = args as [string, ExtensionSettingValue]
        const def = inst.manifest.settings.find(s => s.id === key)
        if (!def) {
          throw new ExtensionError(
            'SYSCALL_DENIED',
            `Setting "${String(key)}" is not declared in extension.json.`,
            { extensionId: inst.extensionId },
          )
        }
        if (typeof value !== def.type || (def.type === 'number' && !Number.isFinite(value))) {
          throw new ExtensionError(
            'SYSCALL_DENIED',
            `Setting "${key}" expects a valid "${def.type}" (got "${String(value)}").`,
            { extensionId: inst.extensionId },
          )
        }
        useExtensionStore.getState().setSetting(inst.extensionId, key, value)
        return value
      }

      case 'ui.notify': {
        const [message, kind] = args as [string, 'info' | 'success' | 'error' | undefined]
        const clean = String(message ?? '').slice(0, 200)
        if (!clean) return
        this.consumeRateLimit(inst.extensionId, 'notify', NOTIFY_RATE_LIMIT, NOTIFY_WINDOW_MS)
        if (kind === 'success') toast.success(clean)
        else if (kind === 'error') toast.error(clean)
        else toast(clean)
        return
      }

      case 'ui.openView': {
        const [viewId, docId] = args as [string, string | undefined]
        const exists = inst.manifest.views.some(v => v.id === viewId)
        if (!exists) {
          throw new ExtensionError(
            'SYSCALL_DENIED',
            `View "${String(viewId)}" is not declared by ${inst.extensionId}.`,
            { extensionId: inst.extensionId },
          )
        }
        this.consumeRateLimit(inst.extensionId, 'openView', NAVIGATE_RATE_LIMIT, NAVIGATE_WINDOW_MS)
        const path =
          typeof docId === 'string' && docId.trim()
            ? `/ext/${encodeURIComponent(inst.extensionId)}/${encodeURIComponent(viewId)}/${encodeURIComponent(docId.trim())}`
            : `/ext/${encodeURIComponent(inst.extensionId)}/${encodeURIComponent(viewId)}`
        this.navigateFn?.(path)
        return path
      }

      default:
        throw new ExtensionError('SYSCALL_DENIED', `Unknown syscall: ${name}`, {
          extensionId: inst.extensionId,
        })
    }
  }

  private buildStagedContributions(
    manifest: ExtensionManifest,
    assets: ResolvedExtensionAssets,
    activationId: string,
  ): StagedContributions {
    const ownerId = manifest.id
    return {
      ownerId,
      activationId,
      commands: manifest.commands.map(cmd => ({
        key: qualifyContributionKey(ownerId, cmd.id),
        id: cmd.id,
        ownerId,
        activationId,
        title: cmd.title,
        run: cmd.run ?? cmd.id,
      })),
      toolbar: manifest.toolbar.map(item => ({
        key: qualifyContributionKey(ownerId, item.id),
        id: item.id,
        ownerId,
        activationId,
        label: item.label,
        commandKey: item.commandId ? qualifyContributionKey(ownerId, item.commandId) : undefined,
        viewId: item.viewId,
      })),
      views: manifest.views.map(view => ({
        key: qualifyContributionKey(ownerId, view.id),
        id: view.id,
        ownerId,
        activationId,
        title: view.title,
        entryUrl: assets.viewUrls[view.id]!,
        placement: view.placement,
        docTypes: view.docTypes,
      })),
    }
  }

  /**
   * Two-phase staged activation: validates cycles, required services, boots worker,
   * verifies exported command handlers, and ONLY commits contributions/services on success.
   * When `preserveLiveOnFailure` is true (used by `update()`), an existing live instance
   * remains completely untouched if the candidate fails.
   */
  private async stageAndActivate(
    manifest: ExtensionManifest,
    assets: ResolvedExtensionAssets,
    opts?: { preserveLiveOnFailure?: boolean; bootTimeoutMs?: number },
  ): Promise<ActiveInstance> {
    const extId = manifest.id
    const activationId = this.nextActivationId(extId)
    const store = useExtensionStore.getState()

    if (!opts?.preserveLiveOnFailure) {
      store.setRuntime(extId, {
        status: 'loading',
        lastError: null,
      })
    }

    // 1. Check circular required service dependencies across enabled records
    const enabledManifests = store.records
      .filter(r => r.enabled && r.id !== extId)
      .map(r => r.manifest)
    const cycle = findServiceCycle(manifest, enabledManifests)
    if (cycle) {
      const err = new ExtensionError(
        'SERVICE_CYCLE',
        `Circular required dependency detected: ${cycle.join(' -> ')}.`,
        { extensionId: extId },
      )
      this.recordActivationFailure(extId, activationId, err, opts?.preserveLiveOnFailure)
      throw err
    }

    // 2. Check required & optional service versions
    const depCheck = serviceRegistry.checkDependencies(manifest)
    if (!depCheck.ok) {
      const first = depCheck.requiredFailures[0]!
      const err = new ExtensionError(
        first.installedVersion ? 'SERVICE_INCOMPATIBLE' : 'SERVICE_MISSING',
        depCheck.requiredFailures.map(f => f.reason).join(' '),
        { extensionId: extId },
      )
      this.recordActivationFailure(extId, activationId, err, opts?.preserveLiveOnFailure)
      throw err
    }

    // 3. Stage contributions in memory (never visible in UI until activation completes)
    const stagedContribs = this.buildStagedContributions(manifest, assets, activationId)

    let sandbox: WorkerSandbox | null = null
    const candidate: ActiveInstance = {
      extensionId: extId,
      activationId,
      manifest,
      assets,
      sandbox: null,
    }

    if (assets.workerUrl) {
      this.staging.set(activationId, candidate)
      sandbox = new WorkerSandbox({
        extensionId: extId,
        version: manifest.version,
        activationId,
        workerUrl: assets.workerUrl,
        baseUrl: assets.baseUrl,
        bootTimeoutMs: opts?.bootTimeoutMs,
        callbacks: {
          onSyscall: (id, actId, name, args) => this.handleSyscall(id, actId, name, args),
          onLog: (id, actId, level, message, detail) => {
            extensionDiagnostics.push({
              extensionId: id,
              activationId: actId,
              source: 'worker',
              level,
              message,
              detail,
            })
          },
          onRuntimeError: (id, actId, error: SerializedError) => {
            if (!this.isActivationCurrent(id, actId)) return
            useExtensionStore.getState().setRuntime(id, {
              lastError: {
                code: error.code ?? 'WORKER_RUNTIME_ERROR',
                message: error.message,
                detail: error.stack,
                at: Date.now(),
              },
            })
          },
          onBlobCountChange: delta => extensionDiagnostics.adjustCounter('blobUrls', delta),
          onWorkerCountChange: delta => extensionDiagnostics.adjustCounter('workers', delta),
        },
      })
      candidate.sandbox = sandbox

      try {
        const exportedFns = await sandbox.init()
        const fnSet = new Set(exportedFns)
        for (let i = 0; i < manifest.commands.length; i++) {
          const cmd = manifest.commands[i]!
          const targetFn = cmd.run ?? cmd.id
          if (!fnSet.has(targetFn)) {
            throw new ExtensionError(
              'FUNCTION_NOT_FOUND',
              `commands[${i}].run ("${targetFn}") is not exported by ${manifest.worker}.`,
              { extensionId: extId },
            )
          }
        }
      } catch (err) {
        sandbox.stop()
        this.staging.delete(activationId)
        this.recordActivationFailure(extId, activationId, err, opts?.preserveLiveOnFailure)
        throw err
      } finally {
        this.staging.delete(activationId)
      }
    }

    // 4. Build service registrations bound to this activationId
    const serviceRegs: ServiceRegistration[] = Object.entries(manifest.services.provides).map(
      ([svcName, svcVersion]) => ({
        name: svcName,
        version: svcVersion,
        ownerId: extId,
        activationId,
        invoke: async (method, args) => {
          if (!this.isActivationCurrent(extId, activationId) || !sandbox) {
            throw new ExtensionError(
              'WORKER_STOPPED',
              `Service "${svcName}" is no longer running.`,
              { extensionId: extId },
            )
          }
          return await this.invokeWorker(extId, method, args, activationId)
        },
      }),
    )

    // 5. Commit point (synchronous & atomic)
    try {
      serviceRegistry.commitByOwner(extId, serviceRegs)
    } catch (err) {
      sandbox?.stop()
      this.recordActivationFailure(extId, activationId, err, opts?.preserveLiveOnFailure)
      throw err
    }

    const previous = this.active.get(extId)
    this.active.set(extId, candidate)
    useContributionStore.getState().commitStaged(stagedContribs)
    if (previous && previous.sandbox) {
      previous.sandbox.stop()
    }

    const unavailableOptionalServices: Record<string, string> = {}
    for (const issue of depCheck.optionalUnavailable) {
      unavailableOptionalServices[issue.service] = issue.reason
    }

    useExtensionStore.getState().setRuntime(extId, {
      status: 'active',
      activationId,
      lastError: null,
      unavailableOptionalServices,
      hasLiveWorker: Boolean(sandbox),
    })

    extensionDiagnostics.push({
      extensionId: extId,
      activationId,
      source: 'host',
      level: 'info',
      message: `Activated ${manifest.name} v${manifest.version}`,
    })

    this.reconcileActiveDependents(extId)
    if (Object.keys(manifest.services.provides).length > 0) {
      void this.healFailedDependents(extId)
    }

    return candidate
  }

  /**
   * Re-checks dependency health for every other active extension whenever a provider
   * activates, updates, stops, disables, or uninstalls.
   */
  private reconcileActiveDependents(changedExtId: string) {
    const store = useExtensionStore.getState()
    for (const [id, inst] of this.active.entries()) {
      if (id === changedExtId) continue
      const depCheck = serviceRegistry.checkDependencies(inst.manifest)
      const unavailableOptionalServices: Record<string, string> = {}
      for (const issue of depCheck.optionalUnavailable) {
        unavailableOptionalServices[issue.service] = issue.reason
      }
      const prevRt = store.runtime[id]
      if (!depCheck.ok) {
        const first = depCheck.requiredFailures[0]!
        store.setRuntime(id, {
          unavailableOptionalServices,
          lastError: {
            code: first.installedVersion ? 'SERVICE_INCOMPATIBLE' : 'SERVICE_MISSING',
            message: depCheck.requiredFailures.map(f => f.reason).join(' '),
            at: Date.now(),
          },
        })
      } else {
        const clearStaleDepError =
          prevRt?.lastError?.code === 'SERVICE_MISSING' ||
          prevRt?.lastError?.code === 'SERVICE_INCOMPATIBLE'
        store.setRuntime(id, {
          unavailableOptionalServices,
          ...(clearStaleDepError ? { lastError: null } : {}),
        })
      }
    }
  }

  /**
   * Automatically retries enabled extensions that previously failed with SERVICE_MISSING
   * or SERVICE_INCOMPATIBLE once a newly activated provider satisfies their requirements.
   */
  private async healFailedDependents(providerExtId: string): Promise<void> {
    const store = useExtensionStore.getState()
    if (store.safeMode) return
    const candidates = store.records.filter(r => {
      if (!r.enabled || r.id === providerExtId || this.active.has(r.id)) return false
      const rt = store.runtime[r.id]
      if (rt?.status !== 'failed') return false
      const code = rt.lastError?.code
      if (code !== 'SERVICE_MISSING' && code !== 'SERVICE_INCOMPATIBLE') return false
      return serviceRegistry.checkDependencies(r.manifest).ok
    })
    for (const rec of candidates) {
      await this.withLock(rec.id, async () => {
        const latest = useExtensionStore.getState()
        if (latest.safeMode || this.active.has(rec.id)) return
        const current = latest.records.find(r => r.id === rec.id)
        if (!current || !current.enabled) return
        if (!serviceRegistry.checkDependencies(current.manifest).ok) return
        try {
          const assets = resolveExtensionAssets(current.manifestUrl, current.manifest)
          await this.stageAndActivate(current.manifest, assets)
        } catch {
          // Recorded per-extension
        }
      })
    }
  }

  private recordActivationFailure(
    extId: string,
    activationId: string,
    err: unknown,
    preserveLiveOnFailure?: boolean,
  ) {
    const info = toErrorInfo(err)
    extensionDiagnostics.push({
      extensionId: extId,
      activationId,
      source: 'host',
      level: 'error',
      message: info.message,
      detail: info.detail,
    })
    if (!preserveLiveOnFailure) {
      useExtensionStore.getState().setRuntime(extId, {
        status: 'failed',
        activationId: null,
        hasLiveWorker: false,
        lastError: { ...info, at: Date.now() },
      })
    }
  }

  private deactivateNow(extId: string, nextStatus: 'disabled' | 'safe-mode' = 'disabled') {
    const prev = this.active.get(extId)
    // Retire identity first so late messages or in-flight syscalls are immediately ignored
    this.active.delete(extId)
    this.clearRateLimits(extId)
    serviceRegistry.removeByOwner(extId)
    useContributionStore.getState().removeByOwner(extId)
    if (prev?.sandbox) {
      prev.sandbox.stop()
    }
    useExtensionStore.getState().setRuntime(extId, {
      status: nextStatus,
      activationId: null,
      hasLiveWorker: false,
      unavailableOptionalServices: {},
    })
    this.reconcileActiveDependents(extId)
  }

  async boot(opts?: { safeMode?: boolean; force?: boolean }): Promise<void> {
    if (this.bootInFlight && !opts?.force) {
      return this.bootInFlight
    }
    const store = useExtensionStore.getState()
    if (store.booted && !opts?.force) {
      return
    }

    const run = (async () => {
      const safeMode = opts?.safeMode ?? isSafeMode()
      store.setSafeMode(safeMode)

      if (safeMode) {
        for (const rec of store.records) {
          this.deactivateNow(rec.id, rec.enabled ? 'safe-mode' : 'disabled')
        }
        store.setBooted(true)
        return
      }

      const ordered = orderForBoot(store.records)
      for (const rec of ordered) {
        await this.withLock(rec.id, async () => {
          const latestStore = useExtensionStore.getState()
          if (latestStore.safeMode) return
          const current = latestStore.records.find(r => r.id === rec.id)
          if (!current || !current.enabled) return
          try {
            const assets = resolveExtensionAssets(current.manifestUrl, current.manifest)
            await this.stageAndActivate(current.manifest, assets)
          } catch {
            // Failure recorded per-extension; continue booting unrelated extensions
          }
        })
      }
      store.setBooted(true)
    })()

    this.bootInFlight = run
    try {
      await run
    } finally {
      if (this.bootInFlight === run) {
        this.bootInFlight = null
      }
    }
  }

  /**
   * Fetch and validate extension.json from URL, stage-boot it, and persist the
   * ExtensionRecord only if manifest + asset validation succeed.
   */
  async installFromUrl(
    manifestUrl: string,
    opts?: { enableImmediately?: boolean; bootTimeoutMs?: number },
  ): Promise<ExtensionRecord> {
    const { manifest, assets } = await fetchExtensionManifest(manifestUrl)
    return await this.installFromManifest(manifest, assets, opts)
  }

  /**
   * Install an already fetched & user-reviewed manifest and resolved assets without
   * re-fetching the manifest (prevents swap between review and activation).
   */
  async installFromManifest(
    manifest: ExtensionManifest,
    assets: ResolvedExtensionAssets,
    opts?: { enableImmediately?: boolean; bootTimeoutMs?: number },
  ): Promise<ExtensionRecord> {
    return await this.withLock(manifest.id, async () => {
      const store = useExtensionStore.getState()
      const existing = store.records.find(r => r.id === manifest.id)
      const now = Date.now()
      const enableImmediately = opts?.enableImmediately ?? true

      const record: ExtensionRecord = {
        id: manifest.id,
        manifestUrl: assets.manifestUrl,
        origin: assets.origin,
        enabled: enableImmediately,
        installedAt: existing?.installedAt ?? now,
        updatedAt: now,
        manifest,
      }

      if (enableImmediately) {
        try {
          await this.stageAndActivate(manifest, assets, {
            preserveLiveOnFailure: Boolean(existing),
            bootTimeoutMs: opts?.bootTimeoutMs,
          })
        } catch (err) {
          // Failed brand-new install leaves no half-installed active extension
          if (!existing) {
            useContributionStore.getState().removeByOwner(manifest.id)
            serviceRegistry.removeByOwner(manifest.id)
            useExtensionStore.getState().removeRuntime(manifest.id)
          }
          throw err
        }
      }

      if (!enableImmediately && this.active.has(manifest.id)) {
        this.deactivateNow(manifest.id, store.safeMode ? 'safe-mode' : 'disabled')
      }
      store.upsertRecord(record)
      if (!enableImmediately) {
        store.setRuntime(record.id, {
          status: store.safeMode ? 'safe-mode' : 'disabled',
          activationId: null,
          hasLiveWorker: false,
        })
      }
      return record
    })
  }

  async enable(extId: string): Promise<void> {
    await this.withLock(extId, async () => {
      const store = useExtensionStore.getState()
      const rec = store.records.find(r => r.id === extId)
      if (!rec) throw new ExtensionError('MANIFEST_INVALID', `Extension "${extId}" is not installed.`)
      const updated: ExtensionRecord = { ...rec, enabled: true, updatedAt: Date.now() }
      store.upsertRecord(updated)
      const assets = resolveExtensionAssets(updated.manifestUrl, updated.manifest)
      await this.stageAndActivate(updated.manifest, assets)
    })
  }

  private stopStagingWorkers(extId: string): boolean {
    let stoppedAny = false
    for (const [actId, staged] of this.staging.entries()) {
      if (staged.extensionId === extId && staged.sandbox) {
        staged.sandbox.stop()
        staged.sandbox = null
        this.staging.delete(actId)
        stoppedAny = true
      }
    }
    return stoppedAny
  }

  async disable(extId: string): Promise<void> {
    this.stopStagingWorkers(extId)
    await this.withLock(extId, async () => {
      const store = useExtensionStore.getState()
      const rec = store.records.find(r => r.id === extId)
      this.deactivateNow(extId, 'disabled')
      if (rec) {
        store.upsertRecord({ ...rec, enabled: false, updatedAt: Date.now() })
      }
      extensionDiagnostics.push({
        extensionId: extId,
        activationId: null,
        source: 'host',
        level: 'info',
        message: `Disabled ${rec?.manifest.name ?? extId}`,
      })
    })
  }

  /**
   * Immediately terminates a stuck/runaway worker without waiting on the lifecycle lock,
   * rejecting all pending invocations with `Plug sandbox stopped`.
   */
  stopWorker(extId: string) {
    const stoppedAny = this.stopStagingWorkers(extId)

    const live = this.active.get(extId)
    if (live?.sandbox) {
      serviceRegistry.removeByOwner(extId)
      live.sandbox.stop()
      live.sandbox = null
      useExtensionStore.getState().setRuntime(extId, {
        hasLiveWorker: false,
        status: 'failed',
        lastError: {
          code: 'WORKER_STOPPED',
          message: 'Worker stopped by user.',
          at: Date.now(),
        },
      })
      this.reconcileActiveDependents(extId)
      extensionDiagnostics.push({
        extensionId: extId,
        activationId: live.activationId,
        source: 'host',
        level: 'warn',
        message: 'Terminated extension worker sandbox.',
      })
    } else if (stoppedAny) {
      extensionDiagnostics.push({
        extensionId: extId,
        activationId: null,
        source: 'host',
        level: 'warn',
        message: 'Terminated staging extension worker sandbox.',
      })
    }
  }

  async reload(extId: string): Promise<void> {
    this.stopStagingWorkers(extId)
    await this.withLock(extId, async () => {
      const store = useExtensionStore.getState()
      const rec = store.records.find(r => r.id === extId)
      if (!rec) throw new ExtensionError('MANIFEST_INVALID', `Extension "${extId}" is not installed.`)
      this.deactivateNow(extId, 'disabled')
      const updated: ExtensionRecord = { ...rec, enabled: true, updatedAt: Date.now() }
      store.upsertRecord(updated)
      const assets = resolveExtensionAssets(updated.manifestUrl, updated.manifest)
      await this.stageAndActivate(updated.manifest, assets)
    })
  }

  /**
   * Staged update: fetches & activates the new version BEFORE touching the active
   * extension or persisted record. A bad update leaves the working version untouched.
   */
  async update(extId: string): Promise<ExtensionRecord> {
    return await this.withLock(extId, async () => {
      const store = useExtensionStore.getState()
      const rec = store.records.find(r => r.id === extId)
      if (!rec) throw new ExtensionError('MANIFEST_INVALID', `Extension "${extId}" is not installed.`)

      const { manifest, assets } = await fetchExtensionManifest(rec.manifestUrl)
      if (manifest.id !== rec.id) {
        throw new ExtensionError(
          'MANIFEST_INVALID',
          `Update manifest ID "${manifest.id}" does not match installed extension "${rec.id}".`,
          { extensionId: rec.id },
        )
      }

      if (rec.enabled && !store.safeMode) {
        await this.stageAndActivate(manifest, assets, { preserveLiveOnFailure: true })
      }

      const updated: ExtensionRecord = {
        ...rec,
        manifest,
        origin: assets.origin,
        updatedAt: Date.now(),
      }
      store.upsertRecord(updated)
      return updated
    })
  }

  /**
   * Uninstalls the extension and removes all its UI/runtime contributions.
   * User-owned documents in DocumentStore are NEVER deleted here.
   */
  async uninstall(extId: string, opts?: { deleteSettings?: boolean }): Promise<void> {
    this.stopStagingWorkers(extId)
    await this.withLock(extId, async () => {
      this.deactivateNow(extId, 'disabled')
      const store = useExtensionStore.getState()
      store.removeRecord(extId)
      if (opts?.deleteSettings) {
        store.clearSettings(extId)
      }
      extensionDiagnostics.push({
        extensionId: extId,
        activationId: null,
        source: 'host',
        level: 'info',
        message: `Uninstalled ${extId} (user documents preserved)`,
      })
    })
  }

  async invokeWorker(
    extId: string,
    fnName: string,
    args: unknown[] = [],
    expectedActivationId?: string,
  ): Promise<unknown> {
    const inst = this.active.get(extId)
    if (!inst || (expectedActivationId && inst.activationId !== expectedActivationId)) {
      throw new ExtensionError('WORKER_STOPPED', `Extension "${extId}" is not active.`, {
        extensionId: extId,
      })
    }
    if (!inst.sandbox) {
      throw new ExtensionError(
        'WORKER_STOPPED',
        `Extension "${extId}" does not have a running worker.`,
        { extensionId: extId },
      )
    }
    try {
      return await inst.sandbox.invoke(fnName, args)
    } catch (err) {
      const info = toErrorInfo(err)
      extensionDiagnostics.push({
        extensionId: extId,
        activationId: inst.activationId,
        source: 'worker',
        level: 'error',
        message: `${fnName}: ${info.message}`,
        detail: info.detail,
      })
      if (this.isActivationCurrent(extId, inst.activationId)) {
        useExtensionStore.getState().setRuntime(extId, {
          lastError: { ...info, at: Date.now() },
        })
      }
      throw err
    }
  }

  async runCommand(commandKey: string, args: unknown[] = []): Promise<unknown> {
    const cmd = useContributionStore.getState().getCommand(commandKey)
    if (!cmd) {
      throw new ExtensionError('FUNCTION_NOT_FOUND', `Command "${commandKey}" is not registered.`)
    }
    return await this.invokeWorker(cmd.ownerId, cmd.run, args, cmd.activationId)
  }

  /** Used by ExtensionViewFrame to execute scoped view->worker or view->syscall RPCs. */
  async handleViewCall(
    extId: string,
    activationId: string,
    target: 'worker' | 'syscall',
    method: string,
    args: unknown[],
  ): Promise<unknown> {
    if (!this.isActivationCurrent(extId, activationId)) {
      throw new ExtensionError('WORKER_STOPPED', 'View activation is no longer current.', {
        extensionId: extId,
      })
    }
    if (target === 'worker') {
      return await this.invokeWorker(extId, method, args, activationId)
    }
    return await this.handleSyscall(extId, activationId, method, args)
  }

  async shutdownAll(): Promise<void> {
    const ids = [...this.active.keys()]
    for (const id of ids) {
      this.deactivateNow(id, 'disabled')
    }
  }

  /**
   * Pushes updated settings live to active extension workers that export `onSettingsChanged`.
   */
  notifySettingsChanged(extId?: string | null) {
    const store = useExtensionStore.getState()
    const targets = extId ? [this.active.get(extId)].filter(Boolean) : [...this.active.values()]
    for (const inst of targets) {
      if (!inst?.sandbox) continue
      const all = store.getAllSettings(inst.extensionId, inst.manifest)
      inst.sandbox.notifySettingsChanged(all)
    }
  }

  /**
   * Reconciles cloud-synced extension entries onto this device without blocking UI
   * or failing the app if any individual extension host is temporarily unreachable.
   */
  async syncFromCloud(
    entries: ReadonlyArray<{ id: string; manifestUrl: string; enabled: boolean }> | undefined,
  ): Promise<void> {
    if (!entries || entries.length === 0) return
    const safeMode = useExtensionStore.getState().safeMode
    for (const entry of entries) {
      if (!entry.manifestUrl.startsWith('https://') && !entry.manifestUrl.startsWith('http://')) {
        continue
      }
      const existing = useExtensionStore.getState().records.find(r => r.id === entry.id)
      if (!existing) {
        try {
          await this.installFromUrl(entry.manifestUrl, {
            enableImmediately: entry.enabled && !safeMode,
          })
        } catch (err) {
          extensionDiagnostics.push({
            extensionId: entry.id,
            activationId: null,
            source: 'host',
            level: 'warn',
            message: `Cloud sync skipped installing ${entry.id}: ${err instanceof Error ? err.message : String(err)}`,
          })
        }
      } else if (!safeMode && existing.enabled !== entry.enabled) {
        try {
          if (entry.enabled) await this.enable(entry.id)
          else await this.disable(entry.id)
        } catch {
          // Recorded per-extension; continue syncing others
        }
      }
    }
  }
}

export const extensionManager = new ExtensionManager()

declare global {
  interface Window {
    __SYNTAX_EXTENSIONS__?: {
      manager: ExtensionManager
      store: typeof useExtensionStore
      contributions: typeof useContributionStore
      services: typeof serviceRegistry
      documents: typeof documentStore
      diagnostics: typeof extensionDiagnostics
    }
  }
}

if (typeof window !== 'undefined') {
  window.addEventListener('syntax:extension-settings-changed', ev => {
    const detail = (ev as CustomEvent<{ extensionId?: string | null } | undefined>).detail
    extensionManager.notifySettingsChanged(detail?.extensionId ?? null)
  })
  window.__SYNTAX_EXTENSIONS__ = {
    manager: extensionManager,
    store: useExtensionStore,
    contributions: useContributionStore,
    services: serviceRegistry,
    documents: documentStore,
    diagnostics: extensionDiagnostics,
  }
}
