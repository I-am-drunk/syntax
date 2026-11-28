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

const hostedOrigin = 'https://syntax-platform.github.io'
const hostedDev = `${hostedOrigin}/syntax-dev/`
const publishedFixture = 'https://raw.githubusercontent.com/syntax-platform/syntax-official-extensions/e5bc14968853daaf75e170917f8d7d53ffa95366/fixtures/native-foundation/v1/manifest.json'

const run = promisify(execFile)
const root = fileURLToPath(new URL('../../', import.meta.url))

function runNpm(args, cwd) {
  const npm = process.env.npm_execpath
  if (npm) return run(process.execPath, [npm, ...args], { cwd })
  if (process.platform === 'win32') {
    // The caller supplies only fixed npm arguments, never paths or user input.
    return run(process.env.ComSpec ?? 'cmd.exe', ['/d', '/s', '/c', `npm ${args.join(' ')}`], { cwd })
  }
  return run('npm', args, { cwd })
}

test('an external checkout builds, checks, hosts, and activates a native fixture', async t => {
  const work = await mkdtemp(join(tmpdir(), 'syntax-authoring-'))
  const destination = join(work, 'fixture')
  const dist = join(destination, 'dist')
  const manifestPath = join(dist, 'manifest.json')
  const entryPath = join(dist, 'main.js')
  t.after(() => rm(work, { recursive: true, force: true }))

  await run(process.execPath, ['scripts/init-native-extension.mjs', destination], { cwd: root })
  assert.deepEqual(await readFile(join(destination, 'syntax-api.d.ts')), await readFile(join(root, 'src/extensions/native/api.ts')))
  await runNpm(['ci', '--no-audit', '--no-fund'], destination)
  await runNpm(['run', 'build'], destination)
  const first = await Promise.all([readFile(manifestPath), readFile(entryPath)])
  await rm(manifestPath)
  await rm(entryPath)
  await runNpm(['run', 'build'], destination)
  assert.deepEqual(await Promise.all([readFile(manifestPath), readFile(entryPath)]), first)

  const { stdout } = await run(process.execPath, ['scripts/check-native-extension.mjs', '--json', manifestPath], { cwd: root })
  assert.equal(JSON.parse(stdout).ok, true)

  const harness = await startE2EHarness({ nativeStarterDirectory: dist })
  t.after(() => harness.close())
  const page = await harness.browser.newPage()
  await page.addInitScript(() => {
    for (const prefix of ['', 'syntax-dev-']) {
      localStorage.setItem(`${prefix}syntax.prefs.v1`, JSON.stringify({ onboarded: true }))
    }
  })
  await page.goto(`${harness.appOrigin}/syntax/#/extensions`)
  await page.getByRole('heading', { name: 'Extensions', exact: true }).waitFor()
  assert.equal(await page.getByRole('region', { name: 'Native extensions' }).count(), 0)

  await page.goto(`${harness.appOrigin}/syntax-dev/#/extensions`)
  const native = page.getByRole('region', { name: 'Native extensions' })
  await native.getByRole('textbox', { name: 'Native manifest URL' }).fill(harness.extUrl('native-starter/manifest.json'))
  await native.getByRole('button', { name: 'Review native package' }).click()
  await native.getByText('This code runs with the same browser access as Syntax.').waitFor()
  assert.equal(await native.getByRole('button', { name: 'Open Native fixture' }).count(), 0)
  await native.getByRole('button', { name: 'Install native package' }).click()
  await native.getByRole('button', { name: 'Open Native fixture' }).click()
  await page.getByText('Extension built outside Syntax', { exact: true }).waitFor()
  await page.keyboard.press('Control+k')
  await page.getByRole('option', { name: /Save sample/ }).click()
  await page.waitForFunction(async () => {
    const { createNativeRepository } = await import('/src/extensions/native/repository.ts')
    return (await createNativeRepository().load('example.native-fixture'))?.tested
  })
  await page.reload()
  await page.getByText('Extension built outside Syntax', { exact: true }).waitFor()
  await page.getByRole('button', { name: 'Back to Extensions' }).click()
  await native.getByRole('button', { name: 'Disable', exact: true }).click()
  await native.getByRole('button', { name: 'Enable', exact: true }).waitFor()
  assert.equal(await native.getByRole('button', { name: 'Open Native fixture' }).count(), 0)
  await native.getByRole('button', { name: 'Enable', exact: true }).click()
  await native.getByRole('button', { name: 'Open Native fixture' }).waitFor()

  const failingSource = harness.extUrl('native-failure/manifest.json')
  const failingEntry = `
    exports.activate = ctx => {
      ctx.registerScreen({ id: 'home', title: 'Failing screen', component() { throw Error('Screen failed'); } });
      ctx.registerCommand({ id: 'fail', title: 'Failing command', run() { throw Error('Command failed'); } });
    };
  `
  await page.route('**/native-failure/*', route => route.fulfill({
    headers: { 'access-control-allow-origin': '*' },
    body: route.request().url() === failingSource ? JSON.stringify({
      manifestVersion: 2,
      id: 'example.failing-fixture',
      name: 'Failing fixture',
      version: '1.0.0',
      syntaxApi: '^2.0.0',
      main: 'main.js',
      sha256: createHash('sha256').update(failingEntry).digest('hex'),
    }) : failingEntry,
  }))
  await native.getByRole('textbox', { name: 'Native manifest URL' }).fill(failingSource)
  await native.getByRole('button', { name: 'Review native package' }).click()
  await native.getByRole('button', { name: 'Install native package' }).click()
  await native.getByRole('button', { name: 'Open Failing screen' }).click()
  await page.getByText('This extension screen is unavailable.').waitFor()
  await page.getByRole('button', { name: 'Back to Extensions' }).click()
  await native.getByText('Screen failed', { exact: true }).waitFor()
  await native.getByRole('button', { name: 'Open Native fixture' }).waitFor()

  await native.getByRole('button', { name: 'Enable', exact: true }).click()
  await native.getByRole('button', { name: 'Open Failing screen' }).waitFor()
  await page.keyboard.press('Control+k')
  await page.getByRole('option', { name: /Failing command/ }).click()
  await native.getByText('Command failed', { exact: true }).waitFor()
  assert.equal(await native.getByRole('button', { name: 'Open Failing screen' }).count(), 0)
  await native.getByRole('button', { name: 'Open Native fixture' }).waitFor()
  await page.reload()
  await native.getByText('Command failed', { exact: true }).waitFor()
  await page.keyboard.press('Control+k')
  await page.getByRole('option', { name: /Save sample/ }).waitFor()
  assert.equal(await page.getByRole('option', { name: /Failing command/ }).count(), 0)

  await t.test('production Dev approves only the pinned HTTPS package and rejects host and cache changes', async t => {
    const production = join(work, 'production-dev')
    await run(process.execPath, ['node_modules/vite/bin/vite.js', 'build', '--outDir', production], {
      cwd: root,
      env: { ...process.env, VITE_CHANNEL: 'dev', VITE_BASE: '/syntax-dev/' },
    })
    const browser = await chromium.launch({ executablePath: resolveBrowserExecutable(), headless: true })
    t.after(() => browser.close())
    const context = await browser.newContext()
    await context.addInitScript(() => {
      localStorage.setItem('syntax-dev-syntax.prefs.v1', JSON.stringify({ onboarded: true }))
      localStorage.setItem('syntax.prefs.v1', JSON.stringify({ onboarded: true }))
    })
    await context.route(`${hostedOrigin}/**`, route => {
      const pathname = new URL(route.request().url()).pathname
      if (pathname === '/syntax-dev/' || pathname === '/syntax/') {
        return route.fulfill({ path: join(production, 'index.html') })
      }
      if (/^\/syntax-dev\/assets\/[\w.-]+$/.test(pathname)) {
        return route.fulfill({ path: join(production, pathname.slice('/syntax-dev/'.length)) })
      }
      return route.fulfill({ status: 404 })
    })
    let changed = false
    const manifest = JSON.parse(first[0])
    const changedEntry = Buffer.concat([first[1], Buffer.from('\n')])
    await context.route(publishedFixture, route => route.fulfill({
      headers: { 'access-control-allow-origin': '*' },
      json: changed ? { ...manifest, sha256: createHash('sha256').update(changedEntry).digest('hex') } : manifest,
    }))
    await context.route(new URL('main.js', publishedFixture).href, route => route.fulfill({
      headers: { 'access-control-allow-origin': '*' },
      body: changed ? changedEntry : first[1],
    }))
    const blockedSource = 'https://unapproved.example/manifest.json'
    let blockedRequests = 0
    await context.route(blockedSource, route => {
      blockedRequests++
      return route.abort()
    })

    const hostedPage = await context.newPage()
    await hostedPage.goto(`${hostedOrigin}/syntax/#/extensions`)
    await hostedPage.getByRole('heading', { name: 'Extensions', exact: true }).waitFor()
    assert.equal(await hostedPage.getByRole('region', { name: 'Native extensions' }).count(), 0)
    await hostedPage.goto(`${hostedDev}#/extensions`)
    const panel = hostedPage.getByRole('region', { name: 'Native extensions' })
    const urlInput = panel.getByRole('textbox', { name: 'Native manifest URL' })
    const review = panel.getByRole('button', { name: 'Review native package' })

    await urlInput.fill(blockedSource)
    await review.click()
    await panel.getByText('This source is not approved for this Syntax build.').waitFor()
    assert.equal(blockedRequests, 0)

    await urlInput.fill(publishedFixture)
    await review.click()
    await panel.getByRole('button', { name: 'Install native package' }).click()
    await panel.getByRole('button', { name: 'Open Native fixture' }).click()
    await hostedPage.getByText('Extension built outside Syntax', { exact: true }).waitFor()
    await hostedPage.reload()
    await hostedPage.getByText('Extension built outside Syntax', { exact: true }).waitFor()
    await hostedPage.getByRole('button', { name: 'Back to Extensions' }).click()

    changed = true
    await urlInput.fill(publishedFixture)
    await review.click()
    await panel.getByText('This package is not approved for this Syntax build.').waitFor()
    await panel.getByRole('button', { name: 'Open Native fixture' }).waitFor()

    await hostedPage.evaluate(async id => {
      const db = await new Promise((resolve, reject) => {
        const request = indexedDB.open('syntax-dev-syntax-native-extensions-v2')
        request.onsuccess = () => resolve(request.result)
        request.onerror = () => reject(request.error)
      })
      try {
        await new Promise((resolve, reject) => {
          const tx = db.transaction('installs', 'readwrite')
          const store = tx.objectStore('installs')
          const request = store.get(id)
          request.onsuccess = () => {
            const record = request.result
            record.package.manifest.version = '2.0.0'
            store.put(record, id)
          }
          tx.oncomplete = resolve
          tx.onabort = () => reject(tx.error)
        })
      } finally {
        db.close()
      }
    }, manifest.id)
    await hostedPage.reload()
    const enable = panel.getByRole('button', { name: 'Enable', exact: true })
    await enable.waitFor()
    assert.equal(await panel.getByRole('button', { name: 'Open Native fixture' }).count(), 0)
    await enable.click()
    await panel.getByText('This package is not approved for this Syntax build.', { exact: true }).nth(1).waitFor()
    assert.equal(await panel.getByRole('button', { name: 'Open Native fixture' }).count(), 0)
  })
})
