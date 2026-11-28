import assert from 'node:assert/strict'
import { createHash } from 'node:crypto'
import { test } from 'node:test'
import { fetchExtensionCatalog } from '../../src/extensions/catalog.ts'
import { checkAndApplyNativeUpdates } from '../../src/extensions/native/autoUpdater.ts'
import { NativeHost } from '../../src/extensions/native/host.ts'
import { NativePackageError } from '../../src/extensions/native/manifest.ts'

function makeHost(remotePackages) {
  const records = new Map()
  const data = new Map()
  const host = new NativeHost(
    {
      list: async () => [...records.values()],
      get: async id => records.get(id),
      replace: async (id, expected, record) => {
        assert.equal(records.get(id)?.revision, expected)
        records.set(id, record)
      },
      remove: async id => { records.delete(id) },
      load: async id => data.get(id),
      save: async (id, value) => { data.set(id, value) },
    },
    { getItem: () => null, setItem() {}, removeItem() {} },
    () => {},
    {
      checkSource() {},
      checkPackage() {},
      allowSourceChange: () => true,
    },
  )
  // Override inspect to serve deterministic test packages without network
  host.inspect = async source => {
    const pkg = remotePackages.get(source)
    if (!pkg) throw new NativePackageError('PACKAGE_FETCH', `Missing test package ${source}`)
    if (pkg.corruptHash) throw new NativePackageError('HASH_MISMATCH', 'Entry hash mismatch')
    if (pkg.incompatibleApi) throw new NativePackageError('API_INCOMPATIBLE', 'Incompatible syntaxApi')
    return pkg
  }
  return { host, records }
}

function makePkg(id, version, entry, sourceUrl, extra = {}) {
  return {
    sourceUrl,
    manifest: {
      manifestVersion: 2,
      id,
      name: `Pkg ${id}`,
      version,
      syntaxApi: extra.syntaxApi ?? '^2.0.0',
      main: 'main.js',
      sha256: createHash('sha256').update(entry).digest('hex'),
    },
    entry,
    ...extra,
  }
}

test('alpha auto-updater upgrades compatible releases and preserves the working install when a candidate is rejected', async () => {
  const v1Entry = `exports.activate = ctx => { ctx.registerScreen({ id: 'main', title: 'v1 Working', component: () => null }); };`
  const v2BrokenEntry = `exports.activate = () => { throw new Error('v2 crashed during activate'); };`
  const v3GoodEntry = `exports.activate = ctx => { ctx.registerScreen({ id: 'main', title: 'v3 Fixed', component: () => null }); };`

  const remote = new Map([
    ['https://example.com/v1/manifest.json', makePkg('example.course', '1.0.0', v1Entry, 'https://example.com/v1/manifest.json')],
    ['https://example.com/v2-bad-hash/manifest.json', makePkg('example.course', '1.1.0', v1Entry, 'https://example.com/v2-bad-hash/manifest.json', { corruptHash: true })],
    ['https://example.com/v2-crash/manifest.json', makePkg('example.course', '1.2.0', v2BrokenEntry, 'https://example.com/v2-crash/manifest.json')],
    ['https://example.com/v3-good/manifest.json', makePkg('example.course', '1.3.0', v3GoodEntry, 'https://example.com/v3-good/manifest.json')],
  ])
  const { host, records } = makeHost(remote)
  const rejectedKeys = new Set()

  await host.installInspected(remote.get('https://example.com/v1/manifest.json'))
  assert.equal(host.runtime.getScreen('example.course', 'main')?.title, 'v1 Working')

  // 1. Incompatible syntaxApi is skipped before inspect
  const incompatibleReport = await checkAndApplyNativeUpdates({
    host,
    rejectedKeys,
    candidates: [{ id: 'example.course', version: '2.0.0', syntaxApi: '^3.0.0', manifestUrl: 'https://example.com/v3-good/manifest.json' }],
  })
  assert.equal(incompatibleReport.updated.length, 0)
  assert.equal(records.get('example.course')?.package.manifest.version, '1.0.0')

  // 2. Corrupt hash candidate is rejected and leaves v1.0.0 active & usable
  const hashReport = await checkAndApplyNativeUpdates({
    host,
    rejectedKeys,
    candidates: [{ id: 'example.course', version: '1.1.0', syntaxApi: '^2.0.0', manifestUrl: 'https://example.com/v2-bad-hash/manifest.json' }],
  })
  assert.equal(hashReport.updated.length, 0)
  assert.equal(hashReport.rejected.length, 1)
  assert.equal(host.runtime.getScreen('example.course', 'main')?.title, 'v1 Working')

  // 3. Throwing activation candidate is rejected and leaves v1.0.0 active & usable
  const crashReport = await checkAndApplyNativeUpdates({
    host,
    rejectedKeys,
    candidates: [{ id: 'example.course', version: '1.2.0', syntaxApi: '^2.0.0', manifestUrl: 'https://example.com/v2-crash/manifest.json' }],
  })
  assert.equal(crashReport.updated.length, 0)
  assert.equal(crashReport.rejected.length, 1)
  assert.equal(records.get('example.course')?.package.manifest.version, '1.0.0')
  assert.equal(host.runtime.getScreen('example.course', 'main')?.title, 'v1 Working')

  // 4. Repeat check skips already-rejected candidate without retrying
  const repeatReport = await checkAndApplyNativeUpdates({
    host,
    rejectedKeys,
    candidates: [{ id: 'example.course', version: '1.2.0', syntaxApi: '^2.0.0', manifestUrl: 'https://example.com/v2-crash/manifest.json' }],
  })
  assert.equal(repeatReport.rejected.length, 0)

  // 5. Compatible verified v1.3.0 updates automatically and replaces v1.0.0 cleanly
  const goodReport = await checkAndApplyNativeUpdates({
    host,
    rejectedKeys,
    candidates: [{ id: 'example.course', version: '1.3.0', syntaxApi: '^2.0.0', manifestUrl: 'https://example.com/v3-good/manifest.json' }],
  })
  assert.equal(goodReport.updated.length, 1)
  assert.equal(goodReport.updated[0].fromVersion, '1.0.0')
  assert.equal(goodReport.updated[0].toVersion, '1.3.0')
  assert.equal(records.get('example.course')?.package.manifest.version, '1.3.0')
  assert.equal(host.runtime.getScreen('example.course', 'main')?.title, 'v3 Fixed')
})

