import assert from 'node:assert/strict'
import { execFile } from 'node:child_process'
import { createHash } from 'node:crypto'
import { existsSync } from 'node:fs'
import { mkdtemp, readFile, rm, writeFile } from 'node:fs/promises'
import http from 'node:http'
import { tmpdir } from 'node:os'
import { extname, join, resolve } from 'node:path'
import { test } from 'node:test'
import { fileURLToPath } from 'node:url'
import { promisify } from 'node:util'
import { startE2EHarness } from './harness.mjs'

const run = promisify(execFile)
const root = fileURLToPath(new URL('../../', import.meta.url))

function runNpm(args, cwd) {
  const npm = process.env.npm_execpath
  if (npm) return run(process.execPath, [npm, ...args], { cwd })
  if (process.platform === 'win32') {
    return run(process.env.ComSpec ?? 'cmd.exe', ['/d', '/s', '/c', `npm ${args.join(' ')}`], { cwd })
  }
  return run('npm', args, { cwd })
}

// Minimal 1x1 PNG listing screenshot served separately from the course download
const PREVIEW_PNG = Buffer.from(
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==',
  'base64',
)

test('V1.4 Build a Course & Build a Tool starters, Community Hub discovery with separate previews, direct links, and alpha auto-updates', async t => {
  const work = await mkdtemp(join(tmpdir(), 'syntax-v14-'))
  const courseDir = join(work, 'starter-course')
  const toolDir = join(work, 'starter-tool')
  t.after(() => rm(work, { recursive: true, force: true }))

  // 1. Follow Build a Course and Build a Tool from fresh checkout
  await run(process.execPath, ['scripts/init-native-extension.mjs', courseDir, '--course'], { cwd: root })
  await run(process.execPath, ['scripts/init-native-extension.mjs', toolDir], { cwd: root })
  await Promise.all([
    runNpm(['ci', '--no-audit', '--no-fund'], courseDir),
    runNpm(['ci', '--no-audit', '--no-fund'], toolDir),
  ])
  await Promise.all([
    runNpm(['run', 'build'], courseDir),
    runNpm(['run', 'build'], toolDir),
  ])
  const [courseCheck, toolCheck] = await Promise.all([
    run(process.execPath, ['scripts/check-native-extension.mjs', '--json', join(courseDir, 'dist/manifest.json')], { cwd: root }),
    run(process.execPath, ['scripts/check-native-extension.mjs', '--json', join(toolDir, 'dist/manifest.json')], { cwd: root }),
  ])
  assert.equal(JSON.parse(courseCheck.stdout).ok, true)
  assert.equal(JSON.parse(toolCheck.stdout).ok, true)

  const [courseManifestRaw, courseEntry, toolManifestRaw, toolEntry] = await Promise.all([
    readFile(join(courseDir, 'dist/manifest.json'), 'utf8'),
    readFile(join(courseDir, 'dist/main.js'), 'utf8'),
    readFile(join(toolDir, 'dist/manifest.json'), 'utf8'),
    readFile(join(toolDir, 'dist/main.js'), 'utf8'),
  ])
  const courseManifest = JSON.parse(courseManifestRaw)
  const toolManifest = JSON.parse(toolManifestRaw)

  // Build v1.1.0 broken update + v1.2.0 valid update for the course
  const courseV12Entry = courseEntry.replace('Spotting Growing Patterns', 'Spotting Growing Patterns (v1.2.0)')
  const courseV12Manifest = {
    ...courseManifest,
    version: '1.2.0',
    sha256: createHash('sha256').update(courseV12Entry).digest('hex'),
  }
  const courseV11BrokenEntry = `exports.activate = () => { throw new Error('Broken v1.1.0 update'); };`
  const courseV11BrokenManifest = {
    ...courseManifest,
    version: '1.1.0',
    sha256: createHash('sha256').update(courseV11BrokenEntry).digest('hex'),
  }

  const harness = await startE2EHarness()
  t.after(() => harness.close())

  const context = await harness.browser.newContext({ viewport: { width: 1280, height: 800 } })
  await context.addInitScript(() => {
    for (const prefix of ['', 'syntax-dev-']) {
      localStorage.setItem(`${prefix}syntax.prefs.v1`, JSON.stringify({ onboarded: true }))
    }
  })

  const courseV1Url = harness.extUrl('v14/course-v1/manifest.json')
  const toolV1Url = harness.extUrl('v14/tool-v1/manifest.json')
  const previewImgUrl = harness.extUrl('v14/previews/starter-course.png')

  let catalogPhase = 'mismatched'
  await context.route('**/syntax-community/catalog/catalog.json', route => {
    const coursePkg = catalogPhase === 'bad-update'
      ? {
          id: courseManifest.id,
          manifestVersion: 2,
          kind: 'course',
          name: courseManifest.name,
          version: '1.1.0',
          syntaxApi: '^2.0.0',
          sha256: courseV11BrokenManifest.sha256,
          description: 'Starter course with separate listing preview.',
          manifestUrl: courseV1Url,
          previewImages: [previewImgUrl],
          tags: ['starter', 'course'],
        }
      : catalogPhase === 'good-update'
        ? {
            id: courseManifest.id,
            manifestVersion: 2,
            kind: 'course',
            name: courseManifest.name,
            version: '1.2.0',
            syntaxApi: '^2.0.0',
            sha256: courseV12Manifest.sha256,
            description: 'Starter course with separate listing preview.',
            manifestUrl: courseV1Url,
            previewImages: [previewImgUrl],
            tags: ['starter', 'course'],
          }
        : {
            id: courseManifest.id,
            manifestVersion: 2,
            kind: 'course',
            name: courseManifest.name,
            version: catalogPhase === 'mismatched' ? '9.9.9' : courseManifest.version,
            syntaxApi: '^2.0.0',
            sha256: courseManifest.sha256,
            description: 'Starter course with separate listing preview.',
            manifestUrl: courseV1Url,
            previewImages: [previewImgUrl],
            tags: ['starter', 'course'],
          }
    return route.fulfill({
      headers: { 'access-control-allow-origin': '*' },
      contentType: 'application/json',
      body: JSON.stringify({
        schemaVersion: 1,
        updatedAt: '2026-11-28T00:00:00Z',
        packages: [coursePkg],
      }),
    })
  })

  await context.route('**/v14/**', route => {
    const url = route.request().url()
    if (url.endsWith('.png')) {
      return route.fulfill({
        headers: { 'access-control-allow-origin': '*' },
        contentType: 'image/png',
        body: PREVIEW_PNG,
      })
    }
    const isManifest = url.endsWith('/manifest.json')
    const respond = (manifestObj, entryStr) => route.fulfill({
      headers: { 'access-control-allow-origin': '*' },
      contentType: isManifest ? 'application/json' : 'text/javascript',
      body: isManifest ? JSON.stringify(manifestObj) : entryStr,
    })
    if (url.includes('/v14/course-v1/')) {
      if (catalogPhase === 'bad-update') return respond(courseV11BrokenManifest, courseV11BrokenEntry)
      if (catalogPhase === 'good-update') return respond(courseV12Manifest, courseV12Entry)
      return respond(courseManifest, courseEntry)
    }
    return respond(toolManifest, toolEntry)
  })

  const page = await context.newPage()

  // 2. Stable hides native v2 catalog entries
  await page.goto(`${harness.appOrigin}/syntax/#/community`)
  await page.getByText('No published extensions in the community catalog yet.').waitFor()
  assert.equal(await page.locator('[data-catalog-manifest-version="2"]').count(), 0)

  await page.goto(`${harness.appOrigin}/syntax-dev/?safeMode=1#/community`)
  const safeModeCard = page.locator(`[data-catalog-id="${courseManifest.id}"]`)
  await safeModeCard.waitFor()
  assert.equal(await safeModeCard.getByRole('button', { name: 'Install', exact: true }).isDisabled(), true)

  // 3. Syntax Dev Community Hub shows the native v2 course WITH its separate preview screenshot
  await page.goto(`${harness.appOrigin}/syntax-dev/#/community`)
  const courseCatalogCard = page.locator(`[data-catalog-id="${courseManifest.id}"]`)
  await courseCatalogCard.waitFor()
  await courseCatalogCard.getByRole('button', { name: 'Install', exact: true }).click()
  await page.getByText('The downloaded package does not match the Community Hub listing.', { exact: true }).waitFor()
  assert.equal(await page.locator(`[data-native-hub-review="${courseManifest.id}"]`).count(), 0)
  catalogPhase = 'initial'
  await page.reload()
  const previewImg = courseCatalogCard.locator(`[data-catalog-previews="${courseManifest.id}"] img`)
  await previewImg.waitFor()
  const previewLoaded = await previewImg.evaluate(async img => {
    await img.decode()
    return img.naturalWidth === 1
  })
  assert.equal(previewLoaded, true, 'Listing preview image must load independently of the course bundle')

  // Install the course from Community Hub
  await courseCatalogCard.getByRole('button', { name: 'Install', exact: true }).click()
  const reviewBox = page.locator(`[data-native-hub-review="${courseManifest.id}"]`)
  await reviewBox.getByText('This code runs with the same browser access as Syntax.').waitFor()
  await reviewBox.getByRole('button', { name: 'Install native package' }).click()
  await reviewBox.waitFor({ state: 'detached' })

  // Verify course appears in Library, shows its bundled SVG lesson asset, and completes cleanly
  await page.goto(`${harness.appOrigin}/syntax-dev/#/library`)
  await page.locator(`[data-native-course-id="${courseManifest.id}"]`).click()
  await page.locator('[data-starter-course-asset="bundled-svg"]').waitFor()
  await page.getByRole('button', { name: 'Continue to question' }).click()
  await page.keyboard.press('2')
  await page.getByRole('button', { name: 'Check answer' }).click()
  await page.getByRole('button', { name: 'Finish lesson' }).click()
  await page.locator('[data-syntax-ui="completion-card"]').waitFor()
  await page.goto(`${harness.appOrigin}/syntax-dev/#/library`)
  await page.locator(`[data-course-progress="${courseManifest.id}"]`).filter({ hasText: '1 / 1 lesson complete' }).waitFor()

  // 4. Install the Tool via direct manifest link -> appears in Extensions & Ctrl+K
  await page.goto(`${harness.appOrigin}/syntax-dev/#/extensions?native=${encodeURIComponent(toolV1Url)}`)
  const native = page.getByRole('region', { name: 'Native extensions' })
  await native.getByRole('button', { name: 'Install native package' }).click()
  await native.locator(`[data-native-extension-id="${toolManifest.id}"]`).waitFor()
  await page.keyboard.press('Control+k')
  await page.getByRole('option', { name: /Save sample/ }).waitFor()
  await page.keyboard.press('Escape')

  // 5. Alpha auto-updater: broken v1.1.0 is rejected and leaves v1.0.0 usable; valid v1.2.0 updates automatically!
  catalogPhase = 'bad-update'
  await page.reload()
  await native.locator(`[data-native-extension-id="${courseManifest.id}"]`).waitFor()
  await page.waitForTimeout(400)
  const versionAfterBad = await native.locator(`[data-native-extension-id="${courseManifest.id}"]`).textContent()
  assert.match(versionAfterBad ?? '', /v1\.0\.0/, 'Rejected v1.1.0 update must leave working v1.0.0 installed')
  await page.goto(`${harness.appOrigin}/syntax-dev/#/native-extension/${courseManifest.id}/lesson-1`)
  await page.getByRole('heading', { name: 'Spotting Growing Patterns', exact: true }).waitFor()

  catalogPhase = 'good-update'
  await page.goto(`${harness.appOrigin}/syntax-dev/#/extensions`)
  await page.reload()
  await native.locator(`[data-native-extension-id="${courseManifest.id}"]`).filter({ hasText: 'v1.2.0' }).waitFor({ timeout: 10000 })
  await page.goto(`${harness.appOrigin}/syntax-dev/#/native-extension/${courseManifest.id}/lesson-1`)
  await page.getByRole('heading', { name: 'Spotting Growing Patterns (v1.2.0)' }).waitFor()

  // 6. Run the interactive examples from the built Storybook.
  const sbDir = resolve(root, 'storybook-static')
  if (!existsSync(join(sbDir, 'iframe.html'))) await runNpm(['run', 'build-storybook'], root)
  await t.test('Storybook course and tool examples work', async () => {
    const mime = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.svg': 'image/svg+xml', '.json': 'application/json' }
    const sbServer = http.createServer(async (req, res) => {
      const clean = (req.url || '/').split('?')[0]
      const target = join(sbDir, clean === '/' ? 'index.html' : clean)
      try {
        const body = await readFile(target)
        res.writeHead(200, { 'content-type': mime[extname(target)] || 'application/octet-stream' })
        res.end(body)
      } catch {
        res.writeHead(404)
        res.end()
      }
    })
    await new Promise(resolveListen => sbServer.listen(0, '127.0.0.1', resolveListen))
    t.after(() => sbServer.close())
    const { port } = sbServer.address()
    const sbPage = await context.newPage()
    const pageErrors = []
    sbPage.on('pageerror', err => pageErrors.push(err.message))
    await sbPage.goto(`http://127.0.0.1:${port}/iframe.html?id=examples-starter-course-lesson--interactive-course&viewMode=story`)
    await sbPage.getByRole('heading', { name: 'Spotting Growing Patterns' }).waitFor()
    await sbPage.getByRole('button', { name: 'Continue to question' }).click()
    await sbPage.getByRole('button', { name: 'Check answer' }).click()
    await sbPage.getByRole('button', { name: 'Finish lesson' }).click()
    await sbPage.locator('[data-syntax-ui="completion-card"]').waitFor()
    await sbPage.goto(`http://127.0.0.1:${port}/iframe.html?id=examples-standalone-tool--quick-notes-tool&viewMode=story`)
    await sbPage.getByRole('textbox', { name: 'Study notes' }).fill('Read chapter two')
    await sbPage.getByRole('button', { name: 'Clear notes' }).click()
    assert.equal(await sbPage.getByRole('textbox', { name: 'Study notes' }).inputValue(), '')
    assert.deepEqual(pageErrors, [], 'Storybook example must run with zero page errors')
    await sbPage.close()
  })
})
