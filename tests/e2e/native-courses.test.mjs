import assert from 'node:assert/strict'
import { execFile } from 'node:child_process'
import { createHash } from 'node:crypto'
import { mkdtemp, readFile, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { test } from 'node:test'
import { fileURLToPath } from 'node:url'
import { promisify } from 'node:util'
import { chromium } from 'playwright-core'
import { resolveBrowserExecutable, startE2EHarness } from './harness.mjs'

const run = promisify(execFile)
const REPO_ROOT = fileURLToPath(new URL('../../', import.meta.url))
const COMMIT = 'a43fb295e5af1b6a003bf71d3015038066df7c13'
const REMOTE_BASE = `https://raw.githubusercontent.com/syntax-platform/syntax-official-extensions/${COMMIT}/extensions`
const SIBLING_BASE = fileURLToPath(new URL('../../../syntax-official-extensions/extensions/', import.meta.url))

function parseHexRgb(color) {
  const hex = color.match(/^#([0-9a-f]{6})$/i)
  if (hex) {
    const n = parseInt(hex[1], 16)
    return [(n >> 16) & 255, (n >> 8) & 255, n & 255]
  }
  const rgb = color.match(/rgba?\((\d+),\s*(\d+),\s*(\d+)/i)
  if (rgb) return [Number(rgb[1]), Number(rgb[2]), Number(rgb[3])]
  throw new Error(`Unsupported color format: ${color}`)
}

function relativeLuminance([r, g, b]) {
  const toLinear = c => {
    const s = c / 255
    return s <= 0.03928 ? s / 12.92 : Math.pow((s + 0.055) / 1.055, 2.4)
  }
  return 0.2126 * toLinear(r) + 0.7152 * toLinear(g) + 0.0722 * toLinear(b)
}

function contrastRatio(c1, c2) {
  const l1 = relativeLuminance(parseHexRgb(c1))
  const l2 = relativeLuminance(parseHexRgb(c2))
  return (Math.max(l1, l2) + 0.05) / (Math.min(l1, l2) + 0.05)
}

async function loadCourseBundle(dirName) {
  try {
    const [mRaw, eRaw] = await Promise.all([
      readFile(join(SIBLING_BASE, dirName, 'releases', 'v1.0.1', 'manifest.json'), 'utf8'),
      readFile(join(SIBLING_BASE, dirName, 'releases', 'v1.0.1', 'main.js'), 'utf8'),
    ])
    const manifest = JSON.parse(mRaw)
    const normalized = eRaw.replace(/\r\n/g, '\n')
    const entry = createHash('sha256').update(eRaw).digest('hex') === manifest.sha256 ? eRaw : normalized
    if (createHash('sha256').update(entry).digest('hex') === manifest.sha256) {
      return { manifest, entry }
    }
  } catch {
    // Fall through to remote official build in CI.
  }
  const [mRes, eRes] = await Promise.all([
    fetch(`${REMOTE_BASE}/${dirName}/releases/v1.0.1/manifest.json`),
    fetch(`${REMOTE_BASE}/${dirName}/releases/v1.0.1/main.js`),
  ])
  assert.ok(mRes.ok && eRes.ok, `Could not load ${dirName} release bundle`)
  return { manifest: await mRes.json(), entry: await eRes.text() }
}

test('V1.2 MPM2D & second-subject courses: contrast, mobile CheckBar, keyboard nav, IDB v1->v2 upgrade, Library progress, Profile delete, and live @syntax/ui update', async t => {
  const [mpm2d, binary] = await Promise.all([
    loadCourseBundle('analytic-geometry-mpm2d'),
    loadCourseBundle('binary-basics'),
  ])

  const harness = await startE2EHarness()
  t.after(() => harness.close())

  const context = await harness.browser.newContext({ viewport: { width: 1280, height: 800 } })
  await context.addInitScript(() => {
    for (const prefix of ['', 'syntax-dev-']) {
      localStorage.setItem(`${prefix}syntax.prefs.v1`, JSON.stringify({ onboarded: true }))
    }
  })

  const page = await context.newPage()

  // Seed a genuine v1 IndexedDB (installs + data stores only, no progress store) on /syntax/ (where native runtime is disabled) before booting Dev
  await page.goto(`${harness.appOrigin}/syntax/#/`)
  await page.evaluate(async () => {
    const db = await new Promise((resolve, reject) => {
      const req = indexedDB.open('syntax-dev-syntax-native-extensions-v2', 1)
      req.onupgradeneeded = () => {
        req.result.createObjectStore('installs')
        req.result.createObjectStore('data')
      }
      req.onsuccess = () => resolve(req.result)
      req.onerror = () => reject(req.error)
    })
    await new Promise((resolve, reject) => {
      const tx = db.transaction('data', 'readwrite')
      tx.objectStore('data').put({ text: 'preserved-from-v1' }, 'legacy.v1-notes')
      tx.oncomplete = resolve
      tx.onabort = () => reject(tx.error)
    })
    db.close()
  })

  const mpm2dUrl = harness.extUrl('courses/mpm2d/manifest.json')
  const binaryUrl = harness.extUrl('courses/binary/manifest.json')
  await page.route('**/courses/*/*', route => {
    const url = route.request().url()
    const bundle = url.includes('/courses/mpm2d/') ? mpm2d : binary
    const isManifest = url.endsWith('/manifest.json')
    return route.fulfill({
      headers: { 'access-control-allow-origin': '*' },
      contentType: isManifest ? 'application/json' : 'text/javascript',
      body: isManifest ? JSON.stringify(bundle.manifest) : bundle.entry,
    })
  })

  // 1. Install both courses (triggers v1->v2 IndexedDB upgrade cleanly while preserving v1 data!)
  await page.goto(`${harness.appOrigin}/syntax-dev/#/extensions`)
  const native = page.getByRole('region', { name: 'Native extensions' })
  for (const url of [mpm2dUrl, binaryUrl]) {
    await native.getByRole('textbox', { name: 'Native manifest URL' }).fill(url)
    await native.getByRole('button', { name: 'Review native package' }).click()
    await native.getByRole('button', { name: 'Install native package' }).click()
  }

  // Verify v1 data survived the v1 -> v2 upgrade and appears in Profile's Saved Course Data!
  await page.goto(`${harness.appOrigin}/syntax-dev/#/profile`)
  await page.locator('[data-saved-course-row="legacy.v1-notes"]').waitFor()

  // 2. Open MPM2D from Library (Courses section)
  await page.goto(`${harness.appOrigin}/syntax-dev/#/library`)
  const mpm2dCard = page.locator('[data-native-course-id="syntax.mpm2d-analytic-geometry"]')
  await mpm2dCard.waitFor()
  await mpm2dCard.click()
  await page.locator('[data-syntax-ui="lesson-shell"][data-syntax-ui-version="0.1.0"]').waitFor()

  // 3. Verify WCAG AA contrast on axes, blue line, teal line, and amber point in BOTH light and dark mode
  async function verifyGraphContrast(expectedTheme) {
    const colors = await page.evaluate(() => {
      const fig = document.querySelector('[data-mpm2d-graph="true"]')
      const svg = fig?.querySelector('svg')
      return {
        theme: fig?.getAttribute('data-graph-theme'),
        bg: svg ? getComputedStyle(svg).backgroundColor : '',
        axis: svg?.querySelector('[data-graph-axis="x"]')?.getAttribute('stroke') || '',
        blue: svg?.querySelector('[data-graph-line="blue"]')?.getAttribute('stroke') || '',
        teal: svg?.querySelector('[data-graph-line="teal"]')?.getAttribute('stroke') || '',
        amber: svg?.querySelector('[data-graph-point="O"] circle')?.getAttribute('fill') || '',
      }
    })
    assert.equal(colors.theme, expectedTheme)
    assert.ok(contrastRatio(colors.axis, colors.bg) >= 4.5, `Axis contrast low in ${expectedTheme}: ${JSON.stringify(colors)}`)
    assert.ok(contrastRatio(colors.blue, colors.bg) >= 4.5, `Blue contrast low in ${expectedTheme}: ${JSON.stringify(colors)}`)
    assert.ok(contrastRatio(colors.teal, colors.bg) >= 4.5, `Teal contrast low in ${expectedTheme}: ${JSON.stringify(colors)}`)
    assert.ok(contrastRatio(colors.amber, colors.bg) >= 4.5, `Amber contrast low in ${expectedTheme}: ${JSON.stringify(colors)}`)
  }

  await page.evaluate(() => { document.documentElement.dataset.theme = 'light' })
  await page.waitForTimeout(80)
  await verifyGraphContrast('light')

  await page.evaluate(() => { document.documentElement.dataset.theme = 'dark' })
  await page.waitForTimeout(80)
  await verifyGraphContrast('dark')

  // 4. Advance to Step 2 and verify dark-mode ChoiceGroup border state + keyboard ArrowDown navigation!
  await page.getByRole('button', { name: 'Continue to question' }).click()
  const radioGroup = page.getByRole('radiogroup', { name: 'Perpendicular slope options' })
  await radioGroup.waitFor()
  const firstOption = radioGroup.locator('[data-choice-option]').first()
  const idleBorder = await firstOption.evaluate(el => getComputedStyle(el).borderColor)
  await firstOption.focus()
  await page.keyboard.press('ArrowDown')
  await page.keyboard.press('ArrowDown')
  const thirdOption = radioGroup.locator('[data-choice-option="c"]')
  assert.equal(await thirdOption.getAttribute('aria-checked'), 'true', 'ArrowDown must select option 3')
  const selectedBorder = await thirdOption.evaluate(el => getComputedStyle(el).borderColor)
  assert.notEqual(selectedBorder, idleBorder, 'Dark-mode selected choice border must visually stand out')

  // 5. Switch to mobile viewport (390x844) on Step 2 and verify sticky CheckBar sits ABOVE mobile tabbar!
  await page.setViewportSize({ width: 390, height: 844 })
  await page.waitForTimeout(100)
  const overflow = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth)
  assert.ok(overflow <= 2, `Expected zero mobile horizontal overflow, got ${overflow}px`)
  const checkBtn = page.getByRole('button', { name: 'Check answer' })
  const checkBox = await checkBtn.boundingBox()
  const tabBar = page.locator('.sx-mobile-tabbar')
  if (await tabBar.isVisible()) {
    const tabBox = await tabBar.boundingBox()
    assert.ok(checkBox && tabBox && checkBox.y + checkBox.height <= tabBox.y + 2,
      `CheckBar button (${JSON.stringify(checkBox)}) must sit above mobile tabbar (${JSON.stringify(tabBox)})`)
  }
  await checkBtn.click()
  await page.locator('[data-graph-right-angle="true"]').waitFor()
  await page.getByRole('button', { name: 'Continue to worked example' }).click()

  // Complete Step 3 on desktop
  await page.setViewportSize({ width: 1280, height: 800 })
  await page.getByRole('button', { name: 'Reveal step 1' }).click()
  await page.getByRole('radiogroup', { name: 'Final equation options' }).waitFor()
  await page.keyboard.press('1')
  await page.getByRole('button', { name: 'Check answer' }).click()
  await page.getByRole('button', { name: 'Finish lesson' }).click()
  await page.locator('[data-syntax-ui="completion-card"]').waitFor()

  // 6. Complete second-subject Binary Basics course
  await page.goto(`${harness.appOrigin}/syntax-dev/#/library`)
  await page.locator('[data-course-progress="syntax.mpm2d-analytic-geometry"]').filter({ hasText: '1 / 1 lesson complete' }).waitFor()

  await page.locator('[data-native-course-id="syntax.binary-basics"]').click()
  await page.getByRole('switch', { name: 'Bit 4' }).click()
  await page.getByRole('switch', { name: 'Bit 1' }).click()
  await page.getByRole('button', { name: 'Check bits' }).click()
  await page.getByRole('button', { name: 'Continue' }).click()
  await page.keyboard.press('2')
  await page.getByRole('button', { name: 'Check answer' }).click()
  await page.getByRole('button', { name: 'Finish lesson' }).click()
  await page.locator('[data-syntax-ui="completion-card"]').waitFor()

  // 7. Reinstall MPM2D and confirm progress persists in Library
  await page.goto(`${harness.appOrigin}/syntax-dev/#/extensions`)
  await native.getByRole('button', { name: 'Uninstall Analytic Geometry (MPM2D)' }).click()
  await native.getByRole('textbox', { name: 'Native manifest URL' }).fill(mpm2dUrl)
  await native.getByRole('button', { name: 'Review native package' }).click()
  await native.getByRole('button', { name: 'Install native package' }).click()
  await page.goto(`${harness.appOrigin}/syntax-dev/#/library`)
  await page.locator('[data-course-progress="syntax.mpm2d-analytic-geometry"]').filter({ hasText: '1 / 1 lesson complete' }).waitFor()

  // 8. Delete ONLY MPM2D saved data at bottom of Profile -> verify Binary Basics & legacy data remain intact
  await page.goto(`${harness.appOrigin}/syntax-dev/#/profile`)
  const savedSection = page.getByRole('region', { name: 'Saved Course Data' })
  const mpm2dRow = savedSection.locator('[data-saved-course-row="syntax.mpm2d-analytic-geometry"]')
  await mpm2dRow.getByRole('button', { name: /Delete saved data/ }).click()
  await mpm2dRow.getByRole('button', { name: 'Confirm delete' }).click()
  await mpm2dRow.waitFor({ state: 'detached' })
  await savedSection.locator('[data-saved-course-row="syntax.binary-basics"]').waitFor()
  await savedSection.locator('[data-saved-course-row="legacy.v1-notes"]').waitFor()

  await page.goto(`${harness.appOrigin}/syntax-dev/#/library`)
  assert.equal(await page.locator('[data-course-progress="syntax.mpm2d-analytic-geometry"]').count(), 0)
  await page.locator('[data-course-progress="syntax.binary-basics"]').filter({ hasText: '1 / 1 lesson complete' }).waitFor()

  // 9. Prove live @syntax/ui propagation WITHOUT rebuilding the installed extension!
  await t.test('installed extension picks up an updated host @syntax/ui control without rebuilding', async t => {
    const work = await mkdtemp(join(tmpdir(), 'syntax-live-ui-'))
    const buildV1 = join(work, 'host-v1')
    const buildV2 = join(work, 'host-v2')
    t.after(() => rm(work, { recursive: true, force: true }))

    await run(process.execPath, ['node_modules/vite/bin/vite.js', 'build', '--outDir', buildV1], {
      cwd: REPO_ROOT,
      env: { ...process.env, VITE_CHANNEL: 'dev', VITE_BASE: '/syntax-dev/', VITE_SYNTAX_UI_VERSION: '0.1.0' },
    })
    await run(process.execPath, ['node_modules/vite/bin/vite.js', 'build', '--outDir', buildV2], {
      cwd: REPO_ROOT,
      env: { ...process.env, VITE_CHANNEL: 'dev', VITE_BASE: '/syntax-dev/', VITE_SYNTAX_UI_VERSION: '0.2.0-live-update' },
    })

    const browser = await chromium.launch({ executablePath: resolveBrowserExecutable(), headless: true })
    t.after(() => browser.close())
    const prodCtx = await browser.newContext()
    await prodCtx.addInitScript(() => {
      localStorage.setItem('syntax-dev-syntax.prefs.v1', JSON.stringify({ onboarded: true }))
    })
    let activeHostDir = buildV1
    const hostedOrigin = 'https://syntax-platform.github.io'
    await prodCtx.route(`${hostedOrigin}/**`, route => {
      const pathname = new URL(route.request().url()).pathname
      if (pathname === '/syntax-dev/') return route.fulfill({ path: join(activeHostDir, 'index.html') })
      if (/^\/syntax-dev\/assets\/[\w.-]+$/.test(pathname)) {
        return route.fulfill({ path: join(activeHostDir, pathname.slice('/syntax-dev/'.length)) })
      }
      return route.fulfill({ status: 404 })
    })
    const pinnedBinaryUrl = `${REMOTE_BASE}/binary-basics/releases/v1.0.1/manifest.json`
    await prodCtx.route(`${REMOTE_BASE}/binary-basics/releases/v1.0.1/*`, route => {
      const isManifest = route.request().url().endsWith('/manifest.json')
      return route.fulfill({
        headers: { 'access-control-allow-origin': '*' },
        contentType: isManifest ? 'application/json' : 'text/javascript',
        body: isManifest ? JSON.stringify(binary.manifest) : binary.entry,
      })
    })

    const p = await prodCtx.newPage()
    await p.goto(`${hostedOrigin}/syntax-dev/#/extensions?native=${encodeURIComponent(pinnedBinaryUrl)}`)
    const region = p.getByRole('region', { name: 'Native extensions' })
    await region.getByRole('button', { name: 'Install native package' }).click()
    await region.locator('[data-native-install-success="syntax.binary-basics"]').getByRole('button', { name: /Open/ }).click()
    await p.locator('[data-syntax-ui="button"][data-syntax-ui-version="0.1.0"]').first().waitFor()

    // Swap ONLY the host build (extension main.js in IndexedDB is 100% untouched & un-rebuilt!)
    activeHostDir = buildV2
    await p.reload()
    await p.locator('[data-syntax-ui="button"][data-syntax-ui-version="0.2.0-live-update"]').first().waitFor()
  })
})
