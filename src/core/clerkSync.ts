import { create } from 'zustand'
import { z } from 'zod'
import { loadPrefs, savePrefs, type SyntaxPrefs } from './prefs'
import { syntaxLog } from './logger'

const THEME_KEY = 'syntax.theme.v1'
const LEGACY_THEME_KEY = 'mpm2d-brilliant-theme-v1'
const SOUND_KEY = 'syntax.sound.v1'
const LEGACY_SOUND_KEY = 'mpm2d-brilliant-sound-v1'

export const CLOUD_SYNC_APPLIED_EVENT = 'syntax:cloud-sync-applied'

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
      onboarded: z.boolean().optional(),
      logoClickTarget: z.enum(['library', 'home']).optional(),
      semaShape: z.string().max(32).optional(),
      semaTail: z.string().max(32).optional(),
      semaExpression: z.string().max(32).optional(),
    })
    .optional(),
})

export type SyntaxCloudPayload = z.infer<typeof SyntaxCloudPayloadSchema>

export type CloudSyncStatus = 'local-only' | 'idle' | 'syncing' | 'synced' | 'error'

interface CloudSyncState {
  status: CloudSyncStatus
  lastSyncedAt: string | null
  lastError: string | null
  setSyncState: (patch: Partial<Omit<CloudSyncState, 'setSyncState'>>) => void
}

export const useCloudSyncStore = create<CloudSyncState>(set => ({
  status: 'local-only',
  lastSyncedAt: null,
  lastError: null,
  setSyncState: patch => set(patch),
}))

export function collectLocalCloudSnapshot(): SyntaxCloudPayload {
  const prefs = loadPrefs()
  const rawTheme = (() => {
    try {
      const t = localStorage.getItem(THEME_KEY) ?? localStorage.getItem(LEGACY_THEME_KEY)
      return t === 'light' || t === 'dark' ? t : undefined
    } catch {
      return undefined
    }
  })()
  const soundOn = (() => {
    try {
      const s = localStorage.getItem(SOUND_KEY) ?? localStorage.getItem(LEGACY_SOUND_KEY)
      return s === null ? undefined : s !== 'false'
    } catch {
      return undefined
    }
  })()

  return {
    v: 1,
    updatedAt: new Date().toISOString(),
    theme: rawTheme,
    soundOn,
    prefs: {
      onboarded: prefs.onboarded,
      logoClickTarget: prefs.logoClickTarget,
      semaShape: prefs.semaShape,
      semaTail: prefs.semaTail,
      semaExpression: prefs.semaExpression,
    },
  }
}

export function mergeCloudIntoLocal(remote: SyntaxCloudPayload): SyntaxCloudPayload {
  const local = collectLocalCloudSnapshot()

  if (remote.prefs) {
    const currentPrefs = loadPrefs()
    const nextPrefs: SyntaxPrefs = {
      ...currentPrefs,
      ...(remote.prefs.onboarded !== undefined
        ? { onboarded: currentPrefs.onboarded || remote.prefs.onboarded }
        : {}),
      ...(remote.prefs.logoClickTarget !== undefined
        ? { logoClickTarget: remote.prefs.logoClickTarget }
        : {}),
      ...(remote.prefs.semaShape
        ? { semaShape: remote.prefs.semaShape as SyntaxPrefs['semaShape'] }
        : {}),
      ...(remote.prefs.semaTail
        ? { semaTail: remote.prefs.semaTail as SyntaxPrefs['semaTail'] }
        : {}),
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

  if (typeof window !== 'undefined') {
    window.dispatchEvent(new CustomEvent(CLOUD_SYNC_APPLIED_EVENT, { detail: remote }))
  }

  return {
    ...local,
    updatedAt: new Date().toISOString(),
    theme: remote.theme ?? local.theme,
    soundOn: remote.soundOn ?? local.soundOn,
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
    syntaxLog.warn(
      'clerk-sync',
      `Skipping cloud sync push: payload ${serializedSize}B exceeds safe 7.2KB limit`,
    )
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
