import { useEffect, useRef, useState } from 'react'
import { type SemaShapeName, type SemaTailName } from '../mascot/Sema'
import { CATCHUP_BY_ID } from '../data/catchupCourses'
import { WinBoxWindow } from '../components/WinBoxWindow'
import { LiveMathVideoStage } from './LiveMathVideoStage'
import type { LiveMathProgram } from './liveMathTypes'
import type { SemaPromptDisplayMode } from './semaTrackTypes'
import './walkthrough.css'

const PROMPT_MODE_STORAGE_KEY = 'mpm2d-sema-prompt-mode-v2'
const PROMPT_MODES: { id: SemaPromptDisplayMode; label: string; title: string }[] = [
  { id: 'all', label: 'CC + Tags', title: 'Live word-synced subtitles + Sema tags (click to switch)' },
  { id: 'subtitle', label: 'CC Only', title: 'Word-synced subtitles only (click to switch)' },
  { id: 'callout', label: 'Tags + CC', title: 'Sema callout tags + subtitles (click to hide)' },
  { id: 'off', label: 'Quiet', title: 'Subtitles and tags hidden (click to show CC + Tags)' },
]

function useDocumentTheme(): 'light' | 'dark' {
  const read = (): 'light' | 'dark' =>
    typeof document !== 'undefined' &&
    (document.documentElement.getAttribute('data-theme') === 'dark' ||
      document.body.getAttribute('data-theme') === 'dark')
      ? 'dark'
      : 'light'

  const [theme, setTheme] = useState<'light' | 'dark'>(read)

  useEffect(() => {
    const update = () => setTheme(read())
    const obs = new MutationObserver(update)
    obs.observe(document.documentElement, { attributes: true, attributeFilter: ['data-theme'] })
    obs.observe(document.body, { attributes: true, attributeFilter: ['data-theme'] })
    return () => obs.disconnect()
  }, [])

  return theme
}

