import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { motion } from 'framer-motion'
import { ArrowDown, BookOpenText, ClipboardCheck, Layers, RotateCcw, SlidersHorizontal } from 'lucide-react'
import '../lessons/completion.css'
import '../mpm2d/mpm2dBrilliant.css'
import { playLessonSound, preloadLessonSounds, type LessonSound } from '../services/lessonSounds'
import { COURSE_LEVELS, type GeoLesson, type GeoLessonPage } from '../mpm2d/pageTypes'
import { UNIT2_LESSONS } from '../mpm2d/data/unit2Course'
import { CATCHUP_BY_ID, CATCHUP_LESSONS } from '../mpm2d/data/catchupCourses'
import { GeoLessonPlayer } from '../mpm2d/GeoLessonPlayer'
import { FormulaSheetModal } from '../mpm2d/components/FormulaSheetModal'
import { DivergingLevelPath, type PathLessonStat } from '../mpm2d/components/DivergingLevelPath'
import type { SyntaxPrefs } from '../mpm2d/storage'
import { usePluginActive } from '../core/registry'
import { useHostSlots } from '../core/hostSlots'
import { assetUrl } from '../mpm2d/assetUrl'

type SavedProgress = {
  completed: Record<string, { correct: number; total: number }>
  missedCheckIds?: string[]
}

const PROGRESS_KEY = 'mpm2d-brilliant-progress-v1'
const RESUME_KEY = 'mpm2d-resume-v1'
const ALL_LESSONS: GeoLesson[] = [...UNIT2_LESSONS, ...CATCHUP_LESSONS]

function loadProgress(): SavedProgress {
  try {
    const raw = localStorage.getItem(PROGRESS_KEY)
    if (raw) {
      const parsed = JSON.parse(raw) as SavedProgress
      if (parsed && parsed.completed && typeof parsed.completed === 'object' && !Array.isArray(parsed.completed)) {
        return {
          completed: parsed.completed,
          missedCheckIds: Array.isArray(parsed.missedCheckIds) ? parsed.missedCheckIds : [],
        }
      }
    }
  } catch {
    // ignore storage errors
  }
  return { completed: {}, missedCheckIds: [] }
}

function loadResumeMap(): Record<string, { pageIndex: number; pageId?: string; furthest: number }> {
  try {
    const raw = localStorage.getItem(RESUME_KEY)
    const saved = raw ? JSON.parse(raw) : null
    if (saved && typeof saved === 'object' && !Array.isArray(saved)) return saved
  } catch {
    // ignore
  }
  return {}
}

function clearLessonResume(lessonId: string) {
  try {
    const raw = localStorage.getItem(RESUME_KEY)
    if (!raw) return
    const map = JSON.parse(raw) as Record<string, { pageIndex: number; furthest: number }>
    delete map[lessonId]
    localStorage.setItem(RESUME_KEY, JSON.stringify(map))
  } catch {
    // ignore
  }
}

function masteryTier(stat?: { correct: number; total: number }): 'none' | 'mastered' | 'partial' | 'retry' {
  if (!stat) return 'none'
  if (stat.total === 0 || stat.correct >= stat.total) return 'mastered'
  if (stat.correct > 0) return 'partial'
  return 'retry'
}

function toPathTier(stat?: { correct: number; total: number }): PathLessonStat['tier'] {
  if (!stat) return 'none'
  if (stat.total === 0 || stat.correct >= stat.total) return 'mastered'
  if (stat.correct > 0) return 'good'
  return 'attempted'
}

export interface Mpm2dCourseStageProps {
  initialLessonId?: string | null
  theme: 'light' | 'dark'
  soundOn: boolean
  prefs: SyntaxPrefs
  onPatchPrefs: (patch: Partial<SyntaxPrefs>) => void
  onLessonRouteChange: (lessonId: string | null) => void
  onProgressChanged: () => void
}

