import { spawn } from 'node:child_process'
import fs from 'node:fs'
import http from 'node:http'
import net from 'node:net'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { chromium } from 'playwright-core'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const REPO_ROOT = path.resolve(__dirname, '../..')
const FIXTURES_DIR = path.resolve(REPO_ROOT, 'tests/fixtures/extensions')

const MIME_TYPES = {
  '.json': 'application/json; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.mjs': 'text/javascript; charset=utf-8',
  '.html': 'text/html; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
}

function getFreePort(host) {
  return new Promise((resolve, reject) => {
    const srv = net.createServer()
    srv.unref()
    srv.on('error', reject)
    srv.listen(0, host, () => {
      const addr = srv.address()
      const port = typeof addr === 'object' && addr ? addr.port : 0
      srv.close(() => resolve(port))
    })
  })
}

export function resolveBrowserExecutable() {
  const candidates = [
    process.env.SYNTAX_E2E_BROWSER,
    'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe',
    'C:\\Program Files\\Microsoft\\Edge\\Application\\msedge.exe',
    'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe',
    '/usr/bin/chromium',
    '/usr/bin/chromium-browser',
    '/usr/bin/google-chrome',
    '/usr/bin/microsoft-edge',
  ].filter(Boolean)

  for (const p of candidates) {
    if (fs.existsSync(p)) return p
  }
  throw new Error('No Chromium/Edge binary found. Set SYNTAX_E2E_BROWSER.')
}

async function waitForHttp(url, timeoutMs = 20000) {
  const deadline = Date.now() + timeoutMs
  while (Date.now() < deadline) {
    try {
      const res = await fetch(url)
      if (res.ok) return
    } catch {
      // retry
    }
    await new Promise(r => setTimeout(r, 200))
  }
  throw new Error(`Timed out waiting for ${url}`)
}

function mutablePayload(mode) {
  if (mode === 'broken-v2') {
    return {
      manifest: {
        formatVersion: 1,
        id: 'tj.mutable',
        name: 'Mutable Extension',
        version: '2.0.0',
        worker: './worker.js',
        views: [{ id: 'panel', title: 'Mutable Panel', entry: './view.html', placement: 'page' }],
        commands: [{ id: 'info', title: 'Mutable Info', run: 'info' }],
      },
      worker: `
        export async function onActivate() {
          throw new Error('Broken v2 activation rollback test')
        }
        export async function info() { return 'broken-v2' }
      `,
    }
  }

  if (mode === 'good-v2') {
    return {
      manifest: {
        formatVersion: 1,
        id: 'tj.mutable',
        name: 'Mutable Extension',
        version: '2.0.0',
        worker: './worker.js',
        views: [{ id: 'panel', title: 'Mutable Panel', entry: './view.html', placement: 'page' }],
        commands: [{ id: 'info', title: 'Mutable Info', run: 'info' }],
      },
      worker: `
        export async function info() { return 'v2-ok' }
        export async function slowEcho(_ctx, tag, delayMs = 400) {
          await new Promise(r => setTimeout(r, delayMs))
          return 'v2:' + tag
        }
      `,
    }
  }

  return {
    manifest: {
      formatVersion: 1,
      id: 'tj.mutable',
      name: 'Mutable Extension',
      version: '1.0.0',
      worker: './worker.js',
      views: [{ id: 'panel', title: 'Mutable Panel', entry: './view.html', placement: 'page' }],
      commands: [{ id: 'info', title: 'Mutable Info', run: 'info' }],
    },
    worker: `
      export async function info() { return 'v1-ok' }
      export async function slowEcho(_ctx, tag, delayMs = 600) {
        await new Promise(r => setTimeout(r, delayMs))
        return 'v1:' + tag
      }
    `,
  }
}

const MUTABLE_VIEW_HTML = `<!doctype html>
<html lang="en">
<head><meta charset="utf-8" /><title>Mutable Panel</title></head>
<body>
  <div id="state">booting</div>
  <div id="result">none</div>
  <button id="slow-btn" type="button">Run Slow Echo</button>
  <script type="module">
    const CHANNEL = 'syntax-view-v1'
    let initData = null
    let seq = 0
    window.addEventListener('message', event => {
      const msg = event.data
      if (!msg || msg.channel !== CHANNEL) return
      if (msg.type === 'syntax:view-init') {
        initData = msg
        document.getElementById('state').textContent = 'ready:' + msg.activationId
      }
      if (msg.type === 'syntax:view-result') {
        document.getElementById('result').textContent = msg.ok
          ? 'ok:' + msg.result
          : 'err:' + (msg.error?.message || 'error')
      }
    })
    document.getElementById('slow-btn').addEventListener('click', () => {
      if (!initData) return
      window.parent.postMessage({
        channel: CHANNEL,
        type: 'syntax:view-call',
        instanceId: initData.instanceId,
        activationId: initData.activationId,
        callId: 'slow-' + (++seq),
        target: 'worker',
        method: 'slowEcho',
        args: ['from-old-view', 550],
      }, '*')
    })
    window.parent.postMessage({ channel: CHANNEL, type: 'syntax:view-ready' }, '*')
  </script>
</body>
</html>`

