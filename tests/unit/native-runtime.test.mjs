import assert from 'node:assert/strict'
import { createHash } from 'node:crypto'
import { test } from 'node:test'
import { NativeHost } from '../../src/extensions/native/host.ts'
import { NativeRuntime } from '../../src/extensions/native/runtime.ts'

function pkg(id, entry, version = '1.0.0') {
  return {
    sourceUrl: `https://example.com/${id}/manifest.json`,
    manifest: { manifestVersion: 2, id, name: id, version, syntaxApi: '^2.0.0', main: 'entry.js', sha256: '0'.repeat(64) },
    entry,
  }
}

function setup(load = async () => undefined) {
  const saved = new Map()
  const cleanupErrors = []
  const runtime = new NativeRuntime({
    load,
    save: async (id, data) => { saved.set(id, data) },
  }, (id, error) => { cleanupErrors.push({ id, message: error.message }) })
  return { runtime, saved, cleanupErrors }
}

const working = `
  const React = require('react');
  exports.activate = ctx => {
    ctx.registerScreen({ id: 'main', title: 'Working', component: () => React.createElement('p', null, 'Ready') });
    ctx.registerCommand({ id: 'save', title: 'Save', run: () => ctx.saveData('saved') });
  };
`

test('activates a screen and command with host React and keeps saved data on disable', async () => {
  const { runtime, saved } = setup()
  await runtime.activate(pkg('example.one', working))
  assert.equal(runtime.getScreen('example.one', 'main').component().props.children, 'Ready')
  await runtime.runCommand('example.one', 'save')
  runtime.disable('example.one')
  assert.equal(runtime.getScreen('example.one', 'main'), undefined)
  assert.equal(saved.get('example.one'), 'saved')
  await assert.rejects(runtime.runCommand('example.one', 'save'), { code: 'COMMAND_UNAVAILABLE' })
})

test('a failed replacement disposes staged work and leaves the installed version and sibling active', async () => {
  const { runtime, saved, cleanupErrors } = setup()
  await runtime.activate(pkg('example.one', working))
  await runtime.activate(pkg('example.two', working))
  await runtime.runCommand('example.one', 'save')
  await assert.rejects(runtime.activate(pkg('example.one', `
    exports.activate = async ctx => {
      ctx.onDispose(() => { throw new Error('cleanup ran'); });
      ctx.registerScreen({ id: 'main', title: 'Staged', component: () => null });
      await ctx.saveData('should not overwrite');
    };
  `, '2.0.0')), { code: 'ACTIVATION_PENDING' })
  assert.deepEqual(cleanupErrors, [{ id: 'example.one', message: 'cleanup ran' }])
  assert.equal(saved.get('example.one'), 'saved')
  assert.equal(runtime.getScreen('example.one', 'main').title, 'Working')
  assert.equal(runtime.getScreen('example.two', 'main').title, 'Working')
})

test('a replacement cannot publish its contributions if writing the new install fails', async () => {
  const { runtime } = setup()
  await runtime.activate(pkg('example.one', working))
  const replacement = working.replace('Working', 'Candidate')
  await assert.rejects(runtime.activate(pkg('example.one', replacement, '2.0.0'), async () => {
    assert.equal(runtime.getScreen('example.one', 'main').title, 'Working')
    throw new Error('storage rejected the new install')
  }), /storage rejected/)
  assert.equal(runtime.getScreen('example.one', 'main').title, 'Working')
})

