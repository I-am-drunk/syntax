import { create } from 'zustand'
import { z } from 'zod'
import { loadPrefs, savePrefs, type SyntaxPrefs } from '../mpm2d/storage'
import { LOCAL_CS_PROGRESS_KEY, CS_PROGRESS_EVENT, readLocalProgressStore } from '../services/progress'
import { useRegistryStore } from './registry'
import { useThemePackStore } from './themePacks'
import { syntaxLog } from './logger'

const MPM2D_PROGRESS_KEY = 'mpm2d-brilliant-progress-v1'
const THEME_KEY = 'mpm2d-brilliant-theme-v1'
const SOUND_KEY = 'mpm2d-brilliant-sound-v1'
const PINNED_KEY = 'syntax.library.pinned.v1'
const CUSTOM_PROGRESS_KEY = 'syntax.custom.progress.v1'

export const CLOUD_SYNC_APPLIED_EVENT = 'syntax:cloud-sync-applied'

const Mpm2dStatSchema = z.object({
  correct: z.number().int().min(0),
  total: z.number().int().min(0),
})

/**
 * Compact schema stored inside Clerk `user.unsafeMetadata.syntaxCloudV1`.
 * Strictly kept well under Clerk's 8 KB unsafeMetadata ceiling.
 */
export const SyntaxCloudPayloadSchema = z.object({
  v: z.literal(1),
  updatedAt: z.string(),
  theme: z.enum(['light', 'dark']).optional(),
  themePackId: z.string().max(64).optional(),
  soundOn: z.boolean().optional(),
  prefs: z
    .object({
      showCatchupPaths: z.boolean().optional(),
      onboarded: z.boolean().optional(),
      voiceOn: z.boolean().optional(),
      penControlsCollapsed: z.boolean().optional(),
      showStepPlan: z.boolean().optional(),
      windowInertia: z.boolean().optional(),
      logoClickTarget: z.enum(['library', 'home']).optional(),
      semaShape: z.string().max(32).optional(),
      semaTail: z.string().max(32).optional(),
      semaExpression: z.string().max(32).optional(),
    })
    .optional(),
  pinnedCourses: z.array(z.string().max(64)).max(32).optional(),
  disabledPackages: z.array(z.string().max(64)).max(48).optional(),
  mpm2dCompleted: z.record(z.string().max(64), Mpm2dStatSchema).optional(),
  csCompletedSlugs: z.array(z.string().max(96)).max(64).optional(),
  customCompleted: z.record(z.string().max(64), z.array(z.string().max(64)).max(64)).optional(),
})

export type SyntaxCloudPayload = z.infer<typeof SyntaxCloudPayloadSchema>

export type CloudSyncStatus = 'local-only' | 'idle' | 'syncing' | 'synced' | 'error'

interface CloudSyncState {
  status: CloudSyncStatus
  lastSyncedAt: string | null
  lastError: string | null
  syncedSummary: {
    mpm2dLessons: number
    csLessons: number
    pinnedCourses: number
  }
  setSyncState: (patch: Partial<Omit<CloudSyncState, 'setSyncState'>>) => void
}

export const useCloudSyncStore = create<CloudSyncState>(set => ({
  status: 'local-only',
  lastSyncedAt: null,
  lastError: null,
  syncedSummary: { mpm2dLessons: 0, csLessons: 0, pinnedCourses: 0 },
  setSyncState: patch => set(patch),
}))

function safeReadJson<T>(key: string, fallback: T): T {
  try {
    const raw = localStorage.getItem(key)
    if (!raw) return fallback
    return JSON.parse(raw) as T
  } catch {
    return fallback
  }
}

