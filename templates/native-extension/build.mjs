import { createHash } from 'node:crypto'
import { mkdir, readFile, writeFile } from 'node:fs/promises'
import { fileURLToPath } from 'node:url'
import { build } from 'esbuild'

const packageRoot = new URL('./', import.meta.url)
const pkg = JSON.parse(await readFile(new URL('package.json', packageRoot), 'utf8'))
const manifestFile = new URL('dist/manifest.json', packageRoot)
const { outputFiles: [entry] } = await build({
  absWorkingDir: fileURLToPath(packageRoot),
  entryPoints: ['index.tsx'],
  bundle: true,
  format: 'cjs',
  jsx: 'automatic',
  platform: 'browser',
  target: 'es2022',
  external: ['react', 'react/jsx-runtime'],
  write: false,
})

await mkdir(new URL('dist/', packageRoot), { recursive: true })
await writeFile(new URL('main.js', manifestFile), entry.contents)
await writeFile(manifestFile, JSON.stringify({
  manifestVersion: 2,
  id: pkg.syntaxExtension.id,
  name: pkg.syntaxExtension.name,
  version: pkg.version,
  syntaxApi: pkg.syntaxExtension.syntaxApi,
  main: 'main.js',
  sha256: createHash('sha256').update(entry.contents).digest('hex'),
}, null, 2) + '\n')
