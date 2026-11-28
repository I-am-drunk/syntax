import assert from 'node:assert/strict'
import { test } from 'node:test'
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
