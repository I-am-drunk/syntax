import { useEffect, useMemo, useRef, useState } from 'react'
import { AlertTriangle, RotateCcw } from 'lucide-react'
import { syntaxLog } from './logger'

type PluginSandboxFrameProps = {
  pluginId: string
  title: string
  html: string
  theme: 'light' | 'dark'
  minHeight?: number
  onDisablePlugin?: () => void
}

function getThemeTokens(theme: 'light' | 'dark') {
  return theme === 'dark'
    ? { bg: '#1c1c1c', fg: '#f3f3f3', muted: '#a1a1a1', border: '#2e2e2e' }
    : { bg: '#ffffff', fg: '#141414', muted: '#5c5c5c', border: '#e5e5e5' }
}

/**
 * Lightweight crash & CSS isolation host for custom plugin HTML/JS widgets.
 * Syncs Light/Dark theme live over postMessage (zero iframe reload on theme switch)
 * and surfaces runtime errors clearly in-place without ever crashing Syntax core.
 */
export function PluginSandboxFrame({
  pluginId,
  title,
  html,
  theme,
  minHeight = 220,
  onDisablePlugin,
}: PluginSandboxFrameProps) {
  const iframeRef = useRef<HTMLIFrameElement>(null)
  const latestThemeRef = useRef(theme)
  latestThemeRef.current = theme
  const [height, setHeight] = useState(minHeight)
  const [reloadNonce, setReloadNonce] = useState(0)
  const [runtimeError, setRuntimeError] = useState<string | null>(null)

  useEffect(() => {
    setHeight(minHeight)
    setRuntimeError(null)
  }, [pluginId, html, minHeight, reloadNonce])

  // Live theme sync without reloading the iframe or losing widget state
  useEffect(() => {
    const win = iframeRef.current?.contentWindow
    if (!win) return
    win.postMessage(
      { type: 'syntax:theme', pluginId, theme, tokens: getThemeTokens(theme) },
      '*',
    )
  }, [pluginId, theme])

  useEffect(() => {
    const onMessage = (event: MessageEvent) => {
      if (event.source !== iframeRef.current?.contentWindow) return
      const data = event.data as
        | { type?: string; pluginId?: string; height?: number; message?: string }
        | undefined
      if (!data || data.pluginId !== pluginId) return

      if (data.type === 'syntax:sandbox-ready') {
        const currentTheme = latestThemeRef.current
        iframeRef.current?.contentWindow?.postMessage(
          {
            type: 'syntax:theme',
            pluginId,
            theme: currentTheme,
            tokens: getThemeTokens(currentTheme),
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
        syntaxLog.error(`plugin:${pluginId}`, msg)
      }
    }
    window.addEventListener('message', onMessage)
    return () => window.removeEventListener('message', onMessage)
  }, [pluginId, minHeight])

  const srcDoc = useMemo(() => {
    const initialTheme = latestThemeRef.current
    const t = getThemeTokens(initialTheme)
    const safeId = JSON.stringify(pluginId).replace(/<\/script/gi, '<\\/script')

    return `<!doctype html>
<html lang="en" data-theme="${initialTheme}">
<head>
<meta charset="utf-8" />
<style>
  :root {
    --sx-bg: ${t.bg};
    --sx-fg: ${t.fg};
    --sx-muted: ${t.muted};
    --sx-border: ${t.border};
    --sx-accent: #456dff;
  }
  * { box-sizing: border-box; }
  body {
    margin: 0;
    padding: 16px;
    background: var(--sx-bg);
    color: var(--sx-fg);
    font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
    line-height: 1.5;
  }
</style>
<script>
  (function () {
    var pid = ${safeId};
    var lastHeight = 0;

    function reportError(msg) {
      parent.postMessage({
        type: 'syntax:sandbox-error',
        pluginId: pid,
        message: String(msg || 'Plugin runtime error').slice(0, 500)
      }, '*');
    }

    window.addEventListener('error', function (e) {
      var loc = e.lineno ? ' (line ' + e.lineno + ')' : '';
      reportError((e.message || 'Runtime error') + loc);
    });

    window.addEventListener('unhandledrejection', function (e) {
      var reason = e.reason && e.reason.message ? e.reason.message : String(e.reason || 'Unhandled promise rejection');
      reportError(reason);
    });

    window.addEventListener('message', function (e) {
      var d = e.data;
      if (!d || d.pluginId !== pid || d.type !== 'syntax:theme' || !d.tokens) return;
      document.documentElement.dataset.theme = d.theme || 'light';
      var r = document.documentElement.style;
      r.setProperty('--sx-bg', d.tokens.bg);
      r.setProperty('--sx-fg', d.tokens.fg);
      r.setProperty('--sx-muted', d.tokens.muted);
      r.setProperty('--sx-border', d.tokens.border);
    });

    function reportHeight() {
      var rootEl = document.getElementById('sx-sandbox-root');
      if (!rootEl) return;
      var rectH = Math.ceil(rootEl.getBoundingClientRect().height);
      var scrollH = Math.ceil(rootEl.scrollHeight);
      var h = Math.max(rectH, scrollH) + 36;
      if (h !== lastHeight) {
        lastHeight = h;
        parent.postMessage({ type: 'syntax:sandbox-resize', pluginId: pid, height: h }, '*');
      }
    }

    window.addEventListener('DOMContentLoaded', function () {
      var rootEl = document.getElementById('sx-sandbox-root');
      if (typeof ResizeObserver !== 'undefined' && rootEl) {
        new ResizeObserver(reportHeight).observe(rootEl);
      }
      reportHeight();
    });

    window.addEventListener('load', function () {
      parent.postMessage({ type: 'syntax:sandbox-ready', pluginId: pid }, '*');
      reportHeight();
    });
  })();
</script>
</head>
<body>
<div id="sx-sandbox-root">${html}</div>
</body>
</html>`
  }, [html, pluginId, reloadNonce])

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
                onClick={() => setReloadNonce(n => n + 1)}
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
        key={`${pluginId}:${reloadNonce}`}
        ref={iframeRef}
        title={`${title} (Isolated plugin)`}
        sandbox="allow-scripts allow-forms allow-modals"
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
