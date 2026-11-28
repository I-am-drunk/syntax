import assert from 'node:assert/strict'
import { spawnSync } from 'node:child_process'
import { mkdtempSync, mkdirSync, rmdirSync, rmSync, symlinkSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { test } from 'node:test'

const commit = 'a'.repeat(40)
const otherCommit = 'b'.repeat(40)

test('Infra and Beta accept only regular static artifacts built from the expected commit', t => {
  const bundle = mkdtempSync(join(tmpdir(), 'syntax-static-artifact-'))
  t.after(() => rmSync(bundle, { recursive: true, force: true }))
  const check = (marker, expected = commit) => spawnSync(process.execPath, [
    '.github/scripts/verify-static-artifact.mjs', bundle, marker, expected,
  ], { encoding: 'utf8' })

  mkdirSync(join(bundle, 'index.html'))
  const missingIndex = check('preview-commit.txt')
  assert.equal(missingIndex.status, 1)
  assert.match(missingIndex.stderr, /must contain index.html/)
  rmdirSync(join(bundle, 'index.html'))
  writeFileSync(join(bundle, 'index.html'), '<!doctype html>')
  const missingMarker = check('release-commit.txt')
  assert.equal(missingMarker.status, 1)
  assert.match(missingMarker.stderr, /release-commit.txt/)

  writeFileSync(join(bundle, 'preview-commit.txt'), commit + '\n')
  writeFileSync(join(bundle, 'release-commit.txt'), commit + '\n')
  mkdirSync(join(bundle, 'assets'))
  writeFileSync(join(bundle, 'assets', 'app.js'), '')
  assert.equal(check('preview-commit.txt').status, 0)
  assert.equal(check('release-commit.txt').status, 0)
  const mismatch = check('release-commit.txt', otherCommit)
  assert.equal(mismatch.status, 1)
  assert.match(mismatch.stderr, /different commit/)
  assert.equal(check('preview-commit.txt', commit.slice(0, 7)).status, 1)

  mkdirSync(join(bundle, '_worker.js'))
  const worker = check('preview-commit.txt')
  assert.equal(worker.status, 1)
  assert.match(worker.stderr, /Cloudflare Worker/)
  rmdirSync(join(bundle, '_worker.js'))

  const linkedAssets = join(bundle, 'linked-assets')
  symlinkSync(join(bundle, 'assets'), linkedAssets, process.platform === 'win32' ? 'junction' : 'dir')
  const symlink = check('release-commit.txt')
  assert.equal(symlink.status, 1)
  assert.match(symlink.stderr, /regular files and directories/)
})
