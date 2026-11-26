import { defaultPreferences, parsePreferencePatch } from '../../shared/preferences.js'
import type { Preferences } from '../../shared/preferences.js'
import { isBackendApiEnabled, isJsonResponse, markBackendApiUnavailable } from './apiMode'
export type { Preferences } from '../../shared/preferences.js'

const LOCAL_PREFERENCES_KEY = 'syntax.preferences.v1'

function readLocalPreferences(): Preferences {
  try {
    const raw = localStorage.getItem(LOCAL_PREFERENCES_KEY)
    if (!raw) return { ...defaultPreferences }
    const parsed = parsePreferencePatch(JSON.parse(raw))
    return { ...defaultPreferences, ...parsed }
  } catch {
    return { ...defaultPreferences }
  }
}

function writeLocalPreferences(patch: Partial<Preferences>): Preferences {
  const next = { ...readLocalPreferences(), ...parsePreferencePatch(patch) }
  try {
    localStorage.setItem(LOCAL_PREFERENCES_KEY, JSON.stringify(next))
  } catch {
    // ignore storage errors
  }
  return next
}

async function request(signal: AbortSignal, patch?: Partial<Preferences>): Promise<Preferences> {
  if (signal.aborted) {
    throw new DOMException('Aborted', 'AbortError')
  }
  const validatedPatch = patch ? parsePreferencePatch(patch) : undefined
  if (!isBackendApiEnabled()) {
    return validatedPatch ? writeLocalPreferences(validatedPatch) : readLocalPreferences()
  }
  try {
    const response = await fetch('/api/preferences', {
      signal,
      method: validatedPatch ? 'PATCH' : 'GET',
      headers: validatedPatch ? { 'Content-Type': 'application/json' } : undefined,
      body: validatedPatch ? JSON.stringify(validatedPatch) : undefined,
    })
    if (response.ok && isJsonResponse(response)) {
      const result = parsePreferencePatch(await response.json())
      if (Object.keys(result).length === Object.keys(defaultPreferences).length) {
        const merged = result as Preferences
        writeLocalPreferences(merged)
        return merged
      }
    } else if (response.status === 404 || !isJsonResponse(response)) {
      markBackendApiUnavailable()
    }
  } catch (err) {
    if (signal.aborted || (err instanceof DOMException && err.name === 'AbortError')) {
      throw err
    }
  }
  return validatedPatch ? writeLocalPreferences(validatedPatch) : readLocalPreferences()
}

export const loadPreferences = (signal: AbortSignal) => request(signal)
export const savePreferences = (patch: Partial<Preferences>, signal: AbortSignal) =>
  request(signal, patch)
