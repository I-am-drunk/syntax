import { useEffect, useState } from 'react'
import { channelStateKey } from '../../core/channelState.ts'
import { playUiSound } from '../../services/uiSounds'
import type { NativeSoundCue } from './api.ts'

export type SyntaxTheme = 'light' | 'dark'

const SOUND_KEY = channelStateKey('syntax.sound.v1')

function readTheme(): SyntaxTheme {
  if (typeof document === 'undefined') return 'light'
  return document.documentElement.dataset.theme === 'dark' ? 'dark' : 'light'
}

export function useSyntaxTheme(): SyntaxTheme {
  const [theme, setTheme] = useState<SyntaxTheme>(readTheme)

  useEffect(() => {
    if (typeof document === 'undefined') return
    const sync = () => setTheme(readTheme())
    sync()
    const observer = new MutationObserver(sync)
    observer.observe(document.documentElement, {
      attributes: true,
      attributeFilter: ['data-theme'],
    })
    return () => observer.disconnect()
  }, [])

  return theme
}

export function playSyntaxSound(cue: NativeSoundCue): void {
  try {
    const saved = localStorage.getItem(SOUND_KEY)
    if (saved === 'false') return
  } catch {
    // Ignore storage access errors in restricted contexts.
  }
  if (cue === 'correct' || cue === 'complete') {
    playUiSound('toggle-on')
  } else {
    playUiSound('lightweight-choice')
  }
}

export const syntaxApiHostModule = {
  useSyntaxTheme,
  playSyntaxSound,
}
