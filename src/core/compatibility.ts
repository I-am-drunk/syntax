/**
 * Minecraft Fabric / Modrinth-inspired Compatibility & Dependency Resolver.
 * Pure TypeScript — zero React/Zustand dependencies — shared by UI, registry, and CLI.
 */
import {
  RESERVED_HOST_IDS,
  SYNTAX_API_VERSION,
  SYNTAX_COMPAT_API_VERSIONS,
  SYNTAX_HOST_VERSION,
  getCompatibility,
  type PackageKind,
  type SyntaxPackageManifest,
} from './packages'
import { compareSemver, satisfiesRange } from './semver'

export type InstalledRecordLike = {
  manifest: SyntaxPackageManifest
  enabled: boolean
}

export type CompatibilityVerdict =
  | 'compatible'   // Ready to install/run with zero issues and zero extra deps
  | 'needs-deps'   // Valid, but requires auto-installing and/or enabling dependencies
  | 'warning'      // Installable/runnable, but has non-blocking warnings (conflict / deprecated-api)
  | 'incompatible' // Hard error: host mismatch, unresolvable dep, version conflict, breaks, or cycle

export type CompatibilityIssueCode =
  | 'host-incompatible'
  | 'deprecated-api'
  | 'missing-dep'
  | 'disabled-dep'
  | 'version-mismatch'
  | 'breaks-installed'
  | 'broken-by-installed'
  | 'conflict'
  | 'cycle'

export type CompatibilityIssue = {
  code: CompatibilityIssueCode
  severity: 'error' | 'warning'
  sourceId: string
  targetId: string
  targetName?: string
  requiredRange?: string
  foundVersion?: string
  chain?: string[]
  message: string
}

export type CompatibilityReport = {
  verdict: CompatibilityVerdict
  issues: CompatibilityIssue[]
  /** Packages from catalogPool that must be installed/upgraded (dependency-first order). */
  installPlan: SyntaxPackageManifest[]
  /** Already-installed packages that satisfy constraints but are currently disabled. */
  enablePlan: SyntaxPackageManifest[]
  /** Recommended optional packages not currently enabled. */
  recommendations: Array<{ id: string; range: string; available?: SyntaxPackageManifest }>
  /** Resolved topological load order for candidate + active graph. */
  loadOrder: string[]
}

export type LoadOrderResult =
  | { ok: true; order: string[] }
  | { ok: false; order: string[]; cycles: string[][] }

export type DependentImpact = {
  id: string
  name: string
  kind: PackageKind
  depth: number
  via: string
}

export type RemovalImpact = {
  targetId: string
  action: 'disable' | 'uninstall'
  safe: boolean
  affected: DependentImpact[]
  cascadeDisableIds: string[]
  summary: string
}

export type InstalledHealthStatus = {
  state: 'healthy' | 'warning' | 'error'
  issues: CompatibilityIssue[]
}

type HostVersions = {
  hostVersion?: string
  apiVersion?: string
  compatApiVersions?: readonly string[]
}

function matchesPackage(targetKey: string, range: string, pkg: SyntaxPackageManifest): boolean {
  const compat = getCompatibility(pkg)
  const idOrCapMatch = pkg.id === targetKey || compat.provides.includes(targetKey)
  if (!idOrCapMatch) return false
  return satisfiesRange(pkg.version, range, { includePrerelease: true })
}

/**
 * Deterministic Kahn topological sort with cycle extraction.
 * Dependencies always appear BEFORE the packages that depend on them.
 */
