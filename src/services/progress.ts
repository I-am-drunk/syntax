import {
  parseCourseSlug,
  parseCourseProgress,
  parseProgress,
  parseProgressId,
  parseProgressReceipt,
} from '../../shared/progress.js'
import type { CourseProgress, ProgressSnapshot, ProgressReceipt } from '../../shared/progress.js'
import { isBackendApiEnabled, isJsonResponse, markBackendApiUnavailable } from './apiMode'
export type { ProblemOutcome, ProgressKind, ProgressSnapshot } from '../../shared/progress.js'

export const progressError = 'Your progress could not be saved. Retry before leaving.'

export const LOCAL_CS_PROGRESS_KEY = 'syntax.cs.progress.v1'
export const CS_PROGRESS_EVENT = 'syntax:cs-progress-changed'

type LocalProgressStore = Record<string, ProgressSnapshot>

export function readLocalProgressStore(): LocalProgressStore {
  try {
    const raw = localStorage.getItem(LOCAL_CS_PROGRESS_KEY)
    if (!raw) return {}
    const parsed = JSON.parse(raw) as unknown
    if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) {
      return parsed as LocalProgressStore
    }
  } catch {
    // ignore corrupted storage
  }
  return {}
}

function writeLocalStore(store: LocalProgressStore) {
  try {
    localStorage.setItem(LOCAL_CS_PROGRESS_KEY, JSON.stringify(store))
    if (typeof window !== 'undefined') {
      window.dispatchEvent(new CustomEvent(CS_PROGRESS_EVENT))
    }
  } catch {
    // ignore quota errors
  }
}

function saveLocalProgress(progress: ProgressSnapshot): ProgressReceipt {
  const store = readLocalProgressStore()
  store[progress.id] = progress
  writeLocalStore(store)
  return {
    accepted: true,
    progress,
    savedAt: new Date().toISOString(),
  }
}

export function readLocalCourseProgress(courseSlug: string): CourseProgress {
  const store = readLocalProgressStore()
  const completedLessons: { slug: string; version: string }[] = []
  const seen = new Set<string>()
  for (const snap of Object.values(store)) {
    if (!snap || !Array.isArray(snap.contents)) continue
    for (const item of snap.contents) {
      if (item.courseSlug !== courseSlug || !item.completed) continue
      const key = `${item.slug}:${item.version}`
      if (!seen.has(key)) {
        seen.add(key)
        completedLessons.push({ slug: item.slug, version: item.version })
      }
    }
  }
  return {
    courseSlug,
    completedLessons,
  }
}

async function receipt(response: Response): Promise<ProgressReceipt> {
  if (response.status !== 200 || !isJsonResponse(response)) {
    throw new Error(progressError)
  }
  return parseProgressReceipt(await response.json())
}

export async function saveProgress(value: ProgressSnapshot): Promise<ProgressReceipt> {
  const progress = parseProgress(value)
  const localReceipt = saveLocalProgress(progress)
  if (!isBackendApiEnabled()) return localReceipt
  try {
    const response = await fetch('/api/progress', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(progress),
      keepalive: true,
    })
    if (response.ok && isJsonResponse(response)) {
      const result = await receipt(response)
      if (JSON.stringify(result.progress) === JSON.stringify(progress)) {
        return result
      }
    } else if (response.status === 404 || !isJsonResponse(response)) {
      markBackendApiUnavailable()
    }
  } catch {
    // Static build / offline: localStorage fallback already persisted cleanly
  }
  return localReceipt
}

export async function readProgress(id: string): Promise<ProgressReceipt> {
  const parsedId = parseProgressId(id)
  if (isBackendApiEnabled()) {
    try {
      const response = await fetch('/api/progress?id=' + encodeURIComponent(parsedId), {
        cache: 'no-store',
      })
      if (response.ok && isJsonResponse(response)) {
        const result = await receipt(response)
        if (result.progress.id === id) return result
      } else if (response.status === 404 || !isJsonResponse(response)) {
        markBackendApiUnavailable()
      }
    } catch {
      // fallback to local
    }
  }
  const store = readLocalProgressStore()
  const local = store[parsedId]
  if (local) {
    return { accepted: true, progress: local, savedAt: new Date().toISOString() }
  }
  throw new Error(progressError)
}

export async function readCourseProgress(
  course: string,
  signal?: AbortSignal,
): Promise<CourseProgress> {
  const courseSlug = parseCourseSlug(course)
  if (signal?.aborted) {
    throw new DOMException('Aborted', 'AbortError')
  }
  if (isBackendApiEnabled()) {
    try {
      const response = await fetch('/api/progress?course=' + encodeURIComponent(courseSlug), {
        cache: 'no-store',
        signal,
      })
      if (response.ok && isJsonResponse(response)) {
        const result = parseCourseProgress(await response.json())
        if (result.courseSlug === courseSlug) return result
      } else if (response.status === 404 || !isJsonResponse(response)) {
        markBackendApiUnavailable()
      }
    } catch (err) {
      if (signal?.aborted || (err instanceof DOMException && err.name === 'AbortError')) {
        throw err
      }
      // Static build / offline: use clean localStorage progress
    }
  }
  if (signal?.aborted) {
    throw new DOMException('Aborted', 'AbortError')
  }
  return readLocalCourseProgress(courseSlug)
}
