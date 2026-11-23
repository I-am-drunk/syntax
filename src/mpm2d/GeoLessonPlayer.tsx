import { Suspense, lazy, useEffect, useMemo, useRef, useState } from 'react'
import { Arrow, LessonFooter } from '../lessons/LessonControls'
import type { LessonSound } from '../services/lessonSounds'
import { gradeAnswer, parseGhostGeometry } from './mathParser'
import { classifyLessonPage, isPenEnabledForPage, type GeoLesson, type GeoLessonPage, type MultiStepPage, type PlanOrderPage } from './pageTypes'
import { BrilliantGraph } from './graph'
import { MathText } from './components/MathText'
import { BrilliantChoice, type ChoiceEvaluation } from './components/BrilliantChoice'
import { BrilliantMathInput } from './components/BrilliantMathInput'
import { BrilliantPlanBuilder } from './components/BrilliantPlanBuilder'
import { BrilliantWorkedCard } from './components/BrilliantWorkedCard'
import { GeoExplanationContent, GeoExplanationModal } from './components/GeoExplanationModal'
import { FormulaSheetContent, FormulaSheetModal } from './components/FormulaSheetModal'
import { GeoCompletion } from './components/GeoCompletion'
import { CompactExploration } from './explorations/CompactExploration'
import { WorkspaceSplitter, type SplitterTension } from './pen/WorkspaceSplitter'
import { buildWorksheetSpec } from './pen/worksheetModel'
import { CheckmarkGate } from './checkmark/CheckmarkGate'
import { getWalkthroughForPage } from './walkthrough/walkthroughData'
import { WalkthroughContent, WalkthroughModal } from './walkthrough/WalkthroughPlayer'
import { Sema, type SemaExpressionName, type SemaShapeName, type SemaState, type SemaTailName } from './mascot/Sema'
import { recordWorkHistoryVersion } from './historyStore'

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

type LessonResume = {
  pageIndex: number
  pageId?: string
  furthest: number
  updatedAt?: number
  states?: Record<string, PageRuntime>
  seenExplain?: Record<string, boolean>
}

type ResumeMap = Record<string, LessonResume>

function readResume(lessonId: string): LessonResume | null {
  if (lessonId.startsWith('virtual-')) return null
  try {
    const raw = localStorage.getItem(RESUME_KEY)
    if (!raw) return null
    const map = JSON.parse(raw) as ResumeMap
    return map[lessonId] ?? null
  } catch {
    return null
  }
}

