import { useEffect, useId, useMemo, useRef, useState } from 'react'
import { AlertTriangle, RotateCcw } from 'lucide-react'
import { toast } from 'sonner'
import type { PluginPermission } from './packages'
import {
  buildSandboxSrcDoc,
  getHostThemeTokens,
  type PluginBlockResult,
} from './pluginBridge'
import {
  pluginStorageGet,
  pluginStorageRemove,
  pluginStorageSet,
  usePluginRuntimeStore,
} from './pluginRuntime'

type PluginSandboxFrameProps = {
  pluginId: string
  title: string
  html: string
  theme: 'light' | 'dark'
  minHeight?: number
  permissions?: readonly PluginPermission[]
  networkAccess?: 'none' | 'allowlisted'
  blockProps?: Record<string, unknown>
  onResult?: (result: PluginBlockResult) => void
  onDisablePlugin?: () => void
}

/**
 * Hardened crash & CSS isolation host for custom plugin HTML/JS widgets.
 * - Strict sandbox ("allow-scripts allow-forms", no allow-same-origin, no allow-modals)
 * - Per-instance ID isolation so multiple blocks on one lesson never collide
 * - Synchronous window.Syntax SDK over postMessage RPC (storage, toast, reportResult, resize, theme)
 * - Automatic crash-loop quarantine (>= 3 errors in 10s auto-disables the plugin cleanly)
 */
