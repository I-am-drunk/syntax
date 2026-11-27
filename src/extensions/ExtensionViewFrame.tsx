import { useEffect, useRef, useState } from 'react'
import { AlertTriangle, Check, Copy, RefreshCw, ShieldAlert } from 'lucide-react'
import { extensionDiagnostics } from './diagnostics.ts'
import { extensionManager } from './manager.ts'
import {
  ExtensionError,
  VIEW_BRIDGE_CHANNEL,
  type HostToViewMessage,
  type SerializedError,
  type ViewThemePayload,
  type ViewToHostMessage,
} from './plugos/protocol.ts'
import { useExtensionStore } from './store.ts'

let viewInstanceSeq = 0

function nextViewInstanceId(): string {
  viewInstanceSeq += 1
  return `view-${viewInstanceSeq}-${Date.now().toString(36)}`
}

const THEME_CSS_VARS = [
  '--surface',
  '--secondary',
  '--text',
  '--muted',
  '--tertiary',
  '--border',
  '--hover',
  '--accent-blue',
  '--focus-ring',
  '--font-sans',
  '--font-mono',
] as const

export function readCurrentViewTheme(): ViewThemePayload {
  if (typeof document === 'undefined' || typeof window === 'undefined') {
    return { mode: 'light', cssVars: {} }
  }
  const root = document.documentElement
  const mode: 'light' | 'dark' = root.dataset.theme === 'dark' ? 'dark' : 'light'
  const computed = window.getComputedStyle(root)
  const cssVars: Record<string, string> = {}
  for (const name of THEME_CSS_VARS) {
    const val = computed.getPropertyValue(name).trim()
    if (val) cssVars[name] = val
  }
  if (cssVars['--surface']) cssVars['--bg'] = cssVars['--surface']
  if (cssVars['--accent-blue']) cssVars['--accent'] = cssVars['--accent-blue']
  return { mode, cssVars }
}

function serializeError(err: unknown): SerializedError {
  if (err instanceof ExtensionError) {
    return {
      name: err.name,
      message: err.message,
      code: err.code,
      stack: err.detail ?? err.stack,
    }
  }
  if (err instanceof Error) {
    return { name: err.name, message: err.message, stack: err.stack }
  }
  return { name: 'Error', message: String(err) }
}

export interface ExtensionViewFrameProps {
  extensionId: string
  extensionName: string
  viewId: string
  entryUrl: string
  activationId: string
  docId?: string | null
  title: string
  placement: 'page' | 'tab' | 'embed'
  readyTimeoutMs?: number
  onReloadExtension?: () => void
  onOpenExtensions?: () => void
}

interface ViewFault {
  code: string
  message: string
  fatal: boolean
}