export function WalkthroughContent({
  program,
  soundOn = true,
  voiceOn = false,
  semaShape = 'jenson',
  semaTail = 'jenson',
  inline = false,
  floating = false,
  slideDown = false,
  initialStepIndex = 0,
  onToggleFloat,
  onToggleVoice,
  onClose,
  onLaunchRescue,
  onEscalateToSolution,
  onOpenFormulas,
}: {
  program: LiveMathProgram
  soundOn?: boolean
  voiceOn?: boolean
  drawMode?: boolean
  semaShape?: SemaShapeName
  semaTail?: SemaTailName
  inline?: boolean
  floating?: boolean
  slideDown?: boolean
  initialStepIndex?: number
  onToggleFloat?: () => void
  onToggleVoice?: () => void
  onClose: () => void
  onLaunchRescue: (rescueLessonId: string) => void
  onEscalateToSolution?: () => void
  onOpenFormulas?: () => void
}) {
  const theme = useDocumentTheme()
  const isDark = theme === 'dark'

  const [lensIndex, setLensIndex] = useState(0)
  const [beatIndex, setBeatIndex] = useState(() => {
    const firstLens = program.lenses[0]
    if (!firstLens || !firstLens.beats.length) return 0
    return Math.max(0, Math.min(initialStepIndex, firstLens.beats.length - 1))
  })
  const [showRescue, setShowRescue] = useState(false)
  const [playing, setPlaying] = useState(true)
  const [promptMode, setPromptMode] = useState<SemaPromptDisplayMode>(() => {
    try {
      const saved = localStorage.getItem(PROMPT_MODE_STORAGE_KEY) as SemaPromptDisplayMode | null
      if (saved && PROMPT_MODES.some(m => m.id === saved)) return saved
    } catch {
      // ignore
    }
    return 'all'
  })

  const shellRef = useRef<HTMLDivElement | null>(null)
  const [isCompact, setIsCompact] = useState(false)

  useEffect(() => {
    setLensIndex(0)
    const firstLens = program.lenses[0]
    const clamped = firstLens
      ? Math.max(0, Math.min(initialStepIndex, Math.max(0, firstLens.beats.length - 1)))
      : 0
    setBeatIndex(clamped)
    setShowRescue(false)
  }, [program.pageId, program.mode, initialStepIndex, program.lenses])

  useEffect(() => {
    const el = shellRef.current
    if (!el || typeof ResizeObserver === 'undefined') return
    const check = () => {
      const rect = el.getBoundingClientRect()
      setIsCompact(rect.width > 0 && rect.width < 520)
    }
    check()
    const obs = new ResizeObserver(check)
    obs.observe(el)
    return () => obs.disconnect()
  }, [])

  const cyclePromptMode = () => {
    setPromptMode(prev => {
      const idx = PROMPT_MODES.findIndex(m => m.id === prev)
      const next = PROMPT_MODES[(idx + 1) % PROMPT_MODES.length]!.id
      try {
        localStorage.setItem(PROMPT_MODE_STORAGE_KEY, next)
      } catch {
        // ignore
      }
      return next
    })
  }

  const lens = program.lenses[lensIndex] ?? program.lenses[0]!
  const safeBeatIndex = Math.max(0, Math.min(beatIndex, Math.max(0, lens.beats.length - 1)))
  const activeBeat = lens.beats[safeBeatIndex] ?? lens.beats[0]!
  const totalSteps = lens.beats.length
  const canPrev = safeBeatIndex > 0
  const canNext = safeBeatIndex < totalSteps - 1

  const switchLens = (nextLensIdx: number) => {
    const nextLens = program.lenses[nextLensIdx]
    if (!nextLens) return
    setLensIndex(nextLensIdx)
    setBeatIndex(Math.min(safeBeatIndex, Math.max(0, nextLens.beats.length - 1)))
  }

  const rescueCourse = CATCHUP_BY_ID.get(program.rescueLessonId)
  const currentPromptSpec = PROMPT_MODES.find(m => m.id === promptMode) ?? PROMPT_MODES[0]!
  const isHintMode = program.mode === 'hint'

  return (
    <div
      ref={shellRef}
      className={`wt-shell is-live-engine${isHintMode ? ' is-hint-mode' : ' is-solution-mode'}${inline ? ' is-inline' : ''}${floating ? ' is-floating' : ''}${slideDown ? ' is-slide-down' : ''}${isCompact ? ' is-compact' : ''}${playing ? ' is-playing' : ''}`}
    >
      {/* Clean single header bar */}
      <div className="wt-step-header-row">
        <div className="wt-step-header-left">
          <span className={`wt-active-step-badge${isHintMode ? ' is-hint' : ''}`}>
            {isHintMode ? `Hint ${safeBeatIndex + 1} / ${totalSteps}` : `Step ${safeBeatIndex + 1} of ${totalSteps}`}
          </span>
          <span className="wt-active-step-label" title={activeBeat.title}>
            {activeBeat.title}
          </span>
        </div>

        <div className="wt-toolbar-controls">
          {program.lenses.length > 1 && (
            <div
              className="wt-lens-tabs"
              role="tablist"
              aria-label="Video mode"
              onKeyDown={e => {
                if (e.key !== 'ArrowLeft' && e.key !== 'ArrowRight') return
                e.preventDefault()
                const dir = e.key === 'ArrowRight' ? 1 : -1
                const nextIdx = (lensIndex + dir + program.lenses.length) % program.lenses.length
                switchLens(nextIdx)
              }}
            >
              {program.lenses.map((l, idx) => {
                const active = idx === lensIndex
                return (
                  <button
                    key={l.id}
                    type="button"
                    role="tab"
                    aria-selected={active}
                    tabIndex={active ? 0 : -1}
                    className={`wt-lens-tab${active ? ' is-active' : ''}`}
                    onClick={() => switchLens(idx)}
                  >
                    {l.label}
                  </button>
                )
              })}
            </div>
          )}

          <button
            type="button"
            className="wt-br-mini-btn"
            title={currentPromptSpec.title}
            onClick={cyclePromptMode}
          >
            {currentPromptSpec.label}
          </button>

          {rescueCourse && !isHintMode && (
            <button
              type="button"
              className={`wt-still-stuck-btn${showRescue ? ' is-open' : ''}`}
              aria-expanded={showRescue}
              onClick={() => setShowRescue(v => !v)}
            >
              <span>Still stuck?</span>
              <svg
                className="wt-top-stuck-chevron"
                width="13"
                height="13"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2.4"
                strokeLinecap="round"
                strokeLinejoin="round"
                aria-hidden="true"
              >
                <polyline points="6 9 12 15 18 9" />
              </svg>
            </button>
          )}

          {!floating && onToggleFloat && (
            <button
              type="button"
              className="wt-br-mini-btn"
              aria-label="Pop out video window"
              title="Pop out into draggable window"
              onClick={onToggleFloat}
            >
              Pop out
            </button>
          )}

          {!floating && (
            <button
              type="button"
              className="wt-icon-btn"
              aria-label={isHintMode ? 'Hide hint video' : 'Close walkthrough'}
              title={isHintMode ? 'Hide hint video' : 'Close walkthrough'}
              onClick={onClose}
            >
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.3" strokeLinecap="round" aria-hidden="true">
                <path d="M18 6 6 18M6 6l12 12" />
              </svg>
            </button>
          )}
        </div>
      </div>

      {/* Prerequisite rescue dropdown */}
      {showRescue && rescueCourse && (
        <div className="wt-rescue-card is-top-dropdown">
          <div className="wt-rescue-copy">
            <strong>{rescueCourse.title}</strong>
            <p>{program.rescueMessage}</p>
          </div>
          <button
            type="button"
            className="wt-rescue-launch"
            onClick={() => onLaunchRescue(rescueCourse.id)}
          >
            Start {rescueCourse.minutes}-min catch-up →
          </button>
        </div>
      )}

      {/* Centerpiece 144Hz Live Vector / Kinetic Algebra Stage */}
      <div className={`wt-stage-carousel${totalSteps > 1 ? ' has-arrows' : ''}`}>
        {totalSteps > 1 && (
          <button
            type="button"
            className="wt-side-arrow is-prev"
            disabled={!canPrev}
            aria-label="Previous step"
            title="Previous step"
            onClick={() => setBeatIndex(i => Math.max(0, i - 1))}
          >
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
              <polyline points="15 18 9 12 15 6" />
            </svg>
          </button>
        )}

        <div className="wt-stage-frame is-live-math">
          <LiveMathVideoStage
            key={`${program.pageId}-${program.mode}-${lens.id}`}
            beats={lens.beats}
            lensId={lens.id}
            beatIndex={safeBeatIndex}
            onBeatIndexChange={setBeatIndex}
            voiceOn={voiceOn && soundOn}
            onToggleVoice={() => onToggleVoice?.()}
            promptMode={promptMode}
            semaShape={semaShape}
            semaTail={semaTail}
            isDark={isDark}
            compact={slideDown || isCompact}
            onPlayingChange={setPlaying}
          />
        </div>

        {totalSteps > 1 && (
          <button
            type="button"
            className="wt-side-arrow is-next"
            disabled={!canNext}
            aria-label="Next step"
            title="Next step"
            onClick={() => setBeatIndex(i => Math.min(totalSteps - 1, i + 1))}
          >
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
              <polyline points="9 18 15 12 9 6" />
            </svg>
          </button>
        )}
      </div>

      {/* Step dots + Guided Hint escalation footer */}
      <div className="wt-bottom-strip">
        {totalSteps > 1 && (
          <div className="wt-step-dots" role="tablist" aria-label="Video steps">
            {lens.beats.map((b, idx) => (
              <button
                key={b.id}
                type="button"
                role="tab"
                aria-selected={idx === safeBeatIndex}
                className={`wt-step-dot-btn${idx === safeBeatIndex ? ' is-active' : ''}`}
                onClick={() => setBeatIndex(idx)}
              >
                <span className="wt-step-dot-num">{idx + 1}</span>
                {!isCompact && <span className="wt-step-dot-name">{b.badge ?? b.title}</span>}
              </button>
            ))}
          </div>
        )}

        {isHintMode && (
          <div className="wt-hint-escalate-row">
            {onOpenFormulas && (
              <button type="button" className="wt-hint-action-btn" onClick={onOpenFormulas}>
                Formula Playbook
              </button>
            )}
            {rescueCourse && (
              <button
                type="button"
                className="wt-hint-action-btn"
                onClick={() => onLaunchRescue(rescueCourse.id)}
              >
                {rescueCourse.minutes}-min skill catch-up
              </button>
            )}
            {onEscalateToSolution && (
              <button
                type="button"
                className="wt-hint-action-btn is-primary"
                onClick={onEscalateToSolution}
              >
                Still stuck? Watch full solution video →
              </button>
            )}
          </div>
        )}
      </div>
    </div>
  )
}

