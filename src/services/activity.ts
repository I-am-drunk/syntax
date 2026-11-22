import { parseProgressReceipt } from '../../shared/progress.js'
import type { ProgressReceipt } from '../../shared/progress.js'

export type SavedActivity = { records: ProgressReceipt[] }
export const activityError = 'Saved activity could not be loaded.'

export function parseSavedActivity(value: unknown): SavedActivity {
  if (!value || typeof value !== 'object' || Array.isArray(value)
    || Object.keys(value).length !== 1 || !('records' in value)
    || !Array.isArray(value.records)) throw new Error(activityError)
  const records = value.records.map(parseProgressReceipt)
  if (new Set(records.map(record => record.progress.id)).size !== records.length)
    throw new Error(activityError)
  return { records }
}

export async function readSavedActivity(signal: AbortSignal): Promise<SavedActivity> {
  const response = await fetch('/api/progress?activity=1', { cache: 'no-store', signal })
  if (response.status !== 200) throw new Error(activityError)
  return parseSavedActivity(await response.json())
}
