import { useEffect, useRef, useState } from 'react'
import { initialPinnedTopics, parsePinnedTopics } from '../../shared/topics.js'
import { loadTopics, saveTopic } from '../services/topics'
type Session = { active: boolean; ready: boolean; pins: Set<string>; saved: Set<string>;
  revisions: Map<string, number> }
export function useTopics() {
  const [pinned, setPinned] = useState(initialPinnedTopics)
  const [ready, setReady] = useState(false), [error, setError] = useState('')
  const [attempt, setAttempt] = useState(0), session = useRef<Session>()
  useEffect(() => {
    const controller = new AbortController()
    const s: Session = { active: true, ready: false, pins: new Set(), saved: new Set(),
      revisions: new Map() }
    session.current = s; setReady(false)
    loadTopics(controller.signal).then(ids => {
      if (!s.active) return
      s.ready = true; s.pins = new Set(ids); s.saved = new Set(ids)
      setPinned(ids); setReady(true); setError('')
    }).catch(() => { if (s.active) setError('Could not load saved topics.') })
    return () => { s.active = false; controller.abort() }
  }, [attempt])
  function toggle(slug: string) {
    const s = session.current
    if (!s?.active || !s.ready) return
    const next = !s.pins.has(slug), version = (s.revisions.get(slug) ?? 0) + 1
    s.revisions.set(slug, version)
    next ? s.pins.add(slug) : s.pins.delete(slug)
    setPinned(parsePinnedTopics([...s.pins]))
    saveTopic(slug, next).then(result => {
      if (s.active) result.pinned ? s.saved.add(slug) : s.saved.delete(slug)
    }).catch(() => {
      // The source rolls back failed optimistic state without an error toast.
      if (s.active && s.revisions.get(slug) === version) {
        s.saved.has(slug) ? s.pins.add(slug) : s.pins.delete(slug)
        setPinned(parsePinnedTopics([...s.pins]))
      }
    })
    return next
  }
  return { pinned, ready, error, toggle, retry: () => { setError(''); setAttempt(n => n + 1) } }
}
