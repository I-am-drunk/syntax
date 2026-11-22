import { useEffect } from 'react'
import type { Preferences } from '../services/preferences'

export function useAppearance(preferences: Preferences | null) {
  useEffect(() => {
    const color = matchMedia('(prefers-color-scheme: dark)')
    const motion = matchMedia('(prefers-reduced-motion: reduce)')
    const update = () => {
      const mode = preferences?.colorMode ?? 'system'
      const dark = mode === 'dark' || (mode === 'system' && color.matches)
      document.documentElement.dataset.theme = dark ? 'dark' : 'light'
      document.documentElement.style.colorScheme = dark ? 'dark' : 'light'
      document.documentElement.dataset.reducedMotion = String(
        preferences?.motion === 'on' || (preferences?.motion !== 'off' && motion.matches))
    }
    update(); color.addEventListener('change', update); motion.addEventListener('change', update)
    return () => { color.removeEventListener('change', update); motion.removeEventListener('change', update) }
  }, [preferences?.colorMode, preferences?.motion])
}