export function collectLocalCloudSnapshot(): SyntaxCloudPayload {
  const prefs = loadPrefs()
  const rawTheme = (() => {
    try {
      const t = localStorage.getItem(THEME_KEY)
      return t === 'light' || t === 'dark' ? t : undefined
    } catch {
      return undefined
    }
  })()
  const soundOn = (() => {
    try {
      const s = localStorage.getItem(SOUND_KEY)
      return s === null ? undefined : s !== 'false'
    } catch {
      return undefined
    }
  })()

  const pinned = safeReadJson<unknown>(PINNED_KEY, [])
  const pinnedCourses = Array.isArray(pinned)
    ? pinned.filter((x): x is string => typeof x === 'string').slice(0, 32)
    : []

  const mpm2dRaw = safeReadJson<{ completed?: Record<string, { correct: number; total: number }> }>(
    MPM2D_PROGRESS_KEY,
    {},
  )
  const mpm2dCompleted: Record<string, { correct: number; total: number }> = {}
  if (mpm2dRaw.completed && typeof mpm2dRaw.completed === 'object') {
    for (const [k, v] of Object.entries(mpm2dRaw.completed)) {
      if (v && typeof v.correct === 'number' && typeof v.total === 'number') {
        mpm2dCompleted[k] = {
          correct: Math.max(0, Math.floor(v.correct)),
          total: Math.max(0, Math.floor(v.total)),
        }
      }
    }
  }

  const csStore = readLocalProgressStore()
  const csSlugSet = new Set<string>()
  for (const snap of Object.values(csStore)) {
    if (!snap || !Array.isArray(snap.contents)) continue
    for (const item of snap.contents) {
      if (item.completed && typeof item.slug === 'string') {
        csSlugSet.add(item.slug)
      }
    }
  }

  const customRaw = safeReadJson<Record<string, unknown>>(CUSTOM_PROGRESS_KEY, {})
  const customCompleted: Record<string, string[]> = {}
  if (customRaw && typeof customRaw === 'object' && !Array.isArray(customRaw)) {
    for (const [cid, list] of Object.entries(customRaw)) {
      if (Array.isArray(list)) {
        const clean = list.filter((x): x is string => typeof x === 'string').slice(0, 64)
        if (clean.length > 0) customCompleted[cid] = clean
      }
    }
  }

  const disabledPackages = useRegistryStore
    .getState()
    .records.filter(r => !r.enabled)
    .map(r => r.manifest.id)
    .slice(0, 48)

  const activeThemeId = useThemePackStore.getState().activeThemeId

  return {
    v: 1,
    updatedAt: new Date().toISOString(),
    theme: rawTheme,
    themePackId: activeThemeId,
    soundOn,
    prefs: {
      showCatchupPaths: prefs.showCatchupPaths,
      onboarded: prefs.onboarded,
      voiceOn: prefs.voiceOn,
      penControlsCollapsed: prefs.penControlsCollapsed,
      showStepPlan: prefs.showStepPlan,
      windowInertia: prefs.windowInertia,
      logoClickTarget: prefs.logoClickTarget,
      semaShape: prefs.semaShape,
      semaTail: prefs.semaTail,
      semaExpression: prefs.semaExpression,
    },
    pinnedCourses,
    disabledPackages,
    mpm2dCompleted,
    csCompletedSlugs: [...csSlugSet].slice(0, 64),
    customCompleted,
  }
}

/**
 * Monotonic merge so signing in on a new device never erases completed lessons
 * or lowers a learner's best score.
 */
