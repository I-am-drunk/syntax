import { mkdir, readFile, rename, writeFile } from 'node:fs/promises'
import { dirname } from 'node:path'
import { fileURLToPath } from 'node:url'
import { defaultPreferences, parsePreferencePatch } from '../shared/preferences.js'

const file = process.env.SYNTAX_DATA_FILE
  ?? fileURLToPath(new URL('../.data/preferences.json', import.meta.url))
let writes = Promise.resolve()

export async function readPreferences() {
  try {
    return {...defaultPreferences, ...parsePreferencePatch(JSON.parse(await readFile(file, 'utf8')))}
  } catch (error) {
    if (error.code === 'ENOENT') return {...defaultPreferences}
    throw error
  }
}

export function updatePreferences(patch) {
  const valid = parsePreferencePatch(patch)
  const operation = writes.then(async () => {
    const next = {...await readPreferences(), ...valid}
    await mkdir(dirname(file), { recursive: true })
    await writeFile(`${file}.pending`, JSON.stringify(next) + '\n', { mode: 0o600 })
    await rename(`${file}.pending`, file)
    return next
  })
  writes = operation.then(() => {}, () => {})
  return operation
}
