import { parseReport } from '../shared/reports.js'
import { saveReport } from './reports.mjs'

export async function handleReportRequest(request, send) {
  if (request.method !== 'POST') return send(405, { error: 'Method not allowed' })
  let report
  try {
    const chunks = []; let size = 0
    for await (const chunk of request) {
      size += chunk.length
      if (size > 141 * 1024 * 1024) return send(413, { error: 'Report attachments are too large.' })
      chunks.push(chunk)
    }
    report = parseReport(JSON.parse(Buffer.concat(chunks).toString('utf8')))
  } catch { return send(400, { error: 'Invalid report.' }) }
  try { return send(201, await saveReport(report)) }
  catch (error) {
    if (error.code === 'REPORT_CONFLICT') return send(409, { error: 'This submission changed. Please try again.' })
    return send(503, { error: 'Your report could not be saved. Please try again.' })
  }
}