export function PluginSandboxFrame({
  pluginId,
  title,
  html,
  theme,
  minHeight = 220,
  permissions = [],
  networkAccess = 'none',
  blockProps,
  onResult,
  onDisablePlugin,
}: PluginSandboxFrameProps) {
  const reactId = useId()
  const instanceId = `${pluginId}:${reactId}`
  const iframeRef = useRef<HTMLIFrameElement>(null)
  const latestThemeRef = useRef(theme)
  latestThemeRef.current = theme
  const onResultRef = useRef(onResult)
  onResultRef.current = onResult
  const onDisableRef = useRef(onDisablePlugin)
  onDisableRef.current = onDisablePlugin
  const lastToastAtRef = useRef(0)

  const recordPluginError = usePluginRuntimeStore(s => s.recordPluginError)
  const clearPluginHealth = usePluginRuntimeStore(s => s.clearPluginHealth)

  const [height, setHeight] = useState(minHeight)
  const [reloadNonce, setReloadNonce] = useState(0)
  const [runtimeError, setRuntimeError] = useState<string | null>(null)

  const permissionsKey = permissions.join(',')
  const propsJson = useMemo(() => JSON.stringify(blockProps ?? {}), [blockProps])
  const hasStoragePerm = permissions.includes('storage')

  useEffect(() => {
    setHeight(minHeight)
    setRuntimeError(null)
  }, [pluginId, html, minHeight, reloadNonce])

  // Live theme sync without reloading the iframe or losing widget state
  useEffect(() => {
    const win = iframeRef.current?.contentWindow
    if (!win) return
    win.postMessage(
      {
        type: 'syntax:theme',
        pluginId,
        instanceId,
        theme,
        tokens: getHostThemeTokens(theme),
      },
      '*',
    )
  }, [pluginId, instanceId, theme])

  useEffect(() => {
    const onMessage = (event: MessageEvent) => {
      if (event.source !== iframeRef.current?.contentWindow) return
      const data = event.data as
        | {
            type?: string
            pluginId?: string
            instanceId?: string
            height?: number
            message?: string
            reqId?: string
            method?: string
            args?: Record<string, unknown>
            correct?: boolean
            score?: number
            summary?: string
          }
        | undefined
      if (!data || data.pluginId !== pluginId) return
      if (data.instanceId && data.instanceId !== instanceId) return

      const replyWindow = iframeRef.current?.contentWindow

      if (data.type === 'syntax:sandbox-ready') {
        const currentTheme = latestThemeRef.current
        replyWindow?.postMessage(
          {
            type: 'syntax:theme',
            pluginId,
            instanceId,
            theme: currentTheme,
            tokens: getHostThemeTokens(currentTheme),
          },
          '*',
        )
      } else if (
        data.type === 'syntax:sandbox-resize' &&
        typeof data.height === 'number' &&
        Number.isFinite(data.height)
      ) {
        const clamped = Math.max(minHeight, Math.min(920, Math.ceil(data.height)))
        setHeight(prev => (prev === clamped ? prev : clamped))
      } else if (data.type === 'syntax:sandbox-error' && typeof data.message === 'string') {
        const msg = data.message.slice(0, 500)
        setRuntimeError(msg)
        recordPluginError(pluginId, msg, () => {
          toast.error(`${title} crashed repeatedly and was disabled to keep Syntax safe.`)
          onDisableRef.current?.()
        })
      } else if (data.type === 'syntax:toast' && typeof data.message === 'string') {
        const now = Date.now()
        if (now - lastToastAtRef.current >= 1500) {
          lastToastAtRef.current = now
          toast.message(data.message.slice(0, 180))
        }
      } else if (data.type === 'syntax:report-result') {
        onResultRef.current?.({
          correct: typeof data.correct === 'boolean' ? data.correct : undefined,
          score: typeof data.score === 'number' ? data.score : undefined,
          summary: typeof data.summary === 'string' ? data.summary : undefined,
        })
      } else if (data.type === 'syntax:rpc' && data.reqId && data.method && replyWindow) {
        const sendReply = (ok: boolean, payload: { result?: unknown; error?: string }) => {
          replyWindow.postMessage(
            {
              type: 'syntax:rpc-reply',
              pluginId,
              instanceId,
              reqId: data.reqId,
              ok,
              ...payload,
            },
            '*',
          )
        }

        if (data.method.startsWith('storage.')) {
          if (!hasStoragePerm) {
            sendReply(false, { error: 'Plugin does not declare "storage" permission.' })
            return
          }
          const key = typeof data.args?.key === 'string' ? data.args.key : ''
          if (data.method === 'storage.get') {
            sendReply(true, { result: pluginStorageGet(pluginId, key) })
          } else if (data.method === 'storage.set') {
            const res = pluginStorageSet(pluginId, key, data.args?.value)
            if (res.ok) sendReply(true, { result: true })
            else sendReply(false, { error: res.error })
          } else if (data.method === 'storage.remove') {
            pluginStorageRemove(pluginId, key)
            sendReply(true, { result: true })
          } else {
            sendReply(false, { error: `Unknown storage method: ${data.method}` })
          }
        } else {
          sendReply(false, { error: `Unknown RPC method: ${data.method}` })
        }
      }
    }
    window.addEventListener('message', onMessage)
    return () => window.removeEventListener('message', onMessage)
  }, [pluginId, instanceId, title, minHeight, hasStoragePerm, recordPluginError])

  const srcDoc = useMemo(() => {
    const initialTheme = latestThemeRef.current
    const parsedProps = JSON.parse(propsJson) as Record<string, unknown>
    return buildSandboxSrcDoc({
      pluginId,
      instanceId,
      html,
      theme: initialTheme,
      tokens: getHostThemeTokens(initialTheme),
      permissions,
      networkAccess,
      props: parsedProps,
    })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [html, pluginId, instanceId, reloadNonce, permissionsKey, networkAccess, propsJson])

  return (
    <div className="sx-plugin-frame-wrap">
      {runtimeError && (
        <div className="sx-plugin-error-banner" role="alert">
          <div className="sx-plugin-error-head">
            <AlertTriangle size={16} aria-hidden="true" />
            <strong>{title} hit a runtime bug</strong>
            <div className="sx-plugin-error-btns">
              <button
                type="button"
                className="sx-btn-ghost sx-btn-xs"
                onClick={() => {
                  clearPluginHealth(pluginId)
                  setReloadNonce(n => n + 1)
                }}
              >
                <RotateCcw size={13} aria-hidden="true" />
                Reload
              </button>
              {onDisablePlugin && (
                <button
                  type="button"
                  className="sx-btn-danger-ghost sx-btn-xs"
                  onClick={onDisablePlugin}
                >
                  Disable
                </button>
              )}
            </div>
          </div>
          <pre className="sx-plugin-error-msg">{runtimeError}</pre>
        </div>
      )}

      <iframe
        key={`${instanceId}:${reloadNonce}`}
        ref={iframeRef}
        title={`${title} (Isolated plugin)`}
        sandbox="allow-scripts allow-forms"
        srcDoc={srcDoc}
        style={{
          width: '100%',
          height: `${height}px`,
          border: '1px solid var(--border)',
          borderRadius: '14px',
          background: 'var(--surface)',
          display: 'block',
        }}
      />
    </div>
  )
}
