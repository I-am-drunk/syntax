import { copyFile, mkdir } from 'node:fs/promises'
import { join, resolve } from 'node:path'

const args = process.argv.slice(2)
let templateKind = 'tool'
const positional = []

for (const arg of args) {
  if (arg === '--course' || arg === '--template=course') {
    templateKind = 'course'
  } else if (arg === '--tool' || arg === '--template=tool') {
    templateKind = 'tool'
  } else if (arg.startsWith('-')) {
    console.error(`Unknown option: ${arg}`)
    console.error('Usage: npm run extension:init -- path/to/new-folder [--course|--tool]')
    process.exit(1)
  } else {
    positional.push(arg)
  }
}

const [path] = positional
if (!path || positional.length !== 1) {
  console.error('Usage: npm run extension:init -- path/to/new-folder [--course|--tool]')
  process.exitCode = 1
} else {
  try {
    const destination = resolve(path)
    await mkdir(destination)
    const templateDir = templateKind === 'course'
      ? '../templates/native-course/'
      : '../templates/native-extension/'
    const template = new URL(templateDir, import.meta.url)
    const files = ['.gitignore', 'package.json', 'package-lock.json', 'tsconfig.json', 'index.tsx', 'build.mjs']
    for (const file of files) {
      await copyFile(new URL(file, template), join(destination, file))
    }
    await copyFile(new URL('../src/extensions/native/api.ts', import.meta.url), join(destination, 'syntax-api.d.ts'))
    await copyFile(new URL('../src/extensions/native/sdk-types.d.ts', import.meta.url), join(destination, 'syntax-sdk.d.ts'))
    const label = templateKind === 'course' ? 'native course starter' : 'native extension starter'
    console.log(`Created the ${label} in ${destination}.`)
  } catch (error) {
    console.error(error.code === 'EEXIST'
      ? 'Choose a folder that does not exist yet.'
      : `Could not create the starter: ${error.message}`)
    process.exitCode = 1
  }
}
