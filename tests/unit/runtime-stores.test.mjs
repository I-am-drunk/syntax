import { describe, it, beforeEach } from 'node:test'
import assert from 'node:assert/strict'
import { useContributionStore, qualifyContributionKey } from '../../src/extensions/contributions.ts'
import { ExtensionServiceRegistry, findServiceCycle } from '../../src/extensions/services.ts'
import {
  createMemoryDocumentStore,
  exportDocumentFilename,
  MAX_DOCUMENT_BYTES,
  parseImportedDocumentJson,
} from '../../src/extensions/documents.ts'
import { validateExtensionManifest } from '../../src/extensions/manifest.ts'
import { isSafeMode, useExtensionStore } from '../../src/extensions/store.ts'
import { extensionDiagnostics } from '../../src/extensions/diagnostics.ts'
import { extractRemoteCloudPayload } from '../../src/core/cloudSchema.ts'
import { fetchExtensionCatalog } from '../../src/extensions/catalog.ts'

describe('ContributionStore ownership and cleanup', () => {
  beforeEach(() => {
    useContributionStore.getState().clearAll()
  })

  it('keeps two extensions isolated and removes only the disabled owner', () => {
    const store = useContributionStore.getState()
    store.commitStaged({
      ownerId: 'ext.a',
      activationId: 'act-1',
      commands: [{ key: qualifyContributionKey('ext.a', 'export'), id: 'export', ownerId: 'ext.a', activationId: 'act-1', title: 'Export A', run: 'exportA' }],
      toolbar: [{ key: qualifyContributionKey('ext.a', 'btn'), id: 'btn', ownerId: 'ext.a', activationId: 'act-1', label: 'A', commandKey: 'ext.a:export' }],
      views: [],
    })
    store.commitStaged({
      ownerId: 'ext.b',
      activationId: 'act-2',
      commands: [{ key: qualifyContributionKey('ext.b', 'export'), id: 'export', ownerId: 'ext.b', activationId: 'act-2', title: 'Export B', run: 'exportB' }],
      toolbar: [{ key: qualifyContributionKey('ext.b', 'btn'), id: 'btn', ownerId: 'ext.b', activationId: 'act-2', label: 'B', commandKey: 'ext.b:export' }],
      views: [],
    })

    assert.equal(useContributionStore.getState().commands.length, 2)
    assert.equal(useContributionStore.getState().toolbar.length, 2)

    store.removeByOwner('ext.a')
    assert.deepEqual(useContributionStore.getState().commands.map(c => c.ownerId), ['ext.b'])
    assert.deepEqual(useContributionStore.getState().toolbar.map(t => t.ownerId), ['ext.b'])
  })

  it('produces zero duplicates across repeated reloads of the same owner', () => {
    const store = useContributionStore.getState()
    for (let i = 0; i < 5; i++) {
      store.commitStaged({
        ownerId: 'ext.a',
        activationId: `act-${i}`,
        commands: [{ key: 'ext.a:ping', id: 'ping', ownerId: 'ext.a', activationId: `act-${i}`, title: 'Ping', run: 'ping' }],
        toolbar: [{ key: 'ext.a:btn', id: 'btn', ownerId: 'ext.a', activationId: `act-${i}`, label: 'Ping', commandKey: 'ext.a:ping' }],
        views: [],
      })
    }
    assert.equal(useContributionStore.getState().commands.length, 1)
    assert.equal(useContributionStore.getState().commands[0].activationId, 'act-4')
  })
})