test('catalog parser supports native v2 listings with separate previewImages alongside v1 entries', async () => {
  const originalFetch = globalThis.fetch
  globalThis.fetch = async () => new Response(JSON.stringify({
    schemaVersion: 1,
    updatedAt: '2026-11-28T00:00:00Z',
    packages: [
      {
        id: 'legacy.v1-tool',
        kind: 'extension',
        name: 'Legacy Tool',
        version: '1.0.0',
        manifestUrl: 'https://example.com/legacy/manifest.json',
      },
      {
        id: 'syntax.mpm2d-analytic-geometry',
        manifestVersion: 2,
        kind: 'course',
        name: 'Analytic Geometry (MPM2D)',
        version: '1.1.0',
        syntaxApi: '^2.0.0',
        manifestUrl: 'https://example.com/mpm2d/manifest.json',
        previewImages: ['https://example.com/previews/mpm2d-lesson.png'],
        tags: ['math', 'official'],
      },
    ],
  }), { status: 200, headers: { 'content-type': 'application/json' } })

  try {
    const result = await fetchExtensionCatalog('https://example.com/catalog.json')
    assert.equal(result.status, 'ready')
    assert.equal(result.entries.length, 2)
    assert.equal(result.entries[0].manifestVersion, 1)
    assert.deepEqual(result.entries[0].previewImages, [])
    assert.equal(result.entries[1].manifestVersion, 2)
    assert.deepEqual(result.entries[1].previewImages, ['https://example.com/previews/mpm2d-lesson.png'])
  } finally {
    globalThis.fetch = originalFetch
  }
})

test('a background update does not undo a disable, uninstall, or newer install while downloading', async t => {
  const source = 'https://example.com/manifest.json'
  const createVersion = version => makePkg('example.course', version, 'exports.activate = () => {};', source)
  for (const change of ['disable', 'uninstall', 'replace']) {
    await t.test(change, async () => {
      const { host, records } = makeHost(new Map())
      await host.installInspected(createVersion('1.0.0'))
      const started = Promise.withResolvers()
      const download = Promise.withResolvers()
      host.inspect = async () => {
        started.resolve()
        return download.promise
      }
      const update = checkAndApplyNativeUpdates({
        host,
        candidates: [{ id: 'example.course', version: '1.1.0', manifestUrl: source }],
      })
      await started.promise
      if (change === 'disable') await host.setEnabled('example.course', false)
      if (change === 'uninstall') await host.uninstall('example.course')
      if (change === 'replace') await host.installInspected(createVersion('1.2.0'))
      const expected = records.get('example.course')
      download.resolve(createVersion('1.1.0'))
      assert.deepEqual(await update, { updated: [], rejected: [] })
      assert.deepEqual(records.get('example.course'), expected)
    })
  }
})
