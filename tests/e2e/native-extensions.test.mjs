import assert from 'node:assert/strict'
import { createHash } from 'node:crypto'
import { test } from 'node:test'
import { startE2EHarness } from './harness.mjs'

const working = `
  exports.activate = ctx => {
    ctx.registerScreen({ id: 'main', title: 'Working', component: () => null });
    ctx.registerCommand({ id: 'save', title: 'Save', run: () => ctx.saveData({ text: 'kept' }) });
  };
`
const broken = `
  exports.activate = ctx => {
    ctx.registerScreen({ id: 'main', title: 'Uncommitted', component: () => null });
    throw new Error('replacement failed');
  };
`

test('native host persists verified installs and quarantines interrupted startup in Chromium', async t => {
  const harness = await startE2EHarness({ channel: 'preview' })
  t.after(() => harness.close())
  const context = await harness.browser.newContext()
  t.after(() => context.close().catch(() => {}))
  const page = await context.newPage()
  const first = `${harness.extOrigin}/native/one/manifest.json`
  const second = `${harness.extOrigin}/native/two/manifest.json`
  let replaceWithBroken = false
  let offline = false
  await context.route('**/native/*/*', async route => {
    const url = new URL(route.request().url())
    if (url.origin !== harness.extOrigin) return route.continue()
    if (offline) return route.abort()
    const [, , name, file] = url.pathname.split('/')
    const brokenUpdate = replaceWithBroken && name === 'one'
    const entry = brokenUpdate ? broken : working
    const manifest = {
      manifestVersion: 2,
      id: `example.${name}`,
      name,
      version: brokenUpdate ? '2.0.0' : '1.0.0',
      syntaxApi: '^2.0.0',
      main: 'entry.js',
      sha256: createHash('sha256').update(entry).digest('hex'),
    }
    await route.fulfill({
      status: 200,
      headers: { 'access-control-allow-origin': '*' },
      body: file === 'manifest.json' ? JSON.stringify(manifest) : entry,
    })
  })

  const hostSetup = async () => {
    const { NativeHost } = await import('/src/extensions/native/host.ts')
    const { createNativeRepository } = await import('/src/extensions/native/repository.ts')
    window.nativeTestRepository = createNativeRepository()
    window.nativeTestHost = new NativeHost(window.nativeTestRepository, sessionStorage, () => {}, {
      checkSource() {},
      checkPackage() {},
    })
  }
  await page.goto(`${harness.appOrigin}/syntax-dev/`)
  await page.evaluate(hostSetup)
  await page.evaluate(async ({ first, second }) => {
    await window.nativeTestHost.install(first)
    await window.nativeTestHost.install(second)
    await window.nativeTestHost.runtime.runCommand('example.one', 'save')
  }, { first, second })

  replaceWithBroken = true
  await assert.rejects(page.evaluate(url => window.nativeTestHost.install(url), first), /replacement failed/)
  assert.equal(await page.evaluate(() => window.nativeTestRepository.get('example.one')
    .then(record => record.package.manifest.version)), '1.0.0')

  offline = true
  const secondTab = await context.newPage()
  await secondTab.goto(`${harness.appOrigin}/syntax-dev/`)
  await secondTab.evaluate(hostSetup)
  await secondTab.evaluate(() => window.nativeTestHost.boot())
  await page.evaluate(async () => {
    await window.nativeTestHost.setEnabled('example.one', false)
    await window.nativeTestHost.setEnabled('example.one', true)
  })
  await assert.rejects(secondTab.evaluate(() =>
    window.nativeTestHost.runtime.runCommand('example.one', 'save')), /changed in another operation/)
  await secondTab.close()

  await page.reload()
  await page.evaluate(hostSetup)
  const cached = await page.evaluate(async () => {
    const result = await window.nativeTestHost.boot()
    return {
      result,
      title: window.nativeTestHost.runtime.getScreen('example.one', 'main').title,
      data: await window.nativeTestRepository.load('example.one'),
    }
  })
  assert.deepEqual(cached, { result: { recovery: 'normal', failed: [] }, title: 'Working', data: { text: 'kept' } })

  await page.evaluate(async () => {
    const existing = await window.nativeTestRepository.get('example.one')
    sessionStorage.setItem('syntax-preview-syntax.native-startup.v2', JSON.stringify({
      id: 'example.one',
      revision: existing.revision,
    }))
  })
  await page.reload()
  await page.evaluate(hostSetup)
  const recovered = await page.evaluate(async () => {
    const result = await window.nativeTestHost.boot()
    return {
      result,
      suspectActive: window.nativeTestHost.runtime.isActive('example.one'),
      siblingActive: window.nativeTestHost.runtime.isActive('example.two'),
      record: await window.nativeTestRepository.get('example.one'),
    }
  })
  assert.deepEqual(recovered.result, { recovery: 'quarantined', failed: ['example.one'] })
  assert.equal(recovered.suspectActive, false)
  assert.equal(recovered.siblingActive, true)
  assert.equal(recovered.record.enabled, false)
  assert.match(recovered.record.failure, /Startup was interrupted/)
  await page.evaluate(() => window.nativeTestHost.setEnabled('example.one', true))
  assert.deepEqual(await page.evaluate(() => window.nativeTestRepository.load('example.one')), { text: 'kept' })

  await page.evaluate(() => sessionStorage.setItem('syntax-preview-syntax.native-startup.v2', 'unreadable'))
  await page.reload()
  await page.evaluate(hostSetup)
  const safeMode = await page.evaluate(async () => {
    const result = await window.nativeTestHost.boot()
    return { result, active: window.nativeTestHost.runtime.isActive('example.two') }
  })
  assert.deepEqual(safeMode, { result: { recovery: 'skipped', failed: [] }, active: false })
  await page.evaluate(async () => {
    await window.nativeTestHost.acknowledgeUnknownStartup()
    await window.nativeTestHost.boot()
  })
  assert.equal(await page.evaluate(() => window.nativeTestHost.runtime.isActive('example.two')), true)
})