export function mergeCloudIntoLocal(remote: SyntaxCloudPayload): SyntaxCloudPayload {
  const local = collectLocalCloudSnapshot()

  // 1. Merge MPM2D completed lessons monotonically (keep highest correct/total)
  const mergedMpm2d: Record<string, { correct: number; total: number }> = {
    ...(local.mpm2dCompleted ?? {}),
  }
  for (const [id, rStat] of Object.entries(remote.mpm2dCompleted ?? {})) {
    const lStat = mergedMpm2d[id]
    if (!lStat) {
      mergedMpm2d[id] = rStat
    } else {
      mergedMpm2d[id] = {
        correct: Math.max(lStat.correct, rStat.correct),
        total: Math.max(lStat.total, rStat.total),
      }
    }
  }
  try {
    const prevRaw = safeReadJson<{ completed?: Record<string, unknown>; missedCheckIds?: unknown[] }>(
      MPM2D_PROGRESS_KEY,
      {},
    )
    localStorage.setItem(
      MPM2D_PROGRESS_KEY,
      JSON.stringify({
        ...prevRaw,
        completed: mergedMpm2d,
      }),
    )
  } catch {
    // ignore quota errors
  }

  // 2. Merge Thinking in Code completed slugs monotonically
  const mergedCsSlugs = new Set<string>([
    ...(local.csCompletedSlugs ?? []),
    ...(remote.csCompletedSlugs ?? []),
  ])
  if ((remote.csCompletedSlugs ?? []).length > 0) {
    try {
      const store = readLocalProgressStore()
      const existingCompleted = new Set<string>()
      for (const snap of Object.values(store)) {
        for (const item of snap?.contents ?? []) {
          if (item.completed) existingCompleted.add(item.slug)
        }
      }
      const missingFromLocal = [...mergedCsSlugs].filter(slug => !existingCompleted.has(slug))
      if (missingFromLocal.length > 0) {
        const cloudKey = 'clerk-cloud-sync-tic'
        const prevCloud = store[cloudKey]
        const mergedContents = [
          ...(prevCloud?.contents ?? []).filter(c => !missingFromLocal.includes(c.slug)),
          ...missingFromLocal.map(slug => ({
            courseSlug: 'thinking-in-code',
            slug,
            version: '1',
            completed: true,
          })),
        ]
        store[cloudKey] = {
          id: cloudKey,
          contents: mergedContents,
        } as (typeof store)[string]
        localStorage.setItem(LOCAL_CS_PROGRESS_KEY, JSON.stringify(store))
        window.dispatchEvent(new CustomEvent(CS_PROGRESS_EVENT))
      }
    } catch {
      // ignore
    }
  }

  // 3. Merge custom declarative course completions monotonically
  const mergedCustom: Record<string, string[]> = { ...(local.customCompleted ?? {}) }
  for (const [cid, list] of Object.entries(remote.customCompleted ?? {})) {
    mergedCustom[cid] = [...new Set([...(mergedCustom[cid] ?? []), ...list])].slice(0, 64)
  }
  try {
    if (Object.keys(mergedCustom).length > 0) {
      localStorage.setItem(CUSTOM_PROGRESS_KEY, JSON.stringify(mergedCustom))
    }
  } catch {
    // ignore
  }

  // 4. Union pinned courses
  const mergedPinned = [
    ...new Set([...(local.pinnedCourses ?? []), ...(remote.pinnedCourses ?? [])]),
  ].slice(0, 32)
  try {
    if (mergedPinned.length > 0) {
      localStorage.setItem(PINNED_KEY, JSON.stringify(mergedPinned))
    }
  } catch {
    // ignore
  }

  // 5. Apply remote preferences & theme when remote carries explicit values
  if (remote.prefs) {
    const currentPrefs = loadPrefs()
    const nextPrefs: SyntaxPrefs = {
      ...currentPrefs,
      ...(remote.prefs.showCatchupPaths !== undefined
        ? { showCatchupPaths: remote.prefs.showCatchupPaths }
        : {}),
      ...(remote.prefs.onboarded !== undefined
        ? { onboarded: currentPrefs.onboarded || remote.prefs.onboarded }
        : {}),
      ...(remote.prefs.voiceOn !== undefined ? { voiceOn: remote.prefs.voiceOn } : {}),
      ...(remote.prefs.penControlsCollapsed !== undefined
        ? { penControlsCollapsed: remote.prefs.penControlsCollapsed }
        : {}),
      ...(remote.prefs.showStepPlan !== undefined
        ? { showStepPlan: remote.prefs.showStepPlan }
        : {}),
      ...(remote.prefs.windowInertia !== undefined
        ? { windowInertia: remote.prefs.windowInertia }
        : {}),
      ...(remote.prefs.logoClickTarget !== undefined
        ? { logoClickTarget: remote.prefs.logoClickTarget }
        : {}),
      ...(remote.prefs.semaShape ? { semaShape: remote.prefs.semaShape as SyntaxPrefs['semaShape'] } : {}),
      ...(remote.prefs.semaTail ? { semaTail: remote.prefs.semaTail as SyntaxPrefs['semaTail'] } : {}),
      ...(remote.prefs.semaExpression
        ? { semaExpression: remote.prefs.semaExpression as SyntaxPrefs['semaExpression'] }
        : {}),
    }
    savePrefs(nextPrefs)
  }

  if (remote.theme === 'light' || remote.theme === 'dark') {
    try {
      localStorage.setItem(THEME_KEY, remote.theme)
    } catch {
      // ignore
    }
  }
  if (remote.soundOn !== undefined) {
    try {
      localStorage.setItem(SOUND_KEY, String(remote.soundOn))
    } catch {
      // ignore
    }
  }
  if (remote.themePackId) {
    useThemePackStore.getState().setActiveThemeId(remote.themePackId)
  }
  if (Array.isArray(remote.disabledPackages)) {
    const disabledSet = new Set(remote.disabledPackages)
    const reg = useRegistryStore.getState()
    for (const rec of reg.records) {
      const shouldBeEnabled = !disabledSet.has(rec.manifest.id)
      if (rec.enabled !== shouldBeEnabled) {
        reg.setPackageEnabled(rec.manifest.id, shouldBeEnabled)
      }
    }
  }

  if (typeof window !== 'undefined') {
    window.dispatchEvent(new CustomEvent(CLOUD_SYNC_APPLIED_EVENT, { detail: remote }))
  }

  return {
    ...local,
    updatedAt: new Date().toISOString(),
    theme: remote.theme ?? local.theme,
    themePackId: remote.themePackId ?? local.themePackId,
    soundOn: remote.soundOn ?? local.soundOn,
    pinnedCourses: mergedPinned,
    mpm2dCompleted: mergedMpm2d,
    csCompletedSlugs: [...mergedCsSlugs].slice(0, 64),
    customCompleted: mergedCustom,
  }
}

