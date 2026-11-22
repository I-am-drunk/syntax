import { UNIT2_LESSONS } from './data/unit2Course'
import { CATCHUP_LESSONS } from './data/catchupCourses'
import type { GeoLesson, GeoLessonPage } from './pageTypes'

export type WorkHistoryCategory =
  | 'all'
  | 'checks'
  | 'multi-step'
  | 'math-input'
  | 'choice'
  | 'conference'
  | 'scratchpad'

export type WorkHistoryVersion = {
  versionId: string
  versionNum: number
  timestamp: number
  answerSummary: string
  subSteps?: { label: string; value: string; outcome: string }[]
  evaluation: 'correct' | 'incorrect' | 'retry' | 'scratchpad'
  hasPenInk?: boolean
  penStepId?: string
}

export type WorkHistoryEntry = {
  id: string
  lessonId: string
  lessonTitle: string
  lessonShortTitle: string
  level: number
  pageId: string
  pageIndex: number
  pageKind: GeoLessonPage['kind']
  isCheck: boolean
  promptSnippet: string
  category: Exclude<WorkHistoryCategory, 'all'>
  latestTimestamp: number
  versions: WorkHistoryVersion[]
}

const HISTORY_KEY = 'mpm2d-work-history-v1'

function cleanPrompt(raw: string): string {
  const flat = raw.replace(/\*\*/g, '').replace(/\s+/g, ' ').trim()
  return flat.length > 130 ? `${flat.slice(0, 127)}…` : flat
}

function resolveCategory(page: GeoLessonPage, isCheck: boolean): Exclude<WorkHistoryCategory, 'all'> {
  if (isCheck) return 'checks'
  if (page.kind === 'plan-order' || page.kind === 'read-plan') return 'conference'
  if (page.kind === 'multi-step') return 'multi-step'
  if (page.kind === 'math-input') return 'math-input'
  if (page.kind === 'choice' || page.kind === 'multi-choice') return 'choice'
  return 'scratchpad'
}

export function loadWorkHistory(): WorkHistoryEntry[] {
  try {
    const raw = localStorage.getItem(HISTORY_KEY)
    const saved: WorkHistoryEntry[] = raw ? JSON.parse(raw) : []
    return mergeWithLiveStorage(Array.isArray(saved) ? saved : [])
  } catch {
    return mergeWithLiveStorage([])
  }
}

export function recordWorkHistoryVersion(params: {
  lesson: GeoLesson
  page: GeoLessonPage
  pageIndex: number
  isCheck: boolean
  answerSummary: string
  subSteps?: { label: string; value: string; outcome: string }[]
  evaluation: 'correct' | 'incorrect' | 'retry' | 'scratchpad'
  penStepId?: string
}) {
  try {
    const raw = localStorage.getItem(HISTORY_KEY)
    const list: WorkHistoryEntry[] = raw ? JSON.parse(raw) : []
    const entryId = `${params.lesson.id}:${params.page.id}`
    const now = Date.now()
    const hasPenInk = detectPenInkForPage(params.lesson.id, params.page.id)

    let entry = list.find(e => e.id === entryId)
    if (!entry) {
      entry = {
        id: entryId,
        lessonId: params.lesson.id,
        lessonTitle: params.lesson.title,
        lessonShortTitle: params.lesson.shortTitle,
        level: params.lesson.level,
        pageId: params.page.id,
        pageIndex: params.pageIndex,
        pageKind: params.page.kind,
        isCheck: params.isCheck,
        promptSnippet: cleanPrompt(params.page.prompt),
        category: resolveCategory(params.page, params.isCheck),
        latestTimestamp: now,
        versions: [],
      }
      list.unshift(entry)
    }

    const lastVer = entry.versions[entry.versions.length - 1]
    if (
      lastVer &&
      lastVer.answerSummary === params.answerSummary &&
      lastVer.evaluation === params.evaluation &&
      now - lastVer.timestamp < 2500
    ) {
      return
    }

    const versionNum = entry.versions.length + 1
    entry.latestTimestamp = now
    entry.versions.push({
      versionId: `${entryId}:v${versionNum}:${now}`,
      versionNum,
      timestamp: now,
      answerSummary: params.answerSummary,
      subSteps: params.subSteps,
      evaluation: params.evaluation,
      hasPenInk,
      penStepId: params.penStepId,
    })

    // Keep newest entries first
    list.sort((a, b) => b.latestTimestamp - a.latestTimestamp)
    localStorage.setItem(HISTORY_KEY, JSON.stringify(list.slice(0, 120)))
  } catch {
    // ignore storage quota errors
  }
}

export function detectPenInkForPage(lessonId: string, pageId: string): boolean {
  try {
    const sheetKey = `mpm2d-pen-brilliant-v4:${lessonId}:${pageId}`
    if (localStorage.getItem(sheetKey)) return true
    for (let i = 0; i < localStorage.length; i++) {
      const k = localStorage.key(i)
      if (k && k.includes(`${lessonId}:${pageId}`)) return true
    }
  } catch {
    // ignore
  }
  return false
}

