import { parseReport } from '../../shared/reports.js';
import type { ReportPayload } from '../../shared/reports.js';
export type { ReportType, ReportContext, ReportPayload } from '../../shared/reports.js';

export async function submitReport(payload: ReportPayload, signal?: AbortSignal): Promise<string> {
  const body = parseReport(payload);
  const response = await fetch('/api/reports', {
    method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body), signal,
  });
  const result: unknown = await response.json();
  if (response.status !== 201 || !result || typeof result !== 'object'
    || !('accepted' in result) || result.accepted !== true
    || !('id' in result) || result.id !== body.id) {
    throw new Error('Your report could not be saved. Your draft is still here.');
  }
  return body.id;
}
