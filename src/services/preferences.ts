import { defaultPreferences, parsePreferencePatch } from '../../shared/preferences.js'
import type { Preferences } from '../../shared/preferences.js'
export type { Preferences } from '../../shared/preferences.js'

async function request(signal: AbortSignal, patch?: Partial<Preferences>): Promise<Preferences> {
  const response = await fetch('/api/preferences', {
    signal,
    method: patch ? 'PATCH' : 'GET',
    headers: patch ? { 'Content-Type': 'application/json' } : undefined,
    body: patch ? JSON.stringify(parsePreferencePatch(patch)) : undefined,
  })
  if (!response.ok) throw new Error('Could not save preferences. Please try again.')
  const result = parsePreferencePatch(await response.json())
  if (Object.keys(result).length !== Object.keys(defaultPreferences).length)
    throw new Error('The preferences response was incomplete.')
  return result as Preferences
}

export const loadPreferences = (signal: AbortSignal) => request(signal)
export const savePreferences = (patch: Partial<Preferences>, signal: AbortSignal) => request(signal, patch)
