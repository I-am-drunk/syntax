import { create } from 'zustand'
import {
  CloudExtensionEntrySchema,
  SyntaxCloudPayloadSchema,
  extractRemoteCloudPayload,
  fingerprintCloudPayload,
  type CloudExtensionEntry,
  type SyntaxCloudPayload,
} from './cloudSchema'
import { loadPrefs, savePrefs, type SyntaxPrefs } from './prefs'
import { syntaxLog } from './logger'

export {
  CloudExtensionEntrySchema,
  SyntaxCloudPayloadSchema,
  extractRemoteCloudPayload,
  fingerprintCloudPayload,
  type CloudExtensionEntry,
  type SyntaxCloudPayload,
}

const THEME_KEY = 'syntax.theme.v1'
const LEGACY_THEME_KEY = 'mpm2d-brilliant-theme-v1'
const SOUND_KEY = 'syntax.sound.v1'
const LEGACY_SOUND_KEY = 'mpm2d-brilliant-sound-v1'
const EXTENSIONS_KEY = 'syntax.extensions.v1'
const EXTENSION_SETTINGS_KEY = 'syntax.extensions.settings.v1'
const CLOUD_PAYLOAD_SOFT_LIMIT = 6800

export const CLOUD_SYNC_APPLIED_EVENT = 'syntax:cloud-sync-applied'
export const CLOUD_SYNC_DIRTY_EVENT = 'syntax:cloud-dirty'

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

function readLocalExtensionEntries(): CloudExtensionEntry[] {
  try {
    const raw = localStorage.getItem(EXTENSIONS_KEY)
    if (!raw) return []
    const parsed = JSON.parse(raw)
    if (!Array.isArray(parsed)) return []
    const out: CloudExtensionEntry[] = []
    for (const item of parsed) {
      if (!item || typeof item !== 'object') continue
      const candidate = CloudExtensionEntrySchema.safeParse({
        id: (item as Record<string, unknown>).id,
        manifestUrl: (item as Record<string, unknown>).manifestUrl,
        enabled: Boolean((item as Record<string, unknown>).enabled),
      })
      if (candidate.success) out.push(candidate.data)
      if (out.length >= 30) break
    }
    return out
  } catch {
    return []
  }
}

function readLocalExtensionSettings(): Record<string, Record<string, boolean | string | number>> {
  try {
    const raw = localStorage.getItem(EXTENSION_SETTINGS_KEY)
    if (!raw) return {}
    const parsed = JSON.parse(raw)
    if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) return {}
    const out: Record<string, Record<string, boolean | string | number>> = {}
    for (const [extId, map] of Object.entries(parsed as Record<string, unknown>)) {
      if (!extId || extId.length > 64 || !map || typeof map !== 'object' || Array.isArray(map)) {
        continue
      }
      const cleanMap: Record<string, boolean | string | number> = {}
      for (const [key, val] of Object.entries(map as Record<string, unknown>)) {
        if (!key || key.length > 64) continue
        if (typeof val === 'boolean') cleanMap[key] = val
        else if (typeof val === 'number' && Number.isFinite(val)) cleanMap[key] = val
        else if (typeof val === 'string' && val.length <= 240) cleanMap[key] = val
      }
      if (Object.keys(cleanMap).length > 0) out[extId] = cleanMap
    }
    return out
  } catch {
    return {}
  }
}

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

  const extensions = readLocalExtensionEntries()
  const extensionSettings = readLocalExtensionSettings()

  const payload: SyntaxCloudPayload = {
    v: 1,
    updatedAt: new Date().toISOString(),
    theme: rawTheme,
    soundOn,
    prefs: {
      onboarded: prefs.onboarded,
      logoClickTarget: prefs.logoClickTarget,
      navStyle: prefs.navStyle,
      semaShape: prefs.semaShape,
      semaTail: prefs.semaTail,
      semaExpression: prefs.semaExpression,
    },
    ...(extensions.length > 0 ? { extensions } : {}),
    ...(Object.keys(extensionSettings).length > 0 ? { extensionSettings } : {}),
  }

  // Keep payload comfortably under Clerk's 8 KB unsafeMetadata ceiling
  if (JSON.stringify(payload).length > CLOUD_PAYLOAD_SOFT_LIMIT && payload.extensionSettings) {
    delete payload.extensionSettings
  }
  while (
    payload.extensions &&
    payload.extensions.length > 0 &&
    JSON.stringify(payload).length > CLOUD_PAYLOAD_SOFT_LIMIT
  ) {
    payload.extensions = payload.extensions.slice(0, -1)
  }

  return payload
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
      ...(remote.prefs.navStyle !== undefined
        ? { navStyle: remote.prefs.navStyle }
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
  if (remote.extensionSettings && Object.keys(remote.extensionSettings).length > 0) {
    try {
      const existing = readLocalExtensionSettings()
      const mergedSettings: Record<string, Record<string, boolean | string | number>> = {
        ...existing,
      }
      for (const [extId, map] of Object.entries(remote.extensionSettings)) {
        mergedSettings[extId] = { ...(existing[extId] ?? {}), ...map }
      }
      localStorage.setItem(EXTENSION_SETTINGS_KEY, JSON.stringify(mergedSettings))
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
    ...(remote.extensions ? { extensions: remote.extensions } : {}),
    ...(remote.extensionSettings ? { extensionSettings: remote.extensionSettings } : {}),
  }
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