export function computeLoadOrder(manifests: readonly SyntaxPackageManifest[]): LoadOrderResult {
  const byId = new Map<string, SyntaxPackageManifest>()
  const providersByKey = new Map<string, SyntaxPackageManifest[]>()

  for (const m of manifests) {
    byId.set(m.id, m)
    const compat = getCompatibility(m)
    const existingById = providersByKey.get(m.id) ?? []
    existingById.push(m)
    providersByKey.set(m.id, existingById)
    for (const cap of compat.provides) {
      const list = providersByKey.get(cap) ?? []
      list.push(m)
      providersByKey.set(cap, list)
    }
  }

  const adj = new Map<string, Set<string>>()
  const inDegree = new Map<string, number>()
  const cycles: string[][] = []

  for (const m of manifests) {
    adj.set(m.id, new Set())
    inDegree.set(m.id, 0)
  }

  for (const m of manifests) {
    const compat = getCompatibility(m)
    for (const [depKey, range] of Object.entries(compat.depends)) {
      if (RESERVED_HOST_IDS.has(depKey)) continue
      const candidates = providersByKey.get(depKey) ?? []
      const provider =
        candidates.find(c => c.id === depKey && satisfiesRange(c.version, range)) ??
        candidates.find(c => satisfiesRange(c.version, range))
      if (!provider) continue
      if (provider.id === m.id) {
        cycles.push([m.id, m.id])
        continue
      }
      const outs = adj.get(provider.id)!
      if (!outs.has(m.id)) {
        outs.add(m.id)
        inDegree.set(m.id, (inDegree.get(m.id) ?? 0) + 1)
      }
    }
  }

  const ready = [...inDegree.entries()]
    .filter(([, deg]) => deg === 0)
    .map(([id]) => id)
    .sort((a, b) => a.localeCompare(b))

  const order: string[] = []
  while (ready.length > 0) {
    const curr = ready.shift()!
    order.push(curr)
    for (const next of adj.get(curr) ?? []) {
      const nextDeg = (inDegree.get(next) ?? 1) - 1
      inDegree.set(next, nextDeg)
      if (nextDeg === 0) {
        ready.push(next)
        ready.sort((a, b) => a.localeCompare(b))
      }
    }
  }

  if (order.length === manifests.length && cycles.length === 0) {
    return { ok: true, order }
  }

  // Extract minimal cycles among remaining nodes with inDegree > 0
  const remaining = new Set([...inDegree.entries()].filter(([, d]) => d > 0).map(([id]) => id))
  const visited = new Set<string>()
  const onStack = new Map<string, number>()
  const stack: string[] = []

  const dfs = (u: string) => {
    visited.add(u)
    onStack.set(u, stack.length)
    stack.push(u)
    for (const v of adj.get(u) ?? []) {
      if (!remaining.has(v)) continue
      if (onStack.has(v)) {
        const startIdx = onStack.get(v)!
        cycles.push([...stack.slice(startIdx), v])
      } else if (!visited.has(v)) {
        dfs(v)
      }
    }
    stack.pop()
    onStack.delete(u)
  }

  for (const id of [...remaining].sort((a, b) => a.localeCompare(b))) {
    if (!visited.has(id)) dfs(id)
  }

  return { ok: false, order, cycles }
}

/**
 * Full Fabric/Modrinth-style pre-flight compatibility check for installing or enabling a package.
 */
