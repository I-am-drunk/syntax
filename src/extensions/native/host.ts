import { channelStateKey } from '../../core/channelState.ts'
import { downloadNativePackage, verifyStoredNativePackage } from './package.ts'
import { NativePackageError } from './manifest.ts'
import type { NativeInstall, NativeRepository } from './repository.ts'
import { NativeRuntime } from './runtime.ts'

const startupKey = channelStateKey('syntax.native-startup.v2')

interface StartupAttempt {
  id: string
  revision: string
}

function readAttempt(raw: string): StartupAttempt | undefined {
  try {
    const value = JSON.parse(raw)
    return value && typeof value.id === 'string' && typeof value.revision === 'string' ? value : undefined
  } catch {
    return undefined
  }
}

export class NativeHost {
  readonly runtime: NativeRuntime
  private readonly repository: NativeRepository
  private readonly journal: Pick<Storage, 'getItem' | 'setItem' | 'removeItem'>
  private tail: Promise<unknown> = Promise.resolve()

  constructor(
    repository: NativeRepository,
    journal: Pick<Storage, 'getItem' | 'setItem' | 'removeItem'>,
    reportCleanupError: (id: string, error: unknown) => void,
  ) {
    this.repository = repository
    this.journal = journal
    this.runtime = new NativeRuntime(repository, reportCleanupError)
  }

  list(): Promise<NativeInstall[]> {
    return this.repository.list()
  }

  install(source: string): Promise<NativeInstall> {
    return this.enqueue(async () => {
      const pkg = await downloadNativePackage(source)
      const id = pkg.manifest.id
      const existing = await this.repository.get(id)
      if (existing && existing.package.sourceUrl !== pkg.sourceUrl) {
        throw new NativePackageError('SOURCE_CONFLICT', `${id} is already installed from a different manifest URL.`)
      }
      if (existing?.package.manifest.version === pkg.manifest.version &&
        existing.package.manifest.sha256 !== pkg.manifest.sha256) {
        throw new NativePackageError('VERSION_REUSED', 'Publish changed JavaScript with a new extension version.')
      }
      const next = { package: pkg, revision: crypto.randomUUID(), enabled: true }
      await this.activate(next, () => this.repository.replace(id, existing?.revision, next))
      return next
    })
  }

  setEnabled(id: string, enabled: boolean): Promise<void> {
    return this.enqueue(async () => {
      const current = await this.repository.get(id)
      if (!current || current.enabled === enabled && this.runtime.isActive(id) === enabled) return
      const next: NativeInstall = { package: current.package, revision: crypto.randomUUID(), enabled }
      if (enabled) {
        try {
          await this.activate(current, () => this.repository.replace(id, current.revision, next), next.revision)
        } catch (error) {
          await this.quarantine(current, error)
          throw error
        }
      } else {
        await this.repository.replace(id, current.revision, next)
        this.runtime.disable(id)
      }
    })
  }

  boot(): Promise<{ recovery: 'normal' | 'skipped' | 'quarantined'; failed: string[] }> {
    return this.enqueue(async () => {
      const raw = this.journal.getItem(startupKey)
      const attempt = raw === null ? undefined : readAttempt(raw)
      if (raw !== null && !attempt) return { recovery: 'skipped', failed: [] }
      let recovery: 'normal' | 'quarantined' = 'normal'
      const failed: string[] = []
      const records = await this.repository.list()
      const suspect = records.find(record =>
        record.package.manifest.id === attempt?.id && record.revision === attempt.revision,
      )
      if (suspect) {
        if (await this.quarantine(suspect, new Error('Startup was interrupted before this extension finished activating.'))) {
          failed.push(suspect.package.manifest.id)
          recovery = 'quarantined'
        }
        this.journal.removeItem(startupKey)
      }
      for (const record of records) {
        const id = record.package.manifest.id
        if (record === suspect || !record.enabled || this.runtime.isActive(id)) continue
        try {
          await this.activate(record, async () => {
            const current = await this.repository.get(id)
            if (current?.revision !== record.revision) {
              throw new NativePackageError('INSTALL_CHANGED', 'Another operation changed this install during startup.')
            }
          })
        } catch (error) {
          if (await this.quarantine(record, error)) failed.push(id)
        }
      }
      this.journal.removeItem(startupKey)
      return { recovery, failed }
    })
  }

  acknowledgeUnknownStartup(): Promise<void> {
    return this.enqueue(async () => {
      const raw = this.journal.getItem(startupKey)
      if (raw !== null && !readAttempt(raw)) this.journal.removeItem(startupKey)
    })
  }

  private enqueue<T>(operation: () => Promise<T>): Promise<T> {
    const result = this.tail.then(operation)
    this.tail = result.catch(() => undefined)
    return result
  }

  private async activate(
    record: NativeInstall,
    commit?: () => Promise<void>,
    revision = record.revision,
  ): Promise<void> {
    await verifyStoredNativePackage(record.package)
    const marker = { id: record.package.manifest.id, revision: record.revision }
    this.journal.setItem(startupKey, JSON.stringify(marker))
    try {
      await this.runtime.activate(record.package, async () => {
        await commit?.()
        this.journal.removeItem(startupKey)
      }, revision)
    } finally {
      this.journal.removeItem(startupKey)
    }
  }

  private async quarantine(record: NativeInstall, error: unknown): Promise<boolean> {
    if (error instanceof NativePackageError && error.code === 'INSTALL_CHANGED') return false
    try {
      await this.repository.replace(record.package.manifest.id, record.revision, {
        ...record,
        revision: crypto.randomUUID(),
        enabled: false,
        failure: (error instanceof Error ? error.message : String(error)).slice(0, 1000),
      })
      this.runtime.disable(record.package.manifest.id)
      return true
    } catch (failure) {
      if (failure instanceof NativePackageError && failure.code === 'INSTALL_CHANGED') return false
      throw failure
    }
  }
}
