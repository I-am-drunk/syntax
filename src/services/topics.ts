import { parsePinnedTopics, parseTopicChange } from '../../shared/topics.js'
import { isBackendApiEnabled, isJsonResponse, markBackendApiUnavailable } from './apiMode'

const LOCAL_TOPICS_KEY = 'syntax.topics.v1'

function readLocalTopics(): string[] {
  try {
    const raw = localStorage.getItem(LOCAL_TOPICS_KEY)
    if (!raw) return []
    return parsePinnedTopics(JSON.parse(raw))
  } catch {
    return []
  }
}

function writeLocalTopics(pinned: string[]) {
  try {
    localStorage.setItem(LOCAL_TOPICS_KEY, JSON.stringify(pinned))
  } catch {
    // ignore storage errors
  }
}

// Accepted clicks outlive the Topics component. Each topic is saved in click order.
const saves = new Map<string, Promise<{ slug: string; pinned: boolean }>>()

export async function loadTopics(signal: AbortSignal): Promise<string[]> {
  await Promise.allSettled([...saves.values()])
  signal.throwIfAborted()
  if (!isBackendApiEnabled()) {
    return readLocalTopics()
  }
  try {
    const response = await fetch('/api/topics', { signal })
    if (response.ok && isJsonResponse(response)) {
      const pinned = parsePinnedTopics((await response.json()).pinned)
      writeLocalTopics(pinned)
      return pinned
    }
    if (response.status === 404 || !isJsonResponse(response)) {
      markBackendApiUnavailable()
    }
  } catch (err) {
    if (signal.aborted || (err instanceof DOMException && err.name === 'AbortError')) {
      throw err
    }
  }
  return readLocalTopics()
}

export function saveTopic(slug: string, pinned: boolean) {
  const change = parseTopicChange({ slug, pinned })
  const operation = (saves.get(slug) ?? Promise.resolve())
    .catch(() => {})
    .then(async () => {
      const current = new Set(readLocalTopics())
      if (change.pinned) current.add(change.slug)
      else current.delete(change.slug)
      writeLocalTopics([...current])

      if (!isBackendApiEnabled()) {
        return change
      }
      try {
        const response = await fetch('/api/topics', {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(change),
        })
        if (response.ok && isJsonResponse(response)) {
          const result = parseTopicChange(await response.json())
          if (result.slug === slug && result.pinned === pinned) {
            return result
          }
        } else if (response.status === 404 || !isJsonResponse(response)) {
          markBackendApiUnavailable()
        }
      } catch {
        // Static build / offline: localStorage fallback already persisted cleanly
      }
      return change
    })
    .finally(() => {
      if (saves.get(slug) === operation) saves.delete(slug)
    })
  saves.set(slug, operation)
  return operation
}