export function ExtensionViewFrame({
  extensionId,
  extensionName,
  viewId,
  entryUrl,
  activationId,
  docId = null,
  title,
  placement,
  readyTimeoutMs = 5000,
  onReloadExtension,
  onOpenExtensions,
}: ExtensionViewFrameProps) {
  const iframeRef = useRef<HTMLIFrameElement | null>(null)
  const loadCountRef = useRef(0)
  const terminatedRef = useRef(false)
  const readyRef = useRef(false)

  const [frameNonce, setFrameNonce] = useState(0)
  const [ready, setReady] = useState(false)
  const [fault, setFault] = useState<ViewFault | null>(null)
  const [copied, setCopied] = useState(false)

  useEffect(() => {
    const instanceId = nextViewInstanceId()
    loadCountRef.current = 0
    terminatedRef.current = false
    readyRef.current = false

    let disposed = false
    let inFlightCalls = 0
    const MAX_IN_FLIGHT_CALLS = 64
    setReady(false)
    setFault(null)

    extensionDiagnostics.adjustCounter('views', 1)
    extensionDiagnostics.adjustCounter('windowListeners', 1)

    const postToView = (win: Window, msg: HostToViewMessage): boolean => {
      try {
        // Opaque sandboxed iframes (without allow-same-origin) have origin 'null',
        // so targetOrigin must be '*'; inbound messages are strictly verified by
        // event.source === iframe.contentWindow && event.origin === 'null'.
        win.postMessage(msg, '*')
        return true
      } catch (err) {
        if (msg.type === 'syntax:view-result' && msg.ok) {
          try {
            win.postMessage(
              {
                channel: VIEW_BRIDGE_CHANNEL,
                type: 'syntax:view-result',
                instanceId: msg.instanceId,
                activationId: msg.activationId,
                callId: msg.callId,
                ok: false,
                error: {
                  name: 'DataCloneError',
                  code: 'DATA_CLONE_ERROR',
                  message:
                    err instanceof Error
                      ? err.message
                      : 'Return value could not be cloned to the view.',
                },
              } satisfies HostToViewMessage,
              '*',
            )
          } catch {
            // ignore secondary failure
          }
        }
        return false
      }
    }

    const readyTimer = window.setTimeout(() => {
      if (disposed || terminatedRef.current || readyRef.current) return
      const msg =
        `View "${title}" did not connect within ${Math.round(readyTimeoutMs / 1000)}s. ` +
        'If this view loads ES modules, verify its server sends Access-Control-Allow-Origin: *.'
      extensionDiagnostics.push({
        extensionId,
        activationId,
        source: 'view',
        level: 'warn',
        message: `VIEW_TIMEOUT: ${msg}`,
      })
      setFault({ code: 'VIEW_TIMEOUT', message: msg, fatal: false })
    }, readyTimeoutMs)

    const handleMessage = (event: MessageEvent) => {
      if (disposed || terminatedRef.current) return
      const win = iframeRef.current?.contentWindow
      if (!win || event.source !== win) return
      if (event.origin !== 'null') return

      const raw = event.data as Partial<ViewToHostMessage> | null
      if (!raw || typeof raw !== 'object' || raw.channel !== VIEW_BRIDGE_CHANNEL) return

      if (raw.type === 'syntax:view-ready') {
        readyRef.current = true
        window.clearTimeout(readyTimer)
        setReady(true)
        setFault(prev => (prev?.code === 'VIEW_TIMEOUT' ? null : prev))
        postToView(win, {
          channel: VIEW_BRIDGE_CHANNEL,
          type: 'syntax:view-init',
          instanceId,
          activationId,
          extensionId,
          viewId,
          docId,
          theme: readCurrentViewTheme(),
        })
        return
      }

      if (raw.type === 'syntax:view-error') {
        if (raw.instanceId !== instanceId || raw.activationId !== activationId) return
        const message = String(raw.message || 'Unhandled view error')
        extensionDiagnostics.push({
          extensionId,
          activationId,
          source: 'view',
          level: 'error',
          message,
          detail: typeof raw.stack === 'string' ? raw.stack : undefined,
        })
        setFault({ code: 'VIEW_RUNTIME_ERROR', message, fatal: false })
        return
      }

      if (raw.type === 'syntax:view-call') {
        if (
          raw.instanceId !== instanceId ||
          raw.activationId !== activationId ||
          typeof raw.callId !== 'string' ||
          (raw.target !== 'worker' && raw.target !== 'syscall') ||
          typeof raw.method !== 'string'
        ) {
          return
        }

        if (!extensionManager.isActivationCurrent(extensionId, activationId)) {
          return
        }

        const callId = raw.callId
        const args = Array.isArray(raw.args) ? raw.args : []

        if (inFlightCalls >= MAX_IN_FLIGHT_CALLS) {
          postToView(win, {
            channel: VIEW_BRIDGE_CHANNEL,
            type: 'syntax:view-result',
            instanceId,
            activationId,
            callId,
            ok: false,
            error: {
              name: 'ExtensionError',
              code: 'SYSCALL_DENIED',
              message: `Too many concurrent view requests (limit ${MAX_IN_FLIGHT_CALLS}).`,
            },
          })
          return
        }

        inFlightCalls += 1
        void extensionManager
          .handleViewCall(extensionId, activationId, raw.target, raw.method, args)
          .then(
            result => {
              inFlightCalls = Math.max(0, inFlightCalls - 1)
              if (
                disposed ||
                terminatedRef.current ||
                iframeRef.current?.contentWindow !== win ||
                !extensionManager.isActivationCurrent(extensionId, activationId)
              ) {
                return
              }
              postToView(win, {
                channel: VIEW_BRIDGE_CHANNEL,
                type: 'syntax:view-result',
                instanceId,
                activationId,
                callId,
                ok: true,
                result,
              })
            },
            err => {
              inFlightCalls = Math.max(0, inFlightCalls - 1)
              if (
                disposed ||
                terminatedRef.current ||
                iframeRef.current?.contentWindow !== win ||
                !extensionManager.isActivationCurrent(extensionId, activationId)
              ) {
                return
              }
              postToView(win, {
                channel: VIEW_BRIDGE_CHANNEL,
                type: 'syntax:view-result',
                instanceId,
                activationId,
                callId,
                ok: false,
                error: serializeError(err),
              })
            },
          )
      }
    }

    window.addEventListener('message', handleMessage)

    const themeObserver = new MutationObserver(() => {
      if (disposed || terminatedRef.current || !readyRef.current) return
      const win = iframeRef.current?.contentWindow
      if (!win) return
      postToView(win, {
        channel: VIEW_BRIDGE_CHANNEL,
        type: 'syntax:view-theme',
        instanceId,
        activationId,
        theme: readCurrentViewTheme(),
      })
    })
    themeObserver.observe(document.documentElement, {
      attributes: true,
      attributeFilter: ['data-theme', 'style'],
    })

    return () => {
      disposed = true
      window.clearTimeout(readyTimer)
      window.removeEventListener('message', handleMessage)
      themeObserver.disconnect()
      extensionDiagnostics.adjustCounter('views', -1)
      extensionDiagnostics.adjustCounter('windowListeners', -1)
    }
  }, [extensionId, viewId, entryUrl, activationId, docId, title, readyTimeoutMs, frameNonce])

  function handleIframeLoad() {
    loadCountRef.current += 1
    if (loadCountRef.current > 1 && !terminatedRef.current) {
      terminatedRef.current = true
      const message =
        `Blocked unexpected navigation inside "${title}" (${extensionId}). ` +
        'Extension views cannot navigate away from their declared entry page.'
      extensionDiagnostics.push({
        extensionId,
        activationId,
        source: 'view',
        level: 'error',
        message: `VIEW_NAVIGATION_BLOCKED: ${message}`,
      })
      setFault({
        code: 'VIEW_NAVIGATION_BLOCKED',
        message,
        fatal: true,
      })
    }
  }

  async function handleCopyReport() {
    try {
      const report = extensionDiagnostics.buildBugReport({
        extensionId,
        safeMode: useExtensionStore.getState().safeMode,
      })
      await navigator.clipboard.writeText(JSON.stringify(report, null, 2))
      setCopied(true)
      window.setTimeout(() => setCopied(false), 1800)
    } catch {
      // clipboard unavailable
    }
  }

  const iframeKey = `${extensionId}:${viewId}:${activationId}:${docId ?? ''}:${frameNonce}`

  return (
    <div
      className={`sx-ext-view-frame is-${placement}`}
      data-extension-id={extensionId}
      data-view-id={viewId}
      data-view-ready={ready ? 'true' : 'false'}
    >
      {placement === 'embed' && (
        <div className="sx-ext-embed-bar">
          <span className="sx-ext-embed-title">
            <strong>{title}</strong>
            <small>{extensionName} · Embedded Extension</small>
          </span>
          <button
            type="button"
            className="sx-btn-ghost sx-btn-sm"
            onClick={() => setFrameNonce(n => n + 1)}
          >
            <RefreshCw size={13} aria-hidden="true" />
            <span>Reset view</span>
          </button>
        </div>
      )}

      {fault && !fault.fatal && (
        <div className="sx-ext-view-banner" role="alert">
          <div className="sx-ext-view-banner-copy">
            <AlertTriangle size={15} aria-hidden="true" />
            <span>
              <strong>{extensionName}</strong>: {fault.message}
            </span>
          </div>
          <div className="sx-ext-view-banner-actions">
            <button
              type="button"
              className="sx-btn-secondary sx-btn-sm"
              onClick={() => setFrameNonce(n => n + 1)}
            >
              <RefreshCw size={13} aria-hidden="true" />
              <span>Reload view</span>
            </button>
            <button
              type="button"
              className="sx-btn-ghost sx-btn-sm"
              onClick={() => void handleCopyReport()}
            >
              {copied ? <Check size={13} aria-hidden="true" /> : <Copy size={13} aria-hidden="true" />}
              <span>{copied ? 'Copied' : 'Copy report'}</span>
            </button>
          </div>
        </div>
      )}

      {fault?.fatal ? (
        <div className="sx-error-card" role="alert">
          <div className="sx-error-badge">
            <ShieldAlert size={14} aria-hidden="true" />
            <span>{fault.code}</span>
          </div>
          <h3>{extensionName} view was stopped</h3>
          <p className="sx-error-summary">{fault.message}</p>
          <div className="sx-error-actions">
            <button
              type="button"
              className="sx-btn-primary"
              onClick={() => {
                setFault(null)
                setFrameNonce(n => n + 1)
              }}
            >
              <RefreshCw size={14} aria-hidden="true" />
              <span>Restart view</span>
            </button>
            {onReloadExtension && (
              <button type="button" className="sx-btn-secondary" onClick={onReloadExtension}>
                <span>Reload extension</span>
              </button>
            )}
            {onOpenExtensions && (
              <button type="button" className="sx-btn-ghost" onClick={onOpenExtensions}>
                <span>Manage extensions</span>
              </button>
            )}
            <button
              type="button"
              className="sx-btn-ghost"
              onClick={() => void handleCopyReport()}
            >
              {copied ? <Check size={14} aria-hidden="true" /> : <Copy size={14} aria-hidden="true" />}
              <span>{copied ? 'Copied' : 'Copy bug report'}</span>
            </button>
          </div>
        </div>
      ) : (
        <iframe
          key={iframeKey}
          ref={iframeRef}
          src={entryUrl}
          title={`${extensionName}: ${title}`}
          className="sx-ext-iframe"
          sandbox="allow-scripts allow-forms"
          allow="camera 'none'; microphone 'none'; geolocation 'none'; payment 'none'; usb 'none'"
          referrerPolicy="no-referrer"
          onLoad={handleIframeLoad}
        />
      )}
    </div>
  )
}
