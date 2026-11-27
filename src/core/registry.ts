import { useMemo } from 'react'
import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import { OFFICIAL_BY_ID, OFFICIAL_CATALOG, RETIRED_OFFICIAL_IDS } from '../packages/catalog'
import { getSyntaxAccount } from './account'
import { syntaxLog } from './logger'
import {
  compareSemver,
  normalizeExternalManifest,
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
  dismissedOfficialIds: string[]
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
      dismissedOfficialIds: [],

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

        if (RETIRED_OFFICIAL_IDS.has(check.manifest.id)) {
          return {
            ok: false,
            error: `Package ID "${check.manifest.id}" is retired and cannot be installed.`,
          }
        }

        const isOfficial = OFFICIAL_ID_SET.has(check.manifest.id)
        const manifest = isOfficial
          ? OFFICIAL_BY_ID.get(check.manifest.id)!
          : normalizeExternalManifest(check.manifest, OFFICIAL_ID_SET)

        const currentRecords = get().records
        const pool = new Map<string, SyntaxPackageManifest>()
        for (const item of OFFICIAL_CATALOG) pool.set(item.id, item)
        for (const item of options?.catalogPool ?? []) {
          if (RETIRED_OFFICIAL_IDS.has(item.id)) continue
          pool.set(
            item.id,
            OFFICIAL_ID_SET.has(item.id)
              ? OFFICIAL_BY_ID.get(item.id)!
              : normalizeExternalManifest(item, OFFICIAL_ID_SET),
          )
        }
        pool.set(manifest.id, manifest)

        // Transitive BFS dependency resolution with strict kind + minVersion tracking & cycle guard
        const toInstall = new Map<string, SyntaxPackageManifest>()
        const missingById = new Map<string, PackageDependency>()
        const requiredById = new Map<
          string,
          { kind: PackageDependency['kind']; minVersion: string }
        >()
        const conflictedIds = new Set<string>()
        const expandedIds = new Set<string>([manifest.id])
        const queue: PackageDependency[] = [...(manifest.requires ?? [])]

        while (queue.length > 0) {
          const dep = queue.shift()!

          if (RETIRED_OFFICIAL_IDS.has(dep.id)) {
            missingById.set(dep.id, dep)
            toInstall.delete(dep.id)
            continue
          }

          const prevReq = requiredById.get(dep.id)
          if (prevReq) {
            if (prevReq.kind !== dep.kind) {
              conflictedIds.add(dep.id)
              missingById.set(dep.id, dep)
              toInstall.delete(dep.id)
              continue
            }
            if (compareSemver(dep.minVersion, prevReq.minVersion) <= 0) {
              continue
            }
          }
          if (conflictedIds.has(dep.id)) continue
          requiredById.set(dep.id, { kind: dep.kind, minVersion: dep.minVersion })

          if (dep.id === manifest.id) {
            if (
              manifest.kind !== dep.kind ||
              compareSemver(manifest.version, dep.minVersion) < 0
            ) {
              missingById.set(dep.id, dep)
            }
            continue
          }

          const existing = currentRecords.find(r => r.manifest.id === dep.id)
          if (existing && existing.manifest.kind !== dep.kind) {
            conflictedIds.add(dep.id)
            missingById.set(dep.id, dep)
            toInstall.delete(dep.id)
            continue
          }

          const poolCandidate = pool.get(dep.id)

          const validPool =
            poolCandidate &&
            poolCandidate.kind === dep.kind &&
            compareSemver(poolCandidate.version, dep.minVersion) >= 0
              ? poolCandidate
              : null
          const validExisting =
            existing &&
            existing.manifest.kind === dep.kind &&
            compareSemver(existing.manifest.version, dep.minVersion) >= 0
              ? existing.manifest
              : null

          // Never downgrade a newer already-installed version
          let bestAvailable: SyntaxPackageManifest | null = null
          if (validPool && validExisting) {
            bestAvailable =
              compareSemver(validPool.version, validExisting.version) > 0
                ? validPool
                : validExisting
          } else {
            bestAvailable = validPool ?? validExisting
          }

          if (!bestAvailable) {
            missingById.set(dep.id, dep)
            toInstall.delete(dep.id)
            continue
          }

          missingById.delete(dep.id)

          const needsInstallOrEnable =
            !validExisting ||
            !existing!.enabled ||
            compareSemver(bestAvailable.version, validExisting.version) > 0

          if (needsInstallOrEnable) {
            toInstall.set(bestAvailable.id, bestAvailable)
          }

          if (!expandedIds.has(bestAvailable.id)) {
            expandedIds.add(bestAvailable.id)
            for (const nested of bestAvailable.requires ?? []) {
              queue.push(nested)
            }
          }
        }

        const missingDeps = [...missingById.values()]
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

        const upsert = (
          item: SyntaxPackageManifest,
          source: InstalledPackageSource,
          overrideSource = false,
        ) => {
          const idx = next.findIndex(r => r.manifest.id === item.id)
          const itemOfficial = OFFICIAL_ID_SET.has(item.id)
          const prevSource = idx >= 0 ? next[idx].source : source
          const rec: InstalledPackageRecord = {
            manifest: itemOfficial ? OFFICIAL_BY_ID.get(item.id)! : item,
            enabled: true,
            installedAt: idx >= 0 ? next[idx].installedAt : now,
            source: itemOfficial ? 'official' : overrideSource ? source : prevSource,
          }
          if (idx >= 0) next[idx] = rec
          else next.push(rec)
          installedIds.push(item.id)
          return rec
        }

        for (const depManifest of toInstall.values()) {
          upsert(depManifest, OFFICIAL_ID_SET.has(depManifest.id) ? 'official' : 'community')
        }

        const mainSource = isOfficial ? 'official' : (options?.source ?? 'community')
        const mainRecord = upsert(manifest, mainSource, Boolean(options?.source))
        const installedSet = new Set(installedIds)

        set({
          records: next,
          dismissedOfficialIds: get().dismissedOfficialIds.filter(id => !installedSet.has(id)),
        })
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
        syntaxLog.info(
          'registry',
          `${enabled ? 'Enabled' : 'Disabled'} ${current[idx].manifest.name}`,
          { id, kind: current[idx].manifest.kind },
        )
      },

      uninstallPackage: id => {
        const current = get().records
        const target = current.find(r => r.manifest.id === id)
        if (!target) return { ok: false, error: 'Package is not installed.' }
        const dismissed = new Set(get().dismissedOfficialIds)
        if (OFFICIAL_ID_SET.has(id)) {
          dismissed.add(id)
        }
        set({
          records: current.filter(r => r.manifest.id !== id),
          dismissedOfficialIds: [...dismissed],
        })
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
      name: 'syntax-registry-v2',
      merge: (persisted, current) => {
        const saved = persisted as Partial<RegistryStoreState> | undefined
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

export function computeCourseDependencyStatus(
  records: InstalledPackageRecord[],
  courseId: string,
): CourseDependencyStatus {
  const courseRecord = records.find(r => r.manifest.id === courseId)
  const manifest = courseRecord?.manifest ?? OFFICIAL_BY_ID.get(courseId)
  if (!manifest || !manifest.requires || manifest.requires.length === 0) {
    return { ok: true, missing: [], disabled: [] }
  }

  const missingById = new Map<string, PackageDependency>()
  const disabledById = new Map<string, SyntaxPackageManifest>()
  const requiredById = new Map<string, { kind: PackageDependency['kind']; minVersion: string }>()
  const conflictedIds = new Set<string>()
  const expandedIds = new Set<string>([manifest.id])
  const queue: PackageDependency[] = [...manifest.requires]

  while (queue.length > 0) {
    const dep = queue.shift()!
    const prevReq = requiredById.get(dep.id)
    if (prevReq) {
      if (prevReq.kind !== dep.kind) {
        conflictedIds.add(dep.id)
        missingById.set(dep.id, dep)
        disabledById.delete(dep.id)
        continue
      }
      if (compareSemver(dep.minVersion, prevReq.minVersion) <= 0) {
        continue
      }
    }
    if (conflictedIds.has(dep.id)) continue
    requiredById.set(dep.id, { kind: dep.kind, minVersion: dep.minVersion })

    if (dep.id === manifest.id) {
      if (
        manifest.kind !== dep.kind ||
        compareSemver(manifest.version, dep.minVersion) < 0
      ) {
        missingById.set(dep.id, dep)
      }
      continue
    }

    const installed = records.find(r => r.manifest.id === dep.id)
    if (
      !installed ||
      installed.manifest.kind !== dep.kind ||
      compareSemver(installed.manifest.version, dep.minVersion) < 0
    ) {
      missingById.set(dep.id, dep)
      disabledById.delete(dep.id)
      continue
    }

    missingById.delete(dep.id)
    if (!installed.enabled) {
      disabledById.set(dep.id, installed.manifest)
    }

    if (!expandedIds.has(installed.manifest.id)) {
      expandedIds.add(installed.manifest.id)
      for (const nested of installed.manifest.requires ?? []) {
        queue.push(nested)
      }
    }
  }

  const missing = [...missingById.values()]
  const disabled = [...disabledById.values()]

  return {
    ok: missing.length === 0 && disabled.length === 0,
    missing,
    disabled,
  }
}

export function useCourseDependencyStatus(courseId: string): CourseDependencyStatus {
  const records = useRegistryStore(s => s.records)
  return useMemo(() => computeCourseDependencyStatus(records, courseId), [records, courseId])
}

export function getCourseDependencyStatus(courseId: string): CourseDependencyStatus {
  return computeCourseDependencyStatus(useRegistryStore.getState().records, courseId)
}

export function useDependentsOf(id: string): InstalledPackageRecord[] {
  const records = useRegistryStore(s => s.records)
  return useMemo(
    () =>
      records.filter(
        r => r.manifest.id !== id && (r.manifest.requires ?? []).some(dep => dep.id === id),
      ),
    [records, id],
  )
}

export function getDependentsOf(id: string): InstalledPackageRecord[] {
  return useRegistryStore
    .getState()
    .records.filter(
      r => r.manifest.id !== id && (r.manifest.requires ?? []).some(dep => dep.id === id),
    )
}
