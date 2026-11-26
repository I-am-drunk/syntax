/**
 * Non-persisted live runtime state for active plugins:
 * - Floating toolbar drawer state (which plugin tool is currently open)
 * - Per-plugin runtime health & crash-loop quarantine (>= 3 crashes in 10s auto-disables)
 * - Scoped 128 KB localStorage helpers per plugin ID
 */
import { create } from 'zustand'
import { syntaxLog } from './logger'

const STORAGE_PREFIX = 'syntax-plugin-data:'
const MAX_PLUGIN_STORAGE_BYTES = 128 * 1024 // 128 KB per plugin
const CRASH_WINDOW_MS = 10_000
const CRASH_QUARANTINE_THRESHOLD = 3

export type PluginRuntimeHealth = {
  crashTimestamps: number[]
  lastError: string | null
  quarantined: boolean
}

export type ActivePluginTool = {
  pluginId: string
  toolId: string
}

type PluginRuntimeState = {
  activeTool: ActivePluginTool | null
  healthById: Record<string, PluginRuntimeHealth>
  openTool: (pluginId: string, toolId: string) => void
  toggleTool: (pluginId: string, toolId: string) => void
  closeTool: (pluginId?: string) => void
  recordPluginError: (
    pluginId: string,
    message: string,
    onQuarantine?: (pluginId: string, message: string) => void,
  ) => boolean
  clearPluginHealth: (pluginId: string) => void
}

export const usePluginRuntimeStore = create<PluginRuntimeState>()((set, get) => ({
  activeTool: null,
  healthById: {},

  openTool: (pluginId, toolId) => {
    set({ activeTool: { pluginId, toolId } })
  },

  toggleTool: (pluginId, toolId) => {
    const curr = get().activeTool
    if (curr && curr.pluginId === pluginId && curr.toolId === toolId) {
      set({ activeTool: null })
    } else {
      set({ activeTool: { pluginId, toolId } })
    }
  },

  closeTool: pluginId => {
    const curr = get().activeTool
    if (!curr) return
    if (!pluginId || curr.pluginId === pluginId) {
      set({ activeTool: null })
    }
  },

  recordPluginError: (pluginId, message, onQuarantine) => {
    const now = Date.now()
    const prev = get().healthById[pluginId] ?? {
      crashTimestamps: [],
      lastError: null,
      quarantined: false,
    }
    const recent = [...prev.crashTimestamps.filter(ts => now - ts < CRASH_WINDOW_MS), now]
    const shouldQuarantine = recent.length >= CRASH_QUARANTINE_THRESHOLD
    const next: PluginRuntimeHealth = {
      crashTimestamps: recent,
      lastError: message.slice(0, 500),
      quarantined: prev.quarantined || shouldQuarantine,
    }
    set(state => ({
      healthById: { ...state.healthById, [pluginId]: next },
      activeTool:
        shouldQuarantine && state.activeTool?.pluginId === pluginId ? null : state.activeTool,
    }))
    syntaxLog.error(`plugin:${pluginId}`, message, {
      recentCrashes: recent.length,
      quarantined: shouldQuarantine,
    })
    if (shouldQuarantine && !prev.quarantined) {
      onQuarantine?.(pluginId, message)
    }
    return shouldQuarantine
  },

  clearPluginHealth: pluginId => {
    set(state => {
      if (!(pluginId in state.healthById)) return state
      const next = { ...state.healthById }
      delete next[pluginId]
      return { healthById: next }
    })
  },
}))

// =========================================================================
// SCOPED 128 KB PER-PLUGIN STORAGE
// =========================================================================
function readBucket(pluginId: string): Record<string, unknown> {
  try {
    const raw = localStorage.getItem(`${STORAGE_PREFIX}${pluginId}`)
    if (!raw) return {}
    const parsed = JSON.parse(raw) as unknown
    if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) {
      return parsed as Record<string, unknown>
    }
  } catch {
    // ignore corrupt bucket
  }
  return {}
}

function writeBucket(pluginId: string, bucket: Record<string, unknown>): { ok: true } | { ok: false; error: string } {
  const serialized = JSON.stringify(bucket)
  if (serialized.length > MAX_PLUGIN_STORAGE_BYTES) {
    return {
      ok: false,
      error: `Plugin storage quota exceeded (max ${MAX_PLUGIN_STORAGE_BYTES / 1024} KB).`,
    }
  }
  try {
    localStorage.setItem(`${STORAGE_PREFIX}${pluginId}`, serialized)
    return { ok: true }
  } catch {
    return { ok: false, error: 'Browser storage is unavailable.' }
  }
}

export function pluginStorageGet(pluginId: string, key: string): unknown {
  const bucket = readBucket(pluginId)
  return Object.prototype.hasOwnProperty.call(bucket, key) ? bucket[key] : null
}

export function pluginStorageSet(
  pluginId: string,
  key: string,
  value: unknown,
): { ok: true } | { ok: false; error: string } {
  if (typeof key !== 'string' || key.length === 0 || key.length > 120) {
    return { ok: false, error: 'Invalid storage key.' }
  }
  const bucket = readBucket(pluginId)
  bucket[key] = value
  return writeBucket(pluginId, bucket)
}

export function pluginStorageRemove(pluginId: string, key: string): void {
  const bucket = readBucket(pluginId)
  if (Object.prototype.hasOwnProperty.call(bucket, key)) {
    delete bucket[key]
    writeBucket(pluginId, bucket)
  }
}

export function clearPluginStorage(pluginId: string): void {
  try {
    localStorage.removeItem(`${STORAGE_PREFIX}${pluginId}`)
  } catch {
    // ignore
  }
}