test('a journal cleanup failure after commit preserves the persisted and active replacement', async () => {
  const records = new Map()
  const diagnostics = []
  let failRemoval = false
  const host = new NativeHost({
    get: async id => records.get(id),
    replace: async (id, expected, record) => {
      assert.equal(records.get(id)?.revision, expected)
      records.set(id, record)
    },
  }, {
    setItem() {},
    removeItem() {
      if (failRemoval) throw new Error('startup journal unavailable')
    },
  }, (id, error) => diagnostics.push([id, error.message]), {
    checkSource() {},
    checkPackage() {},
  })
  const id = 'example.one'
  const checkedPackage = (entry, version) => {
    const result = pkg(id, entry, version)
    result.manifest.sha256 = createHash('sha256').update(entry).digest('hex')
    return result
  }
  await host.installInspected(checkedPackage(working, '1.0.0'))
  failRemoval = true
  const replacement = await host.installInspected(checkedPackage(working.replace('Working', 'Replacement'), '2.0.0'))
  assert.equal(records.get(id)?.revision, replacement.revision)
  assert.equal(host.runtime.getActiveRevision(id), replacement.revision)
  assert.equal(host.runtime.getScreen(id, 'main')?.title, 'Replacement')
  assert.deepEqual(diagnostics, [[id, 'startup journal unavailable']])
})

test('disable retires an activation that finishes late', async () => {
  const { promise: loading, resolve: loadStarted } = Promise.withResolvers()
  const { promise: result, resolve: finishLoad } = Promise.withResolvers()
  const load = () => {
    loadStarted()
    return result
  }
  const { runtime } = setup(load)
  const starting = runtime.activate(pkg('example.one', `
    exports.activate = async ctx => {
      await ctx.loadData();
      ctx.registerScreen({ id: 'main', title: 'Late', component: () => null });
    };
  `))
  await loading
  runtime.disable('example.one')
  await runtime.activate(pkg('example.one', working))
  finishLoad()
  await assert.rejects(starting, { name: 'AbortError' })
  assert.equal(runtime.getScreen('example.one', 'main').title, 'Working')
})

test('cleanup failures, including an async rejection and a throwing reporter, leave the replacement active', async () => {
  const errors = []
  const runtime = new NativeRuntime({ load: async () => undefined, save: async () => {} }, (_id, error) => {
    errors.push(error.message)
    throw new Error('reporter failed')
  })
  await runtime.activate(pkg('example.one', `
    exports.activate = ctx => {
      ctx.onDispose(() => { throw new Error('first'); });
      ctx.onDispose(async () => { throw new Error('async'); });
      ctx.onDispose(() => { throw new Error('last'); });
    };
  `))
  await runtime.activate(pkg('example.one', working, '2.0.0'))
  assert.deepEqual(errors.sort(), ['async', 'first', 'last'])
  assert.equal(runtime.getScreen('example.one', 'main').title, 'Working')
})

test('a delayed save from a retired version cannot overtake a replacement save', async () => {
  const { promise: saving, resolve: saveStarted } = Promise.withResolvers()
  const { promise: release, resolve: finishSave } = Promise.withResolvers()
  const saved = []
  const runtime = new NativeRuntime({
    load: async () => undefined,
    save: async (_id, value) => {
      if (value === 'saved') {
        saveStarted()
        await release
      }
      saved.push(value)
    },
  }, () => {})
  await runtime.activate(pkg('example.one', working))
  const old = runtime.runCommand('example.one', 'save')
  await saving
  await runtime.activate(pkg('example.one', working.replace("'saved'", "'replacement'"), '2.0.0'))
  const replacement = runtime.runCommand('example.one', 'save')
  finishSave()
  await Promise.all([old, replacement])
  assert.deepEqual(saved, ['saved', 'replacement'])
})

test('a command failure retires only its owning extension', async () => {
  const { runtime } = setup()
  await runtime.activate(pkg('example.one', working))
  await runtime.activate(pkg('example.two', `
    exports.activate = ctx => {
      ctx.registerScreen({ id: 'main', title: 'Broken', component: () => null });
      ctx.registerCommand({ id: 'fail', title: 'Fail', run: () => { throw new Error('command failed'); } });
    };
  `))
  await assert.rejects(runtime.runCommand('example.two', 'fail'), /command failed/)
  assert.equal(runtime.getScreen('example.two', 'main'), undefined)
  assert.equal(runtime.getScreen('example.one', 'main').title, 'Working')
})