export function extractRemoteCloudPayload(
  unsafeMetadata: Record<string, unknown> | null | undefined,
): SyntaxCloudPayload | null {
  if (!unsafeMetadata || typeof unsafeMetadata !== 'object') return null
  const raw = unsafeMetadata.syntaxCloudV1
  const parsed = SyntaxCloudPayloadSchema.safeParse(raw)
  return parsed.success ? parsed.data : null
}

/** Fingerprint ignoring `updatedAt` so identical snapshots don't spam Clerk API writes. */
export function fingerprintCloudPayload(payload: SyntaxCloudPayload): string {
  const { updatedAt: _ignored, ...rest } = payload
  return JSON.stringify(rest)
}

export async function pushCloudSnapshotToClerk(
  user: {
    unsafeMetadata?: Record<string, unknown>
    update: (params: { unsafeMetadata: Record<string, unknown> }) => Promise<unknown>
  },
  payload: SyntaxCloudPayload,
): Promise<void> {
  const serializedSize = JSON.stringify(payload).length
  if (serializedSize > 7200) {
    syntaxLog.warn('clerk-sync', `Skipping cloud sync push: payload ${serializedSize}B exceeds safe 7.2KB limit`)
    return
  }
  const existing = (user.unsafeMetadata ?? {}) as Record<string, unknown>
  await user.update({
    unsafeMetadata: {
      ...existing,
      syntaxCloudV1: payload,
    },
  })
}