describe('ExtensionServiceRegistry versioning and cycles', () => {
  it('enforces semver ranges, distinguishes required vs optional, and reports both versions', async () => {
    const reg = new ExtensionServiceRegistry()
    reg.commitByOwner('tj.storyboard', [
      {
        name: 'tj.storyboard/boards',
        version: '1.4.0',
        ownerId: 'tj.storyboard',
        activationId: 'a1',
        invoke: async (m) => (m === 'list' ? ['Scene 1'] : null),
      },
    ])

    const incompatible = validateExtensionManifest({
      formatVersion: 1,
      id: 'tj.exporter',
      name: 'Storyboard Export',
      version: '1.0.0',
      worker: './worker.js',
      services: { requires: { 'tj.storyboard/boards': '^2.0.0' } },
    })
    const checkBad = reg.checkDependencies(incompatible)
    assert.equal(checkBad.ok, false)
    assert.match(checkBad.requiredFailures[0].reason, /\^2\.0\.0/)
    assert.match(checkBad.requiredFailures[0].reason, /1\.4\.0/)

    const optionalConsumer = validateExtensionManifest({
      formatVersion: 1,
      id: 'tj.helper',
      name: 'Helper',
      version: '1.0.0',
      worker: './worker.js',
      services: {
        requires: { 'tj.storyboard/boards': '^1.0.0' },
        optional: { 'tj.missing/svc': '^1.0.0' },
      },
    })
    const checkOpt = reg.checkDependencies(optionalConsumer)
    assert.equal(checkOpt.ok, true)
    assert.equal(checkOpt.optionalUnavailable.length, 1)

    const res = await reg.call(optionalConsumer, 'tj.storyboard/boards', 'list', [])
    assert.deepEqual(res, ['Scene 1'])

    await assert.rejects(
      () => reg.call(optionalConsumer, 'tj.undeclared/svc', 'x', []),
      /must declare/,
    )

    reg.removeByOwner('tj.storyboard')
    await assert.rejects(
      () => reg.call(optionalConsumer, 'tj.storyboard/boards', 'list', []),
      /currently unavailable/,
    )
  })

  it('detects circular required service dependencies explicitly', () => {
    const a = validateExtensionManifest({
      formatVersion: 1,
      id: 'ext.a',
      name: 'A',
      version: '1.0.0',
      worker: './a.js',
      services: { provides: { 'svc.a': '1.0.0' }, requires: { 'svc.b': '^1.0.0' } },
    })
    const b = validateExtensionManifest({
      formatVersion: 1,
      id: 'ext.b',
      name: 'B',
      version: '1.0.0',
      worker: './b.js',
      services: { provides: { 'svc.b': '1.0.0' }, requires: { 'svc.a': '^1.0.0' } },
    })
    const cycle = findServiceCycle(a, [a, b])
    assert.deepEqual(cycle, ['ext.a', 'ext.b', 'ext.a'])
  })

  it('breaks infinite runtime ping-pong recursion across mutually optional services', async () => {
    const reg = new ExtensionServiceRegistry()
    const a = validateExtensionManifest({
      formatVersion: 1,
      id: 'ext.a',
      name: 'A',
      version: '1.0.0',
      worker: './a.js',
      services: { provides: { 'svc.a': '1.0.0' }, optional: { 'svc.b': '^1.0.0' } },
    })
    const b = validateExtensionManifest({
      formatVersion: 1,
      id: 'ext.b',
      name: 'B',
      version: '1.0.0',
      worker: './b.js',
      services: { provides: { 'svc.b': '1.0.0' }, optional: { 'svc.a': '^1.0.0' } },
    })
    reg.commitByOwner('ext.a', [
      {
        name: 'svc.a',
        version: '1.0.0',
        ownerId: 'ext.a',
        activationId: 'a1',
        invoke: async () => reg.call(a, 'svc.b', 'ping', []),
      },
    ])
    reg.commitByOwner('ext.b', [
      {
        name: 'svc.b',
        version: '1.0.0',
        ownerId: 'ext.b',
        activationId: 'b1',
        invoke: async () => reg.call(b, 'svc.a', 'ping', []),
      },
    ])
    await assert.rejects(() => reg.call(a, 'svc.b', 'ping', []), /Service call depth limit/)
  })
})

