import { copyFile, mkdir } from 'node:fs/promises'
import { join, resolve } from 'node:path'

const [path] = process.argv.slice(2)
if (!path || process.argv.length !== 3) {
  console.error('Usage: npm run extension:init -- path/to/new-folder')
  process.exitCode = 1
} else {
  try {
    const destination = resolve(path)
    await mkdir(destination)
    const template = new URL('../templates/native-extension/', import.meta.url)
    const files = ['.gitignore', 'package.json', 'package-lock.json', 'tsconfig.json', 'index.tsx', 'build.mjs']
    for (const file of files) {
      await copyFile(new URL(file, template), join(destination, file))
    }
    await copyFile(new URL('../src/extensions/native/api.ts', import.meta.url), join(destination, 'syntax-api.d.ts'))
    await copyFile(new URL('../src/extensions/native/sdk-types.d.ts', import.meta.url), join(destination, 'syntax-sdk.d.ts'))
    console.log(`Created the native extension starter in ${destination}.`)
  } catch (error) {
    console.error(error.code === 'EEXIST'
      ? 'Choose a folder that does not exist yet.'
      : `Could not create the starter: ${error.message}`)
    process.exitCode = 1
  }
}