function mergeWithLiveStorage(existing: WorkHistoryEntry[]): WorkHistoryEntry[] {
  const byId = new Map<string, WorkHistoryEntry>()
  for (const e of existing) {
    byId.set(e.id, e)
  }

  const allLessons: GeoLesson[] = [...UNIT2_LESSONS, ...CATCHUP_LESSONS]
  const lessonMap = new Map(allLessons.map(l => [l.id, l]))

  try {
    // 1. Scan mpm2d-resume-v1 for any answered questions in progress
    const resumeRaw = localStorage.getItem('mpm2d-resume-v1')
    if (resumeRaw) {
      const resumeMap = JSON.parse(resumeRaw) as Record<
        string,
        {
          pageIndex: number
          furthest: number
          states?: Record<
            string,
            {
              selectedIds?: string[]
              mathValue?: string
              planChosen?: string[]
              evaluation?: string
              subInputs?: string[]
              subOutcomes?: string[]
            }
          >
        }
      >
      for (const [lessonId, res] of Object.entries(resumeMap)) {
        const lesson = lessonMap.get(lessonId)
        if (!lesson || !res.states) continue
        const allPages = [...lesson.pages, ...lesson.checks]
        allPages.forEach((pg, idx) => {
          const st = res.states?.[pg.id]
          if (!st) return
          const hasWork =
            st.evaluation !== 'unsubmitted' ||
            (st.mathValue && st.mathValue.trim().length > 0) ||
            (st.subInputs && st.subInputs.length > 0) ||
            (st.selectedIds && st.selectedIds.length > 0) ||
            (st.planChosen && st.planChosen.length > 0)
          if (!hasWork) return
          const entryId = `${lesson.id}:${pg.id}`
          if (byId.has(entryId)) return
          const isCheck = lesson.checks.length > 0 && idx >= lesson.pages.length
          const summary = summarizePageState(pg, st)
          byId.set(entryId, {
            id: entryId,
            lessonId: lesson.id,
            lessonTitle: lesson.title,
            lessonShortTitle: lesson.shortTitle,
            level: lesson.level,
            pageId: pg.id,
            pageIndex: idx,
            pageKind: pg.kind,
            isCheck,
            promptSnippet: cleanPrompt(pg.prompt),
            category: resolveCategory(pg, isCheck),
            latestTimestamp: Date.now() - idx * 60_000,
            versions: [
              {
                versionId: `${entryId}:v1`,
                versionNum: 1,
                timestamp: Date.now() - idx * 60_000,
                answerSummary: summary,
                evaluation:
                  st.evaluation === 'correct'
                    ? 'correct'
                    : st.evaluation === 'incorrect'
                      ? 'incorrect'
                      : 'retry',
                hasPenInk: detectPenInkForPage(lesson.id, pg.id),
              },
            ],
          })
        })
      }
    }

    // 2. Scan mpm2d-pen-brilliant-v4:* keys for scratchpad/worksheet progress
    for (let i = 0; i < localStorage.length; i++) {
      const k = localStorage.key(i)
      if (!k || !k.startsWith('mpm2d-pen-brilliant-v4:')) continue
      const rest = k.slice('mpm2d-pen-brilliant-v4:'.length)
      const [lessonId, pageId] = rest.split(':')
      if (!lessonId || !pageId) continue
      const entryId = `${lessonId}:${pageId}`
      if (byId.has(entryId)) continue
      const lesson = lessonMap.get(lessonId)
      if (!lesson) continue
      const allPages = [...lesson.pages, ...lesson.checks]
      const pageIndex = allPages.findIndex(p => p.id === pageId)
      if (pageIndex < 0) continue
      const pg = allPages[pageIndex]!
      const isCheck = lesson.checks.length > 0 && pageIndex >= lesson.pages.length
      byId.set(entryId, {
        id: entryId,
        lessonId: lesson.id,
        lessonTitle: lesson.title,
        lessonShortTitle: lesson.shortTitle,
        level: lesson.level,
        pageId: pg.id,
        pageIndex,
        pageKind: pg.kind,
        isCheck,
        promptSnippet: cleanPrompt(pg.prompt),
        category: 'scratchpad',
        latestTimestamp: Date.now() - 120_000,
        versions: [
          {
            versionId: `${entryId}:v1`,
            versionNum: 1,
            timestamp: Date.now() - 120_000,
            answerSummary: 'Handwritten Pen Studio Scratchpad & Steps',
            evaluation: 'scratchpad',
            hasPenInk: true,
          },
        ],
      })
    }
  } catch {
    // ignore
  }

  return Array.from(byId.values()).sort((a, b) => b.latestTimestamp - a.latestTimestamp)
}

function summarizePageState(
  pg: GeoLessonPage,
  st: {
    selectedIds?: string[]
    mathValue?: string
    planChosen?: string[]
    subInputs?: string[]
  },
): string {
  if (pg.kind === 'multi-step') {
    const parts = pg.steps.map((s, i) => `${s.label}: ${st.subInputs?.[i] ?? (i === (st.subInputs?.length ?? 0) ? st.mathValue : '…')}`)
    return parts.join('  →  ')
  }
  if (pg.kind === 'math-input') {
    return st.mathValue?.trim() || 'In progress'
  }
  if (pg.kind === 'choice' || pg.kind === 'multi-choice' || pg.kind === 'read-plan') {
    const labels = (st.selectedIds ?? [])
      .map(id => pg.options.find(o => o.id === id)?.label ?? id)
    return labels.join(', ') || 'Selected option'
  }
  if (pg.kind === 'plan-order') {
    const blocks = (st.planChosen ?? [])
      .map((id, idx) => `${idx + 1}. ${pg.pool.find(b => b.id === id)?.text ?? id}`)
    return blocks.join(' · ') || 'Ordered strategy plan'
  }
  return 'Worked example & scratchpad'
}
