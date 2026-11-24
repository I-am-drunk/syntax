import * as fs from 'node:fs'
import * as path from 'node:path'
import { execFileSync } from 'node:child_process'
import { REPO_ROOT } from './loader.js'
import type { ToolResult } from './types.js'

const CHROME_CANDIDATES = [
  'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe',
  'C:\\Program Files (x86)\\Google\\Chrome\\Application\\chrome.exe',
  'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe',
  'C:\\Program Files\\Microsoft\\Edge\\Application\\msedge.exe',
  '/usr/bin/google-chrome',
  '/usr/bin/chromium',
  '/usr/bin/chromium-browser',
]

function findBrowser(): string | null {
  for (const p of CHROME_CANDIDATES) {
    if (fs.existsSync(p)) return p
  }
  return null
}

export async function previewPage(opts: {
  url: string
  outPath: string
  viewport?: 'desktop' | 'phone'
  theme?: 'light' | 'dark'
}): Promise<ToolResult> {
  const browser = findBrowser()
  if (!browser) {
    return {
      ok: false,
      summary: 'Headless Chrome/Edge binary not found.',
      evidence: { searched: CHROME_CANDIDATES },
      unknowns: ['Install Chrome or Edge to enable headless screenshot previews.'],
    }
  }

  const width = opts.viewport === 'phone' ? 390 : 1280
  const height = opts.viewport === 'phone' ? 844 : 900
  const absOut = path.isAbsolute(opts.outPath) ? opts.outPath : path.join(REPO_ROOT, opts.outPath)
  fs.mkdirSync(path.dirname(absOut), { recursive: true })

  try {
    execFileSync(
      browser,
      [
        '--headless=new',
        '--disable-gpu',
        `--window-size=${width},${height}`,
        '--virtual-time-budget=3000',
        `--screenshot=${absOut}`,
        opts.url,
      ],
      { timeout: 25000, stdio: 'pipe' },
    )
    return {
      ok: fs.existsSync(absOut),
      summary: `Captured ${opts.viewport ?? 'desktop'} screenshot to ${absOut}.`,
      evidence: { browser, url: opts.url, screenshotPath: absOut, width, height },
      unknowns: [],
    }
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err)
    return {
      ok: false,
      summary: `Headless preview failed: ${msg}`,
      evidence: { browser, url: opts.url },
      unknowns: ['Ensure Vite dev server is running at the target URL.'],
    }
  }
}
