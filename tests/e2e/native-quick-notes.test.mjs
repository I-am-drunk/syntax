import assert from 'node:assert/strict'
import { createHash } from 'node:crypto'
import { readFile } from 'node:fs/promises'
import { test } from 'node:test'
import { startE2EHarness } from './harness.mjs'

const QUICK_NOTES_URL = 'https://raw.githubusercontent.com/syntax-platform/syntax-official-extensions/a35f7bc9ad5eaacfe1c5f6b1fba2bcb130ff4dd7/extensions/quick-notes/releases/v1.0.1/manifest.json'
const QUICK_NOTES_ENTRY_URL = 'https://raw.githubusercontent.com/syntax-platform/syntax-official-extensions/a35f7bc9ad5eaacfe1c5f6b1fba2bcb130ff4dd7/extensions/quick-notes/releases/v1.0.1/main.js'

const QUICK_NOTES_FALLBACK_SOURCE = `
const React = require('react');
exports.activate = ctx => {
  function QuickNotesScreen() {
    const [text, setText] = React.useState('');
    const [phase, setPhase] = React.useState('loading');
    const [err, setErr] = React.useState(null);
    const timer = React.useRef();
    const latest = React.useRef('');
    const save = async nextText => {
      setPhase('saving');
      setErr(null);
      try {
        await ctx.saveData({ text: nextText, updatedAt: new Date().toISOString() });
        setPhase('saved');
      } catch (e) {
        setErr(e instanceof Error ? e.message : String(e));
        setPhase('error');
      }
    };
    React.useEffect(() => {
      let alive = true;
      ctx.loadData().then(raw => {
        if (!alive) return;
        const t = raw && typeof raw.text === 'string' ? raw.text : '';
        latest.current = t;
        setText(t);
        setPhase(t ? 'saved' : 'ready');
      });
      return () => { alive = false; clearTimeout(timer.current); };
    }, []);
    return React.createElement('section', { 'aria-label': 'Quick Notes' },
      React.createElement('h1', null, 'Quick Notes'),
      React.createElement('div', { role: 'status' }, phase === 'saved' ? 'Saved' : phase === 'saving' ? 'Saving...' : phase === 'error' ? 'Save failed' : 'Ready'),
      err ? React.createElement('div', { role: 'alert' },
        React.createElement('span', null, 'Could not save your notes: ' + err),
        React.createElement('button', { type: 'button', onClick: () => void save(latest.current) }, 'Retry save')
      ) : null,
      React.createElement('textarea', {
        'aria-label': 'Quick Notes scratchpad',
        value: text,
        onChange: e => {
          const val = e.target.value;
          setText(val);
          latest.current = val;
          clearTimeout(timer.current);
          timer.current = setTimeout(() => void save(val), 150);
        },
        onBlur: () => { clearTimeout(timer.current); void save(latest.current); }
      })
    );
  }
  ctx.registerScreen({ id: 'notes', title: 'Quick Notes', component: QuickNotesScreen });
  ctx.registerCommand({ id: 'open-notes', title: 'Open Quick Notes', run: () => ctx.openScreen('notes') });
};
`

