import { parseReport } from '../../shared/reports.js'
import type { ReportPayload } from '../../shared/reports.js'
import { isBackendApiEnabled, isJsonResponse, markBackendApiUnavailable } from './apiMode'
export type { ReportType, ReportContext, ReportPayload } from '../../shared/reports.js'

const LOCAL_REPORTS_KEY = 'syntax.reports.v1'

function saveLocalReport(report: ReportPayload): void {
  try {
    const raw = localStorage.getItem(LOCAL_REPORTS_KEY)
    const parsed = raw ? (JSON.parse(raw) as unknown) : []
    const list = Array.isArray(parsed) ? parsed : []
    list.push({ ...report, savedAt: new Date().toISOString() })
    localStorage.setItem(LOCAL_REPORTS_KEY, JSON.stringify(list.slice(-50)))
  } catch {
    // ignore storage errors
  }
}

export async function submitReport(payload: ReportPayload, signal?: AbortSignal): Promise<string> {
  const body = parseReport(payload)
  if (signal?.aborted) {
    throw new DOMException('Aborted', 'AbortError')
  }
  if (!isBackendApiEnabled()) {
    saveLocalReport(body)
    return body.id
  }
  const response = await fetch('/api/reports', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
    signal,
  })
  if (response.status === 404 || !isJsonResponse(response)) {
    markBackendApiUnavailable()
    saveLocalReport(body)
    return body.id
  }
  const result: unknown = await response.json()
  if (
    response.status !== 201 ||
    !result ||
    typeof result !== 'object' ||
    !('accepted' in result) ||
    result.accepted !== true ||
    !('id' in result) ||
    result.id !== body.id
  ) {
    throw new Error('Your report could not be saved. Your draft is still here.')
  }
  return body.id
}
