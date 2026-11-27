import { describe, it, beforeEach } from 'node:test'
import assert from 'node:assert/strict'
import { useContributionStore, qualifyContributionKey } from '../../src/extensions/contributions.ts'
import { ExtensionServiceRegistry, findServiceCycle } from '../../src/extensions/services.ts'
import { createMemoryDocumentStore } from '../../src/extensions/documents.ts'
import { validateExtensionManifest } from '../../src/extensions/manifest.ts'
import { isSafeMode } from '../../src/extensions/store.ts'

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

  it('detects safeMode from search or hash query params', () => {
    assert.equal(isSafeMode('?safeMode=1', ''), true)
    assert.equal(isSafeMode('', '#/?safeMode=1'), true)
    assert.equal(isSafeMode('', '#/extensions?safeMode=true'), true)
    assert.equal(isSafeMode('', '#/extensions'), false)
  })
})
