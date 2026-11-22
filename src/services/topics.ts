import { parsePinnedTopics, parseTopicChange } from '../../shared/topics.js'
// Accepted clicks outlive the Topics component. Each topic is saved in click order.
const saves = new Map<string, Promise<{ slug: string; pinned: boolean }>>()
export async function loadTopics(signal: AbortSignal): Promise<string[]> {
  await Promise.allSettled([...saves.values()])
  signal.throwIfAborted()
  const response = await fetch('/api/topics', { signal })
  if (!response.ok) throw new Error('Could not load saved topics.')
  return parsePinnedTopics((await response.json()).pinned)
}
export function saveTopic(slug: string, pinned: boolean) {
  const change = parseTopicChange({ slug, pinned })
  const operation = (saves.get(slug) ?? Promise.resolve()).catch(() => {}).then(async () => {
    const response = await fetch('/api/topics', { method: 'PATCH',
      headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(change) })
    if (!response.ok) throw new Error('Could not save topic.')
    const result = parseTopicChange(await response.json())
    if (result.slug !== slug || result.pinned !== pinned) throw new Error('Topic save did not match.')
    return result
  }).finally(() => { if (saves.get(slug) === operation) saves.delete(slug) })
  saves.set(slug, operation)
  return operation
}