export function evaluateCompatibility(
  candidate: SyntaxPackageManifest,
  installedRecords: readonly InstalledRecordLike[],
  catalogPool: readonly SyntaxPackageManifest[] = [],
  host: HostVersions = {},
): CompatibilityReport {
  const hostVersion = host.hostVersion ?? SYNTAX_HOST_VERSION
  const apiVersion = host.apiVersion ?? SYNTAX_API_VERSION
  const compatApiVersions = host.compatApiVersions ?? SYNTAX_COMPAT_API_VERSIONS

  const installedById = new Map<string, InstalledRecordLike>()
  for (const r of installedRecords) {
    installedById.set(r.manifest.id, r)
  }

  // Build deduplicated provider index (key -> all available manifests by id or capability)
  const allManifestsById = new Map<string, SyntaxPackageManifest>()
  for (const p of catalogPool) allManifestsById.set(p.id, p)
  for (const r of installedRecords) {
    const existing = allManifestsById.get(r.manifest.id)
    if (!existing || compareSemver(r.manifest.version, existing.version) >= 0) {
      allManifestsById.set(r.manifest.id, r.manifest)
    }
  }
  allManifestsById.set(candidate.id, candidate)

  // Keep per-key candidate list including BOTH installed and catalog versions so upgrades work
  const providerCandidates = new Map<string, SyntaxPackageManifest[]>()
  const addProvider = (m: SyntaxPackageManifest) => {
    const pushUnique = (key: string) => {
      const list = providerCandidates.get(key) ?? []
      if (!list.some(x => x.id === m.id && x.version === m.version)) {
        list.push(m)
        providerCandidates.set(key, list)
      }
    }
    pushUnique(m.id)
    for (const cap of getCompatibility(m).provides) {
      pushUnique(cap)
    }
  }

  addProvider(candidate)
  for (const r of installedRecords) addProvider(r.manifest)
  for (const p of catalogPool) addProvider(p)

  const pickBestProvider = (
    key: string,
    requiredRanges: readonly string[],
  ): SyntaxPackageManifest | null => {
    const list = providerCandidates.get(key) ?? []
    const valid = list.filter(m => {
      // Never downgrade an already-installed version
      const inst = installedById.get(m.id)
      if (inst && compareSemver(m.version, inst.manifest.version) < 0) return false
      return requiredRanges.every(rng => satisfiesRange(m.version, rng))
    })
    if (valid.length === 0) return null

    valid.sort((a, b) => {
      const aExact = a.id === key ? 0 : 1
      const bExact = b.id === key ? 0 : 1
      if (aExact !== bExact) return aExact - bExact

      const aInst = installedById.get(a.id)
      const bInst = installedById.get(b.id)
      const aRank = aInst ? (aInst.enabled ? 0 : 1) : a.builtIn ? 2 : 3
      const bRank = bInst ? (bInst.enabled ? 0 : 1) : b.builtIn ? 2 : 3
      if (aRank !== bRank) return aRank - bRank

      return compareSemver(b.version, a.version)
    })
    return valid[0]!
  }

  const issues: CompatibilityIssue[] = []
  const seenIssueKeys = new Set<string>()
  const pushIssue = (issue: CompatibilityIssue) => {
    const key = `${issue.code}|${issue.sourceId}|${issue.targetId}|${issue.requiredRange ?? ''}`
    if (seenIssueKeys.has(key)) return
    seenIssueKeys.add(key)
    issues.push(issue)
  }

  const checkHost = (pkg: SyntaxPackageManifest) => {
    const compat = getCompatibility(pkg)
    const syntaxRange = compat.depends.syntax
    if (syntaxRange && !satisfiesRange(hostVersion, syntaxRange)) {
      pushIssue({
        code: 'host-incompatible',
        severity: 'error',
        sourceId: pkg.id,
        targetId: 'syntax',
        targetName: 'Syntax',
        requiredRange: syntaxRange,
        foundVersion: hostVersion,
        message: `${pkg.name} requires Syntax ${syntaxRange}, but you are running Syntax v${hostVersion}.`,
      })
    }
    const apiRange = compat.depends['syntax-api']
    if (apiRange) {
      if (satisfiesRange(apiVersion, apiRange)) return
      if (compatApiVersions.some(v => satisfiesRange(v, apiRange))) {
        pushIssue({
          code: 'deprecated-api',
          severity: 'warning',
          sourceId: pkg.id,
          targetId: 'syntax-api',
          targetName: 'Syntax API',
          requiredRange: apiRange,
          foundVersion: apiVersion,
          message: `${pkg.name} targets an older Syntax API (${apiRange}, current is v${apiVersion}) and runs in compatibility mode.`,
        })
      } else {
        pushIssue({
          code: 'host-incompatible',
          severity: 'error',
          sourceId: pkg.id,
          targetId: 'syntax-api',
          targetName: 'Syntax API',
          requiredRange: apiRange,
          foundVersion: apiVersion,
          message: `${pkg.name} requires Syntax API ${apiRange}, which is not compatible with Syntax API v${apiVersion}.`,
        })
      }
    }
  }

  // Transitive constraint-accumulating BFS (handles diamond conflicts)
  const constraintsByKey = new Map<
    string,
    Array<{ fromId: string; fromName: string; range: string }>
  >()
  const installPlanMap = new Map<string, SyntaxPackageManifest>()
  const enablePlanMap = new Map<string, SyntaxPackageManifest>()
  const expanded = new Set<string>([candidate.id])
  const queue: SyntaxPackageManifest[] = [candidate]

  checkHost(candidate)

  while (queue.length > 0) {
    const pkg = queue.shift()!
    const compat = getCompatibility(pkg)

    for (const [depKey, range] of Object.entries(compat.depends)) {
      if (RESERVED_HOST_IDS.has(depKey)) continue
      if (depKey === pkg.id) {
        pushIssue({
          code: 'cycle',
          severity: 'error',
          sourceId: pkg.id,
          targetId: pkg.id,
          chain: [pkg.id, pkg.id],
          message: `Circular dependency detected: ${pkg.id} depends on itself.`,
        })
        continue
      }

      const list = constraintsByKey.get(depKey) ?? []
      list.push({ fromId: pkg.id, fromName: pkg.name, range })
      constraintsByKey.set(depKey, list)

      const allRanges = list.map(c => c.range)
      const chosen = pickBestProvider(depKey, allRanges)

      if (!chosen) {
        const anyCandidates = providerCandidates.get(depKey) ?? []
        if (anyCandidates.length > 0) {
          const bestAny = [...anyCandidates].sort((a, b) => compareSemver(b.version, a.version))[0]!
          if (list.length > 1) {
            const first = list[0]!
            pushIssue({
              code: 'version-mismatch',
              severity: 'error',
              sourceId: pkg.id,
              targetId: depKey,
              targetName: bestAny.name,
              requiredRange: range,
              foundVersion: bestAny.version,
              message: `Version conflict for ${bestAny.name}: ${first.fromName} requires ${first.range}, while ${pkg.name} requires ${range}.`,
            })
          } else {
            pushIssue({
              code: 'version-mismatch',
              severity: 'error',
              sourceId: pkg.id,
              targetId: depKey,
              targetName: bestAny.name,
              requiredRange: range,
              foundVersion: bestAny.version,
              message: `${pkg.name} requires ${bestAny.name} (${range}), but only v${bestAny.version} is available.`,
            })
          }
        } else {
          const legacyName = (pkg.requires ?? []).find(r => r.id === depKey)?.name ?? depKey
          pushIssue({
            code: 'missing-dep',
            severity: 'error',
            sourceId: pkg.id,
            targetId: depKey,
            targetName: legacyName,
            requiredRange: range,
            message: `${pkg.name} requires ${legacyName} (${range}), which is not installed or in the catalog.`,
          })
        }
        continue
      }

      const existing = installedById.get(chosen.id)
      const needsInstallOrUpgrade =
        !existing || compareSemver(chosen.version, existing.manifest.version) > 0

      if (chosen.id !== candidate.id) {
        if (needsInstallOrUpgrade) {
          installPlanMap.set(chosen.id, chosen)
          enablePlanMap.delete(chosen.id)
        } else if (existing && !existing.enabled) {
          enablePlanMap.set(chosen.id, chosen)
        }
      }

      if (!expanded.has(chosen.id)) {
        expanded.add(chosen.id)
        checkHost(chosen)
        queue.push(chosen)
      }
    }
  }

  // Bidirectional breaks / conflicts / exclusive slot:* check
  const newSet = new Map<string, SyntaxPackageManifest>()
  newSet.set(candidate.id, candidate)
  for (const m of installPlanMap.values()) newSet.set(m.id, m)
  for (const m of enablePlanMap.values()) newSet.set(m.id, m)

  const existingEnabled = installedRecords
    .filter(r => r.enabled && !newSet.has(r.manifest.id))
    .map(r => r.manifest)

  const finalActive = [...existingEnabled, ...newSet.values()]

  // Check breaks declared by newSet against finalActive
  for (const a of newSet.values()) {
    const compatA = getCompatibility(a)
    for (const [breakKey, range] of Object.entries(compatA.breaks)) {
      for (const b of finalActive) {
        if (b.id === a.id) continue
        if (matchesPackage(breakKey, range, b)) {
          pushIssue({
            code: 'breaks-installed',
            severity: 'error',
            sourceId: a.id,
            targetId: b.id,
            targetName: b.name,
            requiredRange: range,
            foundVersion: b.version,
            message: `${a.name} is incompatible with ${b.name} (v${b.version}). Disable or remove ${b.name} first.`,
          })
        }
      }
    }
    for (const [conflictKey, range] of Object.entries(compatA.conflicts)) {
      for (const b of finalActive) {
        if (b.id === a.id) continue
        if (matchesPackage(conflictKey, range, b)) {
          pushIssue({
            code: 'conflict',
            severity: 'warning',
            sourceId: a.id,
            targetId: b.id,
            targetName: b.name,
            requiredRange: range,
            foundVersion: b.version,
            message: `${a.name} may conflict with ${b.name} (v${b.version}).`,
          })
        }
      }
    }
  }

  // Check breaks & conflicts declared by existingEnabled against newSet
  for (const b of existingEnabled) {
    const compatB = getCompatibility(b)
    for (const [breakKey, range] of Object.entries(compatB.breaks)) {
      for (const a of newSet.values()) {
        if (a.id === b.id) continue
        if (matchesPackage(breakKey, range, a)) {
          pushIssue({
            code: 'broken-by-installed',
            severity: 'error',
            sourceId: b.id,
            targetId: a.id,
            targetName: b.name,
            requiredRange: range,
            foundVersion: a.version,
            message: `Installed package ${b.name} is incompatible with ${a.name} (v${a.version}).`,
          })
        }
      }
    }
    for (const [conflictKey, range] of Object.entries(compatB.conflicts)) {
      for (const a of newSet.values()) {
        if (a.id === b.id) continue
        if (matchesPackage(conflictKey, range, a)) {
          pushIssue({
            code: 'conflict',
            severity: 'warning',
            sourceId: b.id,
            targetId: a.id,
            targetName: b.name,
            requiredRange: range,
            foundVersion: a.version,
            message: `Installed package ${b.name} may conflict with ${a.name} (v${a.version}).`,
          })
        }
      }
    }
  }

  // Automatic exclusive `slot:*` collision detection
  const slotClaimants = new Map<string, SyntaxPackageManifest[]>()
  for (const pkg of finalActive) {
    for (const cap of getCompatibility(pkg).provides) {
      if (!cap.startsWith('slot:')) continue
      const list = slotClaimants.get(cap) ?? []
      list.push(pkg)
      slotClaimants.set(cap, list)
    }
  }
  for (const [slot, claimants] of slotClaimants) {
    if (claimants.length <= 1) continue
    if (!claimants.some(c => newSet.has(c.id))) continue
    const primary = claimants.find(c => newSet.has(c.id))!
    for (const other of claimants) {
      if (other.id === primary.id) continue
      pushIssue({
        code: 'conflict',
        severity: 'warning',
        sourceId: primary.id,
        targetId: other.id,
        targetName: other.name,
        message: `${primary.name} and ${other.name} both claim UI slot ${slot}. Only one can control that slot cleanly at a time.`,
      })
    }
  }

  // Cycle detection & topological load order
  const orderResult = computeLoadOrder(finalActive)
  if (!orderResult.ok) {
    for (const chain of orderResult.cycles) {
      if (chain.some(id => newSet.has(id))) {
        pushIssue({
          code: 'cycle',
          severity: 'error',
          sourceId: chain[0] ?? candidate.id,
          targetId: chain[1] ?? candidate.id,
          chain,
          message: `Circular dependency detected: ${chain.join(' -> ')}.`,
        })
      }
    }
  }

  // Recommendations
  const recommendations: CompatibilityReport['recommendations'] = []
  for (const [recId, range] of Object.entries(getCompatibility(candidate).recommends)) {
    const inst = installedById.get(recId)
    if (inst && inst.enabled && satisfiesRange(inst.manifest.version, range)) continue
    const available = pickBestProvider(recId, [range]) ?? undefined
    recommendations.push({ id: recId, range, available })
  }

  // Order installPlan dependency-first using loadOrder
  const rankById = new Map(orderResult.order.map((id, idx) => [id, idx]))
  const installPlan = [...installPlanMap.values()].sort(
    (a, b) => (rankById.get(a.id) ?? 999) - (rankById.get(b.id) ?? 999),
  )
  const enablePlan = [...enablePlanMap.values()].sort(
    (a, b) => (rankById.get(a.id) ?? 999) - (rankById.get(b.id) ?? 999),
  )

  const hasError = issues.some(i => i.severity === 'error')
  const hasWarning = issues.some(i => i.severity === 'warning')
  const needsAction = installPlan.length > 0 || enablePlan.length > 0

  const verdict: CompatibilityVerdict = hasError
    ? 'incompatible'
    : needsAction
      ? 'needs-deps'
      : hasWarning
        ? 'warning'
        : 'compatible'

  return {
    verdict,
    issues,
    installPlan,
    enablePlan,
    recommendations,
    loadOrder: orderResult.order,
  }
}

