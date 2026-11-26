import { readLocalCourseProgress } from '../services/progress'

export interface CourseLessonStub {
  id: string
  title: string
  level: number
}

export const MPM2D_LESSON_INDEX: readonly CourseLessonStub[] = [
  { id: 'u2-l1-slopes', title: 'Slopes & Lines', level: 1 },
  { id: 'u2-l2-midpoint', title: 'Midpoint', level: 1 },
  { id: 'u2-l3-medians', title: 'Medians', level: 1 },
  { id: 'u2-l4-length-circles', title: 'Length & Circles', level: 1 },
  { id: 'u2-l5-right-tri', title: 'Right Triangles', level: 2 },
  { id: 'u2-l6-distance', title: 'Shortest Distance', level: 2 },
  { id: 'u2-l7-lines', title: '3 Triangle Lines', level: 2 },
  { id: 'u2-l8-quads', title: 'Quadrilateral Proofs', level: 2 },
  { id: 'u2-l9-properties', title: 'Chords, Midsegments & Centres', level: 2 },
  { id: 'u2-c1-triangle-lines', title: 'Sprint 1: Triangle Lines & Centres', level: 3 },
  { id: 'u2-c2-distance-circles', title: 'Sprint 2: Distance, Circles & Area', level: 3 },
  { id: 'u2-c3-shapes-proofs', title: 'Sprint 3: Triangles & Quad Proofs', level: 3 },
  { id: 'u2-c4-flawed-plans', title: 'Sprint 4: Spot the Flaw & "Why?"', level: 3 },
  { id: 'u2-c5-oral-sim', title: 'Sprint 5: Live Oral Conference Sim', level: 3 },
  { id: 'u2-m1-mock-a', title: 'Open-Notes Mock A: Lines & Centres', level: 4 },
  { id: 'u2-m2-mock-b', title: 'Open-Notes Mock B: Proofs & Pipeline Boss', level: 4 },
]

export const MPM2D_TOTAL_LESSONS = MPM2D_LESSON_INDEX.length

export const THINKING_IN_CODE_LESSONS: readonly CourseLessonStub[] = [
  { id: 'tappy-onboarding-tic', title: 'Writing Programs', level: 1 },
  { id: 'sequencing-commands-ss-exp', title: 'Sequencing Commands', level: 1 },
  { id: 'repetition-tappy-insight-ss-exp', title: 'Repeating Patterns', level: 1 },
  { id: 'modifying-programs-tappy-insight-ss-exp', title: 'Debugging Programs', level: 1 },
]

export const THINKING_IN_CODE_META = {
  totalLessons: THINKING_IN_CODE_LESSONS.length,
  firstLessonTitle: THINKING_IN_CODE_LESSONS[0]!.title,
  secondLessonTitle: THINKING_IN_CODE_LESSONS[1]!.title,
} as const

export interface Mpm2dProgressSummary {
  completedCount: number
  masteredCount: number
  totalLessons: number
  percent: number
  hasResume: boolean
  nextLessonId: string
  nextLessonTitle: string
  nextLessonLevel: number
  followingLessonTitle?: string
  missedCheckCount: number
}

export interface ThinkingInCodeProgressSummary {
  completedCount: number
  totalLessons: number
  percent: number
  nextLessonId: string
  nextLessonTitle: string
  followingLessonTitle?: string
}

const PROGRESS_KEY = 'mpm2d-brilliant-progress-v1'
const RESUME_KEY = 'mpm2d-resume-v1'

export function readMpm2dProgressSummary(): Mpm2dProgressSummary {
  let completed: Record<string, { correct: number; total: number }> = {}
  let missedCheckCount = 0
  let hasResume = false
  let resumedLessonId: string | null = null

  try {
    const raw = localStorage.getItem(PROGRESS_KEY)
    if (raw) {
      const parsed = JSON.parse(raw) as {
        completed?: Record<string, { correct: number; total: number }>
        missedCheckIds?: unknown[]
      }
      if (parsed?.completed && typeof parsed.completed === 'object' && !Array.isArray(parsed.completed)) {
        completed = parsed.completed
      }
      if (Array.isArray(parsed?.missedCheckIds)) {
        missedCheckCount = parsed.missedCheckIds.length
      }
    }
  } catch {
    // ignore storage errors
  }

  try {
    const rawResume = localStorage.getItem(RESUME_KEY)
    if (rawResume) {
      const parsed = JSON.parse(rawResume) as Record<string, { pageIndex?: number }>
      if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) {
        for (const stub of MPM2D_LESSON_INDEX) {
          const entry = parsed[stub.id]
          if (entry && typeof entry.pageIndex === 'number' && entry.pageIndex > 0) {
            hasResume = true
            resumedLessonId = stub.id
            break
          }
        }
      }
    }
  } catch {
    // ignore storage errors
  }

  let completedCount = 0
  let masteredCount = 0
  for (const stub of MPM2D_LESSON_INDEX) {
    const stat = completed[stub.id]
    if (!stat) continue
    if (stat.total === 0 || stat.correct > 0) {
      completedCount += 1
    }
    if (stat.total === 0 || stat.correct >= stat.total) {
      masteredCount += 1
    }
  }

  const isDone = (id: string) => {
    const stat = completed[id]
    return Boolean(stat && (stat.total === 0 || stat.correct > 0))
  }

  const nextIdx = resumedLessonId
    ? MPM2D_LESSON_INDEX.findIndex(l => l.id === resumedLessonId)
    : MPM2D_LESSON_INDEX.findIndex(l => !isDone(l.id))

  const resolvedIdx = nextIdx >= 0 ? nextIdx : 0
  const nextStub = MPM2D_LESSON_INDEX[resolvedIdx] ?? MPM2D_LESSON_INDEX[0]!
  const followingStub = MPM2D_LESSON_INDEX[resolvedIdx + 1]

  return {
    completedCount,
    masteredCount,
    totalLessons: MPM2D_TOTAL_LESSONS,
    percent: Math.round((completedCount / MPM2D_TOTAL_LESSONS) * 100),
    hasResume,
    nextLessonId: nextStub.id,
    nextLessonTitle: nextStub.title,
    nextLessonLevel: nextStub.level,
    followingLessonTitle: followingStub?.title,
    missedCheckCount,
  }
}

export function readThinkingInCodeProgressSummary(): ThinkingInCodeProgressSummary {
  const courseProgress = readLocalCourseProgress('thinking-in-code')
  const completedSlugs = new Set(courseProgress.completedLessons.map(l => l.slug))

  const completedCount = THINKING_IN_CODE_LESSONS.filter(l => completedSlugs.has(l.id)).length
  const totalLessons = THINKING_IN_CODE_LESSONS.length
  const nextIdx = THINKING_IN_CODE_LESSONS.findIndex(l => !completedSlugs.has(l.id))
  const resolvedIdx = nextIdx >= 0 ? nextIdx : 0
  const nextStub = THINKING_IN_CODE_LESSONS[resolvedIdx] ?? THINKING_IN_CODE_LESSONS[0]!
  const followingStub = THINKING_IN_CODE_LESSONS[resolvedIdx + 1]

  return {
    completedCount,
    totalLessons,
    percent: Math.round((completedCount / totalLessons) * 100),
    nextLessonId: nextStub.id,
    nextLessonTitle: nextStub.title,
    followingLessonTitle: followingStub?.title,
  }
}
