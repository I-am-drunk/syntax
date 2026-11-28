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

test('hostModules expose live @syntax/ui and @syntax/api, and course progress survives reinstall until per-course delete', async () => {
  const records = new Map()
  const data = new Map()
  const progress = new Map()
  let progressEvents = 0
  let sharedControlLabel = 'v1-host-button'

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
    loadProgress: async id => progress.get(id),
    saveProgress: async (id, val) => {
      if (val === null) progress.delete(id)
      else progress.set(id, val)
    },
    listProgress: async () => Object.fromEntries(progress.entries()),
    listDataOwners: async () => [...new Set([...data.keys(), ...progress.keys()])].sort(),
    clearOwnerData: async id => {
      data.delete(id)
      progress.delete(id)
    },
  }, {
    getItem() { return null },
    setItem() {},
    removeItem() {},
  }, () => {}, {
    checkSource() {},
    checkPackage() {},
  }, {
    hostModules: {
      '@syntax/api': { useSyntaxTheme: () => 'light' },
      '@syntax/ui': { Button: () => sharedControlLabel },
    },
    onProgressChanged: () => { progressEvents += 1 },
  })

  const makeCoursePkg = (id, entry) => {
    const result = pkg(id, entry, '1.0.0')
    result.manifest.sha256 = createHash('sha256').update(entry).digest('hex')
    return result
  }

  const courseEntry = `
    const ui = require('@syntax/ui');
    exports.activate = ctx => {
      ctx.registerScreen({ id: 'lesson', title: 'Lesson 1', kind: 'course', component: () => ui.Button() });
      ctx.registerCommand({
        id: 'complete',
        title: 'Complete lesson',
        run: async () => {
          await ctx.saveData({ done: true });
          await ctx.reportProgress({ completed: 1, total: 2, label: '1 / 2 lessons' });
        },
      });
    };
  `
  await host.installInspected(makeCoursePkg('syntax.course-a', courseEntry))
  await host.installInspected(makeCoursePkg('syntax.course-b', courseEntry))
  await host.runCommand('syntax.course-a', 'complete')
  await host.runCommand('syntax.course-b', 'complete')

  assert.equal(progressEvents, 2)
  assert.deepEqual((await host.listProgress())['syntax.course-a'], { completed: 1, total: 2, label: '1 / 2 lessons' })

  // Live host UI change propagates without rebuilding the installed extension!
  assert.equal(host.runtime.getScreen('syntax.course-a', 'lesson').component(), 'v1-host-button')
  sharedControlLabel = 'v2-updated-host-button'
  assert.equal(host.runtime.getScreen('syntax.course-a', 'lesson').component(), 'v2-updated-host-button')

  // Uninstall + reinstall preserves progress and data
  await host.uninstall('syntax.course-a')
  assert.deepEqual((await host.listProgress())['syntax.course-a'], { completed: 1, total: 2, label: '1 / 2 lessons' })
  await host.installInspected(makeCoursePkg('syntax.course-a', courseEntry))
  assert.deepEqual(data.get('syntax.course-a'), { done: true })

  // Deleting course-a saved data leaves course-b untouched!
  await host.clearCourseData('syntax.course-a')
  assert.equal((await host.listProgress())['syntax.course-a'], undefined)
  assert.equal(data.get('syntax.course-a'), undefined)
  assert.deepEqual((await host.listProgress())['syntax.course-b'], { completed: 1, total: 2, label: '1 / 2 lessons' })
  assert.deepEqual(data.get('syntax.course-b'), { done: true })
})