export default function Mpm2dCourseStage({
  initialLessonId = null,
  theme,
  soundOn,
  prefs,
  onPatchPrefs,
  onLessonRouteChange,
  onProgressChanged,
}: Mpm2dCourseStageProps) {
  const { setContribution, clearContribution } = useHostSlots()
  const playbookPluginOn = usePluginActive('formula-playbook')
  const floatingWindowsPluginOn = usePluginActive('floating-windows')

  const [progress, setProgress] = useState<SavedProgress>(loadProgress)
  const [resumeMap, setResumeMap] = useState(loadResumeMap)
  const [activeLessonId, setActiveLessonId] = useState<string | null>(() =>
    initialLessonId && ALL_LESSONS.some(l => l.id === initialLessonId) ? initialLessonId : null,
  )
  const [returnLessonId, setReturnLessonId] = useState<string | null>(null)
  const [virtualReviewLesson, setVirtualReviewLesson] = useState<GeoLesson | null>(null)
  const [selectedId, setSelectedId] = useState<string>(() => {
    if (initialLessonId && ALL_LESSONS.some(l => l.id === initialLessonId)) return initialLessonId
    const saved = loadProgress()
    const firstOpen = UNIT2_LESSONS.find(l => !saved.completed[l.id])
    return firstOpen?.id ?? UNIT2_LESSONS[0]!.id
  })
  const [formulasOpen, setFormulasOpen] = useState(false)
  const [penModeActive, setPenModeActive] = useState(false)
  const [popoverOpenId, setPopoverOpenId] = useState<string | null>(null)
  const [filterOpen, setFilterOpen] = useState(false)
  const [activeCourseSection, setActiveCourseSection] = useState<'unit2' | 'conference'>('unit2')
  const [dockVisible, setDockVisible] = useState(true)
  const [dockBounceNonce, setDockBounceNonce] = useState(0)
  const [dockCardHeight, setDockCardHeight] = useState(140)
  const [outlineAtBottom, setOutlineAtBottom] = useState(false)
  const [fitnessOpen, setFitnessOpen] = useState(false)
  const [hoveredRing, setHoveredRing] = useState<'course' | 'mastery' | 'lesson' | null>(null)

  const outlineScrollRef = useRef<HTMLElement>(null)
  const nodeRefs = useRef<Map<string, HTMLButtonElement>>(new Map())
  const levelSectionRefs = useRef<Map<number, HTMLElement>>(new Map())
  const dockCardRef = useRef<HTMLDivElement>(null)
  const filterWrapRef = useRef<HTMLDivElement>(null)
  const fitnessDockRef = useRef<HTMLDivElement>(null)

  // Preload lesson sound effects only once the learner actually opens this course
  useEffect(() => {
    preloadLessonSounds()
  }, [])

  // Sync external route changes (e.g. browser Back/Forward)
  useEffect(() => {
    if (initialLessonId && ALL_LESSONS.some(l => l.id === initialLessonId)) {
      setVirtualReviewLesson(null)
      setActiveLessonId(initialLessonId)
      setSelectedId(initialLessonId)
    } else if (!initialLessonId) {
      setVirtualReviewLesson(null)
      setActiveLessonId(null)
      setResumeMap(loadResumeMap())
    }
  }, [initialLessonId])

  // Contribute MPM2D course tabs (Unit 2 | Conference | Playbook) to Core App Shell header
  useEffect(() => {
    const scrollToTop = () => {
      setFormulasOpen(false)
      setActiveCourseSection('unit2')
      outlineScrollRef.current?.scrollTo({ top: 0, behavior: 'smooth' })
    }
    const scrollToConference = () => {
      setFormulasOpen(false)
      setActiveCourseSection('conference')
      const lvl4 = levelSectionRefs.current.get(4)
      const scroller = outlineScrollRef.current
      if (lvl4 && scroller) {
        const scrollerRect = scroller.getBoundingClientRect()
        const targetTop = lvl4.getBoundingClientRect().top - scrollerRect.top + scroller.scrollTop - 24
        scroller.scrollTo({ top: Math.max(0, targetTop), behavior: 'smooth' })
      }
    }

    const tabs = [
      {
        id: 'mpm2d-unit2',
        label: 'Unit 2',
        icon: <Layers size={15} strokeWidth={1.9} className="nav-svg-icon" aria-hidden="true" />,
        active: !formulasOpen && activeCourseSection === 'unit2',
        onClick: scrollToTop,
      },
      {
        id: 'mpm2d-conference',
        label: 'Conference',
        icon: <ClipboardCheck size={15} strokeWidth={1.9} className="nav-svg-icon" aria-hidden="true" />,
        active: !formulasOpen && activeCourseSection === 'conference',
        onClick: scrollToConference,
      },
    ]

    if (playbookPluginOn) {
      tabs.push({
        id: 'mpm2d-playbook',
        label: 'Playbook',
        icon: <BookOpenText size={15} strokeWidth={1.9} className="nav-svg-icon" aria-hidden="true" />,
        active: formulasOpen,
        onClick: () => setFormulasOpen(v => !v),
      })
    }

    setContribution({
      courseNavTabs: tabs,
      menuActions: playbookPluginOn
        ? [
            {
              id: 'mpm2d-playbook',
              label: 'Playbook & Formulas',
              onSelect: () => setFormulasOpen(true),
            },
          ]
        : [],
    })
    return () => clearContribution()
  }, [playbookPluginOn, formulasOpen, activeCourseSection, setContribution, clearContribution])

  // Course-scoped 'F' hotkey for Playbook
  useEffect(() => {
    if (!playbookPluginOn) return
    const onKeyDown = (e: KeyboardEvent) => {
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
      if (el?.closest('[data-pen-workspace]')) return
      if (document.querySelector('[role="dialog"]:not(#syntax-playbook-winbox), [role="menu"]')) return
      if (e.key === 'f' || e.key === 'F') {
        e.preventDefault()
        setFormulasOpen(v => !v)
      }
    }
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [playbookPluginOn])

  useEffect(() => {
    if (!filterOpen) return
    const onDown = (e: PointerEvent) => {
      if (filterWrapRef.current && !filterWrapRef.current.contains(e.target as Node)) {
        setFilterOpen(false)
      }
    }
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.preventDefault()
        setFilterOpen(false)
      }
    }
    window.addEventListener('pointerdown', onDown)
    window.addEventListener('keydown', onKey)
    return () => {
      window.removeEventListener('pointerdown', onDown)
      window.removeEventListener('keydown', onKey)
    }
  }, [filterOpen])

  useEffect(() => {
    if (!fitnessOpen) return
    const onDown = (e: PointerEvent) => {
      if (fitnessDockRef.current && !fitnessDockRef.current.contains(e.target as Node)) {
        setFitnessOpen(false)
        setHoveredRing(null)
      }
    }
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setFitnessOpen(false)
        setHoveredRing(null)
      }
    }
    window.addEventListener('pointerdown', onDown)
    window.addEventListener('keydown', onKey)
    return () => {
      window.removeEventListener('pointerdown', onDown)
      window.removeEventListener('keydown', onKey)
    }
  }, [fitnessOpen])

  const allChecksById = useMemo(() => {
    const map = new Map<string, GeoLessonPage>()
    for (const l of UNIT2_LESSONS) {
      for (const ch of l.checks) {
        map.set(ch.id, ch)
      }
    }
    return map
  }, [])

  const validMissedIds = useMemo(
    () => (progress.missedCheckIds ?? []).filter(id => allChecksById.has(id)),
    [progress.missedCheckIds, allChecksById],
  )

  const activeLesson = useMemo<GeoLesson | undefined>(
    () =>
      virtualReviewLesson ??
      (activeLessonId ? ALL_LESSONS.find(l => l.id === activeLessonId) : undefined),
    [virtualReviewLesson, activeLessonId],
  )

  const totalExercises = useMemo(
    () => UNIT2_LESSONS.reduce((acc, l) => acc + l.pages.length + l.checks.length, 0),
    [],
  )

  const masteredCount = useMemo(
    () => UNIT2_LESSONS.filter(l => masteryTier(progress.completed[l.id]) === 'mastered').length,
    [progress],
  )

  const completedLessonCount = useMemo(
    () =>
      UNIT2_LESSONS.filter(l => {
        const t = toPathTier(progress.completed[l.id])
        return t === 'mastered' || t === 'good'
      }).length,
    [progress],
  )

  const coursePct = useMemo(() => {
    if (UNIT2_LESSONS.length === 0) return 0
    let units = 0
    for (const l of UNIT2_LESSONS) {
      const t = toPathTier(progress.completed[l.id])
      if (t === 'mastered' || t === 'good') {
        units += 1
      } else {
        const res = resumeMap[l.id]
        const total = l.pages.length + l.checks.length
        if (res && total > 0) {
          const allPages = [...l.pages, ...l.checks]
          const foundIdx = res.pageId ? allPages.findIndex(p => p.id === res.pageId) : -1
          const pageIdx = foundIdx >= 0 ? foundIdx : (res.pageIndex ?? 0)
          units += Math.min(0.95, (pageIdx + 1) / total)
        }
      }
    }
    return Math.round((units / UNIT2_LESSONS.length) * 100)
  }, [progress, resumeMap])

  const masteryPct = useMemo(
    () => Math.round((masteredCount / Math.max(1, UNIT2_LESSONS.length)) * 100),
    [masteredCount],
  )

  const resolvedSelectedLesson = useMemo(() => {
    const candidate = ALL_LESSONS.find(l => l.id === selectedId)
    const visibleCandidate =
      candidate && (!CATCHUP_BY_ID.has(candidate.id) || prefs.showCatchupPaths)
        ? candidate
        : undefined
    return (
      visibleCandidate ??
      UNIT2_LESSONS.find(l => !progress.completed[l.id]) ??
      UNIT2_LESSONS[0]!
    )
  }, [selectedId, prefs.showCatchupPaths, progress.completed])

  // Scroll tracking on outline
  useEffect(() => {
    if (activeLesson) return
    const scroller = outlineScrollRef.current
    if (!scroller) return
    let raf = 0
    const sync = () => {
      raf = 0
      const atBot = scroller.scrollTop + scroller.clientHeight >= scroller.scrollHeight - 64
      setOutlineAtBottom(prev => (prev === atBot ? prev : atBot))
      const lvl4 = levelSectionRefs.current.get(4)
      if (lvl4) {
        const scrollerTop = scroller.getBoundingClientRect().top
        const inConf = lvl4.getBoundingClientRect().top - scrollerTop <= 180
        const nextSection: 'unit2' | 'conference' = inConf ? 'conference' : 'unit2'
        setActiveCourseSection(prev => (prev === nextSection ? prev : nextSection))
      }
    }
    const onScroll = () => {
      if (!raf) raf = requestAnimationFrame(sync)
    }
    sync()
    scroller.addEventListener('scroll', onScroll, { passive: true })
    window.addEventListener('resize', onScroll, { passive: true })
    return () => {
      if (raf) cancelAnimationFrame(raf)
      scroller.removeEventListener('scroll', onScroll)
      window.removeEventListener('resize', onScroll)
    }
  }, [activeLesson, prefs.showCatchupPaths])

  useEffect(() => {
    if (activeLesson) return
    const scroller = outlineScrollRef.current
    const nodeEl = nodeRefs.current.get(resolvedSelectedLesson.id)
    if (!scroller || !nodeEl || typeof IntersectionObserver === 'undefined') {
      setDockVisible(true)
      return
    }
    const observer = new IntersectionObserver(
      entries => {
        const entry = entries[0]
        if (!entry) return
        setDockVisible(entry.isIntersecting)
      },
      {
        root: scroller,
        rootMargin: '-110px 0px -100px 0px',
        threshold: [0.25, 0.75],
      },
    )
    observer.observe(nodeEl)
    return () => observer.disconnect()
  }, [resolvedSelectedLesson.id, activeLesson, prefs.showCatchupPaths])

  useEffect(() => {
    if (activeLesson) return
    const el = dockCardRef.current
    if (!el) return
    const update = () => {
      const h = Math.round(el.getBoundingClientRect().height)
      if (h > 40) setDockCardHeight(h)
    }
    update()
    if (typeof ResizeObserver === 'undefined') return
    const ro = new ResizeObserver(update)
    ro.observe(el)
    return () => ro.disconnect()
  }, [resolvedSelectedLesson.id, activeLesson])

  const emitSound = useCallback(
    (cue: LessonSound) => {
      if (soundOn) playLessonSound(cue)
    },
    [soundOn],
  )

  function openLesson(id: string, returnTo?: string | null) {
    setPopoverOpenId(null)
    setVirtualReviewLesson(null)
    setReturnLessonId(returnTo ?? null)
    setActiveLessonId(id)
    if (!CATCHUP_BY_ID.has(id)) {
      setSelectedId(id)
    }
    onLessonRouteChange(id)
  }

  function openMissedReview() {
    const checks = validMissedIds
      .map(id => allChecksById.get(id))
      .filter((p): p is GeoLessonPage => Boolean(p))
    if (checks.length === 0) return
    setPopoverOpenId(null)
    setReturnLessonId(null)
    setVirtualReviewLesson({
      id: 'virtual-missed-checks',
      level: 3,
      number: 99,
      title: 'Missed Checks Review',
      shortTitle: 'Missed Checks',
      subtitle: 'Re-try every check you missed across Unit 2',
      isReview: true,
      completionColor: '#f59e0b',
      completionRiveColor: 0,
      pages: [],
      checks,
    })
  }

  function closeLesson() {
    if (returnLessonId) {
      const back = returnLessonId
      setReturnLessonId(null)
      openLesson(back, null)
      return
    }
    setVirtualReviewLesson(null)
    setActiveLessonId(null)
    setResumeMap(loadResumeMap())
    onLessonRouteChange(null)
    onProgressChanged()
  }

  function handleComplete(
    lessonId: string,
    correct: number,
    total: number,
    missedCheckIds: string[],
  ) {
    const lessonObj =
      lessonId === 'virtual-missed-checks'
        ? virtualReviewLesson
        : ALL_LESSONS.find(l => l.id === lessonId)

    const lessonCheckIds = new Set(lessonObj?.checks.map(c => c.id) ?? [])
    const prevMissed = progress.missedCheckIds ?? []
    const keptMissed = prevMissed.filter(id => !lessonCheckIds.has(id))
    const mergedMissed = Array.from(new Set([...keptMissed, ...missedCheckIds]))

    const next: SavedProgress = {
      completed:
        lessonId === 'virtual-missed-checks'
          ? progress.completed
          : {
              ...progress.completed,
              [lessonId]: { correct, total },
            },
      missedCheckIds: mergedMissed,
    }
    setProgress(next)
    setResumeMap(loadResumeMap())
    try {
      localStorage.setItem(PROGRESS_KEY, JSON.stringify(next))
    } catch {
      // ignore
    }
    onProgressChanged()

    if (lessonId !== 'virtual-missed-checks' && !CATCHUP_BY_ID.has(lessonId)) {
      const idx = UNIT2_LESSONS.findIndex(l => l.id === lessonId)
      if (idx >= 0 && idx < UNIT2_LESSONS.length - 1) {
        setSelectedId(UNIT2_LESSONS[idx + 1]!.id)
      }
    }
  }

  function selectNodeById(id: string) {
    if (id === selectedId) {
      setDockBounceNonce(n => n + 1)
    }
    setSelectedId(id)
    setDockVisible(true)
  }

  const getPathStat = useCallback(
    (id: string): PathLessonStat | undefined => {
      const st = progress.completed[id]
      if (!st) return undefined
      return { correct: st.correct, total: st.total, tier: toPathTier(st) }
    },
    [progress.completed],
  )

  const hasPathResume = useCallback((id: string) => Boolean(resumeMap[id]), [resumeMap])

  const registerNodeRef = useCallback((id: string, el: HTMLButtonElement | null) => {
    if (el) nodeRefs.current.set(id, el)
    else nodeRefs.current.delete(id)
  }, [])

  const activeLevels = useMemo(
    () =>
      COURSE_LEVELS.filter(lvl => UNIT2_LESSONS.some(l => l.level === lvl.level)).map(lvl => ({
        lvl,
        lessons: UNIT2_LESSONS.filter(l => l.level === lvl.level),
        catchups: CATCHUP_LESSONS.filter(c => c.level === lvl.level),
      })),
    [],
  )

  const returnLessonObj = returnLessonId
    ? UNIT2_LESSONS.find(l => l.id === returnLessonId)
    : undefined

  if (activeLesson) {
    return (
      <div className="sx-fullscreen-lesson-layer">
        <GeoLessonPlayer
          key={activeLesson.id}
          lesson={activeLesson}
          theme={theme}
          soundOn={soundOn}
          drawMode={false}
          voiceOn={prefs.voiceOn}
          semaShape={prefs.semaShape}
          semaTail={prefs.semaTail}
          semaExpression={prefs.semaExpression}
          penControlsCollapsed={prefs.penControlsCollapsed}
          showStepPlan={prefs.showStepPlan}
          onToggleShowStepPlan={() => onPatchPrefs({ showStepPlan: !prefs.showStepPlan })}
          formulasOpen={formulasOpen}
          returnToLessonLabel={returnLessonObj?.shortTitle}
          onClose={closeLesson}
          onReturnToLesson={returnLessonObj ? () => openLesson(returnLessonObj.id, null) : undefined}
          onLaunchRescue={rescueId => openLesson(rescueId, activeLesson.id)}
          onToggleDrawMode={() => {}}
          onToggleVoice={() => onPatchPrefs({ voiceOn: !prefs.voiceOn })}
          onComplete={handleComplete}
          onToggleFormulas={() => setFormulasOpen(v => !v)}
          onCloseFormulas={() => setFormulasOpen(false)}
          onPenModeChange={setPenModeActive}
          onSound={emitSound}
        />
        {!penModeActive && playbookPluginOn && (
          <FormulaSheetModal
            open={formulasOpen}
            dockable
            floatingEnabled={floatingWindowsPluginOn}
            onClose={() => setFormulasOpen(false)}
          />
        )}
      </div>
    )
  }

  const sel = resolvedSelectedLesson
  const selStat = progress.completed[sel.id]
  const selTier = toPathTier(selStat)
  const selDone = selTier === 'mastered' || selTier === 'good'
  const selNeedsRetry = selTier === 'attempted'
  const selResume = resumeMap[sel.id]
  const selInProgress = Boolean(selResume)
  const selIsCatchup = CATCHUP_BY_ID.has(sel.id)
  const totalPages = sel.pages.length + sel.checks.length
  const savedPage = [...sel.pages, ...sel.checks].findIndex(page => page.id === selResume?.pageId)
  const ctaText = selInProgress ? 'Resume' : selDone ? 'Review' : selNeedsRetry ? 'Retry' : 'Start'
  const resolvedPageIdx = savedPage >= 0 ? savedPage : (selResume?.pageIndex ?? 0)
  const lessonPct = selDone
    ? 100
    : selInProgress && totalPages > 0
      ? Math.min(99, Math.max(8, Math.round(((resolvedPageIdx + 1) / totalPages) * 100)))
      : 0
  const lessonCaption = selInProgress
    ? `Page ${Math.min(resolvedPageIdx + 1, totalPages)} of ${totalPages}`
    : selDone
      ? 'Completed'
      : selNeedsRetry
        ? 'Needs retry'
        : 'Not started'
  const courseCaption = `${completedLessonCount} of ${UNIT2_LESSONS.length} lessons`
  const masteryCaption = `${masteredCount} of ${UNIT2_LESSONS.length} mastered`
  const kickerText = selIsCatchup
    ? 'Catch-up review'
    : `Level ${sel.level} · Lesson ${sel.number}`

  const rOuter = 16
  const rMid = 11.4
  const rInner = 6.8
  const cOuter = 2 * Math.PI * rOuter
  const cMid = 2 * Math.PI * rMid
  const cInner = 2 * Math.PI * rInner
  const oOuter = cOuter * (1 - Math.max(coursePct, 3) / 100)
  const oMid = cMid * (1 - Math.max(masteryPct, 3) / 100)
  const oInner = cInner * (1 - Math.max(lessonPct, 3) / 100)

  const fitnessRows: Array<{
    key: 'course' | 'mastery' | 'lesson'
    label: string
    pct: number
    caption: string
    tone: string
  }> = [
    { key: 'course', label: 'Course', pct: coursePct, caption: courseCaption, tone: 'is-course' },
    { key: 'mastery', label: 'Mastery', pct: masteryPct, caption: masteryCaption, tone: 'is-mastery' },
    {
      key: 'lesson',
      label: 'This lesson',
      pct: lessonPct,
      caption: lessonCaption,
      tone: selIsCatchup ? 'is-catchup' : 'is-lesson',
    },
  ]

  return (
    <>
      <main ref={outlineScrollRef} className="course-outline mpm2d-outline">
        <aside className="course-summary">
          <img
            src={assetUrl('/assets/courses/Coordinate_Geometry-bgclJY.png')}
            width="100"
            height="100"
            alt=""
          />
          <h1>Analytic Geometry</h1>
          <p>MPM2D Unit 2: slopes, midpoints, distances, triangle lines, and geometric proofs.</p>
          <div className="course-counts">
            <span>
              <img src={assetUrl('/assets/courses/lessons.svg')} alt="" />
              {UNIT2_LESSONS.length} Lessons
            </span>
            <span>
              <img src={assetUrl('/assets/courses/exercises.svg')} alt="" />
              {totalExercises} Exercises
            </span>
          </div>

          <div className="course-schedule">
            <div className="course-schedule-row">
              <span className="course-schedule-date">Tue Nov 24</span>
              <span>U2 Conference · Plans only</span>
            </div>
            <div className="course-schedule-row">
              <span className="course-schedule-date">Thu Nov 26</span>
              <span>Unit Assignment · Open notes</span>
            </div>
          </div>

          {validMissedIds.length > 0 && (
            <button type="button" className="course-missed-btn" onClick={openMissedReview}>
              Review {validMissedIds.length} Missed {validMissedIds.length === 1 ? 'Check' : 'Checks'}
            </button>
          )}
        </aside>

        <div className="course-path">
          {activeLevels.map(({ lvl, lessons, catchups: levelCatchups }) => (
            <section
              ref={el => {
                if (el) levelSectionRefs.current.set(lvl.level, el)
                else levelSectionRefs.current.delete(lvl.level)
              }}
              className="outline-level"
              data-level={lvl.level}
              key={lvl.level}
              aria-labelledby={`level-${lvl.level}`}
            >
              <div className={`outline-level-sticky-row${lvl.level === 1 && filterOpen ? ' is-filter-open' : ''}`}>
                <div className="outline-level-heading" id={`level-${lvl.level}`}>
                  <span>{lvl.label}</span>
                  <h2>{lvl.title}</h2>
                </div>

                {lvl.level === 1 && (
                  <div className="level1-filter-anchor" ref={filterWrapRef}>
                    <button
                      type="button"
                      className={`level1-filter-square${prefs.showCatchupPaths ? ' is-active' : ''}`}
                      aria-label="Filter catch-up paths"
                      aria-expanded={filterOpen}
                      title="Filter catch-up paths"
                      onClick={() => {
                        emitSound('lightweight-choice')
                        setFilterOpen(v => !v)
                      }}
                    >
                      <SlidersHorizontal size={18} aria-hidden="true" />
                      <span className="level1-filter-square-label">Filter</span>
                    </button>

                    {filterOpen && (
                      <div className="level1-filter-popover" role="dialog" aria-label="Path filter">
                        <label className="header-filter-toggle">
                          <span className="header-filter-copy">
                            <strong>Show catch-up paths</strong>
                            <span>Interweave Grade 9/10 prerequisite path</span>
                          </span>
                          <input
                            type="checkbox"
                            className="visually-hidden"
                            checked={prefs.showCatchupPaths}
                            onChange={() => {
                              emitSound('toggle-on')
                              onPatchPrefs({ showCatchupPaths: !prefs.showCatchupPaths })
                            }}
                          />
                          <span className={`header-switch${prefs.showCatchupPaths ? ' is-on' : ''}`} />
                        </label>
                      </div>
                    )}
                  </div>
                )}
              </div>

              <DivergingLevelPath
                levelNumber={lvl.level}
                lessons={lessons}
                catchups={levelCatchups}
                showCatchupPaths={prefs.showCatchupPaths}
                selectedId={selectedId}
                popoverOpenId={popoverOpenId}
                getStat={getPathStat}
                hasResume={hasPathResume}
                onSelect={selectNodeById}
                onTogglePopover={id => setPopoverOpenId(id || null)}
                onOpen={id => openLesson(id)}
                registerNodeRef={registerNodeRef}
              />
            </section>
          ))}

          <div className={`outline-footer-anchor${dockVisible ? ' is-dock-visible' : ' is-dock-hidden'}`}>
            <div
              className="outline-floating-row"
              style={{ bottom: dockVisible ? dockCardHeight + 32 : 20 }}
            >
              <button
                className={`outline-scroll-btn${outlineAtBottom ? ' is-at-bottom' : ''}`}
                aria-label={outlineAtBottom ? 'Jump back to top' : 'Jump to bottom of course'}
                title={outlineAtBottom ? 'Back to top' : 'Jump to bottom'}
                type="button"
                onClick={() => {
                  emitSound('lightweight-choice')
                  const scroller = outlineScrollRef.current
                  if (scroller) {
                    scroller.scrollTo({
                      top: outlineAtBottom ? 0 : Math.max(0, scroller.scrollHeight - scroller.clientHeight),
                      behavior: 'smooth',
                    })
                  }
                }}
              >
                <ArrowDown size={18} aria-hidden="true" />
              </button>

              <div
                ref={fitnessDockRef}
                className={`outline-fitness-dock${fitnessOpen ? ' is-open' : ''}${hoveredRing ? ` has-hover-ring is-hover-${hoveredRing}` : ''}`}
                onPointerEnter={() => setFitnessOpen(true)}
                onPointerLeave={() => {
                  setFitnessOpen(false)
                  setHoveredRing(null)
                }}
              >
                <div className="outline-fitness-drawer" aria-hidden={!fitnessOpen}>
                  <div className="outline-fitness-drawer-inner">
                    <div className="outline-fitness-header">
                      <span>Progress rings</span>
                      <span className="outline-fitness-summary-pct">{coursePct}% course</span>
                    </div>
                    <div className="outline-fitness-rows">
                      {fitnessRows.map(row => (
                        <div
                          key={row.key}
                          className={`outline-fitness-row ${row.tone}${hoveredRing === row.key ? ' is-active' : hoveredRing ? ' is-dimmed' : ''}`}
                          tabIndex={fitnessOpen ? 0 : -1}
                          onPointerEnter={() => setHoveredRing(row.key)}
                          onPointerLeave={() => setHoveredRing(null)}
                          onFocus={() => setHoveredRing(row.key)}
                          onBlur={() => setHoveredRing(null)}
                        >
                          <div className="outline-fitness-row-top">
                            <span className="outline-fitness-row-name">
                              <span className="outline-fitness-dot" aria-hidden="true" />
                              {row.label}
                            </span>
                            <span className="outline-fitness-row-pct">{row.pct}%</span>
                          </div>
                          <div className="outline-fitness-bar-track" aria-hidden="true">
                            <div
                              className="outline-fitness-bar-fill"
                              style={{ width: `${row.pct}%` }}
                            />
                          </div>
                          <span className="outline-fitness-row-caption">{row.caption}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>

                <button
                  type="button"
                  className="outline-fitness-trigger"
                  aria-expanded={fitnessOpen}
                  aria-label={`Progress: ${coursePct}% course, ${masteryPct}% mastery, ${lessonPct}% current lesson`}
                  onClick={() => {
                    emitSound('lightweight-choice')
                    setFitnessOpen(v => !v)
                  }}
                >
                  <svg className="outline-fitness-rings-svg" viewBox="0 0 40 40" aria-hidden="true">
                    <g className={`of-ring-group of-ring-course${hoveredRing === 'course' ? ' is-highlighted' : hoveredRing ? ' is-dimmed' : ''}`}>
                      <circle className="of-ring-track" cx="20" cy="20" r={rOuter} />
                      <circle
                        className="of-ring-arc"
                        cx="20"
                        cy="20"
                        r={rOuter}
                        strokeDasharray={cOuter.toFixed(2)}
                        strokeDashoffset={oOuter.toFixed(2)}
                      />
                    </g>
                    <g className={`of-ring-group of-ring-mastery${hoveredRing === 'mastery' ? ' is-highlighted' : hoveredRing ? ' is-dimmed' : ''}`}>
                      <circle className="of-ring-track" cx="20" cy="20" r={rMid} />
                      <circle
                        className="of-ring-arc"
                        cx="20"
                        cy="20"
                        r={rMid}
                        strokeDasharray={cMid.toFixed(2)}
                        strokeDashoffset={oMid.toFixed(2)}
                      />
                    </g>
                    <g className={`of-ring-group ${selIsCatchup ? 'of-ring-catchup' : 'of-ring-lesson'}${hoveredRing === 'lesson' ? ' is-highlighted' : hoveredRing ? ' is-dimmed' : ''}`}>
                      <circle className="of-ring-track" cx="20" cy="20" r={rInner} />
                      <circle
                        className="of-ring-arc"
                        cx="20"
                        cy="20"
                        r={rInner}
                        strokeDasharray={cInner.toFixed(2)}
                        strokeDashoffset={oInner.toFixed(2)}
                      />
                    </g>
                  </svg>
                  <span className="outline-fitness-trigger-pct">{coursePct}%</span>
                </button>
              </div>
            </div>

            <div className="outline-action-clip">
            <motion.div
              ref={dockCardRef}
              key={`dock-bounce-${dockBounceNonce}`}
              className={`outline-action${selIsCatchup ? ' is-catchup' : ''}${dockVisible ? ' is-visible' : ' is-hidden'}`}
              initial={dockBounceNonce > 0 ? { y: -8, opacity: 1 } : false}
              animate={dockVisible ? { y: 0, opacity: 1 } : { y: dockCardHeight + 32, opacity: 0 }}
              transition={{ type: 'spring', stiffness: 420, damping: 32, mass: 0.85 }}
            >
              <div className="outline-action-head">
                <span className={`outline-action-kicker${selIsCatchup ? ' is-catchup' : ''}`}>
                  {kickerText}
                </span>
                {selInProgress && (
                  <span className="outline-action-page-pill">{lessonCaption}</span>
                )}
              </div>
              <h2 className="outline-action-title">{sel.title}</h2>
              <div className="outline-course-actions">
                <button
                  type="button"
                  className={`course-button${selIsCatchup ? ' is-catchup-cta' : ''}`}
                  onClick={() => openLesson(sel.id)}
                >
                  {ctaText}
                </button>
                {(selInProgress || selDone || selNeedsRetry) && (
                  <button
                    type="button"
                    className="outline-redo-pill"
                    aria-label={`Start ${sel.title} over from page 1`}
                    title="Start over from page 1"
                    onClick={() => {
                      clearLessonResume(sel.id)
                      setResumeMap(loadResumeMap())
                      openLesson(sel.id)
                    }}
                  >
                    <RotateCcw size={17} aria-hidden="true" />
                    <span>Start over</span>
                  </button>
                )}
              </div>
            </motion.div>
            </div>
          </div>
        </div>
      </main>

      {playbookPluginOn && (
        <FormulaSheetModal
          open={formulasOpen}
          dockable={false}
          floatingEnabled={floatingWindowsPluginOn}
          onClose={() => setFormulasOpen(false)}
        />
      )}
    </>
  )
}
