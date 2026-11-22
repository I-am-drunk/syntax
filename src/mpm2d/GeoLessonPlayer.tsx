import { Suspense, lazy, useEffect, useMemo, useRef, useState } from 'react'
import { Arrow, LessonFooter } from '../lessons/LessonControls'
import type { LessonSound } from '../services/lessonSounds'
import { gradeAnswer, parseGhostGeometry } from './mathParser'
import { isPenEnabledForPage, type GeoLesson, type GeoLessonPage, type MultiStepPage, type PlanOrderPage } from './pageTypes'
import { BrilliantGraph } from './graph'
import { MathText } from './components/MathText'
import { BrilliantChoice, type ChoiceEvaluation } from './components/BrilliantChoice'
import { BrilliantMathInput } from './components/BrilliantMathInput'
import { BrilliantPlanBuilder } from './components/BrilliantPlanBuilder'
import { BrilliantWorkedCard } from './components/BrilliantWorkedCard'
import { GeoExplanationContent, GeoExplanationModal } from './components/GeoExplanationModal'
import { FormulaSheetContent } from './components/FormulaSheetModal'
import { GeoCompletion } from './components/GeoCompletion'
import { CompactExploration } from './explorations/CompactExploration'
import { WorkspaceSplitter, type SplitterTension } from './pen/WorkspaceSplitter'
import { buildWorksheetSpec } from './pen/worksheetModel'
import { CheckmarkGate } from './checkmark/CheckmarkGate'
import { getWalkthroughForPage } from './walkthrough/walkthroughData'
import { WalkthroughContent, WalkthroughModal } from './walkthrough/WalkthroughPlayer'

const PenCanvasWorkspace = lazy(() => import('./pen/PenCanvasWorkspace'))

const PEN_OPEN_KEY = 'mpm2d-pen-open-v1'
const PEN_FLIP_KEY = 'mpm2d-pen-flipped-v1'
const PEN_SPLIT_KEY = 'mpm2d-pen-split-v1'
const RESUME_KEY = 'mpm2d-resume-v1'
const CIRCLED = ['①', '②', '③', '④', '⑤', '⑥']

function loadBoolPref(key: string, fallback: boolean): boolean {
  try {
    const v = localStorage.getItem(key)
    if (v === 'true') return true
    if (v === 'false') return false
  } catch {
    // ignore
  }
  return fallback
}

function loadSplitPref(): number {
  try {
    const n = Number(localStorage.getItem(PEN_SPLIT_KEY))
    if (Number.isFinite(n) && n >= 0.28 && n <= 0.56) return n
  } catch {
    // ignore
  }
  return 0.38
}

type ResumeMap = Record<string, { pageIndex: number; furthest: number }>

function readResume(lessonId: string): { pageIndex: number; furthest: number } | null {
  try {
    const raw = localStorage.getItem(RESUME_KEY)
    if (!raw) return null
    const map = JSON.parse(raw) as ResumeMap
    return map[lessonId] ?? null
  } catch {
    return null
  }
}

function writeResume(lessonId: string, pageIndex: number, furthest: number) {
  if (lessonId.startsWith('virtual-')) return
  try {
    const raw = localStorage.getItem(RESUME_KEY)
    const map: ResumeMap = raw ? (JSON.parse(raw) as ResumeMap) : {}
    if (pageIndex <= 0 && furthest <= 0) {
      delete map[lessonId]
    } else {
      map[lessonId] = { pageIndex, furthest }
    }
    localStorage.setItem(RESUME_KEY, JSON.stringify(map))
  } catch {
    // ignore
  }
}

function clearResume(lessonId: string) {
  if (lessonId.startsWith('virtual-')) return
  try {
    const raw = localStorage.getItem(RESUME_KEY)
    if (!raw) return
    const map = JSON.parse(raw) as ResumeMap
    delete map[lessonId]
    localStorage.setItem(RESUME_KEY, JSON.stringify(map))
  } catch {
    // ignore
  }
}

type MultiStepOutcome = 'correct' | 'revealed'

type PageRuntime = {
  evaluation: ChoiceEvaluation
  selectedIds: string[]
  mathValue: string
  planChosen: string[]
  readStep: number
  peekedScene?: boolean
  attempts: number
  feedback?: string
  pinnedHint?: string
  // Multi-step execution state
  activeSubStep: number
  subAttempts: number
  subOutcomes: MultiStepOutcome[]
  subInputs: string[]
  subJustSolved?: boolean
}

const emptyState: PageRuntime = {
  evaluation: 'unsubmitted',
  selectedIds: [],
  mathValue: '',
  planChosen: [],
  readStep: 0,
  attempts: 0,
  activeSubStep: 0,
  subAttempts: 0,
  subOutcomes: [],
  subInputs: [],
}

function RichText({ text }: { text: string }) {
  return (
    <p>
      <MathText text={text} />
    </p>
  )
}

function isInteractivePage(page: GeoLessonPage): boolean {
  return page.kind !== 'explore' && page.kind !== 'worked'
}

function evaluatePlanOrder(page: PlanOrderPage, chosen: string[]): { ok: boolean; feedback: string } {
  const match = page.validPlans.find(
    vp => vp.steps.length === chosen.length && vp.steps.every((id, i) => id === chosen[i]),
  )
  if (match) {
    const alts = page.validPlans.filter(vp => vp !== match)
    const suffix = alts.length > 0 ? ` (Also valid: ${alts.map(a => a.name).join(', ')}.)` : ''
    return { ok: true, feedback: `${match.name}: ${match.explanation}${suffix}` }
  }

  for (const rule of page.orderFeedback ?? []) {
    const iBefore = chosen.indexOf(rule.before)
    const iAfter = chosen.indexOf(rule.after)
    if (iBefore >= 0 && iAfter >= 0 && iBefore > iAfter) {
      return { ok: false, feedback: rule.message }
    }
  }

  let best = page.validPlans[0]
  let bestOverlap = -1
  for (const vp of page.validPlans) {
    const overlap = vp.steps.filter(s => chosen.includes(s)).length
    if (overlap > bestOverlap) {
      bestOverlap = overlap
      best = vp
    }
  }

  const extra = chosen.filter(id => !best.steps.includes(id))
  const missing = best.steps.filter(id => !chosen.includes(id))

  if (missing.length > 0) {
    const custom = page.missingFeedback?.find(m => missing.includes(m.missingId))
    if (custom) return { ok: false, feedback: custom.message }
  }
  if (extra.length > 0 && missing.length === 0) {
    const label = page.pool.find(b => b.id === extra[0])?.text ?? ''
    return { ok: false, feedback: `Extra step not needed here: “${label}”.` }
  }
  if (missing.length === 0 && extra.length === 0) {
    return { ok: false, feedback: 'Right steps, wrong order. Check which value you must find first.' }
  }
  return {
    ok: false,
    feedback: `Check what the question asks for at the end and work backwards (${best.steps.length} steps needed).`,
  }
}

