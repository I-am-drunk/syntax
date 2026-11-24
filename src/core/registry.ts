import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import { OFFICIAL_BY_ID, OFFICIAL_CATALOG } from '../packages/catalog'
import { getSyntaxAccount } from './account'
import { syntaxLog } from './logger'
import {
  compareSemver,
  sanitizeUntrustedManifest,
  validatePackageManifest,
  type PackageDependency,
  type SyntaxPackageManifest,
} from './packages'

export type InstalledPackageSource = 'official' | 'community' | 'local-file'

export type InstalledPackageRecord = {
  manifest: SyntaxPackageManifest
  enabled: boolean
  installedAt: string
  source: InstalledPackageSource
}

export type InstallResult =
  | { ok: true; installedIds: string[]; record: InstalledPackageRecord }
  | { ok: false; needsSignIn: true; error: string }
  | { ok: false; needsSignIn?: false; error: string; missingDependencies?: PackageDependency[] }

export type CourseDependencyStatus = {
  ok: boolean
  missing: PackageDependency[]
  disabled: SyntaxPackageManifest[]
}

const OFFICIAL_ID_SET = new Set(OFFICIAL_BY_ID.keys())

function createDefaultRecords(): InstalledPackageRecord[] {
  const now = new Date().toISOString()
  return OFFICIAL_CATALOG.map(manifest => ({
    manifest,
    enabled: true,
    installedAt: now,
    source: 'official' as const,
  }))
}

type RegistryStoreState = {
  records: InstalledPackageRecord[]
  installPackage: (
    manifest: SyntaxPackageManifest,
    options?: {
      source?: InstalledPackageSource
      catalogPool?: SyntaxPackageManifest[]
      skipSignInCheck?: boolean
    },
  ) => InstallResult
  setPackageEnabled: (id: string, enabled: boolean) => void
  uninstallPackage: (id: string) => { ok: true } | { ok: false; error: string }
  resetOfficialDefaults: () => void
}

export const useRegistryStore = create<RegistryStoreState>()(
  persist(
    (set, get) => ({
      records: createDefaultRecords(),

      installPackage: (rawManifest, options) => {
        if (!options?.skipSignInCheck && !getSyntaxAccount()) {
          return {
            ok: false,
            needsSignIn: true,
            error: 'Sign in to your Syntax account to install courses and plugins.',
          }
        }

        const check = validatePackageManifest(rawManifest)
        if (!check.ok) {
          return { ok: false, error: check.errors.join(' ') }
        }

        const isOfficial = OFFICIAL_ID_SET.has(check.manifest.id)
        const manifest = isOfficial
          ? OFFICIAL_BY_ID.get(check.manifest.id)!
          : sanitizeUntrustedManifest(check.manifest, OFFICIAL_ID_SET, {
              isLocalFile: options?.source === 'local-file',
            })

        const currentRecords = get().records
        const pool = new Map<string, SyntaxPackageManifest>()
        for (const item of OFFICIAL_CATALOG) pool.set(item.id, item)
        for (const item of options?.catalogPool ?? []) {
          pool.set(
            item.id,
            OFFICIAL_ID_SET.has(item.id)
              ? OFFICIAL_BY_ID.get(item.id)!
              : sanitizeUntrustedManifest(item, OFFICIAL_ID_SET),
          )
        }
        pool.set(manifest.id, manifest)

        const toInstall: SyntaxPackageManifest[] = []
        const missingDeps: PackageDependency[] = []

        for (const dep of manifest.requires ?? []) {
          const existing = currentRecords.find(r => r.manifest.id === dep.id)
          if (
            existing &&
            existing.manifest.kind === dep.kind &&
            compareSemver(existing.manifest.version, dep.minVersion) >= 0
          ) {
            if (!existing.enabled) {
              toInstall.push(existing.manifest)
            }
            continue
          }
          const candidate = pool.get(dep.id)
          if (
            candidate &&
            candidate.kind === dep.kind &&
            compareSemver(candidate.version, dep.minVersion) >= 0
          ) {
            toInstall.push(candidate)
          } else {
            missingDeps.push(dep)
          }
        }

        if (missingDeps.length > 0) {
          syntaxLog.warn('registry', `Missing required dependencies for ${manifest.id}`, {
            missing: missingDeps.map(d => `${d.id}@>=${d.minVersion}`),
          })
          return {
            ok: false,
            error: `Missing required embedded plugin: ${missingDeps.map(d => `${d.name} (v${d.minVersion}+)`).join(', ')}.`,
            missingDependencies: missingDeps,
          }
        }

        const now = new Date().toISOString()
        const next = [...currentRecords]
        const installedIds: string[] = []

        const upsert = (item: SyntaxPackageManifest, source: InstalledPackageSource) => {
          const idx = next.findIndex(r => r.manifest.id === item.id)
          const itemOfficial = OFFICIAL_ID_SET.has(item.id)
          const rec: InstalledPackageRecord = {
            manifest: itemOfficial ? OFFICIAL_BY_ID.get(item.id)! : item,
            enabled: true,
            installedAt: idx >= 0 ? next[idx].installedAt : now,
            source: itemOfficial ? 'official' : source,
          }
          if (idx >= 0) next[idx] = rec
          else next.push(rec)
          installedIds.push(item.id)
          return rec
        }

        for (const depManifest of toInstall) {
          upsert(depManifest, OFFICIAL_ID_SET.has(depManifest.id) ? 'official' : 'community')
        }

        const mainSource = isOfficial ? 'official' : (options?.source ?? 'community')
        const mainRecord = upsert(manifest, mainSource)

        set({ records: next })
        syntaxLog.info('registry', `Installed ${manifest.name} (${manifest.extension})`, {
          id: manifest.id,
          version: manifest.version,
          touchesCore: manifest.touchesCore,
          autoInstalledDeps: installedIds.filter(id => id !== manifest.id),
        })

        return { ok: true, installedIds, record: mainRecord }
      },

      setPackageEnabled: (id, enabled) => {
        const current = get().records
        const idx = current.findIndex(r => r.manifest.id === id)
        if (idx < 0 || current[idx].enabled === enabled) return
        const next = [...current]
        next[idx] = { ...current[idx], enabled }
        set({ records: next })
        syntaxLog.info('registry', `${enabled ? 'Enabled' : 'Disabled'} ${current[idx].manifest.name}`, {
          id,
          kind: current[idx].manifest.kind,
        })
      },

      uninstallPackage: id => {
        const current = get().records
        const target = current.find(r => r.manifest.id === id)
        if (!target) return { ok: false, error: 'Package is not installed.' }
        set({ records: current.filter(r => r.manifest.id !== id) })
        syntaxLog.info('registry', `Uninstalled ${target.manifest.name}`, {
          id,
          kind: target.manifest.kind,
        })
        return { ok: true }
      },

      resetOfficialDefaults: () => {
        const custom = get().records.filter(r => !OFFICIAL_BY_ID.has(r.manifest.id))
        set({ records: [...createDefaultRecords(), ...custom] })
        syntaxLog.info('registry', 'Restored all official courses and plugins')
      },
    }),
    {
      name: 'syntax-registry-v2',
      merge: (persisted, current) => {
        const saved = persisted as Partial<RegistryStoreState> | undefined
        if (!saved || !Array.isArray(saved.records)) return current
        const valid: InstalledPackageRecord[] = []
        for (const rec of saved.records) {
          const check = validatePackageManifest(rec?.manifest)
          if (check.ok) {
            const official = OFFICIAL_BY_ID.get(check.manifest.id)
            const manifest = official
              ? official
              : sanitizeUntrustedManifest(check.manifest, OFFICIAL_ID_SET, {
                  isLocalFile: rec.source === 'local-file',
                })
            valid.push({
              manifest,
              enabled: Boolean(rec.enabled),
              installedAt:
                typeof rec.installedAt === 'string' ? rec.installedAt : new Date().toISOString(),
              source: official ? 'official' : (rec.source ?? 'community'),
            })
          }
        }
        return {
          ...current,
          records: valid.length > 0 ? valid : createDefaultRecords(),
        }
      },
    },
  ),
)