/**
 * Evaluates the live health of an ALREADY-installed package (used on PluginsPage rows so
 * silence = healthy, and only broken/conflicting/crashed plugins display calm inline tags).
 */
export function evaluateInstalledHealth(
  record: InstalledRecordLike,
  allRecords: readonly InstalledRecordLike[],
  host: HostVersions = {},
): InstalledHealthStatus {
  const issues: CompatibilityIssue[] = []
  const hostVersion = host.hostVersion ?? SYNTAX_HOST_VERSION
  const apiVersion = host.apiVersion ?? SYNTAX_API_VERSION
  const compat = getCompatibility(record.manifest)

  if (compat.depends.syntax && !satisfiesRange(hostVersion, compat.depends.syntax)) {
    issues.push({
      code: 'host-incompatible',
      severity: 'error',
      sourceId: record.manifest.id,
      targetId: 'syntax',
      requiredRange: compat.depends.syntax,
      foundVersion: hostVersion,
      message: `Requires Syntax ${compat.depends.syntax} (running v${hostVersion}).`,
    })
  }
  if (compat.depends['syntax-api'] && !satisfiesRange(apiVersion, compat.depends['syntax-api'])) {
    issues.push({
      code: 'host-incompatible',
      severity: 'error',
      sourceId: record.manifest.id,
      targetId: 'syntax-api',
      requiredRange: compat.depends['syntax-api'],
      foundVersion: apiVersion,
      message: `Requires Syntax API ${compat.depends['syntax-api']} (running v${apiVersion}).`,
    })
  }

  if (record.enabled) {
    // Check direct dependencies are installed, enabled, and in range
    for (const [depKey, range] of Object.entries(compat.depends)) {
      if (RESERVED_HOST_IDS.has(depKey)) continue
      const matchAny = allRecords.find(
        r =>
          (r.manifest.id === depKey || getCompatibility(r.manifest).provides.includes(depKey)) &&
          satisfiesRange(r.manifest.version, range),
      )
      if (!matchAny) {
        issues.push({
          code: 'missing-dep',
          severity: 'error',
          sourceId: record.manifest.id,
          targetId: depKey,
          requiredRange: range,
          message: `Missing required dependency ${depKey} (${range}).`,
        })
      } else if (!matchAny.enabled) {
        issues.push({
          code: 'disabled-dep',
          severity: 'warning',
          sourceId: record.manifest.id,
          targetId: matchAny.manifest.id,
          targetName: matchAny.manifest.name,
          message: `Requires ${matchAny.manifest.name} to be enabled.`,
        })
      }
    }

    // Check breaks & conflicts against other enabled records
    for (const other of allRecords) {
      if (!other.enabled || other.manifest.id === record.manifest.id) continue
      for (const [breakKey, range] of Object.entries(compat.breaks)) {
        if (matchesPackage(breakKey, range, other.manifest)) {
          issues.push({
            code: 'breaks-installed',
            severity: 'error',
            sourceId: record.manifest.id,
            targetId: other.manifest.id,
            targetName: other.manifest.name,
            message: `Incompatible with enabled plugin ${other.manifest.name}.`,
          })
        }
      }
      for (const [conflictKey, range] of Object.entries(compat.conflicts)) {
        if (matchesPackage(conflictKey, range, other.manifest)) {
          issues.push({
            code: 'conflict',
            severity: 'warning',
            sourceId: record.manifest.id,
            targetId: other.manifest.id,
            targetName: other.manifest.name,
            message: `May conflict with ${other.manifest.name}.`,
          })
        }
      }
      // Shared exclusive UI slot
      const otherSlots = getCompatibility(other.manifest).provides.filter(p => p.startsWith('slot:'))
      for (const slot of compat.provides.filter(p => p.startsWith('slot:'))) {
        if (otherSlots.includes(slot)) {
          issues.push({
            code: 'conflict',
            severity: 'warning',
            sourceId: record.manifest.id,
            targetId: other.manifest.id,
            targetName: other.manifest.name,
            message: `Shares UI slot ${slot} with ${other.manifest.name}.`,
          })
        }
      }
    }
  }

  const state: InstalledHealthStatus['state'] = issues.some(i => i.severity === 'error')
    ? 'error'
    : issues.some(i => i.severity === 'warning')
      ? 'warning'
      : 'healthy'

  return { state, issues }
}

