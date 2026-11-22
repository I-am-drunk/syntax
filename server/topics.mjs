import { mkdir, readFile, rename, writeFile } from 'node:fs/promises'
import { dirname } from 'node:path'
import { fileURLToPath } from 'node:url'
import { initialPinnedTopics, parsePinnedTopics, parseTopicChange } from '../shared/topics.js'
const file = process.env.SYNTAX_TOPICS_FILE
  ?? fileURLToPath(new URL('../.data/topics.json', import.meta.url))
let writes = Promise.resolve()
export async function readTopics() {
  try { return { pinned: parsePinnedTopics(JSON.parse(await readFile(file, 'utf8')).pinned) } }
  catch (error) { if (error.code === 'ENOENT') return { pinned: [...initialPinnedTopics] }; throw error }
}
export function changeTopic(input) {
  const { slug, pinned } = parseTopicChange(input)
  const operation = writes.then(async () => {
    const current = (await readTopics()).pinned.filter(id => id !== slug)
    const next = { pinned: parsePinnedTopics(pinned ? [...current, slug] : current) }
    await mkdir(dirname(file), { recursive: true })
    await writeFile(`${file}.pending`, JSON.stringify(next) + '\n', { mode: 0o600 })
    await rename(`${file}.pending`, file)
    return { slug, pinned }
  })
  writes = operation.then(() => {}, () => {})
  return operation
}
export async function handleTopicsRequest(request, send) {
  try {
    if (request.method === 'GET') return send(200, await readTopics())
    if (request.method !== 'PATCH') return send(405, { error: 'Method not allowed' })
    let body = ''
    for await (const chunk of request) {
      body += chunk
      if (Buffer.byteLength(body) > 1024) return send(413, { error: 'Request too large' })
    }
    let change
    try { change = parseTopicChange(JSON.parse(body)) }
    catch { return send(400, { error: 'Invalid topic change' }) }
    return send(200, await changeTopic(change))
  } catch { return send(503, { error: 'Topics could not be saved.' }) }
}