export function WalkthroughModal({
  program,
  open,
  soundOn = true,
  voiceOn = false,
  drawMode = false,
  semaShape = 'jenson',
  semaTail = 'jenson',
  initialStepIndex = 0,
  onToggleFloat,
  onToggleVoice,
  onClose,
  onLaunchRescue,
}: {
  program: LiveMathProgram
  open: boolean
  soundOn?: boolean
  voiceOn?: boolean
  drawMode?: boolean
  semaShape?: SemaShapeName
  semaTail?: SemaTailName
  initialStepIndex?: number
  onToggleFloat?: () => void
  onToggleVoice?: () => void
  onClose: () => void
  onLaunchRescue: (rescueLessonId: string) => void
}) {
  if (!open) return null
  return (
    <WinBoxWindow
      onClose={onClose}
      eyebrow={program.mode === 'hint' ? 'Guided Hint' : 'Walkthrough'}
      title={program.mode === 'hint' ? 'Guided Hint Video (No Spoilers)' : program.title}
      id={`syntax-walkthrough-${program.mode}`}
      defaultWidth={Math.min(820, typeof window !== 'undefined' ? window.innerWidth - 32 : 760)}
      defaultHeight={Math.min(580, typeof window !== 'undefined' ? window.innerHeight - 48 : 540)}
      minWidth={360}
      minHeight={360}
      className="syntax-wb-walkthrough"
      headerActions={
        onToggleFloat ? (
          <button
            type="button"
            className="wb-custom-action-btn"
            onClick={onToggleFloat}
            title="Dock into lesson panel"
          >
            Dock
          </button>
        ) : undefined
      }
    >
      <WalkthroughContent
        program={program}
        soundOn={soundOn}
        voiceOn={voiceOn}
        drawMode={drawMode}
        semaShape={semaShape}
        semaTail={semaTail}
        floating
        initialStepIndex={initialStepIndex}
        onToggleVoice={onToggleVoice}
        onClose={onClose}
        onLaunchRescue={onLaunchRescue}
      />
    </WinBoxWindow>
  )
}