test('openScreen navigates only for active screens owned by the extension', async () => {
  const { runtime } = setup()
  const navigated = []
  runtime.setNavigator(path => navigated.push(path))
  await runtime.activate(pkg('example.notes', `
    exports.activate = ctx => {
      ctx.registerScreen({ id: 'notes', title: 'Notes', component: () => null });
      ctx.registerCommand({ id: 'open', title: 'Open Notes', run: () => ctx.openScreen('notes') });
      ctx.registerCommand({ id: 'bad', title: 'Bad Screen', run: () => ctx.openScreen('missing') });
    };
  `))
  await runtime.runCommand('example.notes', 'open')
  assert.deepEqual(navigated, ['/native-extension/example.notes/notes'])
  await assert.rejects(runtime.runCommand('example.notes', 'bad'), { code: 'SCREEN_UNAVAILABLE' })
})

test('uninstall preserves saved data, same-build retry sets caution, and replacement clears it', async () => {
  const records = new Map()
  const data = new Map()
  const host = new NativeHost({
    list: async () => [...records.values()],
    get: async id => records.get(id),
    replace: async (id, expected, record) => {
      assert.equal(records.get(id)?.revision, expected)
      records.set(id, record)
    },
    remove: async id => { records.delete(id) },
    load: async id => data.get(id),
    save: async (id, value) => { data.set(id, value) },
  }, {
    getItem() { return null },
    setItem() {},
    removeItem() {},
  }, () => {}, {
    checkSource() {},
    checkPackage() {},
  })

  const id = 'example.notes'
  const makePkg = (entry, version) => {
    const result = pkg(id, entry, version)
    result.manifest.sha256 = createHash('sha256').update(entry).digest('hex')
    return result
  }
  const v1Broken = `
    exports.activate = ctx => {
      ctx.registerScreen({ id: 'main', title: 'Notes', component: () => null });
      ctx.registerCommand({ id: 'save', title: 'Save', run: () => ctx.saveData({ text: 'keep me' }) });
      ctx.registerCommand({ id: 'boom', title: 'Boom', run: () => { throw new Error('boom'); } });
    };
  `
  const v2Fixed = `
    exports.activate = ctx => {
      ctx.registerScreen({ id: 'main', title: 'Notes v2', component: () => null });
    };
  `
  await host.installInspected(makePkg(v1Broken, '1.0.0'))
  await host.runCommand(id, 'save')
  assert.deepEqual(data.get(id), { text: 'keep me' })

  await host.uninstall(id)
  assert.equal(records.get(id), undefined)
  assert.deepEqual(data.get(id), { text: 'keep me' })

  await host.installInspected(makePkg(v1Broken, '1.0.0'))
  await assert.rejects(host.runCommand(id, 'boom'), /boom/)
  const afterCrash = records.get(id)
  assert.equal(afterCrash.enabled, false)
  assert.equal(afterCrash.failedSha256, afterCrash.package.manifest.sha256)
  assert.equal(afterCrash.retryCaution, false)

  await host.setEnabled(id, true)
  const afterRetry = records.get(id)
  assert.equal(afterRetry.enabled, true)
  assert.equal(afterRetry.retryCaution, true)

  // Manual disable/re-enable on same broken build preserves caution
  await host.setEnabled(id, false)
  await host.setEnabled(id, true)
  assert.equal(records.get(id).retryCaution, true)

  // Reinstalling the exact same broken build also preserves retryCaution
  await host.installInspected(makePkg(v1Broken, '1.0.0'))
  assert.equal(records.get(id).retryCaution, true)

  await host.installInspected(makePkg(v2Fixed, '2.0.0'))
  const afterReplace = records.get(id)
  assert.equal(afterReplace.enabled, true)
  assert.equal(afterReplace.retryCaution, undefined)
  assert.equal(afterReplace.failedSha256, undefined)
  assert.deepEqual(data.get(id), { text: 'keep me' })
})
