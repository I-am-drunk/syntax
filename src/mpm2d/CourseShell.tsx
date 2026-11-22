import { useEffect, useMemo, useRef, useState } from 'react'
import { playLessonSound, preloadLessonSounds, type LessonSound } from '../services/lessonSounds'
import { COURSE_LEVELS, type GeoLesson, type GeoLessonPage } from './pageTypes'
import { UNIT2_LESSONS } from './data/unit2Course'
import { GeoLessonPlayer } from './GeoLessonPlayer'
import { FormulaSheetModal } from './components/FormulaSheetModal'
import { assetUrl } from './assetUrl'

type SavedProgress = {
  completed: Record<string, { correct: number; total: number }>
  missedCheckIds?: string[]
}

const PROGRESS_KEY = 'mpm2d-brilliant-progress-v1'
const RESUME_KEY = 'mpm2d-resume-v1'
const THEME_KEY = 'mpm2d-brilliant-theme-v1'
const SOUND_KEY = 'mpm2d-brilliant-sound-v1'

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
  return UNIT2_LESSONS.some(l => l.id === id) ? id : null
}

function FormulasNavIcon() {
  return (
    <svg className="nav-svg-icon" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.1" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M4 19.5v-15A2.5 2.5 0 0 1 6.5 2H19a1 1 0 0 1 1 1v18a1 1 0 0 1-1 1H6.5a1 1 0 0 1 0-5H20" />
      <path d="M9 7h6M9 11h4" />
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

export function CourseShell() {
  const [progress, setProgress] = useState<SavedProgress>(loadProgress)
  const [resumeMap, setResumeMap] = useState(loadResumeMap)
  const [theme, setTheme] = useState<'light' | 'dark'>(loadTheme)
  const [soundOn, setSoundOn] = useState<boolean>(loadSound)
  const [activeLessonId, setActiveLessonId] = useState<string | null>(readLessonFromHash)
  const [virtualReviewLesson, setVirtualReviewLesson] = useState<GeoLesson | null>(null)
  const [selectedId, setSelectedId] = useState<string>(() => {
    const p = loadProgress()
    const firstIncomplete = UNIT2_LESSONS.find(l => !p.completed[l.id])
    return firstIncomplete?.id ?? UNIT2_LESSONS[0].id
  })
  const [activeNav, setActiveNav] = useState<'course' | 'conference'>('course')
  const [formulasOpen, setFormulasOpen] = useState(false)
  const [penModeActive, setPenModeActive] = useState(false)
  const nodeRefs = useRef(new Map<string, HTMLButtonElement>())

  useEffect(preloadLessonSounds, [])

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
      (activeLessonId ? UNIT2_LESSONS.find(l => l.id === activeLessonId) : undefined),
    [virtualReviewLesson, activeLessonId],
  )

  const selectedLesson = useMemo<GeoLesson>(
    () => UNIT2_LESSONS.find(l => l.id === selectedId) ?? UNIT2_LESSONS[0],
    [selectedId],
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

  function openLesson(id: string) {
    setVirtualReviewLesson(null)
    setActiveLessonId(id)
    setSelectedId(id)
    if (location.hash !== `#lesson=${id}`) {
      history.pushState(null, '', `#lesson=${id}`)
    }
  }

  function openMissedReview() {
    const checks = validMissedIds
      .map(id => allChecksById.get(id))
      .filter((p): p is GeoLessonPage => Boolean(p))
    if (checks.length === 0) return
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
        : UNIT2_LESSONS.find(l => l.id === lessonId)

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

    if (lessonId !== 'virtual-missed-checks') {
      const idx = UNIT2_LESSONS.findIndex(l => l.id === lessonId)
      if (idx >= 0 && idx < UNIT2_LESSONS.length - 1) {
        setSelectedId(UNIT2_LESSONS[idx + 1].id)
      }
    }
  }

  function selectNode(lesson: GeoLesson) {
    setSelectedId(lesson.id)
    setActiveNav(lesson.level === 3 ? 'conference' : 'course')
    nodeRefs.current.get(lesson.id)?.scrollIntoView({ behavior: 'smooth', block: 'center' })
  }

  function jumpToCourse() {
    setActiveNav('course')
    window.scrollTo({ top: 0, behavior: 'smooth' })
  }

  function jumpToLevel(level: 3 | 4) {
    setActiveNav(level === 3 ? 'conference' : 'course')
    const target =
      UNIT2_LESSONS.find(l => l.level === level) ??
      UNIT2_LESSONS.find(l => l.level === 2) ??
      UNIT2_LESSONS[0]
    if (target) {
      setSelectedId(target.id)
      nodeRefs.current.get(target.id)?.scrollIntoView({ behavior: 'smooth', block: 'center' })
    }
  }

  if (activeLesson) {
    return (
      <>
        <GeoLessonPlayer
          key={activeLesson.id}
          lesson={activeLesson}
          theme={theme}
          formulasOpen={formulasOpen}
          onClose={closeLesson}
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

  const selectedStat = progress.completed[selectedLesson.id]
  const selectedTier = masteryTier(selectedStat)
  const selectedResume = resumeMap[selectedLesson.id]
  const activeLevels = COURSE_LEVELS.filter(lvl =>
    UNIT2_LESSONS.some(l => l.level === lvl.level),
  )

  return (
    <>
      <header className="app-header">
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
        <nav className="primary-nav" aria-label="Main navigation">
          <a
            href="#course"
            aria-label="Unit 2"
            aria-current={!formulasOpen && activeNav === 'course' ? 'page' : undefined}
            onClick={e => {
              e.preventDefault()
              jumpToCourse()
            }}
          >
            <span className="icon icon-topics" aria-hidden="true" />
            <span>Unit 2</span>
          </a>
          <a
            href="#conference"
            aria-label="Conference"
            aria-current={!formulasOpen && activeNav === 'conference' ? 'page' : undefined}
            onClick={e => {
              e.preventDefault()
              jumpToLevel(3)
            }}
          >
            <span className="icon icon-play" aria-hidden="true" />
            <span>Conference</span>
          </a>
          <button
            type="button"
            className="primary-nav-btn"
            aria-label="Playbook & Formulas (F)"
            aria-current={formulasOpen ? 'page' : undefined}
            onClick={() => setFormulasOpen(true)}
          >
            <FormulasNavIcon />
            <span className="primary-nav-label">Playbook</span>
          </button>
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
        </div>
      </header>

      <main className="course-outline">
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
            return (
              <section
                className="outline-level"
                key={lvl.level}
                aria-labelledby={`level-${lvl.level}`}
              >
                <div className="outline-level-heading" id={`level-${lvl.level}`}>
                  <span>{lvl.label}</span>
                  <h2>{lvl.title}</h2>
                </div>
                <div className="outline-nodes">
                  {lessons.map((lesson, ni) => {
                    const isSelected = lesson.id === selectedLesson.id
                    const stat = progress.completed[lesson.id]
                    const tier = masteryTier(stat)
                    const inProgress = !stat && Boolean(resumeMap[lesson.id])
                    const icon =
                      tier === 'mastered'
                        ? isSelected
                          ? 'complete-selected'
                          : 'complete'
                        : lesson.isReview
                          ? 'review'
                          : isSelected
                            ? 'selected'
                            : 'lesson'

                    return (
                      <button
                        type="button"
                        key={lesson.id}
                        className="outline-node"
                        data-mastery={tier}
                        ref={el => {
                          if (el) nodeRefs.current.set(lesson.id, el)
                          else nodeRefs.current.delete(lesson.id)
                        }}
                        style={{ transform: `translateX(${[0, -1, 0, 1][ni % 4] * 12}%)` }}
                        aria-label={`${lesson.title}, ${lvl.label}${
                          stat ? `, ${stat.correct} of ${stat.total} checks` : inProgress ? ', in progress' : ''
                        }`}
                        aria-pressed={isSelected}
                        onClick={() => selectNode(lesson)}
                        onDoubleClick={() => openLesson(lesson.id)}
                      >
                        <img src={assetUrl(`/assets/courses/node-${icon}.svg`)} alt="" />
                        <span className="outline-node-label">{lesson.shortTitle}</span>
                        {stat && stat.total > 0 && (
                          <span className={`outline-node-score is-${tier}`}>
                            {stat.correct}/{stat.total}
                          </span>
                        )}
                        {inProgress && (
                          <span className="outline-node-score is-progress">Resume</span>
                        )}
                      </button>
                    )
                  })}
                </div>
              </section>
            )
          })}

          <div className="outline-action">
            <div className="outline-action-copy">
              <h2>
                {selectedLesson.title}
                {selectedStat && selectedStat.total > 0 && (
                  <span className={`outline-action-score is-${selectedTier}`}>
                    {selectedStat.correct}/{selectedStat.total}
                  </span>
                )}
              </h2>
              <p className="outline-action-sub">{selectedLesson.subtitle}</p>
            </div>
            <div className="outline-course-actions">
              <button
                type="button"
                className="course-button"
                onClick={() => openLesson(selectedLesson.id)}
              >
                {selectedResume
                  ? 'Resume'
                  : selectedTier === 'mastered'
                    ? 'Practice again'
                    : selectedStat
                      ? 'Retry checks'
                      : 'Start'}
              </button>
            </div>
          </div>
        </div>
      </main>

      <FormulaSheetModal open={formulasOpen} onClose={() => setFormulasOpen(false)} />
    </>
  )
}
