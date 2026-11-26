import { useMemo } from 'react'
import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import { OFFICIAL_BY_ID, OFFICIAL_CATALOG, RETIRED_OFFICIAL_IDS } from '../packages/catalog'
import { getSyntaxAccount } from './account'
import { type UnpackedSytx } from './archive'
import {
  computeLoadOrder,
  evaluateCompatibility,
  evaluateRemovalImpact,
  type CompatibilityReport,
  type RemovalImpact,
} from './compatibility'
import { syntaxLog } from './logger'
import {
  normalizeExternalManifest,
  stripManifestForStorage,
  validatePackageManifest,
  type SyntaxPackageManifest,
} from './packages'
import { deleteVaultArchive, putVaultArchive } from './packageVault'
import { clearPluginStorage, usePluginRuntimeStore } from './pluginRuntime'

export type InstalledPackageSource = 'official' | 'community' | 'local-file'

export type InstalledPackageRecord = {
  manifest: SyntaxPackageManifest
  enabled: boolean
  installedAt: string
  source: InstalledPackageSource
}

export type InstallResult =
  | {
      ok: true
      installedIds: string[]
      enabledIds: string[]
      record: InstalledPackageRecord
      report: CompatibilityReport
    }
  | { ok: false; needsSignIn: true; error: string }
  | { ok: false; needsSignIn?: false; error: string; report?: CompatibilityReport }

export type EnableResult =
  | { ok: true; impact?: RemovalImpact }
  | { ok: false; error: string; report?: CompatibilityReport }

const OFFICIAL_ID_SET = new Set(OFFICIAL_BY_ID.keys())
const STORAGE_KEY_V3 = 'syntax-registry-v3'
const LEGACY_STORAGE_KEY_V2 = 'syntax-registry-v2'

function createDefaultRecords(): InstalledPackageRecord[] {
  const now = new Date().toISOString()
  return OFFICIAL_CATALOG.map(manifest => ({
    manifest,
    enabled: true,
    installedAt: now,
    source: 'official' as const,
  }))
}

/**
 * One-time read from legacy `syntax-registry-v2` so upgrading users never lose
 * previously installed community packages or toggle states.
 */
function readLegacyV2State(): Partial<RegistryStoreState> | null {
  try {
    if (typeof localStorage === 'undefined') return null
    if (localStorage.getItem(STORAGE_KEY_V3)) return null
    const raw = localStorage.getItem(LEGACY_STORAGE_KEY_V2)
    if (!raw) return null
    const parsed = JSON.parse(raw) as { state?: Partial<RegistryStoreState> }
    return parsed?.state ?? null
  } catch {
    return null
  }
}

type RegistryStoreState = {
  records: InstalledPackageRecord[]
  dismissedOfficialIds: string[]
  installPackage: (
    manifest: SyntaxPackageManifest,
    options?: {
      source?: InstalledPackageSource
      catalogPool?: SyntaxPackageManifest[]
      skipSignInCheck?: boolean
      archive?: UnpackedSytx
    },
  ) => InstallResult
  setPackageEnabled: (
    id: string,
    enabled: boolean,
    options?: { cascade?: boolean; catalogPool?: SyntaxPackageManifest[] },
  ) => EnableResult
  uninstallPackage: (
    id: string,
    options?: { cascadeDisable?: boolean },
  ) => { ok: true } | { ok: false; error: string }
  resetOfficialDefaults: () => void
}