test('embedded extensions, optional course tools, and scoped/global styles follow owner lifecycle cleanly', async () => {
  const events = []
  let contributionChanges = 0
  const { runtime } = setup()
  const trackedRuntime = new NativeRuntime(
    { load: async () => undefined, save: async () => {} },
    () => {},
    { onContributionsChanged: () => { contributionChanges += 1 } },
  )
  assert.ok(runtime)

  const coursePkg = pkg('syntax.geo', `
    exports.activate = async ctx => {
      await ctx.registerEmbedded({
        id: 'graph-helper',
        title: 'Graph Helper',
        setup: () => {
          globalThis.__v13Events.push('setup:v1');
          return () => { globalThis.__v13Events.push('cleanup:v1'); };
        },
      });
      ctx.registerStyles({ id: 'local', scope: 'scoped', css: '.box { color: red; }' });
      ctx.registerScreen({ id: 'main', title: 'Geo', kind: 'course', component: () => null });
    };
  `, '1.0.0')
  const toolPkg = pkg('syntax.playbook', `
    exports.activate = ctx => {
      ctx.registerCourseTool({
        id: 'formulas',
        title: 'Formula Playbook',
        buttonLabel: 'Formulas',
        targetCourses: ['syntax.geo'],
        component: () => null,
      });
    };
  `, '1.0.0')
  const themePkg = pkg('syntax.theme', `
    exports.activate = ctx => {
      ctx.registerStyles({ id: 'paper', scope: 'global', css: ':root { --paper: 1; }' });
      ctx.registerCommand({ id: 'boom', title: 'Boom', run: () => { throw new Error('theme crash'); } });
    };
  `, '1.0.0')

  globalThis.__v13Events = events
  try {
    await trackedRuntime.activate(coursePkg)
    assert.deepEqual(events, ['setup:v1'])
    assert.deepEqual(trackedRuntime.listEmbedded('syntax.geo'), [{ id: 'graph-helper', title: 'Graph Helper' }])
    assert.deepEqual(trackedRuntime.listStyles('syntax.geo'), [{ id: 'local', scope: 'scoped' }])

    await trackedRuntime.activate(toolPkg)
    assert.equal(trackedRuntime.listCourseToolsFor('syntax.geo').length, 1)
    assert.equal(trackedRuntime.listCourseToolsFor('syntax.other').length, 0)

    // Disable optional tool while course stays active
    trackedRuntime.disable('syntax.playbook')
    assert.equal(trackedRuntime.listCourseToolsFor('syntax.geo').length, 0)
    assert.equal(trackedRuntime.isActive('syntax.geo'), true)

    // Updating a course runs previous embedded cleanup BEFORE new embedded setup
    const courseV2 = pkg('syntax.geo', `
      exports.activate = async ctx => {
        await ctx.registerEmbedded({
          id: 'graph-helper',
          title: 'Graph Helper v2',
          setup: () => {
            globalThis.__v13Events.push('setup:v2');
            return () => { globalThis.__v13Events.push('cleanup:v2'); };
          },
        });
        ctx.registerScreen({ id: 'main', title: 'Geo v2', kind: 'course', component: () => null });
      };
    `, '1.1.0')
    await trackedRuntime.activate(courseV2)
    assert.deepEqual(events, ['setup:v1', 'cleanup:v1', 'setup:v2'])

    // Disabling course cleans up embedded behavior together
    trackedRuntime.disable('syntax.geo')
    assert.deepEqual(events, ['setup:v1', 'cleanup:v1', 'setup:v2', 'cleanup:v2'])
    assert.deepEqual(trackedRuntime.listEmbedded('syntax.geo'), [])

    // Theme crash cleans up global styles and command
    await trackedRuntime.activate(themePkg)
    assert.deepEqual(trackedRuntime.listStyles('syntax.theme'), [{ id: 'paper', scope: 'global' }])
    await assert.rejects(trackedRuntime.runCommand('syntax.theme', 'boom'), /theme crash/)
    assert.deepEqual(trackedRuntime.listStyles('syntax.theme'), [])
    assert.deepEqual(trackedRuntime.listCommands('syntax.theme'), [])
    assert.ok(contributionChanges >= 4)
  } finally {
    delete globalThis.__v13Events
  }
})

test('scoped CSS rejects breakout braces and global at-rules, and invalid tool metadata is rejected', async () => {
  const { runtime } = setup()
  await assert.rejects(
    runtime.activate(pkg('example.breakout', `
      exports.activate = ctx => {
        ctx.registerStyles({ id: 'bad', scope: 'scoped', css: '.a { color: red; } } body { background: black; } {' });
      };
    `)),
    { code: 'STYLE_INVALID' },
  )
  await assert.rejects(
    runtime.activate(pkg('example.atrule', `
      exports.activate = ctx => {
        ctx.registerStyles({ id: 'bad', scope: 'scoped', css: '@import url("https://evil.example/x.css"); .a { color: red; }' });
      };
    `)),
    { code: 'STYLE_INVALID' },
  )
  await assert.rejects(
    runtime.activate(pkg('example.badtool', `
      exports.activate = ctx => {
        ctx.registerCourseTool({ id: 't', title: 'T', buttonLabel: 'T', targetCourses: [123], component: () => null });
      };
    `)),
    { code: 'CONTRIBUTION_INVALID' },
  )
  await assert.rejects(
    runtime.activate(pkg('example.badrec', `
      exports.activate = ctx => {
        ctx.registerScreen({ id: 's', title: 'S', component: () => null, recommendedTools: [{ id: 'x' }] });
      };
    `)),
    { code: 'CONTRIBUTION_INVALID' },
  )
})
