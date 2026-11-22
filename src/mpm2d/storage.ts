import type { SemaExpressionName, SemaShapeName } from './mascot/bloub'

const PREFS_KEY = 'syntax.mpm2d.prefs.v1'
const COOKIE_NAME = 'syntax_mpm2d_prefs'

export type SyntaxPrefs = {
  drawMode: boolean
  showCatchupPaths: boolean
  onboarded: boolean
  voiceOn: boolean
  penControlsCollapsed: boolean
  semaShape: SemaShapeName
  semaExpression: SemaExpressionName
}

const DEFAULT_PREFS: SyntaxPrefs = {
  drawMode: false,
  showCatchupPaths: false,
  onboarded: false,
  voiceOn: true,
  penControlsCollapsed: true,
  semaShape: 'circle',
  semaExpression: 'neutral',
}

function readCookie(name: string): string | null {
  if (typeof document === 'undefined') return null
  const prefix = `${name}=`
  const parts = document.cookie.split(';')
  for (const part of parts) {
    const trimmed = part.trim()
    if (trimmed.startsWith(prefix)) {
      try {
        return decodeURIComponent(trimmed.slice(prefix.length))
      } catch {
        return null
      }
    }
  }
  return null
}

function writeCookie(name: string, value: string) {
  if (typeof document === 'undefined') return
  try {
    const maxAge = 60 * 60 * 24 * 365
    document.cookie = `${name}=${encodeURIComponent(value)}; max-age=${maxAge}; path=/; SameSite=Lax`
  } catch {
    // ignore cookie errors in restricted contexts
  }
}

export function loadPrefs(): SyntaxPrefs {
  try {
    const raw = localStorage.getItem(PREFS_KEY) ?? readCookie(COOKIE_NAME)
    if (!raw) return { ...DEFAULT_PREFS }
    const parsed = JSON.parse(raw) as Partial<SyntaxPrefs>
    return {
      drawMode: Boolean(parsed.drawMode ?? DEFAULT_PREFS.drawMode),
      showCatchupPaths: Boolean(parsed.showCatchupPaths ?? DEFAULT_PREFS.showCatchupPaths),
      onboarded: Boolean(parsed.onboarded ?? DEFAULT_PREFS.onboarded),
      voiceOn: parsed.voiceOn === undefined ? DEFAULT_PREFS.voiceOn : Boolean(parsed.voiceOn),
      penControlsCollapsed:
        parsed.penControlsCollapsed === undefined
          ? DEFAULT_PREFS.penControlsCollapsed
          : Boolean(parsed.penControlsCollapsed),
      semaShape: parsed.semaShape ?? DEFAULT_PREFS.semaShape,
      semaExpression: parsed.semaExpression ?? DEFAULT_PREFS.semaExpression,
    }
  } catch {
    return { ...DEFAULT_PREFS }
  }
}

export function savePrefs(next: SyntaxPrefs) {
  const serialized = JSON.stringify(next)
  try {
    localStorage.setItem(PREFS_KEY, serialized)
  } catch {
    // ignore storage quota errors
  }
  writeCookie(COOKIE_NAME, serialized)
}

export function updatePrefs(patch: Partial<SyntaxPrefs>): SyntaxPrefs {
  const merged = { ...loadPrefs(), ...patch }
  savePrefs(merged)
  return merged
}
