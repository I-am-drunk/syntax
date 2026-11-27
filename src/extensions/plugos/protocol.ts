/**
 * Wire protocol for Syntax Extensions v1.
 * Adapted from SilverBullet PlugOS `client/plugos/protocol.ts` (MIT).
 */

export type ExtensionErrorCode =
  | 'MANIFEST_FETCH_FAILED'
  | 'MANIFEST_INVALID'
  | 'API_INCOMPATIBLE'
  | 'WORKER_FETCH_FAILED'
  | 'WORKER_BOOT_TIMEOUT'
  | 'WORKER_PARSE_ERROR'
  | 'WORKER_ACTIVATE_ERROR'
  | 'WORKER_STOPPED'
  | 'WORKER_RUNTIME_ERROR'
  | 'FUNCTION_NOT_FOUND'
  | 'SYSCALL_DENIED'
  | 'SERVICE_MISSING'
  | 'SERVICE_INCOMPATIBLE'
  | 'SERVICE_CYCLE'
  | 'REVISION_CONFLICT'
  | 'VIEW_TIMEOUT'
  | 'VIEW_NAVIGATION_BLOCKED'
  | 'DATA_CLONE_ERROR'

export class ExtensionError extends Error {
  readonly code: ExtensionErrorCode
  readonly extensionId?: string
  readonly detail?: string

  constructor(
    code: ExtensionErrorCode,
    message: string,
    opts?: { extensionId?: string; detail?: string; cause?: unknown },
  ) {
    super(message, opts?.cause !== undefined ? { cause: opts.cause } : undefined)
    this.name = 'ExtensionError'
    this.code = code
    this.extensionId = opts?.extensionId
    this.detail = opts?.detail
  }
}

export interface SerializedError {
  name: string
  message: string
  stack?: string
  code?: ExtensionErrorCode
}

export type WorkerLogLevel = 'debug' | 'info' | 'warn' | 'error'

/** Messages sent from the extension Web Worker to the Syntax host. */
export type WorkerToHostMessage =
  | { type: 'boot-started' }
  | { type: 'boot-imported'; functions: string[] }
  | { type: 'boot-ok'; functions: string[] }
  | { type: 'boot-error'; phase: 'parse' | 'activate'; error: SerializedError }
  | { type: 'invr'; id: number; result?: unknown; error?: SerializedError }
  | { type: 'sys'; id: number; name: string; args: unknown[] }
  | { type: 'log'; level: WorkerLogLevel; args: unknown[]; stack?: string }
  | { type: 'runtime-error'; error: SerializedError }

/** Messages sent from the Syntax host to the extension Web Worker. */
export type HostToWorkerMessage =
  | {
      type: 'boot'
      moduleBlobUrl: string
      extensionMeta: {
        id: string
        version: string
        baseUrl: string
        activationId: string
      }
    }
  | { type: 'inv'; id: number; name: string; args: unknown[] }
  | { type: 'sysr'; id: number; result?: unknown; error?: SerializedError }
  | { type: 'settings-changed'; settings: Record<string, boolean | string | number> }

/** Channel identifier for sandboxed extension view iframe postMessage frames. */
export const VIEW_BRIDGE_CHANNEL = 'syntax-view-v1' as const

export interface ViewThemePayload {
  mode: 'light' | 'dark'
  cssVars: Record<string, string>
}

export type ViewToHostMessage =
  | { channel: typeof VIEW_BRIDGE_CHANNEL; type: 'syntax:view-ready' }
  | {
      channel: typeof VIEW_BRIDGE_CHANNEL
      type: 'syntax:view-call'
      instanceId: string
      activationId: string
      callId: string
      target: 'worker' | 'syscall'
      method: string
      args: unknown[]
    }
  | {
      channel: typeof VIEW_BRIDGE_CHANNEL
      type: 'syntax:view-resize'
      instanceId: string
      activationId: string
      height: number
    }
  | {
      channel: typeof VIEW_BRIDGE_CHANNEL
      type: 'syntax:view-error'
      instanceId: string
      activationId: string
      message: string
      stack?: string
    }

export type HostToViewMessage =
  | {
      channel: typeof VIEW_BRIDGE_CHANNEL
      type: 'syntax:view-init'
      instanceId: string
      activationId: string
      extensionId: string
      viewId: string
      docId: string | null
      theme: ViewThemePayload
      settings: Record<string, boolean | string | number>
    }
  | {
      channel: typeof VIEW_BRIDGE_CHANNEL
      type: 'syntax:view-theme'
      instanceId: string
      activationId: string
      theme: ViewThemePayload
    }
  | {
      channel: typeof VIEW_BRIDGE_CHANNEL
      type: 'syntax:view-settings'
      instanceId: string
      activationId: string
      settings: Record<string, boolean | string | number>
    }
  | {
      channel: typeof VIEW_BRIDGE_CHANNEL
      type: 'syntax:view-result'
      instanceId: string
      activationId: string
      callId: string
      ok: true
      result: unknown
    }
  | {
      channel: typeof VIEW_BRIDGE_CHANNEL
      type: 'syntax:view-result'
      instanceId: string
      activationId: string
      callId: string
      ok: false
      error: SerializedError
    }