export const useRegistryStore = create<RegistryStoreState>()(
  persist(
    (set, get) => ({
      records: createDefaultRecords(),
      dismissedOfficialIds: [],

      installPackage: (rawManifest, options) => {
        const source = options?.source ?? 'community'
        // Local .sytx files can always be sideloaded/tested without Clerk login friction
        const requiresSignIn = source !== 'local-file' && !options?.skipSignInCheck
        if (requiresSignIn && !getSyntaxAccount()) {
          return {
            ok: false,
            needsSignIn: true,
            error: 'Sign in to your Syntax account to install courses and plugins from the Hub.',
          }
        }

        const check = validatePackageManifest(rawManifest)
        if (!check.ok) {
          return { ok: false, error: check.errors.join(' ') }
        }

        const isOfficial = OFFICIAL_ID_SET.has(check.manifest.id)
        if (source === 'local-file' && isOfficial) {
          return {
            ok: false,
            error: `Cannot sideload "${check.manifest.id}" because that ID is reserved for an official Syntax package.`,
          }
        }

        const manifest = isOfficial
          ? OFFICIAL_BY_ID.get(check.manifest.id)!
          : normalizeExternalManifest(check.manifest, OFFICIAL_ID_SET)

        const currentRecords = get().records
        const pool: SyntaxPackageManifest[] = [...OFFICIAL_CATALOG]
        for (const item of options?.catalogPool ?? []) {
          pool.push(
            OFFICIAL_ID_SET.has(item.id)
              ? OFFICIAL_BY_ID.get(item.id)!
              : normalizeExternalManifest(item, OFFICIAL_ID_SET),
          )
        }

        const report = evaluateCompatibility(manifest, currentRecords, pool)
        if (report.verdict === 'incompatible') {
          const firstErr =
            report.issues.find(i => i.severity === 'error')?.message ??
            'This package is incompatible with your current Syntax setup.'
          syntaxLog.warn('registry', `Blocked incompatible install for ${manifest.id}`, {
            issues: report.issues.map(i => `${i.code}:${i.targetId}`),
          })
          return { ok: false, error: firstErr, report }
        }

        const now = new Date().toISOString()
        const next = [...currentRecords]
        const installedIds: string[] = []
        const enabledIds: string[] = []

        const upsert = (
          item: SyntaxPackageManifest,
          itemSource: InstalledPackageSource,
          overrideSource = false,
        ) => {
          const idx = next.findIndex(r => r.manifest.id === item.id)
          const itemOfficial = OFFICIAL_ID_SET.has(item.id)
          const prevSource = idx >= 0 ? next[idx]!.source : itemSource
          const rec: InstalledPackageRecord = {
            manifest: itemOfficial ? OFFICIAL_BY_ID.get(item.id)! : item,
            enabled: true,
            installedAt: idx >= 0 ? next[idx]!.installedAt : now,
            source: itemOfficial ? 'official' : overrideSource ? itemSource : prevSource,
          }
          if (idx >= 0) next[idx] = rec
          else next.push(rec)
          installedIds.push(item.id)
          return rec
        }

        // 1. Install/upgrade required dependencies in topological order
        for (const depManifest of report.installPlan) {
          upsert(depManifest, OFFICIAL_ID_SET.has(depManifest.id) ? 'official' : 'community')
        }

        // 2. Re-enable disabled dependencies
        for (const depManifest of report.enablePlan) {
          const idx = next.findIndex(r => r.manifest.id === depManifest.id)
          if (idx >= 0 && !next[idx]!.enabled) {
            next[idx] = { ...next[idx]!, enabled: true }
            enabledIds.push(depManifest.id)
          }
        }

        // 3. Upsert target package
        const mainSource = isOfficial ? 'official' : source
        const mainRecord = upsert(manifest, mainSource, Boolean(options?.source))
        const touchedSet = new Set([...installedIds, ...enabledIds])

        set({
          records: next,
          dismissedOfficialIds: get().dismissedOfficialIds.filter(id => !touchedSet.has(id)),
        })

        // Store raw .sytx archive bytes in IndexedDB vault (non-blocking)
        if (options?.archive) {
          void putVaultArchive(options.archive)
        }
        usePluginRuntimeStore.getState().clearPluginHealth(manifest.id)

        syntaxLog.info('registry', `Installed ${manifest.name} (v${manifest.version})`, {
          id: manifest.id,
          source: mainSource,
          autoInstalledDeps: installedIds.filter(id => id !== manifest.id),
          autoEnabledDeps: enabledIds,
          warnings: report.issues.filter(i => i.severity === 'warning').length,
        })

        return { ok: true, installedIds, enabledIds, record: mainRecord, report }
      },

      setPackageEnabled: (id, enabled, options) => {
        const current = get().records
        const idx = current.findIndex(r => r.manifest.id === id)
        if (idx < 0) return { ok: false, error: 'Package is not installed.' }
        const target = current[idx]!
        if (target.enabled === enabled) return { ok: true }

        if (enabled) {
          // Verify enabling won't violate breaks or host/dep constraints
          const others = current.filter(r => r.manifest.id !== id)
          const report = evaluateCompatibility(
            target.manifest,
            others,
            options?.catalogPool ?? OFFICIAL_CATALOG,
          )
          const hardBlocker = report.issues.find(
            i =>
              i.severity === 'error' &&
              (i.code === 'host-incompatible' ||
                i.code === 'breaks-installed' ||
                i.code === 'broken-by-installed' ||
                i.code === 'cycle'),
          )
          if (hardBlocker) {
            return { ok: false, error: hardBlocker.message, report }
          }

          const next = [...current]
          next[idx] = { ...target, enabled: true }
          set({ records: next })
          usePluginRuntimeStore.getState().clearPluginHealth(id)
          syntaxLog.info('registry', `Enabled ${target.manifest.name}`, {
            id,
            kind: target.manifest.kind,
          })
          return { ok: true }
        }

        // Disabling: compute transitive impact and close active tool drawer if open
        const impact = evaluateRemovalImpact(id, current, 'disable')
        const toDisable = new Set<string>([id])
        if (options?.cascade) {
          for (const depId of impact.cascadeDisableIds) toDisable.add(depId)
        }

        const next = current.map(r => (toDisable.has(r.manifest.id) ? { ...r, enabled: false } : r))
        set({ records: next })
        for (const offId of toDisable) {
          usePluginRuntimeStore.getState().closeTool(offId)
        }

        syntaxLog.info('registry', `Disabled ${target.manifest.name}`, {
          id,
          kind: target.manifest.kind,
          cascaded: options?.cascade ? impact.cascadeDisableIds : [],
        })
        return { ok: true, impact }
      },

      uninstallPackage: (id, options) => {
        const current = get().records
        const target = current.find(r => r.manifest.id === id)
        if (!target) return { ok: false, error: 'Package is not installed.' }

        const impact = evaluateRemovalImpact(id, current, 'uninstall')
        const cascadeSet = new Set<string>(options?.cascadeDisable ? impact.cascadeDisableIds : [])

        const dismissed = new Set(get().dismissedOfficialIds)
        if (OFFICIAL_ID_SET.has(id)) {
          dismissed.add(id)
        }

        set({
          records: current
            .filter(r => r.manifest.id !== id)
            .map(r => (cascadeSet.has(r.manifest.id) ? { ...r, enabled: false } : r)),
          dismissedOfficialIds: [...dismissed],
        })

        // Full cleanup: close tool drawer, clear runtime health, wipe scoped storage & IDB archive
        usePluginRuntimeStore.getState().closeTool(id)
        usePluginRuntimeStore.getState().clearPluginHealth(id)
        clearPluginStorage(id)
        void deleteVaultArchive(id)

        syntaxLog.info('registry', `Uninstalled ${target.manifest.name}`, {
          id,
          kind: target.manifest.kind,
        })
        return { ok: true }
      },

      resetOfficialDefaults: () => {
        const custom = get().records.filter(
          r => !OFFICIAL_BY_ID.has(r.manifest.id) && !RETIRED_OFFICIAL_IDS.has(r.manifest.id),
        )
        set({ records: [...createDefaultRecords(), ...custom], dismissedOfficialIds: [] })
        syntaxLog.info('registry', 'Restored all official courses and plugins')
      },
    }),
    {
      name: STORAGE_KEY_V3,
      partialize: state => ({
        records: state.records.map(r => ({
          ...r,
          manifest: stripManifestForStorage(r.manifest),
        })),
        dismissedOfficialIds: state.dismissedOfficialIds,
      }),
      merge: (persisted, current) => {
        const saved = (persisted as Partial<RegistryStoreState> | undefined) ?? readLegacyV2State()
        if (!saved || !Array.isArray(saved.records)) return current
        const dismissed = new Set<string>(
          Array.isArray(saved.dismissedOfficialIds)
            ? saved.dismissedOfficialIds.filter((id): id is string => typeof id === 'string')
            : [],
        )
        const valid: InstalledPackageRecord[] = []
        const seen = new Set<string>()
        for (const rec of saved.records) {
          const check = validatePackageManifest(rec?.manifest)
          if (!check.ok) continue
          const id = check.manifest.id
          if (RETIRED_OFFICIAL_IDS.has(id) || seen.has(id)) continue
          seen.add(id)
          const official = OFFICIAL_BY_ID.get(id)
          const manifest = official
            ? official
            : normalizeExternalManifest(check.manifest, OFFICIAL_ID_SET)
          valid.push({
            manifest,
            enabled: Boolean(rec.enabled),
            installedAt:
              typeof rec.installedAt === 'string' ? rec.installedAt : new Date().toISOString(),
            source: official ? 'official' : (rec.source ?? 'community'),
          })
        }
        // Automatically merge newly shipped official packages unless explicitly uninstalled
        const now = new Date().toISOString()
        for (const official of OFFICIAL_CATALOG) {
          if (!seen.has(official.id) && !dismissed.has(official.id)) {
            valid.push({
              manifest: official,
              enabled: true,
              installedAt: now,
              source: 'official',
            })
            seen.add(official.id)
          }
        }
        return {
          ...current,
          records: valid.length > 0 ? valid : createDefaultRecords(),
          dismissedOfficialIds: [...dismissed],
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

export function useLoadOrder(): string[] {
  const records = useRegistryStore(s => s.records)
  return useMemo(() => {
    const active = records.filter(r => r.enabled).map(r => r.manifest)
    return computeLoadOrder(active).order
  }, [records])
}

export function useCourseCompatibility(
  courseId: string,
  catalogPool: readonly SyntaxPackageManifest[] = [],
): CompatibilityReport | null {
  const records = useRegistryStore(s => s.records)
  return useMemo(() => {
    const courseRecord = records.find(r => r.manifest.id === courseId)
    const manifest = courseRecord?.manifest ?? OFFICIAL_BY_ID.get(courseId)
    if (!manifest) return null
    return evaluateCompatibility(manifest, records, [...OFFICIAL_CATALOG, ...catalogPool])
  }, [records, courseId, catalogPool])
}

export function useRemovalImpact(id: string, action: 'disable' | 'uninstall'): RemovalImpact {
  const records = useRegistryStore(s => s.records)
  return useMemo(() => evaluateRemovalImpact(id, records, action), [id, records, action])
}

export function getDependentsOf(id: string): InstalledPackageRecord[] {
  const records = useRegistryStore.getState().records
  const impact = evaluateRemovalImpact(id, records, 'disable')
  const affectedSet = new Set(impact.affected.map(a => a.id))
  return records.filter(r => affectedSet.has(r.manifest.id))
}
