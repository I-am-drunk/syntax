import { useEffect, useRef, useState } from 'react'
import { voiceSources } from './voiceSources'
import type { Preferences } from '../services/preferences'

export function useVoiceSample() {
  const audio = useRef<HTMLAudioElement | null>(null)
  const cycle = useRef<string[]>([])
  const [error, setError] = useState('')
  useEffect(() => () => { audio.current?.pause(); audio.current = null }, [])
  async function play(voice: Preferences['voice']) {
    audio.current?.pause()
    if (!cycle.current.length) {
      cycle.current = Object.keys(voiceSources[voice])
      for (let index = cycle.current.length - 1; index > 0; index--) {
        const other = Math.floor(Math.random() * (index + 1))
        ;[cycle.current[index], cycle.current[other]] = [cycle.current[other], cycle.current[index]]
      }
    }
    const key = cycle.current.shift()! as keyof typeof voiceSources.deep
    const sample = new Audio(voiceSources[voice][key])
    audio.current = sample; setError('')
    try { await sample.play() }
    catch { if (audio.current === sample) setError('The voice sample could not be played.') }
  }
  return { play, error, stop: () => { audio.current?.pause() } }
}