/**
 * Computes transitive impact of disabling or uninstalling a package, respecting
 * alternative capability providers (`provides`).
 */
export function evaluateRemovalImpact(
  targetId: string,
  records: readonly InstalledRecordLike[],
  action: 'disable' | 'uninstall',
): RemovalImpact {
  const target = records.find(r => r.manifest.id === targetId)
  if (!target) {
    return {
      targetId,
      action,
      safe: true,
      affected: [],
      cascadeDisableIds: [],
      summary: 'Package is not installed.',
    }
  }

  const activeScope = action === 'disable' ? records.filter(r => r.enabled) : [...records]
  const removedIds = new Set<string>([targetId])
  const affected: DependentImpact[] = []
  const queue: Array<{ id: string; depth: number }> = [{ id: targetId, depth: 0 }]

  while (queue.length > 0) {
    const curr = queue.shift()!
    for (const candidate of activeScope) {
      if (removedIds.has(candidate.manifest.id)) continue
      const compat = getCompatibility(candidate.manifest)
      for (const [depKey, range] of Object.entries(compat.depends)) {
        if (RESERVED_HOST_IDS.has(depKey)) continue
        // Does any remaining non-removed package satisfy this dependency?
        const stillSatisfied = activeScope.some(
          other =>
            !removedIds.has(other.manifest.id) &&
            (other.manifest.id === depKey || getCompatibility(other.manifest).provides.includes(depKey)) &&
            satisfiesRange(other.manifest.version, range),
        )
        if (!stillSatisfied) {
          // Verify that it WAS satisfied before removing curr.id
          const wasSatisfiedByRemoved = activeScope.some(
            other =>
              removedIds.has(other.manifest.id) &&
              (other.manifest.id === depKey || getCompatibility(other.manifest).provides.includes(depKey)) &&
              satisfiesRange(other.manifest.version, range),
          )
          if (wasSatisfiedByRemoved) {
            removedIds.add(candidate.manifest.id)
            affected.push({
              id: candidate.manifest.id,
              name: candidate.manifest.name,
              kind: candidate.manifest.kind,
              depth: curr.depth + 1,
              via: depKey,
            })
            queue.push({ id: candidate.manifest.id, depth: curr.depth + 1 })
            break
          }
        }
      }
    }
  }

  const cascadeDisableIds = affected
    .filter(a => records.some(r => r.manifest.id === a.id && r.enabled))
    .sort((a, b) => b.depth - a.depth)
    .map(a => a.id)

  const verb = action === 'disable' ? 'Disabling' : 'Uninstalling'
  let summary = `Safe to ${action}. No installed courses or plugins depend on ${target.manifest.name}.`
  if (affected.length === 1) {
    const only = affected[0]!
    summary = `${verb} ${target.manifest.name} will affect ${only.name}.`
  } else if (affected.length > 1) {
    const courses = affected.filter(a => a.kind === 'course').length
    const others = affected.length - courses
    const parts: string[] = []
    if (courses > 0) parts.push(`${courses} ${courses === 1 ? 'course' : 'courses'}`)
    if (others > 0) parts.push(`${others} ${others === 1 ? 'plugin' : 'plugins'}`)
    summary = `${verb} ${target.manifest.name} will affect ${parts.join(' and ')} that depend on it.`
  }

  return {
    targetId,
    action,
    safe: affected.length === 0,
    affected,
    cascadeDisableIds,
    summary,
  }
}
