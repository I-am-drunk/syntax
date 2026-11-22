import { useEffect, useMemo, useRef, useState } from 'react'
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
import { SyntaxSettingsModal } from './components/SyntaxSettingsModal'
import { TopBarSema } from './mascot/TopBarSema'
import { loadPrefs, savePrefs, type SyntaxPrefs } from './storage'
import { assetUrl } from './assetUrl'

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
      if (parsed && typeof parsed.completed === 'object') {
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

function loadResumeMap(): Record<string, { pageIndex: number; furthest: number }> {
  try {
    const raw = localStorage.getItem(RESUME_KEY)
    if (raw) return JSON.parse(raw) as Record<string, { pageIndex: number; furthest: number }>
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
  const match = location.hash.match(/^#lesson=([a-z0-9-]+)$/i)
  if (!match) return null
  const id = match[1]
  return ALL_LESSONS.some(l => l.id === id) ? id : null
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

function DrawModeIcon() {
  return (
    <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.1" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M12 19l7-7 3 3-7 7-3-3z" />
      <path d="M18 13l-1.5-7.5L2 2l3.5 14.5L13 18l5-5z" />
      <path d="M2 2l7.586 7.586" />
      <circle cx="11" cy="11" r="2" />
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
  const [activeLessonId, setActiveLessonId] = useState<string | null>(readLessonFromHash)
  const [returnLessonId, setReturnLessonId] = useState<string | null>(null)
  const [virtualReviewLesson, setVirtualReviewLesson] = useState<GeoLesson | null>(null)
  const [selectedId, setSelectedId] = useState<string>(() => {
    const p = loadProgress()
    const firstIncomplete = UNIT2_LESSONS.find(l => !p.completed[l.id])
    return firstIncomplete?.id ?? UNIT2_LESSONS[0].id
  })
  const [popoverOpenId, setPopoverOpenId] = useState<string | null>(null)
  const [activeNav, setActiveNav] = useState<'course' | 'conference'>('course')
  const [formulasOpen, setFormulasOpen] = useState(false)
  const [penModeActive, setPenModeActive] = useState(false)

  const outlineScrollRef = useRef<HTMLElement>(null)
  const levelSectionRefs = useRef(new Map<number, HTMLElement>())
  const nodeRefs = useRef(new Map<string, HTMLButtonElement>())
  const filterWrapRef = useRef<HTMLDivElement>(null)
  const penNotifiedRef = useRef(false)
  const navLockUntilRef = useRef(0)

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
    const onHash = () => setActiveLessonId(readLessonFromHash())
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
      if (e.key === 'Escape') setFilterOpen(false)
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
    if (activeLessonId || virtualReviewLesson) return
    const scroller = outlineScrollRef.current
    if (!scroller) return

    let raf = 0
    const syncNavFromScroll = () => {
      if (Date.now() < navLockUntilRef.current) return
      const confEl = levelSectionRefs.current.get(3)
      if (!confEl) return
      const scrollerRect = scroller.getBoundingClientRect()
      const confRect = confEl.getBoundingClientRect()
      const relTop = confRect.top - scrollerRect.top
      const relBottom = confRect.bottom - scrollerRect.top
      const triggerLine = Math.min(260, scrollerRect.height * 0.38)
      const inConference = relTop <= triggerLine && relBottom > 120
      setActiveNav(prev => {
        const next = inConference ? 'conference' : 'course'
        return prev === next ? prev : next
      })
    }

    const onScroll = () => {
      cancelAnimationFrame(raf)
      raf = requestAnimationFrame(syncNavFromScroll)
    }

    scroller.addEventListener('scroll', onScroll, { passive: true })
    window.addEventListener('resize', onScroll, { passive: true })
    return () => {
      cancelAnimationFrame(raf)
      scroller.removeEventListener('scroll', onScroll)
      window.removeEventListener('resize', onScroll)
    }
  }, [activeLessonId, virtualReviewLesson, prefs.showCatchupPaths])

  // Passive global stylus detection -> offer Draw Mode automatically
  useEffect(() => {
    const onPtr = (e: PointerEvent) => {
      if (e.pointerType !== 'pen' || penNotifiedRef.current) return
      penNotifiedRef.current = true
      setPrefs(prev => {
        if (prev.drawMode) return prev
        if (prev.onboarded) {
          toast('Stylus detected — Draw Mode enabled', {
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
      if (e.metaKey || e.ctrlKey || e.altKey) return
      const el = e.target as HTMLElement | null
      if (el && (el.tagName === 'INPUT' || el.tagName === 'TEXTAREA' || el.isContentEditable)) return
      if (el?.closest('[data-pen-workspace]')) return
      if (e.key === 'f' || e.key === 'F') {
        e.preventDefault()
        setFormulasOpen(v => !v)
      }
    }
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [])

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
    setSelectedId(id)
    const found = ALL_LESSONS.find(l => l.id === id)
    if (found) {
      setActiveNav(found.level === 3 ? 'conference' : 'course')
    }
  }

  function jumpToCourse() {
    navLockUntilRef.current = Date.now() + 650
    setActiveNav('course')
    outlineScrollRef.current?.scrollTo({ top: 0, behavior: 'smooth' })
  }

  function jumpToLevel(level: 3 | 4) {
    navLockUntilRef.current = Date.now() + 650
    setActiveNav(level === 3 ? 'conference' : 'course')
    const sectionEl = levelSectionRefs.current.get(level)
    if (sectionEl && outlineScrollRef.current) {
      const top = sectionEl.offsetTop - 20
      outlineScrollRef.current.scrollTo({ top: Math.max(0, top), behavior: 'smooth' })
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

  const activeLevels = COURSE_LEVELS.filter(lvl =>
    UNIT2_LESSONS.some(l => l.level === lvl.level),
  )

  const currentNavKey = formulasOpen ? 'playbook' : activeNav

  return (
    <>
      <Toaster position="bottom-center" theme={theme} />
      <header className="app-header">
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <a
            className="wordmark"
            href="#top"
            aria-label="Syntax Analytic Geometry"
            onClick={e => {
              e.preventDefault()
              jumpToCourse()
            }}
          >
            Syntax
          </a>
          <TopBarSema
            enableRoaming={prefs.onboarded && !formulasOpen && !settingsOpen}
            scrollContainerRef={outlineScrollRef}
            onPoke={() => emitSound('lightweight-choice')}
          />
        </div>

        <nav className="primary-nav" aria-label="Main navigation">
          <a
            href="#course"
            aria-label="Unit 2"
            aria-current={currentNavKey === 'course' ? 'page' : undefined}
            onClick={e => {
              e.preventDefault()
              jumpToCourse()
            }}
          >
            <span className="icon icon-topics" aria-hidden="true" />
            <span>Unit 2</span>
            {currentNavKey === 'course' && (
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
            aria-current={currentNavKey === 'conference' ? 'page' : undefined}
            onClick={e => {
              e.preventDefault()
              jumpToLevel(3)
            }}
          >
            <span className="icon icon-you" aria-hidden="true" />
            <span>Conference</span>
            {currentNavKey === 'conference' && (
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
            aria-label="Playbook & Formulas (F)"
            aria-current={currentNavKey === 'playbook' ? 'page' : undefined}
            onClick={() => setFormulasOpen(true)}
          >
            <FormulasNavIcon />
            <span className="primary-nav-label">Playbook</span>
            {currentNavKey === 'playbook' && (
              <motion.span
                layoutId="primary-nav-indicator"
                className="primary-nav-indicator"
                transition={{ type: 'spring', stiffness: 460, damping: 36 }}
              />
            )}
          </button>
        </nav>

        <div className="header-actions">
          <button
            type="button"
            className={`header-draw-btn${prefs.drawMode ? ' is-active' : ''}`}
            aria-pressed={prefs.drawMode}
            aria-label={prefs.drawMode ? 'Disable Draw Mode' : 'Enable Draw Mode'}
            title={prefs.drawMode ? 'Draw Mode ON' : 'Draw Mode OFF'}
            onClick={() => {
              emitSound('toggle-on')
              setPrefs(p => ({ ...p, drawMode: !p.drawMode }))
            }}
          >
            <DrawModeIcon />
            <span>Draw</span>
          </button>

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
                    <svg width="20" height="10" viewBox="0 0 20 10" fill="none">
                      <path
                        d="M9.66437 2.60207L4.80758 6.97318C4.07308 7.63423 3.11989 8 2.13172 8H0V10H20V8H17.8683C16.8801 8 15.9269 7.63423 15.1924 6.97318L10.3356 2.60207C10.0708 2.3636 9.92918 2.3636 9.66437 2.60207Z"
                        fill="currentColor"
                      />
                    </svg>
                  </Menu.Arrow>
                  <Menu.Group className="menu-group">
                    <Menu.Item
                      className="menu-item"
                      onClick={() => setSettingsOpen(true)}
                    >
                      Settings
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
                      onClick={() => setFormulasOpen(true)}
                    >
                      Playbook &amp; Formulas
                    </Menu.Item>
                    <Menu.Item
                      className="menu-item"
                      onClick={() => setPrefs(p => ({ ...p, onboarded: false }))}
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

      <main ref={outlineScrollRef} className="course-outline">
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
            <button
              type="button"
              className="course-schedule-row is-clickable"
              onClick={() => jumpToLevel(3)}
            >
              <span className="course-schedule-date">Tue Nov 24</span>
              <span>U2 Conference · Plans only →</span>
            </button>
            <button
              type="button"
              className="course-schedule-row is-clickable"
              onClick={() => jumpToLevel(4)}
            >
              <span className="course-schedule-date">Thu Nov 26</span>
              <span>Unit Assignment · Open notes →</span>
            </button>
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

          {masteredCount > 0 && (
            <div className="course-progress-meta">
              {masteredCount} of {UNIT2_LESSONS.length} lessons mastered
            </div>
          )}
        </aside>

        <div className="course-path">
          {activeLevels.map(lvl => {
            const lessons = UNIT2_LESSONS.filter(l => l.level === lvl.level)
            const levelCatchups: CatchupLesson[] = CATCHUP_LESSONS.filter(
              c => c.level === lvl.level,
            )
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
                <div className="outline-level-heading" id={`level-${lvl.level}`}>
                  <span>{lvl.label}</span>
                  <h2>{lvl.title}</h2>
                </div>

                {/* Non-sticky Level 1 mini square filter button matching Level 1 bar style */}
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
                            <span>Optional Grade 9/10 prerequisite chapters</span>
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

                <DivergingLevelPath
                  levelNumber={lvl.level}
                  lessons={lessons}
                  catchups={levelCatchups}
                  showCatchupPaths={prefs.showCatchupPaths}
                  selectedId={selectedId}
                  popoverOpenId={popoverOpenId}
                  getStat={id => {
                    const st = progress.completed[id]
                    if (!st) return undefined
                    return { correct: st.correct, total: st.total, tier: toPathTier(st) }
                  }}
                  hasResume={id => Boolean(resumeMap[id])}
                  onSelect={selectNodeById}
                  onTogglePopover={id => setPopoverOpenId(id || null)}
                  onOpen={id => openLesson(id)}
                  registerNodeRef={(id, el) => {
                    if (el) nodeRefs.current.set(id, el)
                    else nodeRefs.current.delete(id)
                  }}
                />
              </section>
            )
          })}
        </div>
      </main>

      <FormulaSheetModal open={formulasOpen} onClose={() => setFormulasOpen(false)} />

      <SyntaxSettingsModal
        open={settingsOpen}
        onClose={() => setSettingsOpen(false)}
        theme={theme}
        onChangeTheme={setTheme}
        soundOn={soundOn}
        onChangeSound={setSoundOn}
        prefs={prefs}
        onPatchPrefs={patch => setPrefs(p => ({ ...p, ...patch }))}
        onReplayWelcome={() => setPrefs(p => ({ ...p, onboarded: false }))}
      />

      <OnboardingModal
        open={!prefs.onboarded}
        theme={theme}
        drawMode={prefs.drawMode}
        onSelectTheme={setTheme}
        onSelectDrawMode={next => setPrefs(p => ({ ...p, drawMode: next }))}
        onFinish={() => setPrefs(p => ({ ...p, onboarded: true }))}
      />
    </>
  )
}