function writeResume(lessonId: string, resume: LessonResume) {
  if (lessonId.startsWith('virtual-')) return
  try {
    const raw = localStorage.getItem(RESUME_KEY)
    const map: ResumeMap = raw ? (JSON.parse(raw) as ResumeMap) : {}
    if (resume.pageIndex === 0 && resume.furthest === 0 && !Object.keys(resume.states ?? {}).length) return
    delete map[lessonId]
    map[lessonId] = { ...resume, updatedAt: Date.now() }
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

function isInteractivePage(page: GeoLessonPage, penOpen: boolean): boolean {
  if (page.kind === 'worked') return penOpen && Boolean(page.checkChoice)
  return page.kind !== 'explore'
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

function buildGuidedHints(
  page: GeoLessonPage,
  walkthroughSpec: ReturnType<typeof getWalkthroughForPage>,
): { title: string; bullets: string[]; tip: string } {
  const bullets: string[] = []
  if (walkthroughSpec?.steps && walkthroughSpec.steps.length > 0) {
    for (const st of walkthroughSpec.steps.slice(0, 4)) {
      const label = (st.label || '').trim()
      if (label && !bullets.includes(label)) bullets.push(label)
    }
  }
  if (bullets.length === 0) {
    if (page.kind === 'multi-step') {
      for (const st of page.steps) bullets.push(st.label)
    } else if (page.kind === 'worked') {
      for (const st of page.steps) bullets.push(st.heading)
    } else if (page.kind === 'plan-order') {
      bullets.push('Identify the final geometric property or value asked for.')
      bullets.push('Work backwards to find which slopes, midpoints, or lengths must come first.')
      bullets.push(`Build a sequence of ${page.validPlans[0]?.steps.length ?? 3} ordered steps.`)
    } else {
      bullets.push('Write down the coordinates or equations given in the prompt.')
      bullets.push('Pick the matching Unit 2 formula (slope, midpoint, length, or line equation).')
      bullets.push('Substitute carefully with signs, then double-check on the graph.')
    }
  }

  let tip = 'Use these building blocks to set up your own plan before revealing the full solution.'
  if (page.kind === 'math-input' && page.nudge) {
    tip = page.nudge
  } else if (page.kind === 'multi-step') {
    const firstNudge = page.steps.find(s => s.nudge)?.nudge
    if (firstNudge) tip = firstNudge
  } else if (walkthroughSpec?.title) {
    tip = `Focus on: ${walkthroughSpec.title}`
  }

  return {
    title: 'Components & Setup Plan (No Answer Spoiler)',
    bullets,
    tip,
  }
}

export function GeoLessonPlayer({
  lesson,
  theme,
  soundOn = true,
  drawMode = false,
  voiceOn = true,
  semaShape = 'jenson',
  semaTail = 'jenson',
  semaExpression = 'neutral',
  penControlsCollapsed = true,
  showStepPlan = false,
  formulasOpen,
  returnToLessonLabel,
  onClose,
  onReturnToLesson,
  onLaunchRescue,
  onToggleDrawMode,
  onToggleVoice,
  onToggleShowStepPlan,
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
  semaShape?: SemaShapeName
  semaTail?: SemaTailName
  semaExpression?: SemaExpressionName
  penControlsCollapsed?: boolean
  showStepPlan?: boolean
  formulasOpen: boolean
  returnToLessonLabel?: string
  onClose: () => void
  onReturnToLesson?: () => void
  onLaunchRescue?: (rescueLessonId: string) => void
  onToggleDrawMode?: () => void
  onToggleVoice?: () => void
  onToggleShowStepPlan?: () => void
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
    const maxIdx = Math.max(0, allPages.length - 1)
    const clamp = (index?: number) =>
      Number.isInteger(index) ? Math.max(0, Math.min(index!, maxIdx)) : 0
    const savedPage = allPages.findIndex(page => page.id === r?.pageId)
    const pageIndex = savedPage < 0 ? clamp(r?.pageIndex) : savedPage
    return {
      pageIndex,
      furthest: Math.max(pageIndex, clamp(r?.furthest)),
      states: r?.states ?? {},
      seenExplain: r?.seenExplain ?? {},
    }
  }, [lesson.id, allPages])

  const [pageIndex, setPageIndex] = useState(initialResume.pageIndex)
  const [furthest, setFurthest] = useState(initialResume.furthest)
  const [states, setStates] = useState(initialResume.states)
  const [explanationOpen, setExplanationOpen] = useState(false)
  const [walkthroughOpen, setWalkthroughOpen] = useState(false)
  const [helpMenuOpen, setHelpMenuOpen] = useState(false)
  const [guidedHintsOpen, setGuidedHintsOpen] = useState(false)
  const [walkthroughFloating, setWalkthroughFloating] = useState(true)
  const [workedStepIndex, setWorkedStepIndex] = useState(0)
  const [playbookFloating, setPlaybookFloating] = useState(true)
  const [seenExplain, setSeenExplain] = useState(initialResume.seenExplain)
  const [finished, setFinished] = useState(false)
  const helpMenuRef = useRef<HTMLDivElement>(null)
  const prevLessonIdRef = useRef(lesson.id)
  const onPenModeChangeRef = useRef(onPenModeChange)
  onPenModeChangeRef.current = onPenModeChange

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
  const splitBoundsRef = useRef<DOMRect | null>(null)
  const lessonSurfaceRef = useRef<HTMLDivElement>(null)

  const page = allPages[pageIndex] ?? allPages[0]
  const isCheck = lesson.checks.length > 0 && pageIndex >= lesson.pages.length
  const checkIndex = isCheck ? pageIndex - lesson.pages.length : undefined
  const state = states[page.id] ?? emptyState
  const penAllowed = isPenEnabledForPage(page, isCheck)
  const penOpen = penWanted && penAllowed
  const pageRole = classifyLessonPage(page, isCheck)
  const isProblem = isInteractivePage(page, penOpen)
  const worksheetSpec = useMemo(
    () => buildWorksheetSpec(lesson, page, pageIndex, allPages.length, isCheck, showStepPlan),
    [lesson, page, pageIndex, allPages.length, isCheck, showStepPlan],
  )
  const walkthroughSpec = useMemo(
    () => getWalkthroughForPage(lesson.id, page),
    [lesson.id, page],
  )

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
    return () => onPenModeChangeRef.current?.(false)
  }, [])

  useEffect(() => {
    try {
      localStorage.setItem(PEN_FLIP_KEY, String(penFlipped))
    } catch {
      // ignore
    }
  }, [penFlipped])

  useEffect(() => {
    if (isResizing) return
    try {
      localStorage.setItem(PEN_SPLIT_KEY, String(splitRatio))
    } catch {
      // ignore
    }
  }, [splitRatio, isResizing])

  useEffect(() => {
    if (typeof window === 'undefined') return
    const mq = window.matchMedia('(max-width: 859px)')
    const onChange = () => setIsPortrait(mq.matches)
    onChange()
    mq.addEventListener('change', onChange)
    return () => mq.removeEventListener('change', onChange)
  }, [])

  useEffect(() => {
    if (prevLessonIdRef.current !== lesson.id) {
      prevLessonIdRef.current = lesson.id
      setPageIndex(initialResume.pageIndex)
      setFurthest(initialResume.furthest)
      setStates(initialResume.states)
      setSeenExplain(initialResume.seenExplain)
      setFinished(false)
      setExplanationOpen(false)
      setWalkthroughOpen(false)
      setHelpMenuOpen(false)
      setGuidedHintsOpen(false)
      setWorkedStepIndex(0)
      return
    }
    if (!finished) {
      writeResume(lesson.id, { pageIndex, pageId: page.id, furthest, states, seenExplain })
    }
  }, [lesson.id, page.id, pageIndex, furthest, states, seenExplain, finished, initialResume])

  useEffect(() => {
    pageScrollRef.current?.scrollTo({ top: 0 })
    setExplanationOpen(false)
    setWalkthroughOpen(false)
    setHelpMenuOpen(false)
    setGuidedHintsOpen(false)
    setWorkedStepIndex(0)
  }, [pageIndex])

  useEffect(() => {
    if (!helpMenuOpen) return
    const onDown = (e: PointerEvent) => {
      if (helpMenuRef.current && !helpMenuRef.current.contains(e.target as Node)) {
        setHelpMenuOpen(false)
      }
    }
    const onEsc = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.preventDefault()
        setHelpMenuOpen(false)
      }
    }
    document.addEventListener('pointerdown', onDown, true)
    window.addEventListener('keydown', onEsc)
    return () => {
      document.removeEventListener('pointerdown', onDown, true)
      window.removeEventListener('keydown', onEsc)
    }
  }, [helpMenuOpen])

  // Global 'P' shortcut to toggle Pen Studio Mode
  useEffect(() => {
    if (finished || explanationOpen || walkthroughOpen || formulasOpen) return
    const onKey = (e: KeyboardEvent) => {
      if (e.metaKey || e.ctrlKey || e.altKey) return
      const el = e.target as HTMLElement | null
      if (
        el &&
        (el.tagName === 'INPUT' ||
          el.tagName === 'TEXTAREA' ||
          el.tagName === 'SELECT' ||
          el.isContentEditable)
      ) {
        return
      }
      if (document.querySelector('[role="dialog"], [role="menu"]')) return
      if ((e.key === 'p' || e.key === 'P') && penAllowed) {
        e.preventDefault()
        setPenWanted(v => !v)
      } else if (e.key === '?' && (walkthroughSpec || (page.kind !== 'explore' && page.kind !== 'worked' && page.explanation))) {
        e.preventDefault()
        setHelpMenuOpen(v => !v)
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [finished, explanationOpen, walkthroughOpen, formulasOpen, penAllowed, walkthroughSpec, page])

  const patchState = (id: string, patch: Partial<PageRuntime>) => {
    setStates(prev => ({
      ...prev,
      [id]: { ...(prev[id] ?? emptyState), ...patch },
    }))
  }

  const canCheck = useMemo(() => {
    if (!isProblem || state.evaluation !== 'unsubmitted') return false
    switch (page.kind) {
      case 'worked':
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
        recordWorkHistoryVersion({
          lesson,
          page: msPage,
          pageIndex,
          isCheck,
          answerSummary: msPage.steps.map((s, idx) => `${s.label}: ${nextInputs[idx] ?? ""}`).join("  →  "),
          subSteps: msPage.steps.map((s, idx) => ({
            label: s.label,
            value: nextInputs[idx] ?? "",
            outcome: nextOutcomes[idx] ?? "correct",
          })),
          evaluation: hadRevealed ? 'incorrect' : 'correct',
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

    const maxSubTries = isCheck ? 1 : 2
    if (nextSubAttempts >= maxSubTries) {
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
        recordWorkHistoryVersion({
          lesson,
          page: msPage,
          pageIndex,
          isCheck,
          answerSummary: msPage.steps.map((s, idx) => `${s.label}: ${nextInputs[idx] ?? ''}`).join('  →  '),
          subSteps: msPage.steps.map((s, idx) => ({
            label: s.label,
            value: nextInputs[idx] ?? '',
            outcome: nextOutcomes[idx] ?? 'revealed',
          })),
          evaluation: 'incorrect',
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

  const handleCheck = (allowRetrySubmit = false) => {
    const canSubmitNow =
      canCheck ||
      (allowRetrySubmit &&
        state.evaluation === 'incorrect-retry' &&
        (page.kind === 'math-input' || page.kind === 'multi-step') &&
        state.mathValue.trim().length > 0)
    if (!canSubmitNow) return
    if (page.kind === 'multi-step') {
      handleMultiStepCheck(page)
      return
    }
    const retryable = !isCheck
    let ok = false
    let feedback: string | undefined

    if (page.kind === 'worked' && page.checkChoice) {
      const picked = state.selectedIds[0]
      ok = picked === page.checkChoice.correctId
      if (!ok) {
        feedback =
          page.checkChoice.options.find(o => o.id === picked)?.hint ??
          'Compare your worksheet steps carefully and try another option.'
      }
    } else if (page.kind === 'choice' || page.kind === 'read-plan') {
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
      if (!ok && page.nudge && state.attempts + 1 >= 1 && feedback && !feedback.includes(page.nudge)) {
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
    const summaryText =
      page.kind === 'math-input'
        ? state.mathValue.trim()
        : page.kind === 'worked' && page.checkChoice ? state.selectedIds.map(id => page.checkChoice!.options.find(o => o.id === id)?.label ?? id).join(', ') : page.kind === 'choice' || page.kind === 'multi-choice' || page.kind === 'read-plan'
          ? state.selectedIds.map(id => page.options.find(o => o.id === id)?.label ?? id).join(", ")
          : page.kind === 'plan-order'
            ? state.planChosen.map((id, idx) => `${idx + 1}. ${page.pool.find(b => b.id === id)?.text ?? id}`).join(" · ")
            : "Completed"
    recordWorkHistoryVersion({
      lesson,
      page,
      pageIndex,
      isCheck,
      answerSummary: summaryText,
      evaluation: ok ? 'correct' : nextEval === 'incorrect-retry' ? 'retry' : 'incorrect',
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
      selectedIds: page.kind === 'choice' || page.kind === 'read-plan' || page.kind === 'worked' ? [] : state.selectedIds,
    })
  }

  const handleContinue = () => {
    onSound?.('continue')
    if (pageIndex >= allPages.length - 1) {
      const gradedPages =
        lesson.checks.length > 0
          ? lesson.checks
          : lesson.pages.filter(p => isInteractivePage(p, false))
      const checkCorrect = gradedPages.filter(p => states[p.id]?.evaluation === 'correct').length
      const totalChecks = gradedPages.length
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
    if (finished || explanationOpen || walkthroughOpen || formulasOpen || helpMenuOpen) return
    const onKey = (e: KeyboardEvent) => {
      if (e.metaKey || e.ctrlKey || e.altKey) return
      const target = e.target as HTMLElement | null
      if (target?.closest('[data-pen-workspace]')) return
      if (document.querySelector('[role="dialog"], [role="menu"]')) return
      if (e.key === 'Enter') {
        const isInteractiveEl =
          target instanceof HTMLInputElement ||
          target instanceof HTMLTextAreaElement ||
          target?.isContentEditable ||
          Boolean(target?.closest('button, a, [role="button"], select'))
        if (isInteractiveEl) return
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
  }, [finished, explanationOpen, walkthroughOpen, formulasOpen, helpMenuOpen, isProblem, state, canCheck, pageIndex])

  const handleSplitDrag = (clientPos: number) => {
    const rect = splitBoundsRef.current ?? workspaceRef.current?.getBoundingClientRect()
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
    const gradedPages =
      lesson.checks.length > 0
        ? lesson.checks
        : lesson.pages.filter(p => isInteractivePage(p, false))
    const checkCorrect = gradedPages.filter(p => states[p.id]?.evaluation === 'correct').length
    const totalChecks = gradedPages.length

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

  const walkthroughInitialStep =
    page.kind === 'worked'
      ? workedStepIndex
      : page.kind === 'multi-step'
        ? Math.min(state.activeSubStep, page.steps.length - 1)
        : 0

  // Left-pane slot architecture in Pen Mode: floats by default so question stays visible, or docks if user clicks Dock!
  const leftSlot: 'problem' | 'compare' | 'playbook' | 'walkthrough' =
    penOpen && !walkthroughFloating && walkthroughOpen && walkthroughSpec
      ? 'walkthrough'
      : penOpen && explanationOpen && activeExplanation
        ? 'compare'
        : penOpen && !playbookFloating && formulasOpen
          ? 'playbook'
          : 'problem'

  const workspaceStyle = penOpen
    ? ({ '--pen-split': `${Math.round(splitRatio * 1000) / 10}%` } as React.CSSProperties)
    : undefined

  const lessonSema: { state: SemaState; expression: SemaExpressionName } = (() => {
    if (state.evaluation === 'correct') {
      return { state: 'checkbox', expression: 'proud' }
    }
    if (state.evaluation === 'incorrect-retry') {
      return state.attempts >= 2
        ? { state: 'notify', expression: 'confused' }
        : { state: 'idle', expression: 'confused' }
    }
    if (state.evaluation === 'incorrect') {
      return { state: 'idle', expression: 'sad' }
    }
    if (
      isProblem &&
      state.evaluation === 'unsubmitted' &&
      (state.mathValue.trim().length > 0 || state.subInputs.some(v => v.trim().length > 0))
    ) {
      return { state: 'idle', expression: 'attentive' }
    }
    if (page.kind === 'worked' || page.kind === 'explore') {
      return { state: 'idle', expression: 'curious' }
    }
    return { state: 'idle', expression: semaExpression }
  })()

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
          <div className="lesson-sema-buddy">
            <Sema
              size={26}
              interactive
              shape={semaShape}
              tail={semaTail}
              state={lessonSema.state}
              expression={lessonSema.expression}
              ariaLabel="Sema lesson companion"
              onPoke={() => onSound?.('lightweight-choice')}
            />
          </div>
          {(walkthroughSpec || activeExplanation) && (
            <div ref={helpMenuRef} className="lesson-help-wrap">
              <button
                type="button"
                className="lesson-nav-icon-btn lesson-walkthrough-nav-btn"
                data-active={helpMenuOpen || guidedHintsOpen || walkthroughOpen || undefined}
                onClick={() => {
                  setHelpMenuOpen(v => !v)
                  onSound?.('lightweight-choice')
                }}
                aria-label="Help options: guided hints or full walkthrough"
                aria-haspopup="menu"
                aria-expanded={helpMenuOpen}
                title="Help & Walkthrough (?)"
              >
                <svg width="19" height="19" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.1" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                  <circle cx="12" cy="12" r="9.5" />
                  <path d="M9.4 9.3a2.7 2.7 0 0 1 5.1 1.1c0 1.9-2.6 2.3-2.6 3.9" />
                  <circle cx="12" cy="17.2" r="0.9" fill="currentColor" stroke="none" />
                </svg>
              </button>
              {helpMenuOpen && (
                <div className="lesson-help-menu" role="menu" aria-label="Help mode">
                  <button
                    type="button"
                    role="menuitem"
                    className="lesson-help-item is-primary"
                    onClick={() => {
                      setHelpMenuOpen(false)
                      setGuidedHintsOpen(v => !v)
                      onSound?.('lightweight-choice')
                    }}
                  >
                    <span className="lesson-help-item-head">
                      <strong>{guidedHintsOpen ? 'Hide guided hints' : 'Guided hints'}</strong>
                      <span className="lesson-help-rec-pill">Recommended</span>
                    </span>
                    <span>Step-by-step setup cues and formulas without giving away the answer.</span>
                  </button>
                  {(walkthroughSpec || activeExplanation) && (
                    <button
                      type="button"
                      role="menuitem"
                      className="lesson-help-item"
                      onClick={() => {
                        setHelpMenuOpen(false)
                        if (penOpen && formulasOpen) onCloseFormulas()
                        if (walkthroughSpec) {
                          if (explanationOpen) setExplanationOpen(false)
                          setWalkthroughOpen(true)
                        } else if (activeExplanation) {
                          setExplanationOpen(true)
                        }
                        setSeenExplain(prev => ({ ...prev, [page.id]: true }))
                        onSound?.('lightweight-choice')
                      }}
                    >
                      <strong>
                        {walkthroughSpec ? 'Video walkthrough' : 'View full explanation'}
                      </strong>
                      <span>
                        {walkthroughSpec
                          ? 'Watch Sema walk through the complete worked solution.'
                          : 'Read the complete step-by-step worked solution.'}
                      </span>
                    </button>
                  )}
                </div>
              )}
            </div>
          )}
          <button
            type="button"
            className="lesson-nav-icon-btn"
            data-active={formulasOpen || undefined}
            onClick={() => {
              if (penOpen && explanationOpen) setExplanationOpen(false)
              if (penOpen && !walkthroughFloating && walkthroughOpen) setWalkthroughOpen(false)
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
                  floating={false}
                  onToggleFloat={() => setPlaybookFloating(true)}
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
                  drawMode={drawMode}
                  semaShape={semaShape}
          semaTail={semaTail}
                  inline
                  floating={false}
                  initialStepIndex={walkthroughInitialStep}
                  onToggleFloat={() => setWalkthroughFloating(true)}
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
                  canContinue={state.evaluation === 'correct' || state.evaluation === 'incorrect'}
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
                  data-page-role={pageRole}
                  data-is-check={isCheck}
                >
                  <div className="lesson-content">
                    <div className="lesson-kicker-line">
                      {page.kind === 'worked'
                        ? lesson.id.startsWith('rescue-')
                          ? 'Catch-Up Worked Example'
                          : `Level ${lesson.level} Worked Example`
                        : `${lesson.id.startsWith('rescue-') ? 'Catch-Up' : `Level ${lesson.level}`} · ${
                            isCheck
                              ? 'Mastery Check'
                              : page.kind === 'explore'
                                ? 'Interactive Lab'
                                : penAllowed
                                  ? 'Lesson · Notebook'
                                  : 'Lesson'
                          }`}
                    </div>
                    {returnToLessonLabel && onReturnToLesson && (
                      <button
                        type="button"
                        className="lesson-return-crumb"
                        onClick={onReturnToLesson}
                      >
                        ← Back to {returnToLessonLabel}
                      </button>
                    )}
                    <div className="lesson-copy">
                      <RichText text={page.prompt} />
                    </div>

                    {guidedHintsOpen && (() => {
                      const guide = buildGuidedHints(page, walkthroughSpec)
                      return (
                        <div className="lesson-guided-hints-card" role="region" aria-label="Guided hints">
                          <div className="lesson-guided-hints-head">
                            <span>{guide.title}</span>
                            <button
                              type="button"
                              className="lesson-guided-hints-close"
                              onClick={() => setGuidedHintsOpen(false)}
                            >
                              Hide
                            </button>
                          </div>
                          <ul className="lesson-guided-hints-list">
                            {guide.bullets.map((b, i) => (
                              <li key={i}>
                                <MathText text={b} />
                              </li>
                            ))}
                          </ul>
                          <p className="lesson-guided-hints-tip">
                            <MathText text={guide.tip} />
                          </p>
                          <div className="lesson-guided-hints-actions">
                            <button
                              type="button"
                              className="lesson-guided-hints-more"
                              onClick={() => {
                                setGuidedHintsOpen(false)
                                onToggleFormulas()
                              }}
                            >
                              Open Formula Playbook
                            </button>
                            {(walkthroughSpec || activeExplanation) && (
                              <button
                                type="button"
                                className="lesson-guided-hints-more"
                                onClick={() => {
                                  setGuidedHintsOpen(false)
                                  if (penOpen && formulasOpen) onCloseFormulas()
                                  if (walkthroughSpec) setWalkthroughOpen(true)
                                  else setExplanationOpen(true)
                                }}
                              >
                                Still stuck? Show full solution
                              </button>
                            )}
                          </div>
                        </div>
                      )
                    })()}

                    {page.kind === 'explore' && (
                      <CompactExploration kind={page.exploration} onSound={onSound} />
                    )}

                    {page.kind === 'worked' && (
                      <div className="br-problem-body">
                        <BrilliantWorkedCard
                          key={page.id}
                          page={page}
                          penMode={penOpen}
                          onStepChange={setWorkedStepIndex}
                        />
                        {penOpen && page.checkChoice && workedStepIndex < page.steps.length - 1 && (
                          <div className="br-worked-step-note">
                            Step {workedStepIndex + 1} of {page.steps.length}: work this step on your sheet, then move to the final step to check your equation.
                          </div>
                        )}
                        {penOpen && page.checkChoice && workedStepIndex >= page.steps.length - 1 && (
                          <div className="br-worked-mc-block">
                            <div className="br-worked-mc-label">
                              {page.checkChoice.prompt ?? 'Select the answer you got on your worksheet:'}
                            </div>
                            <BrilliantChoice
                              options={page.checkChoice.options}
                              selected={state.selectedIds}
                              evaluation={state.evaluation}
                              correctIds={[page.checkChoice.correctId]}
                              active={!explanationOpen && !walkthroughOpen && !formulasOpen}
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
                      </div>
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
                          active={!explanationOpen && !walkthroughOpen && !formulasOpen}
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
                          active={!explanationOpen && !walkthroughOpen && !formulasOpen}
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
                          active={!explanationOpen && !walkthroughOpen && !formulasOpen}
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
                            else if (state.evaluation === 'incorrect-retry') handleRetry()
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
                              active={!explanationOpen && !walkthroughOpen && !formulasOpen}
                              onChange={val =>
                                patchState(page.id, {
                                  mathValue: val,
                                  subJustSolved: false,
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
                                else if (state.evaluation === 'incorrect-retry') handleRetry()
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
                          active={!explanationOpen && !walkthroughOpen && !formulasOpen}
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
                                aria-current={i === state.readStep ? 'step' : undefined}
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
                            active={!explanationOpen && !walkthroughOpen && !formulasOpen}
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
                    {isProblem && state.evaluation !== 'unsubmitted' && (walkthroughSpec || activeExplanation) && (
                      <button
                        type="button"
                        className="lesson-draw-why-btn"
                        onClick={() => {
                          if (penOpen && formulasOpen) onCloseFormulas()
                          setSeenExplain(prev => ({ ...prev, [page.id]: true }))
                          if (walkthroughSpec) setWalkthroughOpen(true)
                          else setExplanationOpen(true)
                        }}
                      >
                        {walkthroughSpec ? 'Walk me through' : 'Why?'}
                      </button>
                    )}
                    <CheckmarkGate
                      key={`chk-${page.id}-${state.activeSubStep}`}
                      label={
                        isProblem && state.evaluation === 'unsubmitted'
                          ? 'Draw a checkmark anywhere to check'
                          : state.evaluation === 'incorrect-retry'
                            ? 'Draw a checkmark anywhere to try again'
                            : pageIndex === allPages.length - 1
                              ? 'Draw a checkmark anywhere to finish'
                              : 'Draw a checkmark anywhere to continue'
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
                      enableScreenGesture={!walkthroughOpen && !explanationOpen && !formulasOpen && !helpMenuOpen}
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
                    {isProblem &&
                      (state.evaluation === 'unsubmitted' || state.evaluation === 'incorrect-retry') && (
                        <button
                          type="button"
                          className="lesson-skip-link"
                          onClick={() => {
                            onSound?.('lightweight-choice')
                            handleContinue()
                          }}
                        >
                          Skip
                        </button>
                      )}
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
                    onSkip={() => {
                      onSound?.('lightweight-choice')
                      handleContinue()
                    }}
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
              onDragStart={() => {
                splitBoundsRef.current = workspaceRef.current?.getBoundingClientRect() ?? null
                setIsResizing(true)
              }}
              onDragEnd={() => {
                splitBoundsRef.current = null
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
                  isCorrect={state.evaluation === 'correct'}
                  penControlsCollapsed={penControlsCollapsed}
                  showStepPlan={showStepPlan}
                  onToggleShowStepPlan={onToggleShowStepPlan}
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

      {/* Walk me through renders as a draggable floating window by default (or docks to left pane in Pen Mode when toggled) */}
      {walkthroughSpec && (!penOpen || walkthroughFloating) && (
        <WalkthroughModal
          spec={walkthroughSpec}
          open={walkthroughOpen}
          soundOn={soundOn}
          voiceOn={voiceOn}
          drawMode={drawMode}
          semaShape={semaShape}
          semaTail={semaTail}
          initialStepIndex={walkthroughInitialStep}
          onToggleFloat={penOpen ? () => setWalkthroughFloating(false) : undefined}
          onToggleVoice={() => onToggleVoice?.()}
          onClose={() => setWalkthroughOpen(false)}
          onLaunchRescue={rescueId => {
            setWalkthroughOpen(false)
            onLaunchRescue?.(rescueId)
          }}
        />
      )}

      {penOpen && playbookFloating && formulasOpen && (
        <FormulaSheetModal
          open={formulasOpen}
          onToggleFloat={() => setPlaybookFloating(false)}
          onClose={onCloseFormulas}
        />
      )}

      {/* In Normal Mode, Why? renders as Brilliant modal; in Pen Mode, it swaps the left pane */}
      {activeExplanation && !penOpen && (
        <GeoExplanationModal
          explanation={activeExplanation}
          open={explanationOpen}
          isLast={pageIndex === allPages.length - 1}
          canContinue={state.evaluation === 'correct' || state.evaluation === 'incorrect'}
          onClose={() => setExplanationOpen(false)}
          onContinue={handleContinue}
        />
      )}
    </main>
  )
}