async function loadQuickNotesBundle() {
  try {
    const localBase = 'C:/Users/thetj/syntax-official-extensions/extensions/quick-notes/releases/v1.0.1'
    const [manifestRaw, entryRaw] = await Promise.all([
      readFile(`${localBase}/manifest.json`, 'utf8'),
      readFile(`${localBase}/main.js`, 'utf8'),
    ])
    const manifest = JSON.parse(manifestRaw)
    const normalized = entryRaw.replace(/\r\n/g, '\n')
    const entry = createHash('sha256').update(entryRaw).digest('hex') === manifest.sha256
      ? entryRaw
      : normalized
    if (createHash('sha256').update(entry).digest('hex') === manifest.sha256) {
      return { manifest, entry }
    }
  } catch {
    // Fall through to remote/fallback bundle.
  }
  try {
    const [mRes, eRes] = await Promise.all([fetch(QUICK_NOTES_URL), fetch(QUICK_NOTES_ENTRY_URL)])
    if (mRes.ok && eRes.ok) {
      return { manifest: await mRes.json(), entry: await eRes.text() }
    }
  } catch {
    // Offline fallback keeps the test self-contained.
  }
  return {
    manifest: {
      manifestVersion: 2,
      id: 'syntax.quick-notes',
      name: 'Quick Notes',
      version: '1.0.0',
      syntaxApi: '^2.0.0',
      main: 'main.js',
      sha256: createHash('sha256').update(QUICK_NOTES_FALLBACK_SOURCE).digest('hex'),
    },
    entry: QUICK_NOTES_FALLBACK_SOURCE,
  }
}

