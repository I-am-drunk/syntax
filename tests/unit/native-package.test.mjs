import assert from 'node:assert/strict'
import { createHash } from 'node:crypto'
import { mkdtempSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { spawnSync } from 'node:child_process'
import { test } from 'node:test'
import { parseNativeManifest } from '../../src/extensions/native/manifest.ts'
import { downloadNativePackage } from '../../src/extensions/native/package.ts'

const entry = 'throw new Error("The package checker must not run this code.");'
const manifest = {
  manifestVersion: 2,
  id: 'example.fixture',
  name: 'Fixture',
  version: '1.0.0',
  syntaxApi: '^2.0.0',
  main: 'entry.js',
  sha256: createHash('sha256').update(entry).digest('hex'),
}

test('native manifests have strict fields and a package-relative JavaScript entry', () => {
  assert.deepEqual(parseNativeManifest(manifest), manifest)
  for (const main of ['../entry.js', '/entry.js', 'https://host/entry.js', 'dist\\entry.js', 'entry.js?latest']) {
    assert.throws(() => parseNativeManifest({ ...manifest, main }), { code: 'MANIFEST_INVALID' })
  }
  assert.throws(() => parseNativeManifest({ ...manifest, extra: true }), { code: 'MANIFEST_INVALID' })
  assert.throws(() => parseNativeManifest({ ...manifest, syntaxApi: '>=whatever' }), { code: 'MANIFEST_INVALID' })
  assert.throws(() => parseNativeManifest({ ...manifest, syntaxApi: '^3.0.0' }), { code: 'API_INCOMPATIBLE' })
})

test('author check validates the entry without executing it', t => {
  const folder = mkdtempSync(join(tmpdir(), 'syntax-native-check-'))
  t.after(() => rmSync(folder, { force: true, recursive: true }))
  const manifestPath = join(folder, 'manifest.json')
  const entryPath = join(folder, 'entry.js')
  const check = () => {
    const result = spawnSync(process.execPath, ['scripts/check-native-extension.mjs', '--json', manifestPath], { encoding: 'utf8' })
    return { status: result.status, ...JSON.parse(result.stdout) }
  }

  writeFileSync(manifestPath, JSON.stringify(manifest))
  assert.equal(check().code, 'ENTRY_MISSING')
  writeFileSync(entryPath, entry)
  assert.deepEqual(check(), { status: 0, ok: true, manifest })
  writeFileSync(entryPath, 'export default 1')
  assert.equal(check().code, 'ENTRY_HASH_MISMATCH')
  writeFileSync(manifestPath, JSON.stringify({
    ...manifest,
    sha256: createHash('sha256').update('export default 1').digest('hex'),
  }))
  assert.equal(check().code, 'ENTRY_SYNTAX')
})

test('host downloads and verifies the manifest-relative entry before using it', async () => {
  const source = 'https://example.com/releases/1.0.0/manifest.json'
  const calls = []
  const fetcher = async (url, options) => {
    calls.push(url.href)
    assert.equal(options.credentials, 'omit')
    assert.equal(options.redirect, 'error')
    return new Response(url.href === source ? JSON.stringify(manifest) : entry)
  }
  assert.deepEqual(await downloadNativePackage(source, fetcher), { sourceUrl: source, manifest, entry })
  assert.deepEqual(calls, [source, 'https://example.com/releases/1.0.0/entry.js'])
  await assert.rejects(downloadNativePackage('http://example.com/manifest.json', fetcher), { code: 'SOURCE_URL' })
  await assert.rejects(downloadNativePackage(source, async url =>
    new Response(url.href === source ? JSON.stringify(manifest) : 'changed'),
  ), { code: 'ENTRY_HASH_MISMATCH' })
  await assert.rejects(downloadNativePackage(source, async () =>
    new Response('missing', { status: 404 }),
  ), { code: 'DOWNLOAD_FAILED' })
  await assert.rejects(downloadNativePackage(source, async () =>
    new Response(' '.repeat(20_000)),
  ), { code: 'DOWNLOAD_SIZE' })
})
