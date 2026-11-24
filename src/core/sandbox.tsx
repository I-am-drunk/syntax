import { useEffect, useMemo, useRef, useState } from 'react'
import { syntaxLog } from './logger'
import { isSafeSandboxHtml } from './packages'

type PluginSandboxFrameProps = {
  pluginId: string
  title: string
  html: string
  theme: 'light' | 'dark'
  minHeight?: number
}

export function PluginSandboxFrame({
  pluginId,
  title,
  html,
  theme,
  minHeight = 220,
}: PluginSandboxFrameProps) {
  const iframeRef = useRef<HTMLIFrameElement>(null)
  const [height, setHeight] = useState(minHeight)

  const safe = useMemo(() => isSafeSandboxHtml(html), [html])

  useEffect(() => {
    const onMessage = (event: MessageEvent) => {
      if (event.source !== iframeRef.current?.contentWindow || event.origin !== 'null') {
        return
      }
      const data = event.data as
        | { type?: string; pluginId?: string; height?: number; message?: string }
        | undefined
      if (!data || data.pluginId !== pluginId) return
      if (
        data.type === 'syntax:sandbox-resize' &&
        typeof data.height === 'number' &&
        Number.isFinite(data.height)
      ) {
        const clamped = Math.max(minHeight, Math.min(720, Math.ceil(data.height)))
        setHeight(prev => (prev === clamped ? prev : clamped))
      } else if (data.type === 'syntax:sandbox-error' && typeof data.message === 'string') {
        syntaxLog.error(`sandbox:${pluginId}`, data.message.slice(0, 400))
      }
    }
    window.addEventListener('message', onMessage)
    return () => window.removeEventListener('message', onMessage)
  }, [pluginId, minHeight])

  const srcDoc = useMemo(() => {
    const bg = theme === 'dark' ? '#1c1c1c' : '#ffffff'
    const fg = theme === 'dark' ? '#f3f3f3' : '#141414'
    const muted = theme === 'dark' ? '#a1a1a1' : '#5c5c5c'
    const border = theme === 'dark' ? '#2e2e2e' : '#e5e5e5'
    const safeId = JSON.stringify(pluginId)

    return `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8" />
<meta http-equiv="Content-Security-Policy" content="default-src 'none'; form-action 'none'; base-uri 'none'; style-src 'unsafe-inline'; script-src 'unsafe-inline'; img-src data:;" />
<style>
  :root {
    --sx-bg: ${bg};
    --sx-fg: ${fg};
    --sx-muted: ${muted};
    --sx-border: ${border};
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
</head>
<body>
<div id="sx-sandbox-root">${html}</div>
<script>
  (function () {
    var pid = ${safeId};
    var rootEl = document.getElementById('sx-sandbox-root');
    var lastHeight = 0;
    function reportHeight() {
      if (!rootEl) return;
      var h = Math.ceil(rootEl.getBoundingClientRect().height) + 36;
      if (h !== lastHeight) {
        lastHeight = h;
        parent.postMessage({ type: 'syntax:sandbox-resize', pluginId: pid, height: h }, '*');
      }
    }
    window.addEventListener('error', function (e) {
      parent.postMessage({ type: 'syntax:sandbox-error', pluginId: pid, message: String(e.message || 'Sandbox runtime error').slice(0, 400) }, '*');
    });
    if (typeof ResizeObserver !== 'undefined' && rootEl) {
      new ResizeObserver(reportHeight).observe(rootEl);
    }
    window.addEventListener('load', reportHeight);
    setTimeout(reportHeight, 60);
  })();
</script>
</body>
</html>`
  }, [html, pluginId, theme])

  if (!safe) {
    return (
      <div className="sx-inline-note" role="alert">
        Blocked sandbox preview for <strong>{title}</strong> because its HTML did not pass Syntax
        safety checks.
      </div>
    )
  }

  return (
    <iframe
      ref={iframeRef}
      title={`${title} (Sandboxed)`}
      sandbox="allow-scripts"
      srcDoc={srcDoc}
      style={{
        width: '100%',
        height: `${height}px`,
        border: '1px solid var(--sx-border)',
        borderRadius: '14px',
        background: 'var(--sx-surface)',
      }}
    />
  )
}
