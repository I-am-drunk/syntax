import { createHash } from 'node:crypto'
import { readFile, realpath, stat } from 'node:fs/promises'
import { dirname, isAbsolute, relative, resolve } from 'node:path'
import { compileFunction } from 'node:vm'
import {
  assertNativeEntrySize,
  NativePackageError,
  parseNativeManifest,
} from '../src/extensions/native/manifest.ts'

const args = process.argv.slice(2)
const json = args[0] === '--json'
const manifestFile = args[json ? 1 : 0]

try {
  if (!manifestFile || args.length !== (json ? 2 : 1)) {
    throw new NativePackageError('USAGE', 'Usage: npm run extension:check -- [--json] path/to/manifest.json')
  }

  const manifestPath = await realpath(resolve(manifestFile)).catch(() => {
    throw new NativePackageError('MANIFEST_MISSING', `Could not find ${manifestFile}.`)
  })
  let input
  try {
    input = JSON.parse(await readFile(manifestPath, 'utf8'))
  } catch (error) {
    throw new NativePackageError('MANIFEST_INVALID', `Could not read manifest JSON: ${error.message}`)
  }
  const manifest = parseNativeManifest(input)
  const packageDir = dirname(manifestPath)
  const entryPath = await realpath(resolve(packageDir, manifest.main)).catch(() => {
    throw new NativePackageError('ENTRY_MISSING', `Build ${manifest.main} before checking the package.`)
  })
  const entryRelative = relative(packageDir, entryPath)
  if (entryRelative === '..' || entryRelative.startsWith('../') || entryRelative.startsWith('..\\') || isAbsolute(entryRelative)) {
    throw new NativePackageError('ENTRY_OUTSIDE_PACKAGE', 'The JavaScript entry must stay inside the package directory.')
  }
  const entryStat = await stat(entryPath)
  if (!entryStat.isFile()) {
    throw new NativePackageError('ENTRY_INVALID', 'The JavaScript entry must be a file.')
  }
  assertNativeEntrySize(entryStat.size)
  const entry = await readFile(entryPath)
  assertNativeEntrySize(entry.byteLength)
  if (createHash('sha256').update(entry).digest('hex') !== manifest.sha256) {
    throw new NativePackageError('ENTRY_HASH_MISMATCH', 'Update sha256 to match the final built entry.')
  }
  try {
    compileFunction(new TextDecoder('utf-8', { fatal: true }).decode(entry), ['require', 'module', 'exports'], { filename: manifest.main })
  } catch (error) {
    throw new NativePackageError('ENTRY_SYNTAX', `Build the entry as CommonJS: ${error.message}`)
  }
  console.log(json ? JSON.stringify({ ok: true, manifest }) : `Checked ${manifest.id} ${manifest.version}.`)
} catch (error) {
  const report = {
    ok: false,
    code: error instanceof NativePackageError ? error.code : 'IO_ERROR',
    message: error.message,
  }
  if (json) console.log(JSON.stringify(report))
  else console.error(`${report.code}: ${report.message}`)
  process.exitCode = 1
}
