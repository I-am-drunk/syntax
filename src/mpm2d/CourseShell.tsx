import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { motion } from 'framer-motion'
import { Menu } from '@base-ui/react/menu'
import { Toaster, toast } from 'sonner'
import { playLessonSound, preloadLessonSounds, type LessonSound } from '../services/lessonSounds'
import { COURSE_LEVELS, type GeoLesson, type GeoLessonPage } from './pageTypes'
import { UNIT2_LESSONS } from './data/unit2Course'
import { CATCHUP_BY_ID, CATCHUP_LESSONS, type CatchupLesson } from './data/catchupCourses'
import { GeoLessonPlayer } from './GeoLessonPlayer'
import { FormulaSheetModal } from './components/FormulaSheetModal'
import { DivergingLevelPath, type PathLessonStat } from './components/DivergingLevelPath'
import { OnboardingModal } from './components/OnboardingModal'
import { SyntaxSettingsPage } from './components/SyntaxSettingsModal'
import { SyntaxHistoryPage } from './components/SyntaxHistoryModal'
import { TopBarSema } from './mascot/TopBarSema'
import { loadPrefs, savePrefs, type SyntaxPrefs } from './storage'
import { assetUrl } from './assetUrl'
import {
  DevMetricsMicroBar,
  isDevEnvironment,
  resetAllDevStateAndCookies,
} from './components/DevChannelBadge'

type SavedProgress = {
  completed: Record<string, { correct: number; total: number }>
  missedCheckIds?: string[]
}

const PROGRESS_KEY = 'mpm2d-brilliant-progress-v1'
const RESUME_KEY = 'mpm2d-resume-v1'
const THEME_KEY = 'mpm2d-brilliant-theme-v1'
const SOUND_KEY = 'mpm2d-brilliant-sound-v1'

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

function loadTheme(): 'light' | 'dark' {
  try {
    const saved = localStorage.getItem(THEME_KEY)
    if (saved === 'light' || saved === 'dark') return saved
  } catch {
    // ignore
  }
  return matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light'
}

function loadSound(): boolean {
  try {
    const saved = localStorage.getItem(SOUND_KEY)
    if (saved === 'false') return false
  } catch {
    // ignore
  }
  return true
}

function readLessonFromHash(): string | null {
  const match = location.hash.match(/^#lesson[=/]([a-z0-9-]+)$/i)
  if (!match) return null
  const id = match[1]
  return ALL_LESSONS.some(l => l.id === id) ? id : null
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

function SettingsNavIcon() {
  return (
    <svg className="nav-svg-icon" width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.1" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <circle cx="12" cy="12" r="3" />
      <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 1 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 1 1-2.83-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 1 1 2.83-2.83l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 1 1 2.83 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z" />
    </svg>
  )
}

function RedoOutlineIcon() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.1" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M3 12a9 9 0 1 0 3-6.7L3 8" />
      <path d="M3 3v5h5" />
    </svg>
  )
}

function FormulasNavIcon() {
  return (
    <svg className="nav-svg-icon" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.1" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M4 19.5v-15A2.5 2.5 0 0 1 6.5 2H19a1 1 0 0 1 1 1v18a1 1 0 0 1-1 1H6.5a1 1 0 0 1 0-5H20" />
      <path d="M9 7h6M9 11h4" />
    </svg>
  )
}

function FilterIcon() {
  return (
    <svg width="19" height="19" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <line x1="4" y1="6" x2="20" y2="6" />
      <line x1="7" y1="12" x2="17" y2="12" />
      <line x1="10" y1="18" x2="14" y2="18" />
    </svg>
  )
}

function HamburgerIcon() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" aria-hidden="true">
      <line x1="4" y1="6" x2="20" y2="6" />
      <line x1="4" y1="12" x2="20" y2="12" />
      <line x1="4" y1="18" x2="20" y2="18" />
    </svg>
  )
}

function SunIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <circle cx="12" cy="12" r="4" />
      <path d="M12 2v2M12 20v2M4.93 4.93l1.41 1.41M17.66 17.66l1.41 1.41M2 12h2M20 12h2M6.34 17.66l-1.41 1.41M19.07 4.93l-1.41 1.41" />
    </svg>
  )
}

function MoonIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M12 3a6 6 0 0 0 9 9 9 9 0 1 1-9-9Z" />
    </svg>
  )
}

function SoundIcon({ on }: { on: boolean }) {
  return on ? (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5" />
      <path d="M15.54 8.46a5 5 0 0 1 0 7.07" />
      <path d="M19.07 4.93a10 10 0 0 1 0 14.14" />
    </svg>
  ) : (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5" />
      <line x1="22" y1="9" x2="16" y2="15" />
      <line x1="16" y1="9" x2="22" y2="15" />
    </svg>
  )
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

export function CourseShell() {
  const [progress, setProgress] = useState<SavedProgress>(loadProgress)
  const [resumeMap, setResumeMap] = useState(loadResumeMap)
  const [theme, setTheme] = useState<'light' | 'dark'>(loadTheme)
  const [soundOn, setSoundOn] = useState<boolean>(loadSound)
  const [prefs, setPrefs] = useState<SyntaxPrefs>(loadPrefs)
  const [filterOpen, setFilterOpen] = useState(false)
  const [settingsOpen, setSettingsOpen] = useState(false)
  const [historyOpen, setHistoryOpen] = useState(false)
  const [activeLessonId, setActiveLessonId] = useState<string | null>(readLessonFromHash)
  const [returnLessonId, setReturnLessonId] = useState<string | null>(null)
  const [virtualReviewLesson, setVirtualReviewLesson] = useState<GeoLesson | null>(null)
  const [selectedId, setSelectedId] = useState<string>(() => {
    const p = loadProgress()
    const showCatchup = loadPrefs().showCatchupPaths
    const latest = Object.keys(loadResumeMap()).reverse().find(id =>
      ALL_LESSONS.some(lesson => lesson.id === id) && (!CATCHUP_BY_ID.has(id) || showCatchup),
    )
    const firstIncomplete = UNIT2_LESSONS.find(l => !p.completed[l.id])
    return latest ?? firstIncomplete?.id ?? UNIT2_LESSONS[0].id
  })
  const [popoverOpenId, setPopoverOpenId] = useState<string | null>(null)
  const [activeNav, setActiveNav] = useState<'course' | 'conference'>('course')
  const [outlineAtBottom, setOutlineAtBottom] = useState(false)
  const [formulasOpen, setFormulasOpen] = useState(false)
  const [penModeActive, setPenModeActive] = useState(false)
  const [dockVisible, setDockVisible] = useState(true)
  const [dockCardHeight, setDockCardHeight] = useState(148)
  const [dockBounceNonce, setDockBounceNonce] = useState(0)
  const [fitnessOpen, setFitnessOpen] = useState(false)
  const [hoveredRing, setHoveredRing] = useState<'course' | 'mastery' | 'lesson' | null>(null)
  const [devResetting, setDevResetting] = useState(false)
  const isDev = useMemo(() => isDevEnvironment(), [])

  const outlineScrollRef = useRef<HTMLElement>(null)
  const levelSectionRefs = useRef(new Map<number, HTMLElement>())
  const nodeRefs = useRef(new Map<string, HTMLButtonElement>())
  const filterWrapRef = useRef<HTMLDivElement>(null)
  const dockCardRef = useRef<HTMLDivElement>(null)
  const fitnessDockRef = useRef<HTMLDivElement>(null)
  const penNotifiedRef = useRef(false)
  const navLockUntilRef = useRef(0)
  const jumpRafRef = useRef(0)

  useEffect(() => {
    return () => {
      if (jumpRafRef.current) cancelAnimationFrame(jumpRafRef.current)
    }
  }, [])

  useEffect(preloadLessonSounds, [])

  useEffect(() => {
    savePrefs(prefs)
  }, [prefs])

  useEffect(() => {
    document.documentElement.dataset.theme = theme
    document.documentElement.style.colorScheme = theme
    try {
      localStorage.setItem(THEME_KEY, theme)
    } catch {
      // ignore
    }
  }, [theme])

  useEffect(() => {
    try {
      localStorage.setItem(SOUND_KEY, String(soundOn))
    } catch {
      // ignore
    }
  }, [soundOn])

  useEffect(() => {
    const onHash = () => {
      const id = readLessonFromHash()
      setReturnLessonId(null)
      setVirtualReviewLesson(null)
      setActiveLessonId(id)
      setResumeMap(loadResumeMap())
      if (id && ALL_LESSONS.some(lesson => lesson.id === id)) setSelectedId(id)
    }
    window.addEventListener('hashchange', onHash)
    return () => window.removeEventListener('hashchange', onHash)
  }, [])

  // Close Level 1 Filter popover on outside click / Escape
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

  // Real scroll-spy on .course-outline: smoothly switches Unit 2 <-> Conference on scroll!
  useEffect(() => {
    if (activeLessonId || virtualReviewLesson || settingsOpen || historyOpen) return
    const scroller = outlineScrollRef.current
    if (!scroller) return

    let raf = 0
    let confTop = 0
    let confBottom = 0
    let triggerLine = 220

    const measure = () => {
      const confEl = levelSectionRefs.current.get(3)
      if (!confEl) return
      const sRect = scroller.getBoundingClientRect()
      const cRect = confEl.getBoundingClientRect()
      confTop = cRect.top - sRect.top + scroller.scrollTop
      confBottom = cRect.bottom - sRect.top + scroller.scrollTop
      triggerLine = Math.min(260, sRect.height * 0.38)
    }

    let lastInConf: boolean | null = null
    const syncNavFromScroll = () => {
      raf = 0
      if (Date.now() < navLockUntilRef.current || confBottom <= confTop) return
      const st = scroller.scrollTop
      const atBot = st + scroller.clientHeight >= scroller.scrollHeight - 140
      setOutlineAtBottom(prev => (prev === atBot ? prev : atBot))
      const relTop = confTop - st
      const inConference = relTop <= triggerLine
      if (inConference !== lastInConf) {
        lastInConf = inConference
        setActiveNav(inConference ? 'conference' : 'course')
      }
    }

    const onScroll = () => {
      if (!raf) raf = requestAnimationFrame(syncNavFromScroll)
    }

    const onResize = () => {
      measure()
      onScroll()
    }

    measure()
    syncNavFromScroll()
    scroller.addEventListener('scroll', onScroll, { passive: true })
    window.addEventListener('resize', onResize, { passive: true })
    return () => {
      if (raf) cancelAnimationFrame(raf)
      scroller.removeEventListener('scroll', onScroll)
      window.removeEventListener('resize', onResize)
    }
  }, [activeLessonId, virtualReviewLesson, settingsOpen, historyOpen, prefs.showCatchupPaths])

  // Passive global stylus detection -> offer Draw Mode automatically
  useEffect(() => {
    const onPtr = (e: PointerEvent) => {
      if (e.pointerType !== 'pen' || penNotifiedRef.current) return
      penNotifiedRef.current = true
      setPrefs(prev => {
        if (prev.drawMode) return prev
        if (prev.onboarded) {
          toast('Stylus detected: Draw Mode enabled', {
            action: {
              label: 'Undo',
              onClick: () => setPrefs(p => ({ ...p, drawMode: false })),
            },
          })
        }
        return { ...prev, drawMode: true }
      })
    }
    window.addEventListener('pointerdown', onPtr, { passive: true })
    return () => window.removeEventListener('pointerdown', onPtr)
  }, [])

  // Global 'F' shortcut for Playbook (when not typing in an input or pen canvas)
  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (!prefs.onboarded) return
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
  }, [prefs.onboarded])

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
    () =>
      UNIT2_LESSONS.filter(l => masteryTier(progress.completed[l.id]) === 'mastered').length,
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

  // Brilliant scroll-away hide: observe selected node visibility inside .course-outline
  useEffect(() => {
    if (activeLessonId || virtualReviewLesson || settingsOpen || historyOpen) return
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
  }, [
    resolvedSelectedLesson.id,
    activeLessonId,
    virtualReviewLesson,
    settingsOpen,
    historyOpen,
    prefs.showCatchupPaths,
  ])

  // Track thick tab card height so the parallel floating row glides cleanly above it
  useEffect(() => {
    if (activeLessonId || virtualReviewLesson || settingsOpen || historyOpen) return
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
  }, [
    resolvedSelectedLesson.id,
    activeLessonId,
    virtualReviewLesson,
    settingsOpen,
    historyOpen,
  ])

  // Close Fitness progress drawer on outside click or Escape
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

  const emitSound = (cue: LessonSound) => {
    if (soundOn) playLessonSound(cue)
  }

  function openLesson(id: string, returnTo?: string | null) {
    setPopoverOpenId(null)
    setVirtualReviewLesson(null)
    setReturnLessonId(returnTo ?? null)
    setActiveLessonId(id)
    if (!CATCHUP_BY_ID.has(id)) {
      setSelectedId(id)
    }
    if (location.hash !== `#lesson=${id}`) {
      history.pushState(null, '', `#lesson=${id}`)
    }
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
    if (location.hash) {
      history.pushState(null, '', location.pathname + location.search)
    }
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

    if (lessonId !== 'virtual-missed-checks' && !CATCHUP_BY_ID.has(lessonId)) {
      const idx = UNIT2_LESSONS.findIndex(l => l.id === lessonId)
      if (idx >= 0 && idx < UNIT2_LESSONS.length - 1) {
        setSelectedId(UNIT2_LESSONS[idx + 1].id)
      }
    }
  }

  function selectNodeById(id: string) {
    if (id === selectedId) {
      setDockBounceNonce(n => n + 1)
    }
    setSelectedId(id)
    setDockVisible(true)
    const found = ALL_LESSONS.find(l => l.id === id)
    if (found) {
      setActiveNav(found.level === 3 ? 'conference' : 'course')
    }
  }

  function jumpToCourse(defer = false) {
    navLockUntilRef.current = Date.now() + 650
    setActiveNav('course')
    const run = () => outlineScrollRef.current?.scrollTo({ top: 0, behavior: 'smooth' })
    if (jumpRafRef.current) cancelAnimationFrame(jumpRafRef.current)
    if (defer) {
      jumpRafRef.current = requestAnimationFrame(() => {
        jumpRafRef.current = 0
        run()
      })
    } else {
      run()
    }
  }

  function jumpToLevel(level: 3 | 4, defer = false) {
    navLockUntilRef.current = Date.now() + 650
    setActiveNav(level === 3 ? 'conference' : 'course')
    const run = () => {
      const sectionEl = levelSectionRefs.current.get(level)
      const scroller = outlineScrollRef.current
      if (sectionEl && scroller) {
        const sRect = scroller.getBoundingClientRect()
        const cRect = sectionEl.getBoundingClientRect()
        const top = cRect.top - sRect.top + scroller.scrollTop - 20
        scroller.scrollTo({ top: Math.max(0, top), behavior: 'smooth' })
      } else {
        const target =
          UNIT2_LESSONS.find(l => l.level === level) ??
          UNIT2_LESSONS.find(l => l.level === 2) ??
          UNIT2_LESSONS[0]
        if (target) {
          setSelectedId(target.id)
          nodeRefs.current.get(target.id)?.scrollIntoView({ behavior: 'smooth', block: 'center' })
        }
      }
    }
    if (jumpRafRef.current) cancelAnimationFrame(jumpRafRef.current)
    if (defer) {
      jumpRafRef.current = requestAnimationFrame(() => {
        jumpRafRef.current = 0
        run()
      })
    } else {
      run()
    }
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

  const returnLessonObj = returnLessonId ? UNIT2_LESSONS.find(l => l.id === returnLessonId) : undefined

  if (activeLesson) {
    return (
      <>
        <Toaster position="bottom-center" theme={theme} />
        <GeoLessonPlayer
          key={activeLesson.id}
          lesson={activeLesson}
          theme={theme}
          soundOn={soundOn}
          drawMode={prefs.drawMode}
          voiceOn={prefs.voiceOn}
          semaShape={prefs.semaShape}
        semaTail={prefs.semaTail}
          semaExpression={prefs.semaExpression}
          penControlsCollapsed={prefs.penControlsCollapsed}
          showStepPlan={prefs.showStepPlan}
          onToggleShowStepPlan={() => setPrefs(p => ({ ...p, showStepPlan: !p.showStepPlan }))}
          formulasOpen={formulasOpen}
          returnToLessonLabel={returnLessonObj?.shortTitle}
          onClose={closeLesson}
          onReturnToLesson={returnLessonObj ? () => openLesson(returnLessonObj.id, null) : undefined}
          onLaunchRescue={rescueId => openLesson(rescueId, activeLesson.id)}
          onToggleDrawMode={() => setPrefs(p => ({ ...p, drawMode: !p.drawMode }))}
          onToggleVoice={() => setPrefs(p => ({ ...p, voiceOn: !p.voiceOn }))}
          onComplete={handleComplete}
          onToggleFormulas={() => setFormulasOpen(v => !v)}
          onCloseFormulas={() => setFormulasOpen(false)}
          onPenModeChange={setPenModeActive}
          onSound={emitSound}
        />
        {!penModeActive && (
          <FormulaSheetModal open={formulasOpen} dockable onClose={() => setFormulasOpen(false)} />
        )}
      </>
    )
  }

  const overlayOpen = settingsOpen || historyOpen
  const currentNavKey = formulasOpen ? 'playbook' : activeNav

  return (
    <>
      <Toaster position="bottom-center" theme={theme} />
      <header className="app-header" data-settings-open={settingsOpen || undefined}>
        <div className={`brand-lockup${isDev ? ' is-dev-brand' : ''}`} data-settings-open={settingsOpen || undefined}>
          <div className="brand-wordmark-stack">
            {isDev && <DevMetricsMicroBar compact />}
            <a
              className="wordmark"
              href="#top"
              aria-label={overlayOpen ? 'Syntax: Back to Unit 2' : isDev ? 'Syntax Dev Analytic Geometry' : 'Syntax Analytic Geometry'}
              onClick={e => {
                e.preventDefault()
                if (settingsOpen || historyOpen) {
                  emitSound('lightweight-choice')
                  setSettingsOpen(false); setHistoryOpen(false)
                } else {
                  jumpToCourse()
                }
              }}
            >
              Syntax{isDev && <span className="dev-rainbow-text"> Dev</span>}
            </a>
          </div>
          <TopBarSema
            enableRoaming={prefs.onboarded && !formulasOpen && !settingsOpen && !historyOpen}
            dockedIntoLogo={settingsOpen}
            scrollContainerRef={outlineScrollRef}
            shape={prefs.semaShape}
            tail={prefs.semaTail}
            expression={prefs.semaExpression}
            hasNotification={validMissedIds.length > 0}
            onPoke={() => emitSound('lightweight-choice')}
            onLogoClick={() => {
              emitSound('lightweight-choice')
              setSettingsOpen(false); setHistoryOpen(false)
            }}
          />
        </div>

        <nav
          className="primary-nav"
          aria-label="Main navigation"
          data-settings-open={settingsOpen || undefined}
        >
          <div className="primary-nav-course-items" aria-hidden={settingsOpen || undefined}>
            <a
              href="#course"
              aria-label="Unit 2"
              tabIndex={settingsOpen ? -1 : 0}
              aria-current={!overlayOpen && currentNavKey === 'course' ? 'page' : undefined}
              onClick={e => {
                e.preventDefault()
                const wasOverlay = overlayOpen
                if (settingsOpen) setSettingsOpen(false)
                if (historyOpen) setHistoryOpen(false)
                jumpToCourse(wasOverlay)
              }}
            >
              <span className="icon icon-topics" aria-hidden="true" />
              <span>Unit 2</span>
              {!overlayOpen && currentNavKey === 'course' && (
                <motion.span
                  layoutId="primary-nav-indicator"
                  className="primary-nav-indicator"
                  transition={{ type: 'spring', stiffness: 460, damping: 36 }}
                />
              )}
            </a>
            <a
              href="#conference"
              aria-label="Conference"
              tabIndex={settingsOpen ? -1 : 0}
              aria-current={!overlayOpen && currentNavKey === 'conference' ? 'page' : undefined}
              onClick={e => {
                e.preventDefault()
                const wasOverlay = overlayOpen
                if (settingsOpen) setSettingsOpen(false)
                if (historyOpen) setHistoryOpen(false)
                jumpToLevel(3, wasOverlay)
              }}
            >
              <span className="icon icon-you" aria-hidden="true" />
              <span>Conference</span>
              {!overlayOpen && currentNavKey === 'conference' && (
                <motion.span
                  layoutId="primary-nav-indicator"
                  className="primary-nav-indicator"
                  transition={{ type: 'spring', stiffness: 460, damping: 36 }}
                />
              )}
            </a>
            <button
              type="button"
              className="primary-nav-btn"
              tabIndex={settingsOpen ? -1 : 0}
              aria-label="Playbook & Formulas (F)"
              aria-current={!overlayOpen && currentNavKey === 'playbook' ? 'page' : undefined}
              onClick={() => {
                if (settingsOpen) setSettingsOpen(false)
                if (historyOpen) setHistoryOpen(false)
                setFormulasOpen(true)
              }}
            >
              <FormulasNavIcon />
              <span className="primary-nav-label">Playbook</span>
              {!overlayOpen && currentNavKey === 'playbook' && (
                <motion.span
                  layoutId="primary-nav-indicator"
                  className="primary-nav-indicator"
                  transition={{ type: 'spring', stiffness: 460, damping: 36 }}
                />
              )}
            </button>
          </div>

          {/* Pixar wipe-in Settings nav tab (slides right-to-left from Playbook, dims & hides course tabs behind it) */}
          <div
            className="primary-nav-settings-wiper"
            aria-hidden={!settingsOpen || undefined}
          >
            <button
              type="button"
              className="primary-nav-settings-tab"
              tabIndex={settingsOpen ? 0 : -1}
              aria-current={settingsOpen ? 'page' : undefined}
              onClick={() => {
                window.scrollTo({ top: 0, behavior: 'smooth' })
              }}
            >
              <SettingsNavIcon />
              <span>Settings</span>
              <span className="primary-nav-settings-underline" aria-hidden="true" />
            </button>
          </div>
        </nav>

        <div className="header-actions">

          <button
            type="button"
            className="header-icon-btn"
            aria-label={soundOn ? 'Mute sound effects' : 'Enable sound effects'}
            title={soundOn ? 'Sound on' : 'Sound off'}
            onClick={() => setSoundOn(v => !v)}
          >
            <SoundIcon on={soundOn} />
          </button>

          <button
            type="button"
            className="header-icon-btn"
            aria-label={theme === 'dark' ? 'Switch to light mode' : 'Switch to dark mode'}
            title={theme === 'dark' ? 'Light mode' : 'Dark mode'}
            onClick={() => setTheme(t => (t === 'dark' ? 'light' : 'dark'))}
          >
            {theme === 'dark' ? <SunIcon /> : <MoonIcon />}
          </button>

          {/* Original Brilliant animated Hamburger Menu (Base UI Menu.Root) */}
          <Menu.Root>
            <Menu.Trigger aria-label="Menu" className="menu-trigger">
              <HamburgerIcon />
            </Menu.Trigger>
            <Menu.Portal>
              <Menu.Positioner sideOffset={16} align="end" className="menu-positioner">
                <Menu.Popup className="menu-popup">
                  <Menu.Arrow className="menu-arrow">
                    <svg width="20" height="10" viewBox="0 0 20 10" fill="none" aria-hidden="true">
                      <path
                        d="M9.66437 2.60207L4.80758 6.97318C4.07308 7.63423 3.11989 8 2.13172 8H0V10H20V8H17.8683C16.8801 8 15.9269 7.63423 15.1924 6.97318L10.3356 2.60207C10.0708 2.3636 9.92918 2.3636 9.66437 2.60207Z"
                        fill="currentColor"
                      />
                    </svg>
                  </Menu.Arrow>
                  <Menu.Group className="menu-group">
                    <Menu.Item
                      className="menu-item"
                      onClick={() => {
                        emitSound('toggle-on')
                        setFormulasOpen(false)
                        setHistoryOpen(false)
                        setSettingsOpen(v => !v)
                      }}
                    >
                      {settingsOpen ? 'Back to Unit 2' : 'Settings'}
                    </Menu.Item>
                    <Menu.Item
                      className="menu-item"
                      onClick={() => {
                        emitSound('toggle-on')
                        setFormulasOpen(false)
                        setSettingsOpen(false)
                        setHistoryOpen(v => !v)
                      }}
                    >
                      <span className="menu-item-row">
                        <span>History</span>
                        <span className={`menu-item-pill${historyOpen ? ' is-on' : ''}`}>
                          {historyOpen ? 'OPEN' : 'TIME'}
                        </span>
                      </span>
                    </Menu.Item>
                    <Menu.Item
                      className="menu-item"
                      closeOnClick={false}
                      onClick={() => {
                        emitSound('toggle-on')
                        setPrefs(p => ({ ...p, drawMode: !p.drawMode }))
                      }}
                    >
                      <span className="menu-item-row">
                        <span>Draw Mode</span>
                        <span className={`menu-item-pill${prefs.drawMode ? ' is-on' : ''}`}>
                          {prefs.drawMode ? 'ON' : 'OFF'}
                        </span>
                      </span>
                    </Menu.Item>
                    <Menu.Item
                      className="menu-item"
                      closeOnClick={false}
                      onClick={() => {
                        emitSound('lightweight-choice')
                        setPrefs(p => ({ ...p, showCatchupPaths: !p.showCatchupPaths }))
                      }}
                    >
                      <span className="menu-item-row">
                        <span>Catch-up paths</span>
                        <span className={`menu-item-pill${prefs.showCatchupPaths ? ' is-on' : ''}`}>
                          {prefs.showCatchupPaths ? 'ON' : 'OFF'}
                        </span>
                      </span>
                    </Menu.Item>
                  </Menu.Group>
                  <Menu.Separator className="menu-separator" />
                  <Menu.Group className="menu-group">
                    <Menu.Item
                      className="menu-item"
                      onClick={() => {
                        setSettingsOpen(false)
                        setHistoryOpen(false)
                        setFormulasOpen(true)
                      }}
                    >
                      Playbook &amp; Formulas
                    </Menu.Item>
                    <Menu.Item
                      className="menu-item"
                      onClick={() => {
                        setSettingsOpen(false)
                        setHistoryOpen(false)
                        setPrefs(p => ({ ...p, onboarded: false }))
                      }}
                    >
                      Welcome tour with Sema
                    </Menu.Item>
                  </Menu.Group>
                </Menu.Popup>
              </Menu.Positioner>
            </Menu.Portal>
          </Menu.Root>
        </div>
      </header>

      {settingsOpen && (
        <SyntaxSettingsPage
          onClose={() => {
            emitSound('lightweight-choice')
            setSettingsOpen(false)
          }}
          theme={theme}
          onChangeTheme={setTheme}
          soundOn={soundOn}
          onChangeSound={setSoundOn}
          prefs={prefs}
          onPatchPrefs={patch => setPrefs(p => ({ ...p, ...patch }))}
          onReplayWelcome={() => setPrefs(p => ({ ...p, onboarded: false }))}
        />
      )}
      {historyOpen && (
        <SyntaxHistoryPage
          soundOn={soundOn}
          onClose={() => {
            emitSound('lightweight-choice')
            setHistoryOpen(false)
          }}
          onJumpToQuestion={(lessonId, pageIndex, pageId) => {
            if (pageId) {
              try {
                const raw = localStorage.getItem(RESUME_KEY)
                const map = raw ? JSON.parse(raw) : {}
                const existing = map[lessonId] ?? { pageIndex: 0, furthest: 0 }
                map[lessonId] = {
                  ...existing,
                  pageIndex,
                  pageId,
                  furthest: Math.max(existing.furthest ?? 0, pageIndex),
                }
                localStorage.setItem(RESUME_KEY, JSON.stringify(map))
              } catch {
                // ignore
              }
            }
            setHistoryOpen(false)
            openLesson(lessonId)
          }}
        />
      )}
      <main ref={outlineScrollRef} className="course-outline" style={settingsOpen || historyOpen ? { display: 'none' } : undefined}>
        <aside className="course-summary">
          <img
            src={assetUrl('/assets/courses/Coordinate_Geometry-bgclJY.png')}
            width="100"
            height="100"
            alt=""
          />
          {isDev && (
            <div className="dev-sidebar-strip" aria-label="Developer tools and live metrics">
              <div className="dev-sidebar-top">
                <span className="dev-sidebar-badge">
                  Syntax <span className="dev-rainbow-text">Dev</span>
                </span>
                <button
                  type="button"
                  className="dev-reset-btn"
                  disabled={devResetting}
                  onClick={() => {
                    setDevResetting(true)
                    void resetAllDevStateAndCookies()
                  }}
                >
                  {devResetting ? 'Resetting...' : 'Reset state & cookies'}
                </button>
              </div>
              <DevMetricsMicroBar />
            </div>
          )}
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
            <button
              type="button"
              className="course-missed-btn"
              onClick={openMissedReview}
            >
              Review {validMissedIds.length} Missed {validMissedIds.length === 1 ? 'Check' : 'Checks'}
            </button>
          )}


        </aside>

        <div className="course-path">
          {activeLevels.map(({ lvl, lessons, catchups: levelCatchups }) => {
            return (
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
                        <FilterIcon />
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
                                setPrefs(p => ({ ...p, showCatchupPaths: !p.showCatchupPaths }))
                              }}
                            />
                            <span
                              className={`header-switch${prefs.showCatchupPaths ? ' is-on' : ''}`}
                            />
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
            )
          })}
          {/* Brilliant Sticky Footer Anchor: parallel floating Jump + Apple Fitness Progress above scroll-away thick tab */}
          {(() => {
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

            // Concentric Apple Fitness 3-ring geometry (viewBox 40x40)
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
              {
                key: 'course',
                label: 'Course',
                pct: coursePct,
                caption: courseCaption,
                tone: 'is-course',
              },
              {
                key: 'mastery',
                label: 'Mastery',
                pct: masteryPct,
                caption: masteryCaption,
                tone: 'is-mastery',
              },
              {
                key: 'lesson',
                label: 'This lesson',
                pct: lessonPct,
                caption: lessonCaption,
                tone: selIsCatchup ? 'is-catchup' : 'is-lesson',
              },
            ]

            return (
              <div className={`outline-footer-anchor${dockVisible ? ' is-dock-visible' : ' is-dock-hidden'}`}>
                {/* Parallel floating row: Jump to top/bottom (left) + Apple Fitness Multi-Bar Progress (right) */}
                <div
                  className="outline-floating-row"
                  style={{ bottom: dockVisible ? dockCardHeight + 12 : 0 }}
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
                          top: outlineAtBottom ? 0 : scroller.scrollHeight,
                          behavior: 'smooth',
                        })
                      }
                    }}
                  >
                    <svg
                      width="18"
                      height="18"
                      viewBox="0 0 24 24"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="2.5"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      aria-hidden="true"
                    >
                      <line x1="12" y1="5" x2="12" y2="19" />
                      <polyline points="6 13 12 19 18 13" />
                    </svg>
                  </button>

                  {/* Flat Apple Fitness concentric multi-ring pill with smooth slide-out multi-bar drawer */}
                  <div
                    ref={fitnessDockRef}
                    className={`outline-fitness-dock${fitnessOpen ? ' is-open' : ''}${hoveredRing ? ` has-hover-ring is-hover-${hoveredRing}` : ''}`}
                    onPointerEnter={() => setFitnessOpen(true)}
                    onPointerLeave={() => {
                      setFitnessOpen(false)
                      setHoveredRing(null)
                    }}
                  >
                    <div
                      className="outline-fitness-drawer"
                      aria-hidden={!fitnessOpen}
                    >
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

                {/* Brilliant Thick Tab Card (smoothly slides down & fades away when scrolled past active node) */}
                <motion.div
                  ref={dockCardRef}
                  key={`dock-bounce-${dockBounceNonce}`}
                  className={`outline-action${selIsCatchup ? ' is-catchup' : ''}${dockVisible ? ' is-visible' : ' is-hidden'}`}
                  initial={dockBounceNonce > 0 ? { y: -8, opacity: 1 } : false}
                  animate={dockVisible ? { y: 0, opacity: 1 } : { y: 88, opacity: 0 }}
                  transition={{
                    type: 'spring',
                    stiffness: 420,
                    damping: 32,
                    mass: 0.85,
                  }}
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
                        <RedoOutlineIcon />
                        <span>Start over</span>
                      </button>
                    )}
                  </div>
                </motion.div>
              </div>
            )
          })()}
        </div>
      </main>
      <FormulaSheetModal open={formulasOpen} onClose={() => setFormulasOpen(false)} />

      <OnboardingModal
        open={!prefs.onboarded}
        theme={theme}
        drawMode={prefs.drawMode}
        semaShape={prefs.semaShape}
        semaTail={prefs.semaTail}
        onSelectTheme={setTheme}
        onSelectDrawMode={next => setPrefs(p => ({ ...p, drawMode: next }))}
        onFinish={() => setPrefs(p => ({ ...p, onboarded: true }))}
      />
    </>
  )
}
