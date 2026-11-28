import assert from 'node:assert/strict'
import { execFile } from 'node:child_process'
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
  await page.goto(`${harness.appOrigin}/syntax-dev/`)
  const result = await page.evaluate(async source => {
    const { NativeHost } = await import('/src/extensions/native/host.ts')
    const { createNativeRepository } = await import('/src/extensions/native/repository.ts')
    const repository = createNativeRepository()
    const host = new NativeHost(repository, sessionStorage, () => {})
    const installed = await host.install(source)
    const id = installed.package.manifest.id
    const screen = host.runtime.getScreen(id, 'home')
    await host.runtime.runCommand(id, 'save-sample')
    return { title: screen.title, text: screen.component().props.children, data: await repository.load(id) }
  }, harness.extUrl('native-starter/manifest.json'))
  assert.deepEqual(result, {
    title: 'Native fixture',
    text: 'Extension built outside Syntax',
    data: { tested: true },
  })
})
