import { lstat, readdir, readFile } from 'node:fs/promises'
import { join } from 'node:path'

const [directory, marker, expectedCommit] = process.argv.slice(2)
const markerNames = ['preview-commit.txt', 'release-commit.txt']

async function checkFiles(directory) {
  for (const entry of await readdir(directory, { withFileTypes: true })) {
    if (entry.isDirectory()) {
      await checkFiles(join(directory, entry.name))
    } else if (!entry.isFile()) {
      throw new Error('The site artifact must contain only regular files and directories.')
    }
  }
}

try {
  if (!directory || !markerNames.includes(marker) || !/^[a-f0-9]{40}$/.test(expectedCommit ?? '')) {
    throw new Error('Supply a bundle directory, a supported commit marker, and a full commit SHA.')
  }
  if (!(await lstat(directory)).isDirectory()) {
    throw new Error('The site artifact must be a directory.')
  }
  await checkFiles(directory)
  if (!(await lstat(join(directory, 'index.html'))).isFile()) {
    throw new Error('The site artifact must contain index.html.')
  }
  if ((await readdir(directory)).includes('_worker.js')) {
    throw new Error('The static site artifact must not contain a Cloudflare Worker.')
  }
  const commit = await readFile(join(directory, marker), 'utf8')
  if (commit.trimEnd() !== expectedCommit) {
    throw new Error('The site artifact was built from a different commit.')
  }
} catch (error) {
  console.error(error.message)
  process.exitCode = 1
}
