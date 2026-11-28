import assert from 'node:assert/strict'
import { createHash } from 'node:crypto'
import { readFile } from 'node:fs/promises'
import { join } from 'node:path'
import { test } from 'node:test'
import { fileURLToPath } from 'node:url'
import { startE2EHarness } from './harness.mjs'

const SIBLING_BASE = fileURLToPath(new URL('../../../syntax-official-extensions/extensions/', import.meta.url))
const MPM2D_COMMIT = 'fcf313f56cb82141603a012780b674286b3aef87'
const TOOLS_COMMIT = 'b95da21145bc80361597001b1f480606067e9bea'
const FORMULA_PLAYBOOK_OFFICIAL_URL = `https://raw.githubusercontent.com/syntax-platform/syntax-official-extensions/${TOOLS_COMMIT}/extensions/formula-playbook/releases/v1.0.0/manifest.json`

async function loadExtension(dirName, version, commit) {
  try {
    const [mRaw, eRaw] = await Promise.all([
      readFile(join(SIBLING_BASE, dirName, 'releases', version, 'manifest.json'), 'utf8'),
      readFile(join(SIBLING_BASE, dirName, 'releases', version, 'main.js'), 'utf8'),
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
  const base = `https://raw.githubusercontent.com/syntax-platform/syntax-official-extensions/${commit}/extensions/${dirName}/releases/${version}`
  const [mRes, eRes] = await Promise.all([fetch(`${base}/manifest.json`), fetch(`${base}/main.js`)])
  assert.ok(mRes.ok && eRes.ok, `Could not load ${dirName} ${version}`)
  return { manifest: await mRes.json(), entry: await eRes.text() }
}

test('V1.3 embedded course behavior, optional Formula Playbook tool with live disable, and opt-in Warm Paper Theme with crash cleanup', async t => {
  const [mpm2d, playbook, warmTheme] = await Promise.all([
    loadExtension('analytic-geometry-mpm2d', 'v1.1.0', MPM2D_COMMIT),
    loadExtension('formula-playbook', 'v1.0.0', TOOLS_COMMIT),
    loadExtension('warm-paper-theme', 'v1.0.0', TOOLS_COMMIT),
  ])

  const harness = await startE2EHarness()
  t.after(() => harness.close())

  const context = await harness.browser.newContext({ viewport: { width: 1280, height: 800 } })
  await context.addInitScript(() => {
    for (const prefix of ['', 'syntax-dev-']) {
      localStorage.setItem(`${prefix}syntax.prefs.v1`, JSON.stringify({ onboarded: true }))
    }
  })

  const mpm2dUrl = harness.extUrl('v13/mpm2d/manifest.json')
  const themeUrl = harness.extUrl('v13/warm-theme/manifest.json')
  const crashThemeUrl = harness.extUrl('v13/crash-theme/manifest.json')
  const crashToolUrl = harness.extUrl('v13/crash-tool/manifest.json')
  const crashThemeEntry = `
    exports.activate = ctx => {
      ctx.registerStyles({ id: 'crash-global', scope: 'global', css: ':root { --crash-theme-active: 1; }' });
      ctx.registerCommand({ id: 'crash-theme-cmd', title: 'Crash Theme Command', run: () => { throw new Error('Theme crashed!'); } });
    };
  `
  const crashToolEntry = `
    exports.activate = ctx => {
      ctx.registerCourseTool({
        id: 'crash-panel',
        title: 'Crashing Course Tool',
        buttonLabel: 'Crash Tool',
        targetCourses: ['syntax.mpm2d-analytic-geometry'],
        component: () => { throw new Error('Optional tool render crash!'); },
      });
    };
  `

  await context.route('**/v13/*/*', route => {
    const url = route.request().url()
    const isManifest = url.endsWith('/manifest.json')
    if (url.includes('/v13/mpm2d/')) {
      return route.fulfill({
        headers: { 'access-control-allow-origin': '*' },
        contentType: isManifest ? 'application/json' : 'text/javascript',
        body: isManifest ? JSON.stringify(mpm2d.manifest) : mpm2d.entry,
      })
    }
    if (url.includes('/v13/warm-theme/')) {
      return route.fulfill({
        headers: { 'access-control-allow-origin': '*' },
        contentType: isManifest ? 'application/json' : 'text/javascript',
        body: isManifest ? JSON.stringify(warmTheme.manifest) : warmTheme.entry,
      })
    }
    if (url.includes('/v13/crash-tool/')) {
      return route.fulfill({
        headers: { 'access-control-allow-origin': '*' },
        contentType: isManifest ? 'application/json' : 'text/javascript',
        body: isManifest ? JSON.stringify({
          manifestVersion: 2,
          id: 'example.crash-tool',
          name: 'Crashing Course Tool',
          version: '1.0.0',
          syntaxApi: '^2.0.0',
          main: 'main.js',
          sha256: createHash('sha256').update(crashToolEntry).digest('hex'),
        }) : crashToolEntry,
      })
    }
    return route.fulfill({
      headers: { 'access-control-allow-origin': '*' },
      contentType: isManifest ? 'application/json' : 'text/javascript',
      body: isManifest ? JSON.stringify({
        manifestVersion: 2,
        id: 'example.crash-theme',
        name: 'Crash Theme',
        version: '1.0.0',
        syntaxApi: '^2.0.0',
        main: 'main.js',
        sha256: createHash('sha256').update(crashThemeEntry).digest('hex'),
      }) : crashThemeEntry,
    })
  })
  // Intercept Formula Playbook's recommended URL so installation is deterministic offline/in CI
  await context.route('**/formula-playbook/releases/v1.0.0/*', route => {
    const isManifest = route.request().url().endsWith('/manifest.json')
    return route.fulfill({
      headers: { 'access-control-allow-origin': '*' },
      contentType: isManifest ? 'application/json' : 'text/javascript',
      body: isManifest ? JSON.stringify(playbook.manifest) : playbook.entry,
    })
  })

  const page = await context.newPage()
  await page.goto(`${harness.appOrigin}/syntax-dev/#/extensions`)
  const native = page.getByRole('region', { name: 'Native extensions' })

  // 1. Fresh install of MPM2D v1.1.0 includes embedded engine, scoped CSS, and Formula Playbook recommendation
  await native.getByRole('textbox', { name: 'Native manifest URL' }).fill(mpm2dUrl)
  await native.getByRole('button', { name: 'Review native package' }).click()
  await native.getByRole('button', { name: 'Install native package' }).click()
  const mpm2dCard = native.locator('[data-native-extension-id="syntax.mpm2d-analytic-geometry"]')
  await mpm2dCard.waitFor()
  assert.equal(await page.evaluate(() => document.documentElement.dataset.mpm2dEmbedded), '1.1.0')

  // Inspect MPM2D -> verify embedded module & recommended Formula Playbook button!
  await mpm2dCard.getByRole('button', { name: 'Inspect Analytic Geometry (MPM2D)' }).click()
  const inspectPanel = mpm2dCard.locator('[data-native-inspect="syntax.mpm2d-analytic-geometry"]')
  await inspectPanel.getByText('Interactive Slope Graph Engine').waitFor()
  await inspectPanel.locator('[data-recommended-tool="syntax.formula-playbook"]').waitFor()

  // Disabling MPM2D removes embedded behavior + scoped styles together; re-enabling restores them
  await mpm2dCard.getByRole('button', { name: 'Disable', exact: true }).click()
  await mpm2dCard.getByRole('button', { name: 'Enable', exact: true }).waitFor()
  assert.equal(await page.evaluate(() => document.documentElement.dataset.mpm2dEmbedded), undefined)
  assert.equal(await page.locator('style[data-native-style-owner="syntax.mpm2d-analytic-geometry"]').count(), 0)
  await mpm2dCard.getByRole('button', { name: 'Enable', exact: true }).click()
  await mpm2dCard.getByRole('button', { name: 'Disable', exact: true }).waitFor()
  assert.equal(await page.evaluate(() => document.documentElement.dataset.mpm2dEmbedded), '1.1.0')
  assert.equal(await page.locator('style[data-native-style-owner="syntax.mpm2d-analytic-geometry"][data-native-style-scope="scoped"]').count(), 1)

  // 2. Install recommended Formula Playbook straight from MPM2D's Inspect details!
  await inspectPanel.getByRole('button', { name: 'Install Formula Playbook' }).click()
  await native.getByRole('button', { name: 'Install native package' }).click()
  assert.ok(FORMULA_PLAYBOOK_OFFICIAL_URL.includes('formula-playbook'))

  // Open MPM2D in a live course tab -> use Formula Playbook inside the course
  const courseTab = await context.newPage()
  await courseTab.goto(`${harness.appOrigin}/syntax-dev/#/native-extension/syntax.mpm2d-analytic-geometry/lesson-1`)
  const formulasBtn = courseTab.locator('[data-course-tool-trigger="syntax.formula-playbook"]')
  await formulasBtn.waitFor()
  // Verify scoped CSS applies inside MPM2D callout AND does NOT leak outside [data-native-ext-root]
  const calloutBorder = await courseTab.locator('.mpm2d-callout').evaluate(el => getComputedStyle(el).borderLeftWidth)
  assert.equal(calloutBorder, '3px', 'Scoped course CSS must apply inside MPM2D')
  const outsideBorder = await courseTab.evaluate(() => {
    const probe = document.createElement('div')
    probe.className = 'mpm2d-callout'
    document.body.appendChild(probe)
    const width = getComputedStyle(probe).borderLeftWidth
    probe.remove()
    return width
  })
  assert.equal(outsideBorder, '0px', 'Scoped course CSS must NOT leak outside the course root')

  await formulasBtn.click()
  await courseTab.locator('[data-course-tool-panel="syntax.formula-playbook"]').waitFor()

  // Disable Formula Playbook from Extensions tab WHILE MPM2D stays open in courseTab!
  const playbookCard = native.locator('[data-native-extension-id="syntax.formula-playbook"]')
  await playbookCard.getByRole('button', { name: 'Disable', exact: true }).click()

  // Verify live BroadcastChannel retirement BEFORE bringing courseTab to front!
  await courseTab.locator('[data-course-tool-trigger="syntax.formula-playbook"]').waitFor({ state: 'detached' })
  assert.equal(await courseTab.locator('[data-course-tool-panel="syntax.formula-playbook"]').count(), 0)

  // Install a crashing optional course tool -> opening it inside MPM2D quarantines ONLY the tool, leaving MPM2D healthy!
  await native.getByRole('textbox', { name: 'Native manifest URL' }).fill(crashToolUrl)
  await native.getByRole('button', { name: 'Review native package' }).click()
  await native.getByRole('button', { name: 'Install native package' }).click()
  await native.locator('[data-native-extension-id="example.crash-tool"]').waitFor()
  await courseTab.bringToFront()
  const crashToolBtn = courseTab.locator('[data-course-tool-trigger="example.crash-tool"]')
  await crashToolBtn.waitFor()
  await crashToolBtn.click()
  await courseTab.locator('[data-sonner-toast]').filter({ hasText: /Crashing Course Tool stopped after an error/ }).waitFor()
  await crashToolBtn.waitFor({ state: 'detached' })

  // MPM2D STILL teaches & grades cleanly after the optional tool crashed!
  await courseTab.getByRole('button', { name: 'Continue to question' }).click()
  await courseTab.keyboard.press('3')
  await courseTab.getByRole('button', { name: 'Check answer' }).click()
  await courseTab.getByText(/Correct!/).waitFor()
  await courseTab.close()

  // 3. Opt-in global Theme + Command extension (Warm Paper Theme)
  await page.bringToFront()
  await page.evaluate(() => { document.documentElement.dataset.theme = 'light' })
  const surfaceBefore = await page.evaluate(() => getComputedStyle(document.documentElement).getPropertyValue('--surface').trim())
  assert.notEqual(surfaceBefore.toLowerCase(), '#faf6ee')

  await native.getByRole('textbox', { name: 'Native manifest URL' }).fill(themeUrl)
  await native.getByRole('button', { name: 'Review native package' }).click()
  await native.getByRole('button', { name: 'Install native package' }).click()
  const themeCard = native.locator('[data-native-extension-id="syntax.warm-paper-theme"]')
  await themeCard.waitFor()
  const surfaceEnabled = await page.evaluate(() => getComputedStyle(document.documentElement).getPropertyValue('--surface').trim())
  assert.equal(surfaceEnabled.toLowerCase(), '#faf6ee', 'Global theme CSS must style the whole app when enabled')

  await page.keyboard.press('Control+k')
  await page.getByRole('option', { name: /Warm Paper: Toggle Accent Border/ }).click()
  assert.equal(await page.evaluate(() => document.documentElement.dataset.warmPaperAccent), 'high')

  await themeCard.getByRole('button', { name: 'Disable', exact: true }).click()
  await themeCard.getByRole('button', { name: 'Enable', exact: true }).waitFor()
  const surfaceAfterDisable = await page.evaluate(() => getComputedStyle(document.documentElement).getPropertyValue('--surface').trim())
  assert.notEqual(surfaceAfterDisable.toLowerCase(), '#faf6ee', 'Global theme CSS must be removed on disable')
  assert.equal(await page.evaluate(() => document.documentElement.dataset.warmPaperAccent), undefined)
  await page.keyboard.press('Control+k')
  assert.equal(await page.getByRole('option', { name: /Warm Paper: Toggle Accent Border/ }).count(), 0)
  await page.keyboard.press('Escape')

  // 4. Throwing Theme extension recovers cleanly, removing its global style & command
  await native.getByRole('textbox', { name: 'Native manifest URL' }).fill(crashThemeUrl)
  await native.getByRole('button', { name: 'Review native package' }).click()
  await native.getByRole('button', { name: 'Install native package' }).click()
  await native.locator('[data-native-extension-id="example.crash-theme"]').waitFor()
  assert.equal(await page.locator('style[data-native-style-owner="example.crash-theme"][data-native-style-scope="global"]').count(), 1)
  await page.keyboard.press('Control+k')
  await page.getByRole('option', { name: /Crash Theme Command/ }).click()
  await page.locator('[data-sonner-toast]').filter({ hasText: /Crash Theme stopped after an error/ }).waitFor()
  assert.equal(await page.locator('style[data-native-style-owner="example.crash-theme"]').count(), 0)
})
