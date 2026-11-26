import { parseProgressReceipt } from '../../shared/progress.js'
import type { ProgressReceipt } from '../../shared/progress.js'
import { isBackendApiEnabled, isJsonResponse, markBackendApiUnavailable } from './apiMode'
import { readLocalProgressStore } from './progress'

export type SavedActivity = { records: ProgressReceipt[] }
export const activityError = 'Saved activity could not be loaded.'

export function parseSavedActivity(value: unknown): SavedActivity {
  if (
    !value ||
    typeof value !== 'object' ||
    Array.isArray(value) ||
    Object.keys(value).length !== 1 ||
    !('records' in value) ||
    !Array.isArray(value.records)
  ) {
    throw new Error(activityError)
  }
  const records = value.records.map(parseProgressReceipt)
  if (new Set(records.map((record) => record.progress.id)).size !== records.length) {
    throw new Error(activityError)
  }
  return { records }
}

function readLocalActivity(): SavedActivity {
  const store = readLocalProgressStore()
  const now = new Date().toISOString()
  const records: ProgressReceipt[] = []
  for (const progress of Object.values(store)) {
    if (!progress || typeof progress.id !== 'string') continue
    records.push({ accepted: true, progress, savedAt: now })
  }
  return { records }
}

export async function readSavedActivity(signal: AbortSignal): Promise<SavedActivity> {
  if (signal.aborted) {
    throw new DOMException('Aborted', 'AbortError')
  }
  if (!isBackendApiEnabled()) {
    return readLocalActivity()
  }
  try {
    const response = await fetch('/api/progress?activity=1', { cache: 'no-store', signal })
    if (response.status === 200 && isJsonResponse(response)) {
      return parseSavedActivity(await response.json())
    }
    if (response.status === 404 || !isJsonResponse(response)) {
      markBackendApiUnavailable()
    }
  } catch (err) {
    if (signal.aborted || (err instanceof DOMException && err.name === 'AbortError')) {
      throw err
    }
  }
  return readLocalActivity()
}