export function useInstalledPackages(): InstalledPackageRecord[] {
  return useRegistryStore(s => s.records)
}

export function useIsPackageInstalled(id: string): boolean {
  return useRegistryStore(s => s.records.some(r => r.manifest.id === id))
}

export function usePluginActive(id: string): boolean {
  return useRegistryStore(s => {
    const rec = s.records.find(r => r.manifest.id === id)
    return Boolean(rec && rec.enabled)
  })
}

export function installPackage(
  manifest: SyntaxPackageManifest,
  options?: {
    source?: InstalledPackageSource
    catalogPool?: SyntaxPackageManifest[]
    skipSignInCheck?: boolean
  },
): InstallResult {
  return useRegistryStore.getState().installPackage(manifest, options)
}

export function setPackageEnabled(id: string, enabled: boolean) {
  useRegistryStore.getState().setPackageEnabled(id, enabled)
}

export function uninstallPackage(id: string) {
  return useRegistryStore.getState().uninstallPackage(id)
}

export function resetOfficialDefaults() {
  useRegistryStore.getState().resetOfficialDefaults()
}

export function getDependentsOf(id: string): InstalledPackageRecord[] {
  return useRegistryStore
    .getState()
    .records.filter(
      r => r.manifest.id !== id && (r.manifest.requires ?? []).some(dep => dep.id === id),
    )
}

export function getCourseDependencyStatus(courseId: string): CourseDependencyStatus {
  const records = useRegistryStore.getState().records
  const courseRecord = records.find(r => r.manifest.id === courseId)
  const manifest = courseRecord?.manifest ?? OFFICIAL_BY_ID.get(courseId)
  if (!manifest || !manifest.requires || manifest.requires.length === 0) {
    return { ok: true, missing: [], disabled: [] }
  }

  const missing: PackageDependency[] = []
  const disabled: SyntaxPackageManifest[] = []

  for (const dep of manifest.requires) {
    const installed = records.find(r => r.manifest.id === dep.id)
    if (
      !installed ||
      installed.manifest.kind !== dep.kind ||
      compareSemver(installed.manifest.version, dep.minVersion) < 0
    ) {
      missing.push(dep)
    } else if (!installed.enabled) {
      disabled.push(installed.manifest)
    }
  }

  return {
    ok: missing.length === 0 && disabled.length === 0,
    missing,
    disabled,
  }
}
