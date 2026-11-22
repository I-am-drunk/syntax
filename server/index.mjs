import { createServer } from 'node:http'
import { readPreferences, updatePreferences } from './preferences.mjs'
import { parsePreferencePatch } from '../shared/preferences.js'
import { handleReportRequest } from './reportRequest.mjs'
import { handleTopicsRequest } from './topics.mjs'
import { handleProgressRequest } from './progressRequest.mjs'

const server = createServer(async (request, response) => {
  const send = (status, value) => {
    response.writeHead(status, { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' })
    response.end(JSON.stringify(value))
  }
  if (request.url === '/api/topics') return handleTopicsRequest(request, send)
  if (request.url === '/api/reports') return handleReportRequest(request, send)
  if (request.url === '/api/progress' || request.url.startsWith('/api/progress?'))
    return handleProgressRequest(request, send)
  if (request.url !== '/api/preferences') return send(404, { error: 'Not found' })
  try {
    if (request.method === 'GET') return send(200, await readPreferences())
    if (request.method !== 'PATCH') return send(405, { error: 'Method not allowed' })
    let body = ''
    for await (const chunk of request) {
      body += chunk
      if (Buffer.byteLength(body) > 8192) return send(413, { error: 'Request too large' })
    }
    let patch
    try { patch = parsePreferencePatch(JSON.parse(body)) }
    catch { return send(400, { error: 'Invalid preference values' }) }
    return send(200, await updatePreferences(patch))
  } catch {
    return send(503, { error: 'Preferences could not be saved. Please try again.' })
  }
})

server.listen(Number(process.env.SYNTAX_API_PORT ?? 5180), '127.0.0.1')
for (const signal of ['SIGINT', 'SIGTERM']) process.on(signal, () => server.close())
