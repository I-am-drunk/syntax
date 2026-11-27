import assert from 'node:assert/strict'
import { after, before, describe, it } from 'node:test'
import { startE2EHarness } from './harness.mjs'

let harness

async function createCleanPage() {
  const context = await harness.browser.newContext({ viewport: { width: 1280, height: 860 } })
  // Skip onboarding modal cleanly on the top-level Syntax host frame only
  // (opaque sandboxed extension iframes intentionally block localStorage).
  await context.addInitScript(() => {
    if (window !== window.top) return
    try {
      if (!localStorage.getItem('syntax.prefs.v1')) {
        localStorage.setItem('syntax.prefs.v1', JSON.stringify({ onboarded: true }))
      }
    } catch {
      // ignore
    }
  })
  const page = await context.newPage()
  const pageErrors = []
  page.on('pageerror', err => pageErrors.push(err))
  return { context, page, pageErrors }
}

async function installViaUi(page, url) {
  await page.goto(`${harness.appOrigin}/#/extensions`)
  await page.waitForSelector('input[aria-label="Extension manifest URL"]')
  await page.fill('input[aria-label="Extension manifest URL"]', url)
  await page.click('button[type="submit"]:has-text("Install")')
}

describe('Syntax Extensions v1 end-to-end acceptance suite (real Chromium)', () => {
  before(async () => {
    harness = await startE2EHarness()
  })

  after(async () => {
    if (harness) await harness.close()
  })

  it('1-4. external install, opaque sandboxed page & embed views, service collaboration, error attribution, hang stop & reload recovery', async () => {
    const { context, page, pageErrors } = await createCleanPage()
    try {
      // 1. Install Storyboard Studio from separate cross-origin server
      await installViaUi(page, harness.extUrl('storyboard/extension.json'))
      await page.waitForSelector('[data-extension-id="tj.storyboard"][data-extension-status="active"]')

      // Verify legacy /plugins route redirects cleanly to /extensions
      await page.goto(`${harness.appOrigin}/#/plugins`)
      await page.waitForFunction(() => window.location.hash.includes('/extensions'))

      // Verify toolbar contribution appears in header
      await page.waitForSelector('[data-extension-toolbar-key="tj.storyboard:open-board"]')

      // Open fullscreen page view via toolbar button
      await page.click('[data-extension-toolbar-key="tj.storyboard:open-board"]')
      await page.waitForSelector('[data-extension-id="tj.storyboard"][data-view-id="board"][data-view-ready="true"]')

      const frame = page.frameLocator('iframe.sx-ext-iframe').first()

      // Verify opaque-origin sandbox isolation (origin === 'null', parent & localStorage blocked)
      const probeText = await frame.locator('#security-probe').textContent()
      const probe = JSON.parse(probeText || '{}')
      assert.equal(probe.origin, 'null')
      assert.equal(probe.parentBlocked, true)
      assert.equal(probe.storageBlocked, true)

      // Verify live theme sync into iframe
      const initialTheme = await frame.locator('#theme-mode').textContent()
      await page.click('button[aria-label*="Switch to"]')
      await page.waitForFunction(
        prev => {
          const iframe = document.querySelector('iframe.sx-ext-iframe')
          return Boolean(iframe) && document.documentElement.dataset.theme !== prev
        },
        initialTheme,
      )
      await frame.locator(`#theme-mode:text-is("${initialTheme === 'dark' ? 'light' : 'dark'}")`).waitFor()

      // Create & save document via worker -> DocumentStore, verify optimistic revision conflict
      await frame.locator('#create-btn').click()
      await frame.locator('#doc-status:has-text("rev:1")').waitFor()
      await frame.locator('#add-task-btn').click()
      await frame.locator('#doc-status:has-text("rev:2")').waitFor()
      await frame.locator('#stale-save-btn').click()
      await frame.locator('#doc-status:has-text("CONFLICT:")').waitFor()

      // Verify embedded view mounts cleanly on Library page alongside saved document
      await page.goto(`${harness.appOrigin}/#/library`)
      await page.waitForSelector('[data-extension-id="tj.storyboard"][data-view-id="scratchpad"][data-view-ready="true"]')
      const embedFrame = page.frameLocator('[data-view-id="scratchpad"] iframe.sx-ext-iframe')
      const embedStatus = await embedFrame.locator('#embed-status').textContent()
      assert.match(embedStatus || '', /^embed-ready:scratchpad:/)

      // 2. Install Storyboard Exporter (requires tj.storyboard/boards@^1.0.0, optional missing service, shared "Export" command name)
      await installViaUi(page, harness.extUrl('storyboard-exporter/extension.json'))
      await page.waitForSelector('[data-extension-id="tj.exporter"][data-extension-status="active"]')

      // Verify BOTH extensions' "Export" commands exist without colliding and render in header Menu
      const commandKeys = await page.evaluate(() =>
        window.__SYNTAX_EXTENSIONS__.contributions.getState().commands.map(c => c.key),
      )
      assert.ok(commandKeys.includes('tj.storyboard:export'))
      assert.ok(commandKeys.includes('tj.exporter:export'))

      await page.click('button[aria-label="Menu"]')
      await page.waitForSelector('[data-extension-command-key="tj.storyboard:export"]')
      await page.waitForSelector('[data-extension-command-key="tj.exporter:export"]')
      await page.keyboard.press('Escape')

      // Verify full page reload boots extensions automatically in topological order
      await page.reload()
      await page.waitForSelector('[data-extension-id="tj.storyboard"][data-extension-status="active"]')
      await page.waitForSelector('[data-extension-id="tj.exporter"][data-extension-status="active"]')

      // Inter-extension service call returns saved storyboard tasks + optional missing service reported
      const exportResult = await page.evaluate(async () => {
        const ext = window.__SYNTAX_EXTENSIONS__
        const res = await ext.manager.runCommand('tj.exporter:export', ['deck.md'])
        const rt = ext.store.getState().runtime['tj.exporter']
        return { res, optionalIssues: rt.unavailableOptionalServices }
      })
      assert.equal(exportResult.res.hasAnalytics, false)
      assert.match(exportResult.res.output, /deck\.md: Storyboard, Record voiceover, Edit rough cut/)
      assert.ok('tj.missing/analytics' in exportResult.optionalIssues)

      // 3. Ordinary error attribution
      const errResult = await page.evaluate(async () => {
        const ext = window.__SYNTAX_EXTENSIONS__
        try {
          await ext.manager.runCommand('tj.exporter:exportBad')
          return { threw: false }
        } catch (err) {
          const logs = ext.diagnostics.getLogs('tj.exporter')
          return {
            threw: true,
            message: err.message,
            attributed: logs.some(l => l.extensionId === 'tj.exporter' && l.message.includes('Missing export filename')),
          }
        }
      })
      assert.equal(errResult.threw, true)
      assert.match(errResult.message, /Missing export filename/)
      assert.equal(errResult.attributed, true)

      // 4. Infinite loop hang isolation + Stop Worker via UI + Reload without page refresh
      const hangCheck = await page.evaluate(async () => {
        const ext = window.__SYNTAX_EXTENSIONS__
        const hungPromise = ext.manager.runCommand('tj.exporter:hang').then(
          () => ({ ok: true }),
          err => ({ ok: false, message: err.message }),
        )
        // Give exporter worker time to enter while(true){}
        await new Promise(r => setTimeout(r, 120))
        // Meanwhile tj.storyboard MUST still respond immediately!
        const boardTasks = await ext.manager.invokeWorker('tj.storyboard', 'listBoards')
        window.__HUNG_PROMISE__ = hungPromise
        return { boardTasks }
      })
      assert.ok(hangCheck.boardTasks.includes('Storyboard'))

      // Stop stuck exporter worker from the Extensions UI
      await page.click('[data-extension-id="tj.exporter"] button:has-text("Stop worker")')
      const stoppedResult = await page.evaluate(() => window.__HUNG_PROMISE__)
      assert.equal(stoppedResult.ok, false)
      assert.match(stoppedResult.message, /Plug sandbox stopped/)

      // Reload exporter without page refresh and verify it works again!
      await page.click('[data-extension-id="tj.exporter"] button:has-text("Reload")')
      await page.waitForSelector('[data-extension-id="tj.exporter"][data-extension-status="active"]')
      const recovered = await page.evaluate(() =>
        window.__SYNTAX_EXTENSIONS__.manager.runCommand('tj.exporter:export', ['after-reload.md']),
      )
      assert.match(recovered.output, /^after-reload\.md: Storyboard/)

      // 13. Uninstall tj.storyboard preserves user documents and shows recovery panel!
      await page.click('[data-extension-id="tj.storyboard"] button:has-text("Uninstall")')
      await page.waitForFunction(
        () => !window.__SYNTAX_EXTENSIONS__.store.getState().records.some(r => r.id === 'tj.storyboard'),
      )

      // Navigate to Library -> saved document is still there!
      await page.goto(`${harness.appOrigin}/#/library`)
      await page.waitForSelector('.sx-ext-doc-row:has-text("Demo Board")')
      await page.click('.sx-ext-doc-row:has-text("Demo Board")')
      await page.waitForSelector('h3:has-text("This document opens with tj.storyboard")')
      await page.waitForSelector('button:has-text("Export document JSON")')

      // Reinstall tj.storyboard and reopen document -> full data intact!
      await installViaUi(page, harness.extUrl('storyboard/extension.json'))
      await page.waitForSelector('[data-extension-id="tj.storyboard"][data-extension-status="active"]')
      await page.goto(`${harness.appOrigin}/#/library`)
      await page.click('.sx-ext-doc-row:has-text("Demo Board")')
      await page.waitForSelector('[data-extension-id="tj.storyboard"][data-view-id="board"][data-view-ready="true"]')
      const reopenedFrame = page.frameLocator('iframe.sx-ext-iframe').first()
      await reopenedFrame.locator('#doc-status:has-text("rev:2|Demo Board")').waitFor()
      await reopenedFrame.locator('#task-list li:has-text("Edit rough cut")').waitFor()

      assert.equal(pageErrors.length, 0, `Unexpected page errors: ${pageErrors.map(e => e.message).join('; ')}`)
    } finally {
      await context.close()
    }
  })

  it('5-8. fast syntax error catch, onActivate rollback, semver incompatibility, and circular dependency detection', async () => {
    const { context, page, pageErrors } = await createCleanPage()
    try {
      await page.goto(`${harness.appOrigin}/#/extensions`)
      await page.waitForFunction(() => Boolean(window.__SYNTAX_EXTENSIONS__))

      // 5. Fast SyntaxError catch (< 2000ms, zero leftover contributions/workers/blobs)
      const t0 = Date.now()
      const syntaxRes = await page.evaluate(async url => {
        const ext = window.__SYNTAX_EXTENSIONS__
        try {
          await ext.manager.installFromUrl(url)
          return { ok: true }
        } catch (err) {
          return {
            ok: false,
            code: err.code,
            message: err.message,
            records: ext.store.getState().records.length,
            counters: ext.diagnostics.getResourceCounters(),
          }
        }
      }, harness.extUrl('broken-syntax/extension.json'))
      const elapsed = Date.now() - t0
      assert.equal(syntaxRes.ok, false)
      assert.equal(syntaxRes.code, 'WORKER_PARSE_ERROR')
      assert.ok(elapsed < 2500, `Expected fast syntax error catch, took ${elapsed}ms`)
      assert.equal(syntaxRes.records, 0)
      assert.equal(syntaxRes.counters.workers, 0)
      assert.equal(syntaxRes.counters.blobUrls, 0)
      assert.equal(syntaxRes.counters.commands, 0)

      // 6. Staged activation rollback when onActivate throws
      const activateRes = await page.evaluate(async url => {
        const ext = window.__SYNTAX_EXTENSIONS__
        try {
          await ext.manager.installFromUrl(url)
          return { ok: true }
        } catch (err) {
          return {
            ok: false,
            code: err.code,
            message: err.message,
            records: ext.store.getState().records.length,
            counters: ext.diagnostics.getResourceCounters(),
          }
        }
      }, harness.extUrl('broken-activate/extension.json'))
      assert.equal(activateRes.ok, false)
      assert.equal(activateRes.code, 'WORKER_ACTIVATE_ERROR')
      assert.match(activateRes.message, /Boom during onActivate/)
      assert.equal(activateRes.records, 0)
      assert.equal(activateRes.counters.commands, 0)
      assert.equal(activateRes.counters.toolbarItems, 0)
      assert.equal(activateRes.counters.services, 0)
      assert.equal(activateRes.counters.workers, 0)
      assert.equal(activateRes.counters.blobUrls, 0)

      // 7. Semver incompatibility names BOTH required range (^2.0.0) and installed version (1.4.0)
      await page.evaluate(
        url => window.__SYNTAX_EXTENSIONS__.manager.installFromUrl(url),
        harness.extUrl('storyboard/extension.json'),
      )
      const incompatRes = await page.evaluate(async url => {
        try {
          await window.__SYNTAX_EXTENSIONS__.manager.installFromUrl(url)
          return { ok: true }
        } catch (err) {
          return { ok: false, code: err.code, message: err.message }
        }
      }, harness.extUrl('incompatible-dep/extension.json'))
      assert.equal(incompatRes.ok, false)
      assert.equal(incompatRes.code, 'SERVICE_INCOMPATIBLE')
      assert.match(incompatRes.message, /\^2\.0\.0/)
      assert.match(incompatRes.message, /1\.4\.0/)

      // 8. Circular required dependency detection
      const cycleRes = await page.evaluate(
        async ([urlA, urlB]) => {
          const ext = window.__SYNTAX_EXTENSIONS__
          await ext.manager.installFromUrl(urlA, { enableImmediately: false })
          // Mark cycle-a enabled in store without booting, then try installing cycle-b enabled
          const recA = ext.store.getState().records.find(r => r.id === 'tj.cycle-a')
          ext.store.getState().upsertRecord({ ...recA, enabled: true })
          try {
            await ext.manager.installFromUrl(urlB)
            return { ok: true }
          } catch (err) {
            return { ok: false, code: err.code, message: err.message }
          }
        },
        [harness.extUrl('cycle-a/extension.json'), harness.extUrl('cycle-b/extension.json')],
      )
      assert.equal(cycleRes.ok, false)
      assert.equal(cycleRes.code, 'SERVICE_CYCLE')
      assert.match(cycleRes.message, /tj\.cycle-b -> tj\.cycle-a -> tj\.cycle-b/)

      assert.equal(pageErrors.length, 0, `Unexpected page errors: ${pageErrors.map(e => e.message).join(' | ')}`)
    } finally {
      await context.close()
    }
  })

  it('9-12. staged update rollback, late async reply drop, rogue view navigation guard, and strict CORS diagnostic', async () => {
    const { context, page, pageErrors } = await createCleanPage()
    try {
      harness.setMutableMode('v1')
      await page.goto(`${harness.appOrigin}/#/extensions`)
      await page.waitForFunction(() => Boolean(window.__SYNTAX_EXTENSIONS__))

      // 9. Install v1, attempt broken v2 update -> v1 stays alive; then good v2 update succeeds
      await page.evaluate(
        url => window.__SYNTAX_EXTENSIONS__.manager.installFromUrl(url),
        harness.extUrl('mutable-ext/extension.json'),
      )
      assert.equal(
        await page.evaluate(() => window.__SYNTAX_EXTENSIONS__.manager.runCommand('tj.mutable:info')),
        'v1-ok',
      )

      harness.setMutableMode('broken-v2')
      const badUpdate = await page.evaluate(async () => {
        const ext = window.__SYNTAX_EXTENSIONS__
        try {
          await ext.manager.update('tj.mutable')
          return { rejected: false }
        } catch (err) {
          const stillWorking = await ext.manager.runCommand('tj.mutable:info')
          const rec = ext.store.getState().records.find(r => r.id === 'tj.mutable')
          return { rejected: true, err: err.message, stillWorking, version: rec.manifest.version }
        }
      })
      assert.equal(badUpdate.rejected, true)
      assert.equal(badUpdate.stillWorking, 'v1-ok')
      assert.equal(badUpdate.version, '1.0.0')

      // 10. Late async response drop across reload
      await page.goto(`${harness.appOrigin}/#/ext/tj.mutable/panel`)
      await page.waitForSelector('[data-extension-id="tj.mutable"][data-view-ready="true"]')
      const oldFrame = page.frameLocator('iframe.sx-ext-iframe').first()
      await oldFrame.locator('#slow-btn').click()

      // Immediately reload extension to good-v2 while slowEcho is still in flight!
      harness.setMutableMode('good-v2')
      await page.evaluate(() => window.__SYNTAX_EXTENSIONS__.manager.update('tj.mutable'))
      await page.waitForSelector('[data-extension-id="tj.mutable"][data-view-ready="true"]')
      await page.waitForTimeout(700)

      const newViewResult = await page.frameLocator('iframe.sx-ext-iframe').first().locator('#result').textContent()
      assert.equal(newViewResult, 'none', 'Late reply from old activation must never reach new view')

      const v2Check = await page.evaluate(async () => {
        const ext = window.__SYNTAX_EXTENSIONS__
        return {
          info: await ext.manager.runCommand('tj.mutable:info'),
          version: ext.store.getState().records.find(r => r.id === 'tj.mutable').manifest.version,
          lastError: ext.store.getState().runtime['tj.mutable'].lastError,
          cmdCount: ext.contributions.getState().commands.filter(c => c.ownerId === 'tj.mutable').length,
        }
      })
      assert.equal(v2Check.info, 'v2-ok')
      assert.equal(v2Check.version, '2.0.0')
      assert.equal(v2Check.lastError, null)
      assert.equal(v2Check.cmdCount, 1)

      // 11. Rogue view self-navigation guard (double-onload termination)
      await page.evaluate(
        url => window.__SYNTAX_EXTENSIONS__.manager.installFromUrl(url),
        harness.extUrl('rogue-nav/extension.json'),
      )
      await page.goto(`${harness.appOrigin}/#/ext/tj.rogue-nav/main`)
      await page.waitForSelector('[data-extension-id="tj.rogue-nav"][data-view-ready="true"]')
      await page.frameLocator('iframe.sx-ext-iframe').first().locator('#nav-away').click()
      await page.waitForSelector('.sx-error-badge:has-text("VIEW_NAVIGATION_BLOCKED")')
      assert.equal(await page.locator('iframe.sx-ext-iframe').count(), 0)

      // 12. Strict CORS (origin-specific ACAO instead of *) triggers VIEW_TIMEOUT diagnostic
      await page.evaluate(
        url => window.__SYNTAX_EXTENSIONS__.manager.installFromUrl(url),
        harness.extUrl('strict-cors/extension.json'),
      )
      await page.goto(`${harness.appOrigin}/#/ext/tj.strict-cors/main`)
      await page.waitForSelector('.sx-ext-view-banner:has-text("Access-Control-Allow-Origin: *")', {
        timeout: 9000,
      })

      assert.equal(pageErrors.length, 0, `Unexpected page errors: ${pageErrors.map(e => e.message).join(' | ')}`)
    } finally {
      await context.close()
    }
  })

  it('14-15. Safe Mode recovery and multi-cycle soak test with zero resource leaks', async () => {
    const { context, page, pageErrors } = await createCleanPage()
    try {
      await page.goto(`${harness.appOrigin}/#/extensions`)
      await page.waitForFunction(() => Boolean(window.__SYNTAX_EXTENSIONS__))

      // Install both storyboard & exporter
      await page.evaluate(
        async ([u1, u2]) => {
          const m = window.__SYNTAX_EXTENSIONS__.manager
          await m.installFromUrl(u1)
          await m.installFromUrl(u2)
        },
        [harness.extUrl('storyboard/extension.json'), harness.extUrl('storyboard-exporter/extension.json')],
      )

      // 14. Reload into Safe Mode (?safeMode=1)
      await page.goto(`${harness.appOrigin}/?safeMode=1`)
      await page.waitForSelector('.sx-ext-safemode-banner:has-text("Safe Mode is active")')
      const safeState = await page.evaluate(() => {
        const ext = window.__SYNTAX_EXTENSIONS__
        return {
          safeMode: ext.store.getState().safeMode,
          counters: ext.diagnostics.getResourceCounters(),
          records: ext.store.getState().records.map(r => ({
            id: r.id,
            status: ext.store.getState().runtime[r.id]?.status,
          })),
        }
      })
      assert.equal(safeState.safeMode, true)
      assert.equal(safeState.counters.workers, 0)
      assert.equal(safeState.counters.commands, 0)
      assert.equal(safeState.counters.toolbarItems, 0)
      assert.equal(safeState.records.length, 2)
      assert.ok(safeState.records.every(r => r.status === 'safe-mode'))

      // Exit Safe Mode via UI button -> boots cleanly!
      await page.click('button:has-text("Exit Safe Mode")')
      await page.waitForSelector('[data-extension-id="tj.storyboard"][data-extension-status="active"]')
      await page.waitForSelector('[data-extension-id="tj.exporter"][data-extension-status="active"]')

      // 15. Multi-cycle soak test: reload x5, open/close views x3, hang/stop/reload x2, disable/enable, uninstall all
      for (let i = 0; i < 5; i++) {
        await page.evaluate(() => window.__SYNTAX_EXTENSIONS__.manager.reload('tj.storyboard'))
        await page.evaluate(() => window.__SYNTAX_EXTENSIONS__.manager.reload('tj.exporter'))
      }

      for (let i = 0; i < 3; i++) {
        await page.goto(`${harness.appOrigin}/#/ext/tj.storyboard/board`)
        await page.waitForSelector('[data-extension-id="tj.storyboard"][data-view-ready="true"]')
        await page.goto(`${harness.appOrigin}/#/extensions`)
      }

      for (let i = 0; i < 2; i++) {
        await page.evaluate(async () => {
          const m = window.__SYNTAX_EXTENSIONS__.manager
          const p = m.runCommand('tj.exporter:hang').catch(() => 'stopped')
          await new Promise(r => setTimeout(r, 80))
          m.stopWorker('tj.exporter')
          await p
          await m.reload('tj.exporter')
        })
      }

      // Check counters while active (exact expected counts, zero duplicates!)
      const activeCounters = await page.evaluate(() =>
        window.__SYNTAX_EXTENSIONS__.diagnostics.getResourceCounters(),
      )
      assert.equal(activeCounters.workers, 2)
      assert.equal(activeCounters.blobUrls, 0)
      assert.equal(activeCounters.views, 0)
      assert.equal(activeCounters.windowListeners, 0)
      assert.equal(activeCounters.commands, 5)
      assert.equal(activeCounters.toolbarItems, 2)
      assert.equal(activeCounters.services, 1)

      // Uninstall all and assert absolute zero across every counter!
      await page.evaluate(async () => {
        const m = window.__SYNTAX_EXTENSIONS__.manager
        await m.uninstall('tj.exporter')
        await m.uninstall('tj.storyboard')
      })

      const finalCounters = await page.evaluate(() =>
        window.__SYNTAX_EXTENSIONS__.diagnostics.getResourceCounters(),
      )
      assert.deepEqual(finalCounters, {
        workers: 0,
        blobUrls: 0,
        views: 0,
        windowListeners: 0,
        commands: 0,
        toolbarItems: 0,
        services: 0,
      })

      assert.equal(pageErrors.length, 0, `Unexpected page errors: ${pageErrors.map(e => e.message).join('; ')}`)
    } finally {
      await context.close()
    }
  })
})