export async function startE2EHarness({ nativeStarterDirectory, channel } = {}) {
  const vitePort = await getFreePort('127.0.0.1')
  const extPort = await getFreePort('127.0.0.1')
  const appOrigin = `http://localhost:${vitePort}`
  const extOrigin = `http://127.0.0.1:${extPort}`

  let mutableMode = 'v1'

  const extServer = http.createServer((req, res) => {
    const reqUrl = new URL(req.url || '/', extOrigin)
    const pathname = decodeURIComponent(reqUrl.pathname)

    const isStrictCorsModule = pathname === '/strict-cors/mod.js'
    const acao = isStrictCorsModule ? appOrigin : '*'

    res.setHeader('Access-Control-Allow-Origin', acao)
    res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS')
    res.setHeader('Cache-Control', 'no-store')

    if (req.method === 'OPTIONS') {
      res.writeHead(204)
      res.end()
      return
    }

    if (nativeStarterDirectory && (pathname === '/native-starter/manifest.json' || pathname === '/native-starter/main.js')) {
      const filename = path.basename(pathname)
      res.writeHead(200, { 'Content-Type': MIME_TYPES[path.extname(filename)] })
      fs.createReadStream(path.resolve(nativeStarterDirectory, filename)).pipe(res)
      return
    }

    if (pathname === '/sdk/syntax-view-v1.js') {
      const sdkPath = path.resolve(REPO_ROOT, 'public/sdk/syntax-view-v1.js')
      res.writeHead(200, { 'Content-Type': MIME_TYPES['.js'] })
      fs.createReadStream(sdkPath).pipe(res)
      return
    }

    if (pathname.startsWith('/mutable-ext/')) {
      const payload = mutablePayload(mutableMode)
      if (pathname === '/mutable-ext/extension.json') {
        res.writeHead(200, { 'Content-Type': MIME_TYPES['.json'] })
        res.end(JSON.stringify(payload.manifest))
        return
      }
      if (pathname === '/mutable-ext/worker.js') {
        res.writeHead(200, { 'Content-Type': MIME_TYPES['.js'] })
        res.end(payload.worker)
        return
      }
      if (pathname === '/mutable-ext/view.html') {
        res.writeHead(200, { 'Content-Type': MIME_TYPES['.html'] })
        res.end(MUTABLE_VIEW_HTML)
        return
      }
    }

    const rel = pathname.replace(/^\/+/, '')
    const absPath = path.resolve(FIXTURES_DIR, rel)
    if (!absPath.startsWith(FIXTURES_DIR) || !fs.existsSync(absPath) || fs.statSync(absPath).isDirectory()) {
      res.writeHead(404, { 'Content-Type': 'text/plain; charset=utf-8' })
      res.end('Not found')
      return
    }

    const ext = path.extname(absPath).toLowerCase()
    res.writeHead(200, { 'Content-Type': MIME_TYPES[ext] || 'application/octet-stream' })
    fs.createReadStream(absPath).pipe(res)
  })

  await new Promise(resolve => extServer.listen(extPort, '127.0.0.1', resolve))

  const viteEntry = path.resolve(REPO_ROOT, 'node_modules/vite/bin/vite.js')
  const viteProc = spawn(
    process.execPath,
    [viteEntry, '--host', 'localhost', '--port', String(vitePort), '--strictPort'],
    {
      cwd: REPO_ROOT,
      env: channel ? { ...process.env, VITE_CHANNEL: channel } : process.env,
      stdio: ['ignore', 'pipe', 'pipe'],
      windowsHide: true,
    },
  )

  let viteLog = ''
  viteProc.stdout?.on('data', d => { viteLog += d.toString() })
  viteProc.stderr?.on('data', d => { viteLog += d.toString() })

  try {
    await waitForHttp(appOrigin)
  } catch (err) {
    viteProc.kill()
    extServer.close()
    throw new Error(`${err.message}\nVite log:\n${viteLog}`)
  }

  const browser = await chromium.launch({
    executablePath: resolveBrowserExecutable(),
    headless: true,
  })

  return {
    appOrigin,
    extOrigin,
    browser,
    extUrl(relPath) {
      return `${extOrigin}/${relPath.replace(/^\/+/, '')}`
    },
    setMutableMode(mode) {
      mutableMode = mode
    },
    async close() {
      await browser.close().catch(() => {})
      await new Promise(resolve => extServer.close(() => resolve()))
      if (!viteProc.killed) {
        viteProc.kill()
      }
    },
  }
}
