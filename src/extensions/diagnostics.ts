import { syntaxLog } from '../core/logger.ts'
import type { WorkerLogLevel } from './plugos/protocol.ts'

const MAX_LOGS_PER_EXTENSION = 100
const MAX_LOG_MESSAGE_CHARS = 2_000
const MAX_LOG_DETAIL_CHARS = 8_000

function clipText(value: string, maxChars: number): string {
  if (value.length <= maxChars) return value
  return `${value.slice(0, maxChars)}... [truncated]`
}

export interface ExtensionLogEntry {
  ts: number
  extensionId: string
  activationId: string | null
  source: 'host' | 'worker' | 'view'
  level: WorkerLogLevel
  message: string
  detail?: string
}

export interface LiveResourceCounters {
  workers: number
  blobUrls: number
  views: number
  windowListeners: number
  commands: number
  toolbarItems: number
  services: number
}

export interface ExtensionBugReport {
  generatedAt: string
  syntaxVersion: string
  syntaxUrl: string
  safeMode: boolean
  userAgent: string
  extensionId?: string
  resources: LiveResourceCounters
  logs: ExtensionLogEntry[]
}

const logsByExtension = new Map<string, ExtensionLogEntry[]>()
const listeners = new Set<() => void>()

const counters: LiveResourceCounters = {
  workers: 0,
  blobUrls: 0,
  views: 0,
  windowListeners: 0,
  commands: 0,
  toolbarItems: 0,
  services: 0,
}

function notify() {
  for (const fn of listeners) fn()
}

export const extensionDiagnostics = {
  push(entry: Omit<ExtensionLogEntry, 'ts'>) {
    const message = clipText(String(entry.message ?? ''), MAX_LOG_MESSAGE_CHARS)
    const detail =
      entry.detail !== undefined ? clipText(String(entry.detail), MAX_LOG_DETAIL_CHARS) : undefined
    const full: ExtensionLogEntry = { ...entry, message, detail, ts: Date.now() }
    const list = logsByExtension.get(entry.extensionId) ?? []
    list.push(full)
    if (list.length > MAX_LOGS_PER_EXTENSION) {
      list.splice(0, list.length - MAX_LOGS_PER_EXTENSION)
    }
    logsByExtension.set(entry.extensionId, list)

    if (entry.level === 'error') {
      syntaxLog.error(`ext:${entry.extensionId}`, message, detail)
    } else if (entry.level === 'warn') {
      syntaxLog.warn(`ext:${entry.extensionId}`, message, detail)
    }
    notify()
  },

  getLogs(extensionId?: string): ExtensionLogEntry[] {
    if (extensionId) {
      return [...(logsByExtension.get(extensionId) ?? [])]
    }
    const all: ExtensionLogEntry[] = []
    for (const list of logsByExtension.values()) all.push(...list)
    return all.sort((a, b) => a.ts - b.ts)
  },

  clear(extensionId?: string) {
    if (extensionId) {
      logsByExtension.delete(extensionId)
    } else {
      logsByExtension.clear()
    }
    notify()
  },

  adjustCounter(key: keyof LiveResourceCounters, delta: number) {
    counters[key] = Math.max(0, counters[key] + delta)
    notify()
  },

  setCounter(key: keyof LiveResourceCounters, value: number) {
    counters[key] = Math.max(0, value)
    notify()
  },

  getResourceCounters(): LiveResourceCounters {
    return { ...counters }
  },

  subscribe(fn: () => void): () => void {
    listeners.add(fn)
    return () => {
      listeners.delete(fn)
    }
  },

  buildBugReport(opts?: { extensionId?: string; safeMode?: boolean }): ExtensionBugReport {
    const env = (import.meta as { env?: Record<string, string | undefined> }).env
    return {
      generatedAt: new Date().toISOString(),
      syntaxVersion: env?.VITE_RELEASE_TAG || 'dev',
      syntaxUrl: typeof window !== 'undefined' ? window.location.origin + window.location.pathname : '',
      safeMode: Boolean(opts?.safeMode),
      userAgent: typeof navigator !== 'undefined' ? navigator.userAgent : 'unknown',
      extensionId: opts?.extensionId,
      resources: this.getResourceCounters(),
      logs: this.getLogs(opts?.extensionId),
    }
  },
}