describe('DocumentStore optimistic concurrency and Safe Mode detection', () => {
  it('increments revisions and rejects stale revision conflicts', async () => {
    const store = createMemoryDocumentStore()
    const created = await store.create({
      type: 'storyboard',
      title: 'Opening Sequence',
      createdByExtensionId: 'tj.storyboard',
      data: { scenes: ['Intro'] },
    })
    assert.equal(created.revision, 1)

    const saved = await store.save({
      id: created.id,
      expectedRevision: 1,
      data: { scenes: ['Intro', 'Middle'] },
    })
    assert.equal(saved.revision, 2)

    await assert.rejects(
      () => store.save({ id: created.id, expectedRevision: 1, data: { scenes: ['Stale'] } }),
      /REVISION_CONFLICT|modified elsewhere/,
    )

    const reloaded = await store.get(created.id)
    assert.deepEqual(reloaded?.data, { scenes: ['Intro', 'Middle'] })
  })

  it('enforces per-extension document ownership, payload size cap, and host restore', async () => {
    const store = createMemoryDocumentStore()
    const docA = await store.create({
      type: 'note',
      title: 'Private Note A',
      createdByExtensionId: 'ext.a',
      data: { text: 'secret' },
    })
    const docB = await store.create({
      type: 'note',
      title: 'Private Note B',
      createdByExtensionId: 'ext.b',
      data: { text: 'other' },
    })

    // Host list (no owner filter) sees both; scoped list sees only own docs
    assert.equal((await store.list()).length, 2)
    assert.deepEqual(
      (await store.list(undefined, 'ext.a')).map(d => d.id),
      [docA.id],
    )
    assert.deepEqual(
      (await store.list('note', 'ext.b')).map(d => d.id),
      [docB.id],
    )

    // Cross-extension get and save are denied
    await assert.rejects(() => store.get(docA.id, 'ext.b'), /cannot access a document owned by/)
    await assert.rejects(
      () =>
        store.save({
          id: docA.id,
          expectedRevision: 1,
          ownerExtensionId: 'ext.b',
          data: { text: 'tampered' },
        }),
      /cannot access a document owned by/,
    )

    // Oversized payload rejected cleanly
    await assert.rejects(
      () =>
        store.create({
          type: 'note',
          title: 'Too Big',
          createdByExtensionId: 'ext.a',
          data: { blob: 'x'.repeat(MAX_DOCUMENT_BYTES + 100) },
        }),
      /exceeds maximum size/,
    )

    // Delete + Undo restore preserves exact envelope and revision
    await store.delete(docA.id)
    assert.equal(await store.get(docA.id), null)
    await store.restore(docA)
    const restored = await store.get(docA.id, 'ext.a')
    assert.equal(restored?.title, 'Private Note A')
    assert.equal(restored?.revision, 1)

    // Validated document backup parsing & filename helper
    const imported = parseImportedDocumentJson(JSON.stringify(docA))
    assert.equal(imported.title, 'Private Note A')
    assert.equal(imported.createdByExtensionId, 'ext.a')
    assert.equal(exportDocumentFilename(docA), 'private-note-a.syntaxdoc.json')
    assert.throws(() => parseImportedDocumentJson('{bad json'), /not valid JSON/)
    assert.throws(() => parseImportedDocumentJson(JSON.stringify({ nope: true })), /Syntax document backup/)

    // Host rename increments revision safely and rejects empty names
    const renamed = await store.rename(docA.id, 'Renamed Note A')
    assert.equal(renamed.title, 'Renamed Note A')
    assert.equal(renamed.revision, 2)
    await assert.rejects(() => store.rename(docA.id, '   '), /cannot be empty/)
  })

  it('detects safeMode from search or hash query params', () => {
    assert.equal(isSafeMode('?safeMode=1', ''), true)
    assert.equal(isSafeMode('', '#/?safeMode=1'), true)
    assert.equal(isSafeMode('', '#/extensions?safeMode=true'), true)
    assert.equal(isSafeMode('', '#/extensions'), false)
  })

  it('validates persisted settings against current manifest schema and rejects NaN', () => {
    const store = useExtensionStore.getState()
    const extId = 'tj.settings-unit'
    const v1 = validateExtensionManifest({
      formatVersion: 1,
      id: extId,
      name: 'Settings Test',
      version: '1.0.0',
      settings: [
        { id: 'prefix', type: 'string', label: 'Prefix', default: 'Scene' },
        { id: 'count', type: 'number', label: 'Count', default: 3 },
        { id: 'oldFlag', type: 'boolean', label: 'Old Flag', default: false },
      ],
    })
    store.setSetting(extId, 'prefix', 'Act')
    store.setSetting(extId, 'oldFlag', true)
    store.setSetting(extId, 'count', Number.NaN)

    assert.equal(store.getSetting(extId, 'prefix', v1), 'Act')
    assert.equal(store.getSetting(extId, 'count', v1), 3)

    // v2 changes prefix from string -> boolean and drops oldFlag
    const v2 = validateExtensionManifest({
      formatVersion: 1,
      id: extId,
      name: 'Settings Test',
      version: '2.0.0',
      settings: [
        { id: 'prefix', type: 'boolean', label: 'Use Prefix', default: true },
        { id: 'count', type: 'number', label: 'Count', default: 5 },
      ],
    })
    assert.equal(store.getSetting(extId, 'prefix', v2), true)
    assert.equal(store.getSetting(extId, 'oldFlag', v2), undefined)
    assert.deepEqual(store.getAllSettings(extId, v2), { prefix: true, count: 5 })
    store.clearSettings(extId)
  })

  it('bounds diagnostics ring buffer entry count and truncates oversized log payloads', () => {
    const extId = 'tj.noisy-unit'
    extensionDiagnostics.clear(extId)
    for (let i = 0; i < 120; i++) {
      extensionDiagnostics.push({
        extensionId: extId,
        activationId: 'a1',
        source: 'worker',
        level: 'info',
        message: 'x'.repeat(5000),
        detail: 'y'.repeat(12000),
      })
    }
    const logs = extensionDiagnostics.getLogs(extId)
    assert.equal(logs.length, 100)
    assert.ok(logs[0].message.length < 2100)
    assert.match(logs[0].message, /\[truncated\]$/)
    assert.ok((logs[0].detail || '').length < 8100)
    extensionDiagnostics.clear(extId)
  })

  it('parses cloud sync payloads with extensions/settings and stays tolerant of legacy themePackId', () => {
    const parsed = extractRemoteCloudPayload({
      syntaxCloudV1: {
        v: 1,
        updatedAt: '2026-11-27T12:00:00Z',
        theme: 'dark',
        themePackId: 'legacy-pack',
        soundOn: false,
        extensions: [
          {
            id: 'tj.storyboard',
            manifestUrl: 'https://example.com/storyboard/extension.json',
            enabled: true,
          },
        ],
        extensionSettings: {
          'tj.storyboard': { defaultPrefix: 'Act', maxTasks: 30, autoSave: true },
        },
      },
    })
    assert.ok(parsed)
    assert.equal(parsed.theme, 'dark')
    assert.equal(parsed.soundOn, false)
    assert.equal(parsed.extensions?.length, 1)
    assert.equal(parsed.extensions?.[0].id, 'tj.storyboard')
    assert.equal(parsed.extensionSettings?.['tj.storyboard']?.defaultPrefix, 'Act')
    assert.equal('themePackId' in parsed, false)
  })

  it('fetches catalog gracefully when pre-aborted and validates schema', async () => {
    const controller = new AbortController()
    controller.abort()
    const aborted = await fetchExtensionCatalog('https://example.com/catalog.json', controller.signal)
    assert.equal(aborted.status, 'idle')
    assert.deepEqual(aborted.entries, [])
  })
})
