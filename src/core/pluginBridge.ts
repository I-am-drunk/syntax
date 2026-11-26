/**
 * Hardened `window.Syntax` sandboxed iframe bridge.
 * - Per-instance isolation (`instanceId`) so multiple blocks on one lesson never collide
 * - Strict CSP by default when `networkAccess === 'none'`
 * - Live theme token inheritance from `document.documentElement` (respects active Theme Packs!)
 * - Synchronous `window.Syntax` SDK: theme, props, permissions, onThemeChange, storage, toast, reportResult, resize
 */
import type { PluginPermission } from './packages'

export type SandboxThemeTokens = {
  bg: string
  fg: string
  muted: string
  border: string
  accent: string
}

export type PluginBlockResult = {
  correct?: boolean
  score?: number
  summary?: string
}

/**
 * Reads live computed CSS tokens from the host root so sandboxed widgets automatically
 * inherit both Dark/Light mode and any active Theme Pack plugin.
 */
export function getHostThemeTokens(theme: 'light' | 'dark'): SandboxThemeTokens {
  const fallback: SandboxThemeTokens =
    theme === 'dark'
      ? { bg: '#1c1c1c', fg: '#f3f3f3', muted: '#a1a1a1', border: '#2e2e2e', accent: '#456dff' }
      : { bg: '#ffffff', fg: '#141414', muted: '#5c5c5c', border: '#e5e5e5', accent: '#456dff' }

  if (typeof window === 'undefined' || typeof document === 'undefined') {
    return fallback
  }
  try {
    const cs = getComputedStyle(document.documentElement)
    const pick = (name: string, fb: string) => cs.getPropertyValue(name).trim() || fb
    return {
      bg: pick('--surface', fallback.bg),
      fg: pick('--text-primary', fallback.fg),
      muted: pick('--text-secondary', fallback.muted),
      border: pick('--border', fallback.border),
      accent: pick('--accent', pick('--accent-blue', fallback.accent)),
    }
  } catch {
    return fallback
  }
}

function safeJsonForScript(value: unknown): string {
  return JSON.stringify(value ?? null)
    .replace(/<\/script/gi, '<\\/script')
    .replace(/\u2028/g, '\\u2028')
    .replace(/\u2029/g, '\\u2029')
}

