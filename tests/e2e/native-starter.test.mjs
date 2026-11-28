import assert from 'node:assert/strict'
import { execFile } from 'node:child_process'
import { createHash } from 'node:crypto'
import { mkdtemp, readFile, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { test } from 'node:test'
import { fileURLToPath } from 'node:url'
import { promisify } from 'node:util'
import { startE2EHarness } from './harness.mjs'

const run = promisify(execFile)
const root = fileURLToPath(new URL('../../', import.meta.url))

function runNpm(args, cwd) {
  const npm = process.env.npm_execpath
  if (npm) return run(process.execPath, [npm, ...args], { cwd })
  if (process.platform === 'win32') {
    // The caller supplies only fixed npm arguments, never paths or user input.
    return run(process.env.ComSpec ?? 'cmd.exe', ['/d', '/s', '/c', `npm ${args.join(' ')}`], { cwd })
  }
  return run('npm', args, { cwd })
}

test('an external checkout builds, checks, hosts, and activates a native fixture', async t => {
  const work = await mkdtemp(join(tmpdir(), 'syntax-authoring-'))
  const destination = join(work, 'fixture')
  const dist = join(destination, 'dist')
  const manifestPath = join(dist, 'manifest.json')
  const entryPath = join(dist, 'main.js')
  t.after(() => rm(work, { recursive: true, force: true }))

  await run(process.execPath, ['scripts/init-native-extension.mjs', destination], { cwd: root })
  assert.deepEqual(await readFile(join(destination, 'syntax-api.d.ts')), await readFile(join(root, 'src/extensions/native/api.ts')))
  await runNpm(['ci', '--no-audit', '--no-fund'], destination)
  await runNpm(['run', 'build'], destination)
  const first = await Promise.all([readFile(manifestPath), readFile(entryPath)])
  await rm(manifestPath)
  await rm(entryPath)
  await runNpm(['run', 'build'], destination)
  assert.deepEqual(await Promise.all([readFile(manifestPath), readFile(entryPath)]), first)

  const { stdout } = await run(process.execPath, ['scripts/check-native-extension.mjs', '--json', manifestPath], { cwd: root })
  assert.equal(JSON.parse(stdout).ok, true)

  const harness = await startE2EHarness({ nativeStarterDirectory: dist })
  t.after(() => harness.close())
  const page = await harness.browser.newPage()
  await page.addInitScript(() => {
    for (const prefix of ['', 'syntax-dev-']) {
      localStorage.setItem(`${prefix}syntax.prefs.v1`, JSON.stringify({ onboarded: true }))
    }
  })
  await page.goto(`${harness.appOrigin}/syntax/#/extensions`)
  await page.getByRole('heading', { name: 'Extensions', exact: true }).waitFor()
  assert.equal(await page.getByRole('region', { name: 'Native extensions' }).count(), 0)

  await page.goto(`${harness.appOrigin}/syntax-dev/#/extensions`)
  const native = page.getByRole('region', { name: 'Native extensions' })
  await native.getByRole('textbox', { name: 'Native manifest URL' }).fill(harness.extUrl('native-starter/manifest.json'))
  await native.getByRole('button', { name: 'Review native package' }).click()
  await native.getByText('This code runs with the same browser access as Syntax.').waitFor()
  assert.equal(await native.getByRole('button', { name: 'Open Native fixture' }).count(), 0)
  await native.getByRole('button', { name: 'Install native package' }).click()
  await native.getByRole('button', { name: 'Open Native fixture' }).click()
  await page.getByText('Extension built outside Syntax', { exact: true }).waitFor()
  await page.keyboard.press('Control+k')
  await page.getByRole('option', { name: /Save sample/ }).click()
  await page.waitForFunction(async () => {
    const { createNativeRepository } = await import('/src/extensions/native/repository.ts')
    return (await createNativeRepository().load('example.native-fixture'))?.tested
  })
  await page.reload()
  await page.getByText('Extension built outside Syntax', { exact: true }).waitFor()
  await page.getByRole('button', { name: 'Back to Extensions' }).click()
  await native.getByRole('button', { name: 'Disable', exact: true }).click()
  await native.getByRole('button', { name: 'Enable', exact: true }).waitFor()
  assert.equal(await native.getByRole('button', { name: 'Open Native fixture' }).count(), 0)
  await native.getByRole('button', { name: 'Enable', exact: true }).click()
  await native.getByRole('button', { name: 'Open Native fixture' }).waitFor()

  const failingSource = harness.extUrl('native-failure/manifest.json')
  const failingEntry = `
    exports.activate = ctx => {
      ctx.registerScreen({ id: 'home', title: 'Failing screen', component() { throw Error('Screen failed'); } });
      ctx.registerCommand({ id: 'fail', title: 'Failing command', run() { throw Error('Command failed'); } });
    };
  `
  await page.route('**/native-failure/*', route => route.fulfill({
    headers: { 'access-control-allow-origin': '*' },
    body: route.request().url() === failingSource ? JSON.stringify({
      manifestVersion: 2,
      id: 'example.failing-fixture',
      name: 'Failing fixture',
      version: '1.0.0',
      syntaxApi: '^2.0.0',
      main: 'main.js',
      sha256: createHash('sha256').update(failingEntry).digest('hex'),
    }) : failingEntry,
  }))
  await native.getByRole('textbox', { name: 'Native manifest URL' }).fill(failingSource)
  await native.getByRole('button', { name: 'Review native package' }).click()
  await native.getByRole('button', { name: 'Install native package' }).click()
  await native.getByRole('button', { name: 'Open Failing screen' }).click()
  await page.getByText('This extension screen is unavailable.').waitFor()
  await page.getByRole('button', { name: 'Back to Extensions' }).click()
  await native.getByText('Screen failed', { exact: true }).waitFor()
  await native.getByRole('button', { name: 'Open Native fixture' }).waitFor()

  await native.getByRole('button', { name: 'Enable', exact: true }).click()
  await native.getByRole('button', { name: 'Open Failing screen' }).waitFor()
  await page.keyboard.press('Control+k')
  await page.getByRole('option', { name: /Failing command/ }).click()
  await native.getByText('Command failed', { exact: true }).waitFor()
  assert.equal(await native.getByRole('button', { name: 'Open Failing screen' }).count(), 0)
  await native.getByRole('button', { name: 'Open Native fixture' }).waitFor()
  await page.reload()
  await native.getByText('Command failed', { exact: true }).waitFor()
  await page.keyboard.press('Control+k')
  await page.getByRole('option', { name: /Save sample/ }).waitFor()
  assert.equal(await page.getByRole('option', { name: /Failing command/ }).count(), 0)
})