test('V1.1 Quick Notes link install, autosave durability, save error reporting, and crash recovery UX', async t => {
  const quickNotes = await loadQuickNotesBundle()
  const harness = await startE2EHarness()
  t.after(() => harness.close())

  const context = await harness.browser.newContext({ viewport: { width: 1280, height: 800 } })
  await context.addInitScript(() => {
    for (const prefix of ['', 'syntax-dev-']) {
      localStorage.setItem(`${prefix}syntax.prefs.v1`, JSON.stringify({ onboarded: true }))
    }
  })

  const quickNotesSource = harness.extUrl('quick-notes/manifest.json')
  const crashSource = harness.extUrl('crash-tool/manifest.json')
  const crashV1Entry = `
    const React = require('react');
    exports.activate = ctx => {
      ctx.registerScreen({
        id: 'main',
        title: 'Crash Tool',
        component: () => React.createElement('p', null, 'Crash tool v1')
      });
      ctx.registerCommand({
        id: 'save-token',
        title: 'Save crash token',
        run: () => ctx.saveData({ preserved: 'yes-v1' })
      });
      ctx.registerCommand({
        id: 'explode',
        title: 'Explode crash tool',
        run: () => { throw new Error('Simulated crash v1'); }
      });
    };
  `
  const crashV11BrokenEntry = `
    exports.activate = () => {
      throw new Error('Broken replacement v1.1.0');
    };
  `
  const crashV2FixedEntry = `
    const React = require('react');
    exports.activate = ctx => {
      function FixedScreen() {
        const [val, setVal] = React.useState('loading');
        React.useEffect(() => {
          ctx.loadData().then(d => setVal(d && d.preserved ? d.preserved : 'missing'));
        }, []);
        return React.createElement('p', null, 'Fixed v2 data: ' + val);
      }
      ctx.registerScreen({ id: 'main', title: 'Crash Tool', component: FixedScreen });
    };
  `

  let crashStage = 'v1'
  const page = await context.newPage()
  await page.route('**/quick-notes/*', route => {
    const isManifest = route.request().url().endsWith('/manifest.json')
    return route.fulfill({
      headers: { 'access-control-allow-origin': '*' },
      contentType: isManifest ? 'application/json' : 'text/javascript',
      body: isManifest ? JSON.stringify(quickNotes.manifest) : quickNotes.entry,
    })
  })
  await page.route('**/crash-tool/*', route => {
    const isManifest = route.request().url().endsWith('/manifest.json')
    const entry = crashStage === 'v1'
      ? crashV1Entry
      : crashStage === 'v1.1-broken'
        ? crashV11BrokenEntry
        : crashV2FixedEntry
    const version = crashStage === 'v1' ? '1.0.0' : crashStage === 'v1.1-broken' ? '1.1.0' : '2.0.0'
    return route.fulfill({
      headers: { 'access-control-allow-origin': '*' },
      contentType: isManifest ? 'application/json' : 'text/javascript',
      body: isManifest ? JSON.stringify({
        manifestVersion: 2,
        id: 'example.crash-tool',
        name: 'Crash Tool',
        version,
        syntaxApi: '^2.0.0',
        main: 'main.js',
        sha256: createHash('sha256').update(entry).digest('hex'),
      }) : entry,
    })
  })

  // 1. Install Quick Notes from direct link (?native=...)
  await page.goto(`${harness.appOrigin}/syntax-dev/#/extensions?native=${encodeURIComponent(quickNotesSource)}`)
  const native = page.getByRole('region', { name: 'Native extensions' })
  await native.getByRole('button', { name: 'Install native package' }).waitFor()
  await native.getByRole('button', { name: 'Install native package' }).click()

  // 2. Open directly from install success banner
  const successBanner = native.locator('[data-native-install-success="syntax.quick-notes"]')
  await successBanner.waitFor()
  await successBanner.getByRole('button', { name: /Open/ }).click()
  const textarea = page.getByLabel('Quick Notes scratchpad')
  await textarea.waitFor()

  // 3. Autosave + refresh durability
  await textarea.fill('Slope of a perpendicular line is the negative reciprocal.')
  await page.getByRole('status').filter({ hasText: /Saved/ }).waitFor()
  await page.reload()
  await textarea.waitFor()
  await page.getByRole('status').filter({ hasText: /Saved/ }).waitFor()
  assert.equal(await textarea.inputValue(), 'Slope of a perpendicular line is the negative reciprocal.')

  // 4. Open from Extensions + Disable/Enable durability
  await page.getByRole('button', { name: 'Back to Extensions' }).click()
  const qnCard = native.locator('[data-native-extension-id="syntax.quick-notes"]')
  await qnCard.getByRole('button', { name: 'Disable', exact: true }).click()
  await qnCard.getByRole('button', { name: 'Enable', exact: true }).waitFor()
  await qnCard.getByRole('button', { name: 'Enable', exact: true }).click()
  await qnCard.getByRole('button', { name: 'Open Quick Notes' }).click()
  await textarea.waitFor()
  await page.getByRole('status').filter({ hasText: /Saved/ }).waitFor()
  assert.equal(await textarea.inputValue(), 'Slope of a perpendicular line is the negative reciprocal.')

  // 5. Uninstall + Reinstall durability
  await page.getByRole('button', { name: 'Back to Extensions' }).click()
  await qnCard.getByRole('button', { name: 'Uninstall Quick Notes' }).click()
  await native.getByText('Uninstalled Quick Notes. Saved data was preserved.').waitFor()
  await native.getByRole('textbox', { name: 'Native manifest URL' }).fill(quickNotesSource)
  await native.getByRole('button', { name: 'Review native package' }).click()
  await native.getByRole('button', { name: 'Install native package' }).click()

  // 6. Open Quick Notes via Command Palette (Ctrl+K)
  await page.keyboard.press('Control+k')
  await page.getByRole('option', { name: /Open Quick Notes/ }).click()
  await textarea.waitFor()
  await page.getByRole('status').filter({ hasText: /Saved/ }).waitFor()
  assert.equal(await textarea.inputValue(), 'Slope of a perpendicular line is the negative reciprocal.')

  // 7. Simulate a real save failure & verify clear error reporting + recovery on Retry save
  await page.evaluate(() => {
    const orig = IDBObjectStore.prototype.put
    window.__origIdbPut = orig
    IDBObjectStore.prototype.put = function (...args) {
      if (this.name === 'data') {
        throw new DOMException('Simulated quota exceeded', 'QuotaExceededError')
      }
      return orig.apply(this, args)
    }
  })
  await textarea.fill('Draft that should trigger a visible save error.')
  const saveAlert = page.getByRole('alert').filter({ hasText: /Could not save your notes/ })
  await saveAlert.waitFor()
  await page.evaluate(() => {
    if (window.__origIdbPut) IDBObjectStore.prototype.put = window.__origIdbPut
  })
  await saveAlert.getByRole('button', { name: 'Retry save' }).click()
  await page.getByRole('status').filter({ hasText: /Saved/ }).waitFor()

  // 8. Install Crash Tool while Quick Notes stays healthy in a second tab
  const healthyTab = await context.newPage()
  await healthyTab.goto(page.url())
  await healthyTab.getByRole('status').filter({ hasText: /Saved/ }).waitFor()
  assert.equal(await healthyTab.getByLabel('Quick Notes scratchpad').inputValue(), 'Draft that should trigger a visible save error.')

  await page.getByRole('button', { name: 'Back to Extensions' }).click()
  await native.getByRole('textbox', { name: 'Native manifest URL' }).fill(crashSource)
  await native.getByRole('button', { name: 'Review native package' }).click()
  await native.getByRole('button', { name: 'Install native package' }).click()
  const crashCard = native.locator('[data-native-extension-id="example.crash-tool"]')
  await crashCard.waitFor()

  // Save data in Crash Tool first so we prove data survives crash + retry + replacement
  await page.keyboard.press('Control+k')
  await page.getByRole('option', { name: /Save crash token/ }).click()
  await page.waitForTimeout(200)

  // Trigger crash -> verify top-right Sonner notification with Inspect action
  await page.keyboard.press('Control+k')
  await page.getByRole('option', { name: /Explode crash tool/ }).click()
  const toast = page.locator('[data-sonner-toast]').filter({ hasText: /Crash Tool stopped after an error/ })
  await toast.waitFor({ state: 'visible', timeout: 10000 })
  const box = await toast.boundingBox()
  assert.ok(box && box.x > 640 && box.y < 300, `Expected desktop top-right notification, got box ${JSON.stringify(box)}`)

  // Click Inspect on toast -> verify inspection details + Re-enable button
  await toast.getByRole('button', { name: 'Inspect' }).click()
  await crashCard.locator('[data-native-inspect="example.crash-tool"]').waitFor()
  await crashCard.getByRole('button', { name: 'Re-enable', exact: true }).waitFor()

  // Healthy Quick Notes tab is still alive and usable
  assert.equal(await healthyTab.getByLabel('Quick Notes scratchpad').inputValue(), 'Draft that should trigger a visible save error.')

  // Retry the exact same broken build -> verify short same-build retry caution appears
  await crashCard.getByRole('button', { name: 'Re-enable', exact: true }).click()
  await crashCard.locator('[data-retry-caution="true"]').waitFor()

  // Attempt broken replacement v1.1.0 -> verify new failure is shown and data is preserved
  crashStage = 'v1.1-broken'
  await crashCard.getByRole('button', { name: 'Check update' }).click()
  await native.getByRole('button', { name: 'Install native package' }).click()
  await native.getByRole('alert').filter({ hasText: /Broken replacement v1\.1\.0/ }).waitFor()
  await native.getByRole('button', { name: 'Cancel', exact: true }).click()

  // Install verified fixed replacement v2.0.0 -> verify caution clears & saved data preserved!
  crashStage = 'v2-fixed'
  await crashCard.getByRole('button', { name: 'Check update' }).click()
  await native.getByRole('button', { name: 'Install native package' }).click()
  await crashCard.locator('[data-caution-cleared="true"]').waitFor()
  assert.equal(await crashCard.locator('[data-retry-caution="true"]').count(), 0)
  await crashCard.getByRole('button', { name: 'Open Crash Tool' }).click()
  await page.getByText('Fixed v2 data: yes-v1', { exact: true }).waitFor()

  // Quick Notes still intact in healthy tab!
  await healthyTab.reload()
  await healthyTab.getByRole('status').filter({ hasText: /Saved/ }).waitFor()
  assert.equal(await healthyTab.getByLabel('Quick Notes scratchpad').inputValue(), 'Draft that should trigger a visible save error.')
  await healthyTab.close()
})
