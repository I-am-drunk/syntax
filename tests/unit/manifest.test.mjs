import { describe, it } from 'node:test'
import assert from 'node:assert/strict'
import {
  compareSemver,
  resolveExtensionAssets,
  satisfiesSemver,
  validateExtensionManifest,
} from '../../src/extensions/manifest.ts'

describe('extension manifest validation', () => {
  it('accepts a valid storyboard manifest', () => {
    const m = validateExtensionManifest({
      formatVersion: 1,
      id: 'tj.storyboard',
      name: 'Storyboard',
      version: '1.2.0',
      worker: './worker.js',
      views: [{ id: 'board', title: 'Storyboard', entry: './view/index.html', placement: 'page' }],
      commands: [{ id: 'new-board', title: 'New storyboard', run: 'newBoard' }],
      toolbar: [{ id: 'open-board', label: 'Board', viewId: 'board' }],
      services: { provides: { 'tj.storyboard/boards': '1.2.0' } },
    })
    assert.equal(m.id, 'tj.storyboard')
    assert.equal(m.syntaxApi, '^1.0.0')
    assert.equal(m.views[0].placement, 'page')
  })

  it('rejects commands when worker is omitted', () => {
    assert.throws(
      () =>
        validateExtensionManifest({
          formatVersion: 1,
          id: 'tj.bad',
          name: 'Bad',
          version: '1.0.0',
          commands: [{ id: 'run', title: 'Run' }],
        }),
      /worker is required/,
    )
  })

  it('rejects toolbar referencing unknown command or view', () => {
    assert.throws(
      () =>
        validateExtensionManifest({
          formatVersion: 1,
          id: 'tj.bad-toolbar',
          name: 'Bad Toolbar',
          version: '1.0.0',
          worker: './worker.js',
          toolbar: [{ id: 'btn', label: 'Go', commandId: 'missing' }],
        }),
      /does not match any declared command/,
    )
  })

  it('rejects disallowed javascript: and data: URLs', () => {
    assert.throws(
      () =>
        validateExtensionManifest({
          formatVersion: 1,
          id: 'tj.xss',
          name: 'XSS',
          version: '1.0.0',
          views: [{ id: 'v', title: 'V', entry: 'javascript:alert(1)' }],
        }),
      /Disallowed URL scheme/,
    )
  })

  it('rejects duplicate command, view, toolbar, and setting IDs', () => {
    assert.throws(
      () =>
        validateExtensionManifest({
          formatVersion: 1,
          id: 'tj.dups',
          name: 'Dups',
          version: '1.0.0',
          worker: './worker.js',
          commands: [
            { id: 'export', title: 'Export A' },
            { id: 'export', title: 'Export B' },
          ],
        }),
      /Duplicate commands id "export"/,
    )
  })

  it('rejects mismatched setting default value types', () => {
    assert.throws(
      () =>
        validateExtensionManifest({
          formatVersion: 1,
          id: 'tj.bad-setting',
          name: 'Bad Setting',
          version: '1.0.0',
          settings: [{ id: 'flag', type: 'boolean', label: 'Flag', default: 'yes' }],
        }),
      /default value must be of type "boolean"/,
    )
  })

  it('resolves relative asset URLs cleanly against manifestUrl', () => {
    const m = validateExtensionManifest({
      formatVersion: 1,
      id: 'tj.storyboard',
      name: 'Storyboard',
      version: '1.0.0',
      worker: './worker.js',
      icon: './icon.svg',
      views: [{ id: 'board', title: 'Board', entry: './view/index.html' }],
    })
    const assets = resolveExtensionAssets('https://friend.example/ext/storyboard/extension.json', m)
    assert.equal(assets.origin, 'https://friend.example')
    assert.equal(assets.baseUrl, 'https://friend.example/ext/storyboard/')
    assert.equal(assets.workerUrl, 'https://friend.example/ext/storyboard/worker.js')
    assert.equal(assets.viewUrls.board, 'https://friend.example/ext/storyboard/view/index.html')
  })

  it('rejects cross-origin worker or view asset URLs', () => {
    const m = validateExtensionManifest({
      formatVersion: 1,
      id: 'tj.cross',
      name: 'Cross Origin',
      version: '1.0.0',
      worker: 'https://other.example/worker.js',
    })
    assert.throws(
      () => resolveExtensionAssets('https://friend.example/ext/extension.json', m),
      /same origin as extension\.json/,
    )
  })
})

describe('semver comparison and ranges', () => {
  it('orders semver versions including prereleases', () => {
    assert.equal(compareSemver('1.0.0', '1.0.0'), 0)
    assert.equal(compareSemver('1.2.0', '1.1.9'), 1)
    assert.equal(compareSemver('1.0.0-alpha.1', '1.0.0'), -1)
    assert.equal(compareSemver('1.0.0-alpha.10', '1.0.0-alpha.2'), 1)
  })

  it('evaluates caret, tilde, exact, and compound ranges', () => {
    assert.equal(satisfiesSemver('1.4.0', '^1.0.0'), true)
    assert.equal(satisfiesSemver('2.0.0', '^1.0.0'), false)
    assert.equal(satisfiesSemver('1.4.0', '^2.0.0'), false)
    assert.equal(satisfiesSemver('0.2.3', '^0.2.0'), true)
    assert.equal(satisfiesSemver('0.3.0', '^0.2.0'), false)
    assert.equal(satisfiesSemver('1.2.5', '~1.2.0'), true)
    assert.equal(satisfiesSemver('1.3.0', '~1.2.0'), false)
    assert.equal(satisfiesSemver('1.5.0', '>=1.2.0 <2.0.0'), true)
    assert.equal(satisfiesSemver('2.0.0', '>=1.2.0 <2.0.0'), false)
    assert.equal(satisfiesSemver('1.0.0', '1.0.0'), true)
  })
})