export function GeoLessonPlayer({
  lesson,
  theme,
  soundOn = true,
  drawMode = false,
  voiceOn = true,
  formulasOpen,
  returnToLessonLabel,
  onClose,
  onReturnToLesson,
  onLaunchRescue,
  onToggleDrawMode,
  onToggleVoice,
  onComplete,
  onToggleFormulas,
  onCloseFormulas,
  onPenModeChange,
  onSound,
}: {
  lesson: GeoLesson
  theme: 'light' | 'dark'
  soundOn?: boolean
  drawMode?: boolean
  voiceOn?: boolean
  formulasOpen: boolean
  returnToLessonLabel?: string
  onClose: () => void
  onReturnToLesson?: () => void
  onLaunchRescue?: (rescueLessonId: string) => void
  onToggleDrawMode?: () => void
  onToggleVoice?: () => void
  onComplete: (
    lessonId: string,
    correctChecks: number,
    totalChecks: number,
    missedCheckIds: string[],
  ) => void
  onToggleFormulas: () => void
  onCloseFormulas: () => void
  onPenModeChange?: (open: boolean) => void
  onSound?: (cue: LessonSound) => void
}) {
  const allPages = useMemo(() => [...lesson.pages, ...lesson.checks], [lesson])
  const initialResume = useMemo(() => {
    const r = readResume(lesson.id)
    if (!r) return { pageIndex: 0, furthest: 0 }
    const maxIdx = Math.max(0, allPages.length - 1)
    return {
      pageIndex: Math.min(r.pageIndex, maxIdx),
      furthest: Math.min(r.furthest, maxIdx),
    }
  }, [lesson.id, allPages.length])

  const [pageIndex, setPageIndex] = useState(initialResume.pageIndex)
  const [furthest, setFurthest] = useState(initialResume.furthest)
  const [states, setStates] = useState<Record<string, PageRuntime>>({})
  const [explanationOpen, setExplanationOpen] = useState(false)
  const [walkthroughOpen, setWalkthroughOpen] = useState(false)
  const [seenExplain, setSeenExplain] = useState<Record<string, boolean>>({})
  const [finished, setFinished] = useState(false)

  // Pen Studio Mode state
  const [penWanted, setPenWanted] = useState<boolean>(() => loadBoolPref(PEN_OPEN_KEY, false))
  const [penFlipped, setPenFlipped] = useState<boolean>(() => loadBoolPref(PEN_FLIP_KEY, false))
  const [splitRatio, setSplitRatio] = useState<number>(loadSplitPref)
  const [penFullscreen, setPenFullscreen] = useState(false)
  const [isResizing, setIsResizing] = useState(false)
  const [splitterTension, setSplitterTension] = useState<SplitterTension>('none')
  const [splitterTensionAmount, setSplitterTensionAmount] = useState(0)
  const [isPortrait, setIsPortrait] = useState(() =>
    typeof window !== 'undefined' ? window.innerWidth < 860 : false,
  )

  const pageScrollRef = useRef<HTMLElement>(null)
  const workspaceRef = useRef<HTMLDivElement>(null)
  const lessonSurfaceRef = useRef<HTMLDivElement>(null)

  const page = allPages[pageIndex] ?? allPages[0]
  const isCheck = lesson.checks.length > 0 && pageIndex >= lesson.pages.length
  const checkIndex = isCheck ? pageIndex - lesson.pages.length : undefined
  const state = states[page.id] ?? emptyState
  const isProblem = isInteractivePage(page)
  const penAllowed = isPenEnabledForPage(page, isCheck)
  const penOpen = penWanted && penAllowed

  useEffect(() => {
    if (!penOpen) setPenFullscreen(false)
    onPenModeChange?.(penOpen)
  }, [penOpen, onPenModeChange])

  useEffect(() => {
    try {
      localStorage.setItem(PEN_OPEN_KEY, String(penWanted))
    } catch {
      // ignore
    }
  }, [penWanted])

  useEffect(() => {
    return () => onPenModeChange?.(false)
  }, [onPenModeChange])

  useEffect(() => {
    try {
      localStorage.setItem(PEN_FLIP_KEY, String(penFlipped))
    } catch {
      // ignore
    }
  }, [penFlipped])

  useEffect(() => {
    try {
      localStorage.setItem(PEN_SPLIT_KEY, String(splitRatio))
    } catch {
      // ignore
    }
  }, [splitRatio])

  useEffect(() => {
    if (typeof window === 'undefined') return
    const mq = window.matchMedia('(max-width: 859px)')
    const onChange = () => setIsPortrait(mq.matches)
    onChange()
    mq.addEventListener('change', onChange)
    return () => mq.removeEventListener('change', onChange)
  }, [])

  useEffect(() => {
    if (!finished) {
      writeResume(lesson.id, pageIndex, furthest)
    }
  }, [lesson.id, pageIndex, furthest, finished])

  useEffect(() => {
    pageScrollRef.current?.scrollTo({ top: 0 })
    setExplanationOpen(false)
    setWalkthroughOpen(false)
  }, [pageIndex])

  // Global 'P' shortcut to toggle Pen Studio Mode
  useEffect(() => {
    if (finished) return
    const onKey = (e: KeyboardEvent) => {
      if (e.metaKey || e.ctrlKey || e.altKey) return
      const el = e.target as HTMLElement | null
      if (el && (el.tagName === 'INPUT' || el.tagName === 'TEXTAREA' || el.isContentEditable)) return
      if ((e.key === 'p' || e.key === 'P') && penAllowed) {
        e.preventDefault()
        setPenWanted(v => !v)
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [finished, penAllowed])

  const patchState = (id: string, patch: Partial<PageRuntime>) => {
    setStates(prev => ({
      ...prev,
      [id]: { ...(prev[id] ?? emptyState), ...patch },
    }))
  }

  const canCheck = useMemo(() => {
    if (!isProblem || state.evaluation !== 'unsubmitted') return false
    switch (page.kind) {
      case 'choice':
      case 'read-plan':
        return state.selectedIds.length === 1
      case 'multi-choice':
        return state.selectedIds.length > 0
      case 'math-input':
      case 'multi-step':
        return state.mathValue.trim().length > 0
      case 'plan-order':
        return state.planChosen.length > 0
      default:
        return false
    }
  }, [isProblem, page.kind, state])

  const handleMultiStepCheck = (msPage: MultiStepPage) => {
    const stepIdx = state.activeSubStep
    const sub = msPage.steps[stepIdx]
    if (!sub) return
    const res = gradeAnswer(state.mathValue, sub.answer)
    if (res.isFormatError) {
      patchState(msPage.id, { feedback: res.feedback, pinnedHint: res.feedback })
      onSound?.('hint')
      return
    }

    const isLastSub = stepIdx >= msPage.steps.length - 1

    if (res.correct) {
      const nextOutcomes: MultiStepOutcome[] = [...state.subOutcomes, 'correct']
      const nextInputs = [...state.subInputs, state.mathValue]
      if (isLastSub) {
        const hadRevealed = nextOutcomes.includes('revealed')
        patchState(msPage.id, {
          evaluation: hadRevealed ? 'incorrect' : 'correct',
          subOutcomes: nextOutcomes,
          subInputs: nextInputs,
          subJustSolved: true,
          feedback: undefined,
          pinnedHint: undefined,
        })
        onSound?.(hadRevealed ? 'continue' : 'correct')
      } else {
        // Advance cleanly to next chained step (pen canvas stays completely uninterrupted!)
        patchState(msPage.id, {
          activeSubStep: stepIdx + 1,
          subAttempts: 0,
          subOutcomes: nextOutcomes,
          subInputs: nextInputs,
          subJustSolved: true,
          mathValue: '',
          evaluation: 'unsubmitted',
          feedback: undefined,
          pinnedHint: undefined,
        })
        onSound?.('correct')
      }
      return
    }

    // Wrong answer on current chained step: 2-try anti-cascade guard!
    const nextSubAttempts = state.subAttempts + 1
    let feedback = res.feedback
    if (sub.nudge && feedback && !feedback.includes(sub.nudge)) {
      feedback = `${feedback} ${sub.nudge}`
    }

    if (nextSubAttempts >= 2) {
      // Anti-cascade: lock in the clean exact value on the ledger so the student can finish the remaining steps!
      const nextOutcomes: MultiStepOutcome[] = [...state.subOutcomes, 'revealed']
      const nextInputs = [...state.subInputs, sub.ledgerResult]
      if (isLastSub) {
        patchState(msPage.id, {
          evaluation: 'incorrect',
          subAttempts: nextSubAttempts,
          subOutcomes: nextOutcomes,
          subInputs: nextInputs,
          subJustSolved: true,
          feedback: `${feedback ?? 'Check the algebra carefully.'} Exact value: ${sub.ledgerResult}.`,
          pinnedHint: undefined,
        })
        onSound?.('incorrect')
      } else {
        patchState(msPage.id, {
          activeSubStep: stepIdx + 1,
          subAttempts: 0,
          subOutcomes: nextOutcomes,
          subInputs: nextInputs,
          subJustSolved: true,
          mathValue: '',
          evaluation: 'unsubmitted',
          feedback: undefined,
          pinnedHint: `Locked Step ${stepIdx + 1} (${sub.ledgerResult}) so your next step stays exact.`,
        })
        onSound?.('hint')
      }
      return
    }

    // First wrong try on this sub-step: stay editable with pinned diagnostic hint
    patchState(msPage.id, {
      evaluation: 'incorrect-retry',
      subAttempts: nextSubAttempts,
      attempts: state.attempts + 1,
      feedback,
      pinnedHint: feedback ?? state.pinnedHint,
    })
    onSound?.('hint')
  }

  const handleCheck = () => {
    if (!canCheck) return
    if (page.kind === 'multi-step') {
      handleMultiStepCheck(page)
      return
    }
    const retryable = !isCheck
    let ok = false
    let feedback: string | undefined

    if (page.kind === 'choice' || page.kind === 'read-plan') {
      const picked = state.selectedIds[0]
      ok = picked === page.correctId
      if (!ok) {
        feedback = page.options.find(o => o.id === picked)?.hint
      }
    } else if (page.kind === 'multi-choice') {
      const setA = new Set(state.selectedIds)
      const setB = new Set(page.correctIds)
      ok = setA.size === setB.size && [...setA].every(x => setB.has(x))
      if (!ok) {
        const wrongPick = state.selectedIds.find(id => !setB.has(id))
        if (wrongPick) {
          feedback =
            page.options.find(o => o.id === wrongPick)?.hint ??
            'One of your selected options does not hold. Check each one carefully.'
        } else {
          feedback = `You’re close: there are ${page.correctIds.length} correct options in total.`
        }
      }
    } else if (page.kind === 'math-input') {
      const res = gradeAnswer(state.mathValue, page.answer)
      if (res.isFormatError) {
        patchState(page.id, { feedback: res.feedback, pinnedHint: res.feedback })
        onSound?.('hint')
        return
      }
      ok = res.correct
      feedback = res.feedback
      if (!ok && page.nudge && state.attempts >= 1 && feedback && !feedback.includes(page.nudge)) {
        feedback = `${feedback} ${page.nudge}`
      }
    } else if (page.kind === 'plan-order') {
      const res = evaluatePlanOrder(page, state.planChosen)
      ok = res.ok
      feedback = res.feedback
    }

    const nextAttempts = ok ? state.attempts : state.attempts + 1
    const exhaustedRetries = retryable && nextAttempts >= 3
    const nextEval: ChoiceEvaluation = ok
      ? 'correct'
      : retryable && !exhaustedRetries
        ? 'incorrect-retry'
        : 'incorrect'
    patchState(page.id, {
      evaluation: nextEval,
      attempts: nextAttempts,
      feedback,
      pinnedHint: ok ? undefined : feedback ?? state.pinnedHint,
    })
    onSound?.(ok ? 'correct' : nextEval === 'incorrect-retry' ? 'hint' : 'incorrect')
  }

  const handleRetry = () => {
    patchState(page.id, {
      evaluation: 'unsubmitted',
      feedback: undefined,
      pinnedHint:
        page.kind === 'math-input' || page.kind === 'multi-step'
          ? state.feedback ?? state.pinnedHint
          : undefined,
      selectedIds: page.kind === 'choice' || page.kind === 'read-plan' ? [] : state.selectedIds,
    })
  }

  const handleContinue = () => {
    onSound?.('continue')
    if (pageIndex >= allPages.length - 1) {
      const checkCorrect = lesson.checks.filter(p => states[p.id]?.evaluation === 'correct').length
      const totalChecks = lesson.checks.length
      const missedCheckIds = lesson.checks
        .filter(p => states[p.id]?.evaluation !== 'correct')
        .map(p => p.id)
      clearResume(lesson.id)
      onComplete(lesson.id, checkCorrect, totalChecks, missedCheckIds)
      setFinished(true)
      return
    }
    const next = pageIndex + 1
    setPageIndex(next)
    setFurthest(f => Math.max(f, next))
  }

  const handleNavigate = (offset: number) => {
    const next = pageIndex + offset
    if (next < 0 || next > furthest || next >= allPages.length) return
    setPageIndex(next)
  }

  // Keyboard Enter for fast progression
  useEffect(() => {
    if (finished || explanationOpen || walkthroughOpen) return
    const onKey = (e: KeyboardEvent) => {
      if (e.metaKey || e.ctrlKey || e.altKey) return
      if ((e.target as HTMLElement | null)?.closest('[data-pen-workspace]')) return
      if (e.key === 'Enter') {
        const inInput = e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement
        if (inInput) return
        if (!isProblem) {
          e.preventDefault()
          handleContinue()
        } else if (state.evaluation === 'unsubmitted' && canCheck) {
          e.preventDefault()
          handleCheck()
        } else if (state.evaluation === 'incorrect-retry') {
          e.preventDefault()
          handleRetry()
        } else if (state.evaluation === 'correct' || state.evaluation === 'incorrect') {
          e.preventDefault()
          handleContinue()
        }
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [finished, explanationOpen, isProblem, state, canCheck, pageIndex])

  const handleSplitDrag = (clientPos: number) => {
    const rect = workspaceRef.current?.getBoundingClientRect()
    if (!rect) return

    const raw = isPortrait
      ? (clientPos - rect.top) / Math.max(1, rect.height)
      : penFlipped
        ? (rect.right - clientPos) / Math.max(1, rect.width)
        : (clientPos - rect.left) / Math.max(1, rect.width)

    const minR = isPortrait ? 0.26 : 0.28
    const maxR = isPortrait ? 0.62 : 0.56
    const fullscreenSnap = isPortrait ? 0.13 : 0.14
    const closeSnap = isPortrait ? 0.77 : 0.72

    // Dragging back inward while in Full-Screen Drawing Mode smoothly restores split view
    if (penFullscreen) {
      if (raw >= fullscreenSnap + 0.04) {
        setPenFullscreen(false)
        setSplitRatio(Math.min(maxR, Math.max(minR, raw)))
        setSplitterTension('none')
        setSplitterTensionAmount(0)
        onSound?.('toggle-on')
      }
      return
    }

    if (raw > maxR) {
      // Hold steady at 60/40 limit; keep dragging past threshold to snap closed!
      setSplitRatio(maxR)
      const prog = Math.min(1, (raw - maxR) / (closeSnap - maxR))
      if (raw >= closeSnap) {
        setIsResizing(false)
        setSplitterTension('none')
        setSplitterTensionAmount(0)
        setPenFullscreen(false)
        setPenWanted(false)
        setSplitRatio(0.4)
        onSound?.('toggle-on')
        return
      }
      setSplitterTension('close')
      setSplitterTensionAmount(prog)
      return
    }

    if (raw < minR) {
      // Hold steady at max drawing ratio; keep dragging past threshold to snap full screen!
      setSplitRatio(minR)
      const prog = Math.min(1, (minR - raw) / (minR - fullscreenSnap))
      if (raw <= fullscreenSnap) {
        setIsResizing(false)
        setSplitterTension('none')
        setSplitterTensionAmount(0)
        setPenFullscreen(true)
        onSound?.('toggle-on')
        return
      }
      setSplitterTension('fullscreen')
      setSplitterTensionAmount(prog)
      return
    }

    setSplitterTension('none')
    setSplitterTensionAmount(0)
    setSplitRatio(raw)
  }

  if (finished) {
    const checkCorrect =
      lesson.checks.length > 0
        ? lesson.checks.filter(p => states[p.id]?.evaluation === 'correct').length
        : lesson.pages.filter(p => isInteractivePage(p) && states[p.id]?.evaluation === 'correct').length
    const totalChecks =
      lesson.checks.length > 0
        ? lesson.checks.length
        : lesson.pages.filter(isInteractivePage).length

    return (
      <GeoCompletion
        title={`${lesson.shortTitle}\ncomplete!`}
        color={lesson.completionColor}
        riveColor={lesson.completionRiveColor}
        levelNumber={lesson.level}
        correctCount={checkCorrect}
        totalCount={totalChecks}
        onContinue={onClose}
        onSound={onSound}
      />
    )
  }

  const checkEvaluations: ChoiceEvaluation[] = lesson.checks.map(
    p => states[p.id]?.evaluation ?? 'unsubmitted',
  )

  const lessonTotal = Math.max(1, lesson.pages.length)
  const progressPct = isCheck
    ? 100
    : lessonTotal === 1
      ? 100
      : (Math.min(pageIndex, lessonTotal - 1) / (lessonTotal - 1)) * 100

  const ghost =
    page.kind === 'math-input' && state.evaluation === 'unsubmitted'
      ? parseGhostGeometry(state.mathValue, page.answer.kind)
      : page.kind === 'multi-step' && state.evaluation === 'unsubmitted'
        ? parseGhostGeometry(
            state.mathValue,
            page.steps[state.activeSubStep]?.answer.kind ?? 'number',
          )
        : null

  const activeExplanation =
    page.kind !== 'explore' && page.kind !== 'worked' ? page.explanation : undefined

  const walkthroughSpec = useMemo(
    () => getWalkthroughForPage(lesson.id, page),
    [lesson.id, page],
  )

  const worksheetSpec = buildWorksheetSpec(lesson, page, pageIndex, allPages.length, isCheck)

  // Left-pane slot architecture in Pen Mode: zero 3-panel collisions!
  const leftSlot: 'problem' | 'compare' | 'playbook' | 'walkthrough' =
    penOpen && walkthroughOpen && walkthroughSpec
      ? 'walkthrough'
      : penOpen && explanationOpen && activeExplanation
        ? 'compare'
        : penOpen && formulasOpen
          ? 'playbook'
          : 'problem'

  const workspaceStyle = penOpen
    ? ({ '--pen-split': `${Math.round(splitRatio * 1000) / 10}%` } as React.CSSProperties)
    : undefined

  return (
    <main
      className="lesson-shell"
      data-phase={isCheck ? 'checks' : 'lesson'}
      data-pen-open={penOpen || undefined}
      aria-label={lesson.title}
    >
      <header className="lesson-navigation">
        <button type="button" className="lesson-close" onClick={onClose} aria-label="Close">
          <svg width="16" height="16" viewBox="0 0 16 16" aria-hidden="true">
            <path
              fill="currentColor"
              d="M8.00006 6.58577L3.05027 1.63599L1.63606 3.0502L6.58585 7.99999L1.63605 12.9498L3.05026 14.364L8.00006 9.4142L12.9498 14.3639L14.364 12.9497L9.41427 7.99999L14.364 3.05029L12.9498 1.63608L8.00006 6.58577Z"
            />
          </svg>
        </button>

        <nav
          className="lesson-progress-navigation"
          aria-label={isCheck ? 'Lesson checks' : 'Lesson pages'}
        >
          {!isCheck && (
            <>
              <button
                className="lesson-page-arrow"
                type="button"
                aria-label="Previous page"
                disabled={pageIndex === 0}
                onClick={() => handleNavigate(-1)}
              >
                <Arrow />
              </button>
              <div
                className="lesson-progress-track"
                role="progressbar"
                aria-label="Lesson progress"
                aria-valuemin={0}
                aria-valuemax={lessonTotal - 1}
                aria-valuenow={Math.min(pageIndex, lessonTotal - 1)}
              >
                <div style={{ width: `${progressPct}%` }} />
              </div>
            </>
          )}

          {lesson.checks.length > 0 && (
            <div
              className="lesson-check-progress"
              aria-label={
                checkIndex === undefined
                  ? undefined
                  : `Check ${checkIndex + 1} of ${lesson.checks.length}`
              }
            >
              {checkEvaluations.map((ev, i) => (
                <i key={i} data-current={checkIndex === i} data-evaluation={ev} />
              ))}
            </div>
          )}

          {!isCheck && (
            <button
              className="lesson-page-arrow"
              type="button"
              aria-label="Next page"
              disabled={pageIndex >= furthest || pageIndex >= lesson.pages.length - 1}
              onClick={() => handleNavigate(1)}
            >
              <Arrow right />
            </button>
          )}
        </nav>

        <div className="lesson-nav-actions">
          {onToggleDrawMode && (
            <button
              type="button"
              className="lesson-nav-icon-btn"
              data-active={drawMode || undefined}
              onClick={() => {
                onToggleDrawMode()
                onSound?.('toggle-on')
              }}
              aria-label={drawMode ? 'Disable Draw-a-Checkmark Mode' : 'Enable Draw-a-Checkmark Mode'}
              aria-pressed={drawMode}
              title={drawMode ? 'Draw Mode ON (draw checkmarks)' : 'Draw Mode OFF (tap/keyboard)'}
            >
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.3" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                <path d="M4 13.5 L9.5 19 L20 6" />
              </svg>
            </button>
          )}
          <button
            type="button"
            className="lesson-nav-icon-btn"
            data-active={formulasOpen || undefined}
            onClick={() => {
              if (penOpen && explanationOpen) setExplanationOpen(false)
              onToggleFormulas()
            }}
            aria-label="Unit 2 Playbook"
            aria-pressed={formulasOpen}
            title="Playbook & Formulas (F)"
          >
            <svg width="19" height="19" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
              <path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20" />
              <path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z" />
              <path d="M9 8h6M9 12h4" />
            </svg>
          </button>

          <button
            type="button"
            className="lesson-nav-icon-btn lesson-pen-toggle"
            disabled={!penAllowed}
            data-active={penOpen || undefined}
            data-disabled={!penAllowed || undefined}
            onClick={() => {
              if (!penAllowed) return
              setPenWanted(v => !v)
            }}
            aria-label={
              !penAllowed
                ? 'Pen sheet not needed on this step'
                : penOpen
                  ? 'Close Pen Workspace'
                  : 'Open Pen Workspace'
            }
            aria-pressed={penOpen}
            title={
              !penAllowed
                ? 'Pen sheet disabled for this step'
                : penOpen
                  ? 'Close Pen Workspace (P)'
                  : 'Open Pen Workspace (P)'
            }
          >
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
              <path d="M17 3a2.85 2.83 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5Z" />
              <path d="m15 5 4 4" />
            </svg>
          </button>
        </div>
      </header>

      <div
        ref={workspaceRef}
        className="lesson-workspace"
        data-pen-open={penOpen || undefined}
        data-pen-fullscreen={(penOpen && penFullscreen) || undefined}
        data-flipped={penFlipped || undefined}
        data-resizing={isResizing || undefined}
        style={workspaceStyle}
      >
        <div
          ref={lessonSurfaceRef}
          className="lesson-surface"
          data-evaluation={isProblem ? state.evaluation : 'unsubmitted'}
        >
          <div className="lesson-surface-inner">
            {leftSlot === 'playbook' && (
              <div className="lesson-left-slot-panel">
                <FormulaSheetContent
                  compact
                  closeLabel="Back to problem"
                  onClose={onCloseFormulas}
                />
              </div>
            )}

            {leftSlot === 'walkthrough' && walkthroughSpec && (
              <div className="lesson-left-slot-panel is-walkthrough">
                <WalkthroughContent
                  spec={walkthroughSpec}
                  soundOn={soundOn}
                  voiceOn={voiceOn}
                  inline
                  onToggleVoice={() => onToggleVoice?.()}
                  onClose={() => setWalkthroughOpen(false)}
                  onLaunchRescue={rescueId => {
                    setWalkthroughOpen(false)
                    onLaunchRescue?.(rescueId)
                  }}
                />
              </div>
            )}

            {leftSlot === 'compare' && activeExplanation && (
              <div className="lesson-left-slot-panel is-compare">
                <GeoExplanationContent
                  explanation={activeExplanation}
                  isLast={pageIndex === allPages.length - 1}
                  title="Compare with your work"
                  inline
                  onClose={() => setExplanationOpen(false)}
                  onContinue={handleContinue}
                />
              </div>
            )}

            {leftSlot === 'problem' && (
              <>
                <section
                  ref={pageScrollRef}
                  className="lesson-page"
                  data-page-kind={page.kind}
                  data-is-check={isCheck}
                >
                  <div className="lesson-content">
                    {returnToLessonLabel && onReturnToLesson && (
                      <button
                        type="button"
                        className="lesson-return-crumb"
                        onClick={onReturnToLesson}
                      >
                        ← Back to {returnToLessonLabel}
                      </button>
                    )}
                    <div className="lesson-copy-row">
                      <div className="lesson-copy">
                        <RichText text={page.prompt} />
                      </div>
                      {walkthroughSpec && (
                        <button
                          type="button"
                          className="lesson-walkthrough-trigger"
                          aria-label="Walk me through with Sema"
                          title="Walk me through with Sema"
                          onClick={() => {
                            if (penOpen && formulasOpen) onCloseFormulas()
                            if (explanationOpen) setExplanationOpen(false)
                            setWalkthroughOpen(true)
                          }}
                        >
                          ?
                        </button>
                      )}
                    </div>

                    {page.kind === 'explore' && (
                      <CompactExploration kind={page.exploration} onSound={onSound} />
                    )}

                    {page.kind === 'worked' && (
                      <BrilliantWorkedCard
                        page={page}
                        penMode={penOpen}
                      />
                    )}

                    {page.kind === 'choice' && (
                      <div className="br-problem-body">
                        {page.scene && (
                          <div className="geo-frame">
                            <BrilliantGraph
                              mode="display"
                              scene={
                                state.evaluation === 'correct' && page.solvedScene
                                  ? page.solvedScene
                                  : page.scene
                              }
                            />
                          </div>
                        )}
                        <BrilliantChoice
                          options={page.options}
                          selected={state.selectedIds}
                          layout={page.layout}
                          evaluation={state.evaluation}
                          correctIds={[page.correctId]}
                          active={!explanationOpen}
                          onToggle={id => {
                            onSound?.('lightweight-choice')
                            patchState(page.id, { selectedIds: [id] })
                          }}
                        />
                        {state.feedback &&
                          state.evaluation !== 'unsubmitted' &&
                          state.evaluation !== 'correct' && (
                            <div className="br-inline-note is-hint">
                              <MathText text={state.feedback} />
                            </div>
                          )}
                      </div>
                    )}

                    {page.kind === 'multi-choice' && (
                      <div className="br-problem-body">
                        {page.scene && (
                          <div className="geo-frame">
                            <BrilliantGraph mode="display" scene={page.scene} />
                          </div>
                        )}
                        <BrilliantChoice
                          options={page.options}
                          selected={state.selectedIds}
                          multiple
                          evaluation={state.evaluation}
                          correctIds={page.correctIds}
                          active={!explanationOpen}
                          onToggle={id => {
                            onSound?.('lightweight-choice')
                            const next = state.selectedIds.includes(id)
                              ? state.selectedIds.filter(x => x !== id)
                              : [...state.selectedIds, id]
                            patchState(page.id, { selectedIds: next })
                          }}
                        />
                        {state.feedback &&
                          state.evaluation !== 'unsubmitted' &&
                          state.evaluation !== 'correct' && (
                            <div className="br-inline-note is-hint">
                              <MathText text={state.feedback} />
                            </div>
                          )}
                      </div>
                    )}

                    {page.kind === 'math-input' && (
                      <div className="br-problem-body">
                        <div className="geo-frame">
                          <BrilliantGraph
                            mode="display"
                            scene={
                              state.evaluation === 'correct' && page.solvedScene
                                ? page.solvedScene
                                : page.scene
                            }
                            ghost={ghost}
                            caption={ghost ? 'Live preview' : undefined}
                            animateDrawIn={state.evaluation === 'correct' && Boolean(page.solvedScene)}
                          />
                        </div>
                        <BrilliantMathInput
                          value={state.mathValue}
                          spec={page.answer}
                          placeholder={page.placeholder}
                          evaluation={state.evaluation}
                          feedback={state.feedback}
                          pinnedHint={state.pinnedHint}
                          active={!explanationOpen}
                          onChange={val =>
                            patchState(page.id, {
                              mathValue: val,
                              ...(state.evaluation === 'incorrect-retry'
                                ? {
                                    evaluation: 'unsubmitted',
                                    feedback: undefined,
                                    pinnedHint: state.feedback ?? state.pinnedHint,
                                  }
                                : { feedback: undefined }),
                            })
                          }
                          onSubmit={() => {
                            if (state.evaluation === 'unsubmitted' && canCheck) handleCheck()
                            else if (state.evaluation === 'incorrect-retry') handleCheck()
                            else if (state.evaluation === 'correct' || state.evaluation === 'incorrect')
                              handleContinue()
                          }}
                        />
                      </div>
                    )}

                    {page.kind === 'multi-step' && (() => {
                      const activeIdx = Math.min(state.activeSubStep, page.steps.length - 1)
                      const activeSub = page.steps[activeIdx]
                      const allDone = state.evaluation === 'correct' || state.evaluation === 'incorrect'
                      const graphScene = allDone
                        ? page.steps[page.steps.length - 1].solvedScene
                        : activeSub.scene
                      return (
                        <div className="br-problem-body">
                          <div className="geo-frame">
                            <BrilliantGraph
                              mode="display"
                              scene={graphScene}
                              ghost={allDone ? null : ghost}
                              caption={
                                allDone
                                  ? 'All steps complete'
                                  : ghost
                                    ? 'Live preview'
                                    : `Step ${activeIdx + 1} of ${page.steps.length}: ${activeSub.label}`
                              }
                              animateDrawIn={Boolean(state.subJustSolved)}
                            />
                          </div>

                          {/* Bare editorial circled-numeral ledger (ZERO pills!) */}
                          <div className="br-ms-ledger" aria-label="Problem steps">
                            {page.steps.map((st, idx) => {
                              const doneOutcome = state.subOutcomes[idx]
                              const isCurrent = !allDone && idx === activeIdx
                              return (
                                <div
                                  key={st.id}
                                  className={`br-ms-row${
                                    doneOutcome === 'correct'
                                      ? ' is-done'
                                      : doneOutcome === 'revealed'
                                        ? ' is-revealed'
                                        : isCurrent
                                          ? ' is-active'
                                          : ' is-upcoming'
                                  }`}
                                >
                                  <span className="br-ms-num">{CIRCLED[idx] ?? `${idx + 1}.`}</span>
                                  <span className="br-ms-label">{st.label}</span>
                                  {doneOutcome && (
                                    <span className="br-ms-val">
                                      <MathText text={st.ledgerResult} />
                                    </span>
                                  )}
                                </div>
                              )
                            })}
                          </div>

                          {!allDone && (
                            <div className="br-ms-active-prompt">
                              <MathText text={activeSub.prompt} />
                            </div>
                          )}

                          {!allDone && (
                            <BrilliantMathInput
                              key={`${page.id}:${activeSub.id}`}
                              value={state.mathValue}
                              spec={activeSub.answer}
                              placeholder={activeSub.placeholder}
                              evaluation={state.evaluation}
                              feedback={state.feedback}
                              pinnedHint={state.pinnedHint}
                              active={!explanationOpen}
                              onChange={val =>
                                patchState(page.id, {
                                  mathValue: val,
                                  ...(state.evaluation === 'incorrect-retry'
                                    ? {
                                        evaluation: 'unsubmitted',
                                        feedback: undefined,
                                        pinnedHint: state.feedback ?? state.pinnedHint,
                                      }
                                    : { feedback: undefined }),
                                })
                              }
                              onSubmit={() => {
                                if (state.evaluation === 'unsubmitted' && canCheck) handleCheck()
                                else if (state.evaluation === 'incorrect-retry') handleCheck()
                              }}
                            />
                          )}

                          {allDone && state.feedback && (
                            <div className="br-inline-note is-hint">
                              <MathText text={state.feedback} />
                            </div>
                          )}
                        </div>
                      )
                    })()}

                    {page.kind === 'plan-order' && (
                      <div className="br-problem-body">
                        <div className="geo-frame">
                          <BrilliantGraph mode="display" scene={page.scene} />
                        </div>
                        <BrilliantPlanBuilder
                          key={page.id}
                          pool={page.pool}
                          chosen={state.planChosen}
                          expectedSlots={page.validPlans[0]?.steps.length ?? 3}
                          validPlans={page.validPlans}
                          dynamicSlots={
                            isCheck ||
                            page.validPlans.some(
                              vp => vp.steps.length !== page.validPlans[0]?.steps.length,
                            )
                          }
                          hideRowHints={isCheck}
                          defaultOralTest={page.defaultOralTest}
                          evaluation={state.evaluation}
                          feedback={state.feedback}
                          active={!explanationOpen}
                          onSound={onSound}
                          onChange={next => {
                            patchState(page.id, { planChosen: next })
                          }}
                        />
                      </div>
                    )}

                    {page.kind === 'read-plan' && (() => {
                      const showGraph =
                        !page.blindScene ||
                        state.peekedScene ||
                        state.evaluation !== 'unsubmitted'
                      return (
                        <div className="br-problem-body">
                          {showGraph ? (
                            <div className="geo-frame">
                              <BrilliantGraph
                                mode="display"
                                scene={page.planSteps[state.readStep]?.scene ?? page.planSteps[0].scene}
                                caption={`Step ${state.readStep + 1} of ${page.planSteps.length}`}
                              />
                            </div>
                          ) : (
                            <div className="br-blind-strip">
                              <span>Oral Exam Mode: read the plan without a sketch first.</span>
                              <button
                                type="button"
                                className="br-blind-peek-btn"
                                onClick={() => patchState(page.id, { peekedScene: true })}
                              >
                                Peek Sketch
                              </button>
                            </div>
                          )}
                          <div className="br-read-plan">
                            {page.planSteps.map((st, i) => (
                              <button
                                key={i}
                                type="button"
                                className={`br-read-step${i === state.readStep ? ' is-current' : ''}`}
                                onClick={() => patchState(page.id, { readStep: i })}
                              >
                                <span className="br-read-num">{i + 1}</span>
                                <span>
                                  <MathText text={st.text} />
                                </span>
                              </button>
                            ))}
                          </div>
                          <BrilliantChoice
                            options={page.options}
                            selected={state.selectedIds}
                            evaluation={state.evaluation}
                            correctIds={[page.correctId]}
                            active={!explanationOpen}
                            onToggle={id => {
                              onSound?.('lightweight-choice')
                              patchState(page.id, { selectedIds: [id] })
                            }}
                          />
                          {state.feedback &&
                            state.evaluation !== 'unsubmitted' &&
                            state.evaluation !== 'correct' && (
                              <div className="br-inline-note is-hint">
                                <MathText text={state.feedback} />
                              </div>
                            )}
                        </div>
                      )
                    })()}
                  </div>
                </section>

                {drawMode ? (
                  <footer
                    className="lesson-footer is-draw-mode"
                    data-evaluation={state.evaluation}
                  >
                    {isProblem && state.evaluation !== 'unsubmitted' && walkthroughSpec && (
                      <button
                        type="button"
                        className="lesson-draw-why-btn"
                        onClick={() => {
                          if (penOpen && formulasOpen) onCloseFormulas()
                          setWalkthroughOpen(true)
                        }}
                      >
                        Walk me through
                      </button>
                    )}
                    <CheckmarkGate
                      key={`chk-${page.id}-${state.activeSubStep}-${state.evaluation}`}
                      label={
                        isProblem && state.evaluation === 'unsubmitted'
                          ? 'Draw ✓ to check'
                          : state.evaluation === 'incorrect-retry'
                            ? 'Draw ✓ to retry'
                            : pageIndex === allPages.length - 1
                              ? 'Draw ✓ to finish'
                              : 'Draw ✓ to continue'
                      }
                      fallbackLabel={
                        isProblem && state.evaluation === 'unsubmitted'
                          ? 'Tap to check'
                          : state.evaluation === 'incorrect-retry'
                            ? 'Tap to try again'
                            : pageIndex === allPages.length - 1
                              ? 'Tap to finish'
                              : 'Tap to continue'
                      }
                      disabled={isProblem && state.evaluation === 'unsubmitted' && !canCheck}
                      visualState={
                        state.evaluation === 'correct'
                          ? 'correct'
                          : state.evaluation === 'incorrect-retry' || state.evaluation === 'incorrect'
                            ? 'wrong'
                            : 'ready'
                      }
                      screenGestureContainerRef={lessonSurfaceRef}
                      enableScreenGesture={!walkthroughOpen && !explanationOpen && !formulasOpen}
                      onTrigger={() => {
                        if (!isProblem) {
                          handleContinue()
                        } else if (state.evaluation === 'unsubmitted' && canCheck) {
                          handleCheck()
                        } else if (state.evaluation === 'incorrect-retry') {
                          handleRetry()
                        } else {
                          handleContinue()
                        }
                      }}
                    />
                  </footer>
                ) : (
                  <LessonFooter
                    key={`${page.id}:${state.evaluation}:${state.activeSubStep}`}
                    evaluation={state.evaluation}
                    isProblem={isProblem}
                    isLast={pageIndex === allPages.length - 1}
                    isCheck={isCheck}
                    canCheck={canCheck}
                    onCheck={handleCheck}
                    onRetry={handleRetry}
                    onContinue={handleContinue}
                    onExplain={
                      walkthroughSpec
                        ? () => {
                            if (penOpen && formulasOpen) onCloseFormulas()
                            setSeenExplain(prev => ({ ...prev, [page.id]: true }))
                            setWalkthroughOpen(true)
                          }
                        : activeExplanation
                          ? () => {
                              if (penOpen && formulasOpen) onCloseFormulas()
                              setSeenExplain(prev => ({ ...prev, [page.id]: true }))
                              setExplanationOpen(true)
                            }
                          : undefined
                    }
                    explanationSeen={!!seenExplain[page.id]}
                    allowWhyOnRetry={state.attempts >= 2}
                  />
                )}
              </>
            )}
          </div>
        </div>

        {penOpen && (
          <>
            <WorkspaceSplitter
              orientation={isPortrait ? 'horizontal' : 'vertical'}
              flipped={penFlipped}
              fullscreen={penFullscreen}
              tension={splitterTension}
              tensionAmount={splitterTensionAmount}
              onDragStart={() => setIsResizing(true)}
              onDragEnd={() => {
                setIsResizing(false)
                setSplitterTension('none')
                setSplitterTensionAmount(0)
              }}
              onDelta={handleSplitDrag}
              onReset={() => {
                setPenFullscreen(false)
                setSplitRatio(0.38)
              }}
              onExitFullscreen={() => {
                setPenFullscreen(false)
                onSound?.('toggle-on')
              }}
            />
            <div className="pen-workspace-surface">
              <Suspense
                fallback={<div className="pen-canvas-loading">Preparing pen studio…</div>}
              >
                <PenCanvasWorkspace
                  pageKey={`${lesson.id}:${page.id}`}
                  theme={theme}
                  flipped={penFlipped}
                  fullscreen={penFullscreen}
                  worksheetSpec={worksheetSpec}
                  onToggleFlip={() => setPenFlipped(f => !f)}
                  onToggleFullscreen={() => {
                    setPenFullscreen(v => !v)
                    onSound?.('toggle-on')
                  }}
                  onSound={onSound}
                />
              </Suspense>
            </div>
          </>
        )}
      </div>

      {/* Flying-Sema Walkthrough modal in Normal Mode */}
      {walkthroughSpec && !penOpen && (
        <WalkthroughModal
          spec={walkthroughSpec}
          open={walkthroughOpen}
          soundOn={soundOn}
          voiceOn={voiceOn}
          onToggleVoice={() => onToggleVoice?.()}
          onClose={() => setWalkthroughOpen(false)}
          onLaunchRescue={rescueId => {
            setWalkthroughOpen(false)
            onLaunchRescue?.(rescueId)
          }}
        />
      )}

      {/* In Normal Mode, Why? renders as Brilliant modal; in Pen Mode, it swaps the left pane */}
      {activeExplanation && !penOpen && (
        <GeoExplanationModal
          explanation={activeExplanation}
          open={explanationOpen}
          isLast={pageIndex === allPages.length - 1}
          onClose={() => setExplanationOpen(false)}
          onContinue={handleContinue}
        />
      )}
    </main>
  )
}
