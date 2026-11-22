import { useEffect, useRef, useState } from 'react'
import { loadPreferences, savePreferences, type Preferences } from '../services/preferences'

type Key = keyof Preferences
const savedMessages: Partial<Record<Key, string>> = {
  soundEffects: 'Sound effects setting updated', motion: 'Reduce motion setting updated',
  voice: 'Koji voice setting updated', narration: 'Koji narration setting updated',
}
function readColorMode(): Preferences['colorMode'] {
  try {
    const value = localStorage.getItem('syntax-color-mode')
    return value === 'dark' || value === 'light' ? value : 'system'
  } catch { return 'system' }
}
function delay(ms: number, signal: AbortSignal) {
  return new Promise<void>((resolve, reject) => {
    const abort = () => { clearTimeout(timer); reject(new DOMException('Aborted', 'AbortError')) }
    const timer = setTimeout(() => { signal.removeEventListener('abort', abort); resolve() }, ms)
    signal.addEventListener('abort', abort, { once: true })
    if (signal.aborted) abort()
  })
}

export function usePreferences() {
  const [preferences, setPreferences] = useState<Preferences | null>(null)
  const [pending, setPending] = useState<Partial<Record<Key, boolean>>>({})
  const [spinners, setSpinners] = useState<Partial<Record<Key, boolean>>>({})
  const [error, setError] = useState('')
  const [message, setMessage] = useState('')
  const [attempt, setAttempt] = useState(0)
  const controllers = useRef(new Map<Key, AbortController>())
  useEffect(() => {
    const controller = new AbortController()
    loadPreferences(controller.signal).then(saved => {
      if (!controller.signal.aborted) setPreferences({ ...saved, colorMode: readColorMode() })
    }).catch(() => {
      if (!controller.signal.aborted) setError('Could not load preferences. Please try again.')
    })
    return () => { controller.abort(); controllers.current.forEach(c => c.abort()) }
  }, [attempt])
  useEffect(() => {
    if (!message) return
    const timer = setTimeout(() => setMessage(''), 2000)
    return () => clearTimeout(timer)
  }, [message])

  async function change<K extends Key>(key: K, value: Preferences[K]) {
    if (!preferences || controllers.current.has(key)) return
    if (key === 'colorMode') {
      try {
        localStorage.setItem('syntax-color-mode', String(value))
        setPreferences(p => p && ({ ...p, colorMode: value as Preferences['colorMode'] }))
      } catch { setError('Could not save the color preference.') }
      return
    }
    const previous = preferences[key], controller = new AbortController()
    const optimistic = Object.hasOwn(savedMessages, key)
    controllers.current.set(key, controller)
    setError(''); setPending(p => ({ ...p, [key]: true }))
    if (optimistic) setPreferences(p => p && ({ ...p, [key]: value }))
    let spinnerStarted = 0
    const timer = optimistic ? setTimeout(() => {
      spinnerStarted = performance.now()
      setSpinners(p => ({ ...p, [key]: true }))
    }, 60) : undefined
    const finishSpinner = () => delay(Math.max(0, spinnerStarted + 600 - performance.now()), controller.signal)
    try {
      const saved = await savePreferences({ [key]: value }, controller.signal)
      clearTimeout(timer)
      if (spinnerStarted) await finishSpinner()
      if (!controller.signal.aborted) {
        setPreferences(p => p && ({ ...p, [key]: saved[key] }))
        if (key !== 'colorMode') setMessage(savedMessages[key] ?? 'Notification preference updated')
      }
    } catch {
      clearTimeout(timer)
      if (spinnerStarted && !controller.signal.aborted) await finishSpinner().catch(() => {})
      if (!controller.signal.aborted) {
        setPreferences(p => p && ({ ...p, [key]: previous }))
        setError('Could not save preferences. Please try again.')
      }
    } finally {
      clearTimeout(timer)
      controllers.current.delete(key)
      if (!controller.signal.aborted) {
        setPending(p => ({ ...p, [key]: false }))
        setSpinners(p => ({ ...p, [key]: false }))
      }
    }
  }
  return { preferences, pending, spinners, error, message, change,
    retry: () => { setError(''); setAttempt(x => x + 1) } }
}