export function buildSandboxSrcDoc(opts: {
  pluginId: string
  instanceId: string
  html: string
  theme: 'light' | 'dark'
  tokens: SandboxThemeTokens
  permissions: readonly PluginPermission[]
  networkAccess: 'none' | 'allowlisted'
  props?: Record<string, unknown>
}): string {
  const { pluginId, instanceId, html, theme, tokens, permissions, networkAccess, props } = opts

  const cspMeta =
    networkAccess === 'none'
      ? `<meta http-equiv="Content-Security-Policy" content="default-src 'none'; script-src 'unsafe-inline'; style-src 'unsafe-inline'; img-src data: blob:; font-src data:;" />`
      : `<meta http-equiv="Content-Security-Policy" content="default-src 'none'; script-src 'unsafe-inline'; style-src 'unsafe-inline'; img-src data: blob: https:; font-src data: https:; connect-src https:;" />`

  const safePid = safeJsonForScript(pluginId)
  const safeInstance = safeJsonForScript(instanceId)
  const safeTheme = safeJsonForScript(theme)
  const safeProps = safeJsonForScript(props ?? {})
  const safePerms = safeJsonForScript(permissions)

  return `<!doctype html>
<html lang="en" data-theme="${theme}">
<head>
<meta charset="utf-8" />
${cspMeta}
<style>
  :root {
    --sx-bg: ${tokens.bg};
    --sx-fg: ${tokens.fg};
    --sx-muted: ${tokens.muted};
    --sx-border: ${tokens.border};
    --sx-accent: ${tokens.accent};
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
    var pid = ${safePid};
    var iid = ${safeInstance};
    var currentTheme = ${safeTheme};
    var initialProps = ${safeProps};
    var grantedPermissions = ${safePerms};
    var themeListeners = [];
    var pendingRpc = {};
    var rpcCounter = 0;
    var lastHeight = 0;

    function send(type, payload) {
      parent.postMessage(Object.assign({ type: type, pluginId: pid, instanceId: iid }, payload || {}), '*');
    }

    function reportError(msg) {
      send('syntax:sandbox-error', {
        message: String(msg || 'Plugin runtime error').slice(0, 500)
      });
    }

    function rpc(method, args) {
      return new Promise(function (resolve, reject) {
        var reqId = iid + ':' + (++rpcCounter);
        pendingRpc[reqId] = { resolve: resolve, reject: reject };
        send('syntax:rpc', { reqId: reqId, method: method, args: args || {} });
        setTimeout(function () {
          if (pendingRpc[reqId]) {
            delete pendingRpc[reqId];
            reject(new Error('Syntax RPC timed out: ' + method));
          }
        }, 4000);
      });
    }

    window.Syntax = {
      get theme() { return currentTheme; },
      props: initialProps,
      permissions: grantedPermissions.slice(),
      onThemeChange: function (cb) {
        if (typeof cb === 'function') themeListeners.push(cb);
        return function () {
          themeListeners = themeListeners.filter(function (fn) { return fn !== cb; });
        };
      },
      storage: {
        get: function (key) { return rpc('storage.get', { key: String(key) }); },
        set: function (key, value) { return rpc('storage.set', { key: String(key), value: value }); },
        remove: function (key) { return rpc('storage.remove', { key: String(key) }); }
      },
      toast: function (message) {
        send('syntax:toast', { message: String(message || '').slice(0, 180) });
      },
      reportResult: function (result) {
        if (!result || typeof result !== 'object') return;
        send('syntax:report-result', {
          correct: typeof result.correct === 'boolean' ? result.correct : undefined,
          score: typeof result.score === 'number' ? result.score : undefined,
          summary: typeof result.summary === 'string' ? result.summary.slice(0, 200) : undefined
        });
      },
      resize: function (height) {
        var h = Math.ceil(Number(height));
        if (Number.isFinite(h) && h > 0 && h !== lastHeight) {
          lastHeight = h;
          send('syntax:sandbox-resize', { height: h });
        }
      }
    };

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
      if (!d || d.pluginId !== pid) return;
      if (d.instanceId && d.instanceId !== iid) return;

      if (d.type === 'syntax:theme' && d.tokens) {
        currentTheme = d.theme || 'light';
        document.documentElement.dataset.theme = currentTheme;
        var r = document.documentElement.style;
        r.setProperty('--sx-bg', d.tokens.bg);
        r.setProperty('--sx-fg', d.tokens.fg);
        r.setProperty('--sx-muted', d.tokens.muted);
        r.setProperty('--sx-border', d.tokens.border);
        if (d.tokens.accent) r.setProperty('--sx-accent', d.tokens.accent);
        for (var i = 0; i < themeListeners.length; i++) {
          try { themeListeners[i](currentTheme, d.tokens); } catch (err) { reportError(err); }
        }
      } else if (d.type === 'syntax:rpc-reply' && d.reqId && pendingRpc[d.reqId]) {
        var entry = pendingRpc[d.reqId];
        delete pendingRpc[d.reqId];
        if (d.ok) entry.resolve(d.result);
        else entry.reject(new Error(d.error || 'RPC failed'));
      }
    });

    function reportHeight() {
      var rootEl = document.getElementById('sx-sandbox-root');
      if (!rootEl) return;
      var rectH = Math.ceil(rootEl.getBoundingClientRect().height);
      var scrollH = Math.ceil(rootEl.scrollHeight);
      var h = Math.max(rectH, scrollH) + 36;
      if (h !== lastHeight) {
        lastHeight = h;
        send('syntax:sandbox-resize', { height: h });
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
      send('syntax:sandbox-ready');
      reportHeight();
    });
  })();
</script>
</head>
<body>
<div id="sx-sandbox-root">${html}</div>
</body>
</html>`
}
