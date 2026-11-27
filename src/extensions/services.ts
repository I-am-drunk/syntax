import { extensionDiagnostics } from './diagnostics.ts'
import { satisfiesSemver, type ExtensionManifest } from './manifest.ts'
import { ExtensionError } from './plugos/protocol.ts'

export interface ServiceRegistration {
  name: string
  version: string
  ownerId: string
  activationId: string
  invoke: (method: string, args: unknown[]) => Promise<unknown>
}

export interface DependencyIssue {
  service: string
  requiredRange: string
  installedVersion: string | null
  providerId: string | null
  reason: string
}

export interface DependencyCheckResult {
  ok: boolean
  requiredFailures: DependencyIssue[]
  optionalUnavailable: DependencyIssue[]
  availableOptional: string[]
}

/**
 * Explicit cycle detection across enabled extension manifests' required services.
 * Returns the cycle chain (e.g. ['ext.a', 'ext.b', 'ext.a']) if circular, or null.
 */
export function findServiceCycle(
  target: ExtensionManifest,
  allEnabledManifests: readonly ExtensionManifest[],
): string[] | null {
  const byId = new Map<string, ExtensionManifest>()
  const providerByService = new Map<string, string>()

  for (const m of allEnabledManifests) {
    byId.set(m.id, m)
    for (const svc of Object.keys(m.services.provides)) {
      providerByService.set(svc, m.id)
    }
  }
  byId.set(target.id, target)
  for (const svc of Object.keys(target.services.provides)) {
    providerByService.set(svc, target.id)
  }

  const visited = new Set<string>()
  const stack: string[] = []
  const onStack = new Set<string>()

  function dfs(extId: string): string[] | null {
    if (onStack.has(extId)) {
      const start = stack.indexOf(extId)
      return [...stack.slice(start), extId]
    }
    if (visited.has(extId)) return null
    visited.add(extId)
    stack.push(extId)
    onStack.add(extId)

    const manifest = byId.get(extId)
    if (manifest) {
      for (const reqSvc of Object.keys(manifest.services.requires)) {
        const providerId = providerByService.get(reqSvc)
        if (!providerId) continue
        const cycle = dfs(providerId)
        if (cycle) return cycle
      }
    }

    stack.pop()
    onStack.delete(extId)
    return null
  }

  return dfs(target.id)
}

export class ExtensionServiceRegistry {
  private readonly registrations = new Map<string, ServiceRegistration>()

  checkDependencies(manifest: ExtensionManifest): DependencyCheckResult {
    const requiredFailures: DependencyIssue[] = []
    const optionalUnavailable: DependencyIssue[] = []
    const availableOptional: string[] = []

    const inspect = (service: string, requiredRange: string): DependencyIssue | null => {
      const reg = this.registrations.get(service)
      if (!reg) {
        return {
          service,
          requiredRange,
          installedVersion: null,
          providerId: null,
          reason: `Requires service "${service}" (${requiredRange}), which is not active.`,
        }
      }
      if (!satisfiesSemver(reg.version, requiredRange)) {
        return {
          service,
          requiredRange,
          installedVersion: reg.version,
          providerId: reg.ownerId,
          reason: `Needs "${service}" ${requiredRange}, but ${reg.ownerId} provides ${reg.version}.`,
        }
      }
      return null
    }

    for (const [service, range] of Object.entries(manifest.services.requires)) {
      const issue = inspect(service, range)
      if (issue) requiredFailures.push(issue)
    }

    for (const [service, range] of Object.entries(manifest.services.optional)) {
      const issue = inspect(service, range)
      if (issue) optionalUnavailable.push(issue)
      else availableOptional.push(service)
    }

    return {
      ok: requiredFailures.length === 0,
      requiredFailures,
      optionalUnavailable,
      availableOptional,
    }
  }

  /**
   * Atomically replaces all services owned by `ownerId`.
   * Rejects if another active extension already owns one of the claimed service names.
   */
  commitByOwner(ownerId: string, services: ServiceRegistration[]) {
    for (const svc of services) {
      const existing = this.registrations.get(svc.name)
      if (existing && existing.ownerId !== ownerId) {
        throw new ExtensionError(
          'SERVICE_INCOMPATIBLE',
          `Service "${svc.name}" is already provided by active extension "${existing.ownerId}".`,
          { extensionId: ownerId },
        )
      }
    }

    for (const [name, reg] of this.registrations.entries()) {
      if (reg.ownerId === ownerId) {
        this.registrations.delete(name)
      }
    }
    for (const svc of services) {
      this.registrations.set(svc.name, svc)
    }
    extensionDiagnostics.setCounter('services', this.registrations.size)
  }

  removeByOwner(ownerId: string) {
    let changed = false
    for (const [name, reg] of this.registrations.entries()) {
      if (reg.ownerId === ownerId) {
        this.registrations.delete(name)
        changed = true
      }
    }
    if (changed) {
      extensionDiagnostics.setCounter('services', this.registrations.size)
    }
  }

  clearAll() {
    this.registrations.clear()
    extensionDiagnostics.setCounter('services', 0)
  }

  get(name: string): ServiceRegistration | undefined {
    return this.registrations.get(name)
  }

  has(callerManifest: ExtensionManifest, serviceName: string): boolean {
    const range =
      callerManifest.services.requires[serviceName] ??
      callerManifest.services.optional[serviceName]
    if (!range) return false
    const reg = this.registrations.get(serviceName)
    return Boolean(reg && satisfiesSemver(reg.version, range))
  }

  list(): ServiceRegistration[] {
    return [...this.registrations.values()]
  }

  async call(
    callerManifest: ExtensionManifest,
    serviceName: string,
    method: string,
    args: unknown[],
  ): Promise<unknown> {
    const declaredRange =
      callerManifest.services.requires[serviceName] ??
      callerManifest.services.optional[serviceName]
    if (!declaredRange) {
      throw new ExtensionError(
        'SYSCALL_DENIED',
        `Extension "${callerManifest.id}" must declare "${serviceName}" in services.requires or services.optional before calling it.`,
        { extensionId: callerManifest.id },
      )
    }

    const reg = this.registrations.get(serviceName)
    if (!reg) {
      throw new ExtensionError(
        'SERVICE_MISSING',
        `Service "${serviceName}" is currently unavailable (provider is not active).`,
        { extensionId: callerManifest.id },
      )
    }

    if (!satisfiesSemver(reg.version, declaredRange)) {
      throw new ExtensionError(
        'SERVICE_INCOMPATIBLE',
        `${callerManifest.name} needs "${serviceName}" ${declaredRange}, but ${reg.ownerId} provides ${reg.version}.`,
        { extensionId: callerManifest.id },
      )
    }

    return await reg.invoke(method, args)
  }
}

export const serviceRegistry = new ExtensionServiceRegistry()
