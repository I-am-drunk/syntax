# Syntax Extensions v1 Architecture

General-purpose, browser-native extension architecture for Syntax built on SilverBullet's MIT-licensed PlugOS worker isolation model.

## Design Principles

1. **YAGNI.** Every module owns one concrete responsibility. No speculative hooks, event buses, custom compilers, or theme-extension overload.
2. **Author freedom, host ownership.** An extension owns its logic (`worker.js`) and custom UI (`view/index.html`). Syntax owns where contributions appear, user-saved documents, and guaranteed cleanup on disable/unload.
3. **Zero author build tool required.** A friend can write plain ES modules (`export function myCmd(ctx) {}`) and plain HTML/JS/CSS hosted on any CORS-enabled static server (or bundled with Vite/esbuild).
4. **Real fault isolation.** Background code runs in per-extension Web Workers (`WorkerSandbox`). Visual UI runs in opaque-origin sandboxed iframes (`sandbox="allow-scripts allow-forms"`, strictly no `allow-same-origin`).
5. **General-purpose first.** Supports standalone tools (`page`/`tab`), embeddable extensions (`embed`), command-only tools, and collaborating extensions via versioned services. Courses are simply one future consumer among many.

## V1 to V20 Simplification Summary

- **Removed custom compiler & archive VFS (V2):** Static URL + `extension.json` first; future archive format reuses the exact same `WorkerSandbox` Blob loader.
- **Deferred theme extensions (V3):** Core light/dark appearance stays in Settings; views receive read-only theme tokens.
- **Replaced PlugOS abstract `Hook<T>` & `EventBus` (V4, V5):** One typed Zustand `ContributionStore` (`commands`, `toolbar`, `views`) + explicit versioned `ServiceRegistry`.
- **Zero-dependency semver (V6):** 40-line pure TS `satisfiesSemver()` instead of adding external runtime packages.
- **Merged `Plug` + `WorkerSandbox` (V7) & Two-Blob dynamic `import()` bootstrap (V8):** Solves cross-origin `new Worker()` `SecurityError`, catches author `SyntaxError` in <50ms, maps stack traces via `//# sourceURL=`, and needs zero author SDK imports.
- **Direct `<iframe src>` with opaque origin (V9, V10):** Native relative asset loading, strict `event.source` + `event.origin === 'null'` + `(instanceId, activationId)` validation, double-`onload` navigation guard, zero `srcdoc` HTML rewriting bugs.
- **Staged atomic activation & updates (V16, V19):** Candidate workers boot and validate before replacing active state or committing UI contributions. Failed startup or bad update leaves zero debris.
- **User-owned IndexedDB `DocumentStore` (V14, V15):** Small `ExtensionRecord` metadata in `localStorage` for instant Safe Mode (`#/?safeMode=1`); user documents in IndexedDB with optimistic `revision` conflict checks that survive disable/uninstall/reinstall.

## Repository Hierarchy

```text
src/extensions/
  plugos/
    LICENSE.md           # SilverBullet MIT license (Copyright 2022, Zef Hemel)
    UPSTREAM.md          # Upstream commit 53452e220a9b4e5643fb2b9a7ca2151be51b3ab3 & diffs
    protocol.ts          # Worker & view RPC message types + ExtensionError
    workerSandbox.ts     # Two-Blob PlugOS WorkerSandbox (timeout, stop+reject, log forwarding)
  manifest.ts            # Zod v4 schema for extension.json, URL resolution, timed fetch, semver
  contributions.ts       # Per-extension owned Zustand ContributionStore (atomic commit/cleanup)
  services.ts            # Versioned ServiceRegistry (requires/optional, cycle & version checks)
  documents.ts           # User-owned IndexedDB DocumentStore (envelope + revision check)
  diagnostics.ts         # Bounded per-extension ring buffer, syntaxLog bridge, bug report, leak counters
  store.ts               # localStorage ExtensionRecord persistence, runtime status, isSafeMode()
  manager.ts             # Serialized lifecycle orchestrator + window.__SYNTAX_EXTENSIONS__ test hook
  ExtensionViewFrame.tsx # Opaque-origin sandboxed iframe host with instanceId/activationId retirement
  ExtensionPage.tsx      # Thin route wrapper (#/ext/:extensionId/:viewId/:docId?) with recovery UI
  catalog.ts             # Honest remote catalog fetcher (idle/loading/ready/error)
```

## Extension Authoring Rules (Cross-Origin Contract)

1. Host `extension.json`, `worker.js`, and any `view/*` files with `Access-Control-Allow-Origin: *` (required for both cross-origin worker fetch and `<script type="module">` inside opaque-origin sandboxed iframes).
2. Keep `worker.js` self-contained (or use absolute CORS URLs for imports; relative `./helper.js` ES imports are unsupported inside Blob Workers). Use `ctx.extension.assetUrl('./file.json')` for relative data fetches.
3. Custom views cannot access `window.localStorage` or `window.parent.document`; persist state through `syntax:view-call` RPC to the extension worker or host `DocumentStore`.

## Quick Start: Writing an Extension

Host three static files on any server that sends `Access-Control-Allow-Origin: *`:

### 1. `extension.json`

```json
{
  "formatVersion": 1,
  "id": "you.notes",
  "name": "Quick Notes",
  "version": "1.0.0",
  "worker": "./worker.js",
  "views": [
    { "id": "main", "title": "Notes", "entry": "./view/index.html", "placement": "page", "docTypes": ["note"] },
    { "id": "widget", "title": "Scratchpad", "entry": "./view/embed.html", "placement": "embed" }
  ],
  "commands": [
    { "id": "new-note", "title": "New Note", "run": "createNote" }
  ],
  "toolbar": [
    { "id": "open-notes", "label": "Notes", "viewId": "main" }
  ],
  "settings": [
    { "id": "defaultTitle", "type": "string", "label": "Default title", "default": "Untitled Note" }
  ]
}
```

### 2. `worker.js`

```js
export async function onActivate(ctx) {
  ctx.log.info('Quick Notes ready', await ctx.settings.get('defaultTitle'))
}

export async function createNote(ctx, body = '') {
  const title = await ctx.settings.get('defaultTitle')
  return await ctx.documents.create({ type: 'note', title, data: { body } })
}
```

### 3. `view/index.html` (Opaque-Origin View Bridge)

```html
<!doctype html>
<html>
<body>
  <script type="module">
    const CHANNEL = 'syntax-view-v1'
    let session = null
    window.addEventListener('message', (event) => {
      const msg = event.data
      if (msg?.channel !== CHANNEL) return
      if (msg.type === 'syntax:view-init') {
        session = msg
        // Apply msg.theme.mode and msg.theme.cssVars, then call worker or syscall via syntax:view-call
      }
    })
    window.parent.postMessage({ channel: CHANNEL, type: 'syntax:view-ready' }, '*')
  </script>
</body>
</html>
```
