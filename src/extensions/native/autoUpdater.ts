import { compareSemver, satisfiesSemver } from '../manifest.ts'
import type { NativeHost } from './host.ts'
import { NATIVE_EXTENSION_API_VERSION, NativePackageError } from './manifest.ts'
import type { NativeInstall } from './repository.ts'

export interface NativeUpdateCandidate {
  id: string
  version: string
  manifestUrl: string
  syntaxApi?: string
  sha256?: string
}

export interface NativeAutoUpdateReport {
  updated: { id: string; name: string; fromVersion: string; toVersion: string }[]
  rejected: { id: string; version: string; reason: string }[]
}

export interface NativeAutoUpdateOptions {
  host: Pick<NativeHost, 'reconcile' | 'inspect' | 'installInspected'>
  candidates: readonly NativeUpdateCandidate[]
  rejectedKeys?: Set<string>
  sameSourceOnly?: boolean
  onUpdated?: (entry: { id: string; name: string; fromVersion: string; toVersion: string }) => void
  onRejected?: (entry: { id: string; version: string; reason: string }) => void
}

function candidateKey(candidate: NativeUpdateCandidate): string {
  return `${candidate.id}@${candidate.version}:${candidate.sha256 ?? candidate.manifestUrl}`
}

function pickBestCandidate(
  install: NativeInstall,
  candidates: readonly NativeUpdateCandidate[],
  rejectedKeys: Set<string>,
  sameSourceOnly: boolean,
): NativeUpdateCandidate | undefined {
  const id = install.package.manifest.id
  const currentVersion = install.package.manifest.version
  const compatible = candidates.filter(candidate => {
    if (candidate.id !== id) return false
    if (sameSourceOnly && candidate.manifestUrl !== install.package.sourceUrl) return false
    if (compareSemver(candidate.version, currentVersion) <= 0) return false
    if (candidate.syntaxApi && !satisfiesSemver(NATIVE_EXTENSION_API_VERSION, candidate.syntaxApi)) {
      return false
    }
    if (install.failedSha256 && candidate.sha256 && install.failedSha256 === candidate.sha256) {
      return false
    }
    if (rejectedKeys.has(candidateKey(candidate))) return false
    return true
  })
  if (compatible.length === 0) return undefined
  compatible.sort((a, b) => compareSemver(b.version, a.version))
  return compatible[0]
}

/**
 * Temporary alpha auto-updater (PUB-02).
 * Automatically installs strictly newer, compatible native releases after full
 * manifest/SHA-256 verification and staged activation. A rejected build leaves
 * the currently working install active and usable.
 */
export async function checkAndApplyNativeUpdates(
  options: NativeAutoUpdateOptions,
): Promise<NativeAutoUpdateReport> {
  const { host, candidates, onUpdated, onRejected } = options
  const rejectedKeys = options.rejectedKeys ?? new Set<string>()
  const installs = await host.reconcile()
  const report: NativeAutoUpdateReport = { updated: [], rejected: [] }

  for (const install of installs) {
    if (!install.enabled) continue
    const candidate = pickBestCandidate(install, candidates, rejectedKeys, options.sameSourceOnly ?? false)
    if (!candidate) continue
    const key = candidateKey(candidate)
    try {
      const inspected = await host.inspect(candidate.manifestUrl)
      if (inspected.manifest.id !== install.package.manifest.id) {
        throw new Error(`Candidate manifest ID ${inspected.manifest.id} does not match ${install.package.manifest.id}.`)
      }
      if (inspected.manifest.version !== candidate.version ||
        (candidate.sha256 && inspected.manifest.sha256 !== candidate.sha256)) {
        throw new Error('The downloaded package does not match the listed release.')
      }
      if (install.failedSha256 && inspected.manifest.sha256 === install.failedSha256) {
        rejectedKeys.add(key)
        continue
      }
      await host.installInspected(inspected, install.revision)
      const entry = {
        id: inspected.manifest.id,
        name: inspected.manifest.name,
        fromVersion: install.package.manifest.version,
        toVersion: inspected.manifest.version,
      }
      report.updated.push(entry)
      onUpdated?.(entry)
    } catch (error) {
      if (error instanceof NativePackageError && error.code === 'INSTALL_CHANGED') continue
      rejectedKeys.add(key)
      const reason = error instanceof Error ? error.message : String(error)
      const entry = { id: candidate.id, version: candidate.version, reason }
      report.rejected.push(entry)
      onRejected?.(entry)
    }
  }

  return report
}
