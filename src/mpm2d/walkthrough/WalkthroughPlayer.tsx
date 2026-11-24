import { useEffect, useRef, useState } from 'react'
import {
  BufferingIndicator,
  Container,
  Controls,
  ErrorDialog,
  FullscreenButton,
  Hotkey,
  MuteButton,
  PlayButton,
  PlaybackRateButton,
  StatusAnnouncer,
  Time,
  TimeSlider,
  createPlayer,
} from '@videojs/react'
import { Video, videoFeatures } from '@videojs/react/video'
import { type SemaShapeName, type SemaTailName } from '../mascot/Sema'
import { assetUrl } from '../assetUrl'
import { CATCHUP_BY_ID } from '../data/catchupCourses'
import { BrilliantGraph } from '../graph/BrilliantGraph'
import { MathText } from '../components/MathText'
import { WinBoxWindow } from '../components/WinBoxWindow'
import type { WalkthroughSpec } from './walkthroughData'
import { SemaStageRuntime } from './SemaStageRuntime'
import type { SemaPromptDisplayMode, SemaTrack } from './semaTrackTypes'
import './walkthrough.css'

const { Player, usePlayer } = createPlayer({
  features: videoFeatures,
  displayName: 'SyntaxWalkthroughPlayer',
})

const PLAYBACK_RATES = [0.75, 1, 1.25, 1.5] as const
const PROMPT_MODE_STORAGE_KEY = 'mpm2d-sema-prompt-mode-v1'
const PROMPT_MODES: { id: SemaPromptDisplayMode; label: string; title: string }[] = [
  { id: 'callout', label: 'Tags', title: 'Sema callout tags (click to switch to speech bubbles)' },
  { id: 'bubble', label: 'Say', title: 'Sema speech bubbles (click to switch to live CC subtitles)' },
  { id: 'subtitle', label: 'CC', title: 'Word-synced subtitles (click to show All)' },
  { id: 'all', label: 'All', title: 'Tags + Sema speech + live CC (click to hide prompts)' },
  { id: 'off', label: 'Quiet', title: 'Prompts hidden (click to show Sema tags)' },
]
const TRACK_CACHE = new Map<string, SemaTrack>()

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

function WalkthroughVideoStage({
  videoSrc,
  semaTrack,
  voiceActive,
  promptMode,
  semaShape,
  semaTail,
  fallbackCaption,
  onPlayingChange,
  onToggleVoice,
  onVideoError,
}: {
  videoSrc: string
  semaTrack: SemaTrack | null
  voiceActive: boolean
  promptMode: SemaPromptDisplayMode
  semaShape: SemaShapeName
  semaTail: SemaTailName
  fallbackCaption?: string
  onPlayingChange: (playing: boolean) => void
  onToggleVoice: () => void
  onVideoError?: () => void
}) {
  const videoRef = useRef<HTMLVideoElement | null>(null)
  const store = usePlayer()
  const paused = usePlayer(s => s.paused)
  const ended = usePlayer(s => s.ended)
  const muted = usePlayer(s => s.muted)

  const playing = !paused && !ended

  useEffect(() => {
    onPlayingChange(playing)
  }, [playing, onPlayingChange])

  const autoMutedRef = useRef(false)
  const syncingExternalRef = useRef(false)
  const savedPlaybackRef = useRef<{ time: number; rate: number; wasPaused: boolean } | null>(null)
  const prevSrcRef = useRef(videoSrc)

  // Preserve time, rate & pause state when light/dark theme swaps videoSrc
  useEffect(() => {
    if (prevSrcRef.current !== videoSrc) {
      const v = videoRef.current
      if (v && Number.isFinite(v.currentTime) && v.currentTime > 0.1) {
        savedPlaybackRef.current = {
          time: v.currentTime,
          rate: v.playbackRate || 1,
          wasPaused: v.paused,
        }
      }
      prevSrcRef.current = videoSrc
      autoMutedRef.current = false
    }
  }, [videoSrc])

  // Sync external voice preference into the player store
  useEffect(() => {
    const v = videoRef.current
    if (v && v.muted === voiceActive) {
      syncingExternalRef.current = true
      store.setMuted(!voiceActive)
    }
  }, [voiceActive, store, videoSrc])

  // Propagate user clicks on Video.js MuteButton back to app voice setting
  const prevMutedRef = useRef(muted)
  useEffect(() => {
    if (prevMutedRef.current !== muted) {
      prevMutedRef.current = muted
      if (syncingExternalRef.current) {
        syncingExternalRef.current = false
        return
      }
      if (autoMutedRef.current && muted) {
        autoMutedRef.current = false
        return
      }
      const shouldBeMuted = !voiceActive
      if (muted !== shouldBeMuted) {
        onToggleVoice()
      }
    }
  }, [muted, voiceActive, onToggleVoice])

  const handleSurfaceToggle = () => {
    const v = videoRef.current
    if (!v) return
    if (v.paused || v.ended) {
      if (v.ended) v.currentTime = 0
      v.play().catch(() => {
        autoMutedRef.current = true
        v.muted = true
        v.play().catch(() => {})
      })
    } else {
      v.pause()
    }
  }

  return (
    <Container className="wt-vjs-container">
      <Video
        ref={videoRef}
        className="wt-manim-video"
        src={videoSrc}
        playsInline
        preload="auto"
        muted={!voiceActive}
        onClick={handleSurfaceToggle}
        onError={() => onVideoError?.()}
        onLoadedMetadata={e => {
          const v = e.currentTarget
          v.muted = !voiceActive
          const saved = savedPlaybackRef.current
          if (saved) {
            savedPlaybackRef.current = null
            try {
              v.currentTime = Math.min(saved.time, Math.max(0, (v.duration || saved.time) - 0.1))
              v.playbackRate = saved.rate
            } catch {
              // ignore seek error
            }
            if (saved.wasPaused) return
          }
          v.play().catch(() => {
            autoMutedRef.current = true
            v.muted = true
            v.play().catch(() => {})
          })
        }}
      />

      {/* Interactive Flying & Stretchable Sema Runtime Overlay */}
      <SemaStageRuntime
        track={semaTrack}
        videoRef={videoRef}
        playing={playing}
        voiceOn={voiceActive}
        displayMode={promptMode}
        userShape={semaShape}
        userTail={semaTail}
        fallbackCaption={fallbackCaption}
      />

      <Hotkey keys="Space" action="togglePaused" />
      <Hotkey keys="k" action="togglePaused" />
      <Hotkey keys="m" action="toggleMuted" />
      <Hotkey keys="f" action="toggleFullscreen" />
      <Hotkey keys="ArrowLeft" action="seekStep" value={-3} />
      <Hotkey keys="ArrowRight" action="seekStep" value={3} />

      <BufferingIndicator
        className="wt-vjs-buffering"
        render={(props, state) => (
          <div {...props}>{state.visible ? <span className="wt-vjs-spinner" /> : null}</div>
        )}
      />

      {paused && (
        <PlayButton
          className="wt-video-center-play"
          render={(props, state) => (
            <button {...props} type="button">
              {state.ended ? (
                <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.3" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                  <path d="M3 12a9 9 0 1 0 3-6.7L3 8" />
                  <path d="M3 3v5h5" />
                </svg>
              ) : (
                <svg width="24" height="24" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
                  <polygon points="7,4 20,12 7,20" />
                </svg>
              )}
            </button>
          )}
        />
      )}

      <Controls.Root>
        <Controls.Backdrop className="wt-vjs-backdrop" />
        <Controls.Content className="wt-vjs-controls">
          <TimeSlider.Root className="wt-vjs-slider" pauseOnDrag step={0.5} largeStep={3}>
            <TimeSlider.Track className="wt-vjs-track">
              <TimeSlider.Buffer className="wt-vjs-buffer" />
              <TimeSlider.Fill className="wt-vjs-fill" />
            </TimeSlider.Track>
            <TimeSlider.Thumb className="wt-vjs-thumb" />
            <TimeSlider.Preview className="wt-vjs-preview" overflow="clamp">
              <TimeSlider.Value type="pointer" className="wt-vjs-preview-time" />
            </TimeSlider.Preview>
          </TimeSlider.Root>

          <Controls.Group className="wt-vjs-bar">
            <div className="wt-vjs-group">
              <PlayButton
                className="wt-vjs-btn"
                render={(props, state) => (
                  <button {...props} type="button">
                    {state.ended ? (
                      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.3" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                        <path d="M3 12a9 9 0 1 0 3-6.7L3 8" />
                        <path d="M3 3v5h5" />
                      </svg>
                    ) : state.paused ? (
                      <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
                        <polygon points="6,4 20,12 6,20" />
                      </svg>
                    ) : (
                      <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
                        <rect x="6" y="4" width="4.5" height="16" rx="1" />
                        <rect x="13.5" y="4" width="4.5" height="16" rx="1" />
                      </svg>
                    )}
                  </button>
                )}
              />

              <span className="wt-vjs-time">
                <Time.Value type="current" />
                <span className="wt-vjs-time-sep">/</span>
                <Time.Value type="duration" />
              </span>
            </div>

            <div className="wt-vjs-group">
              <PlaybackRateButton
                rates={PLAYBACK_RATES}
                className="wt-vjs-btn wt-vjs-rate"
                render={(props, state) => (
                  <button {...props} type="button">
                    {state.rate}x
                  </button>
                )}
              />

              <MuteButton
                className="wt-vjs-btn"
                render={(props, state) => (
                  <button {...props} type="button">
                    {state.muted ? (
                      <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.1" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                        <polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5" />
                        <line x1="23" y1="9" x2="17" y2="15" />
                        <line x1="17" y1="9" x2="23" y2="15" />
                      </svg>
                    ) : (
                      <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.1" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                        <polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5" />
                        <path d="M15.54 8.46a5 5 0 0 1 0 7.07" />
                        <path d="M19.07 4.93a10 10 0 0 1 0 14.14" />
                      </svg>
                    )}
                  </button>
                )}
              />

              <FullscreenButton
                className="wt-vjs-btn"
                render={(props, state) => (
                  <button {...props} type="button">
                    {state.fullscreen ? (
                      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                        <path d="M8 3v3a2 2 0 0 1-2 2H3m18 0h-3a2 2 0 0 1-2-2V3m0 18v-3a2 2 0 0 1 2-2h3M3 16h3a2 2 0 0 1 2 2v3" />
                      </svg>
                    ) : (
                      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                        <path d="M8 3H5a2 2 0 0 0-2 2v3m18 0V5a2 2 0 0 0-2-2h-3m0 18h3a2 2 0 0 0 2-2v-3M3 16v3a2 2 0 0 0 2 2h3" />
                      </svg>
                    )}
                  </button>
                )}
              />
            </div>
          </Controls.Group>
        </Controls.Content>
      </Controls.Root>

      <StatusAnnouncer />

      <ErrorDialog.Root>
        <ErrorDialog.Popup className="wt-vjs-error">
          <ErrorDialog.Title />
          <ErrorDialog.Description />
          <ErrorDialog.Close />
        </ErrorDialog.Popup>
      </ErrorDialog.Root>
    </Container>
  )
}

export function WalkthroughContent({
  spec,
  soundOn,
  voiceOn,
  semaShape = 'jenson',
  semaTail = 'jenson',
  inline = false,
  floating = false,
  initialStepIndex = 0,
  onToggleFloat,
  onToggleVoice,
  onClose,
  onLaunchRescue,
}: {
  spec: WalkthroughSpec
  soundOn: boolean
  voiceOn: boolean
  drawMode?: boolean
  semaShape?: SemaShapeName
  semaTail?: SemaTailName
  inline?: boolean
  floating?: boolean
  initialStepIndex?: number
  onToggleFloat?: () => void
  onToggleVoice: () => void
  onClose: () => void
  onLaunchRescue: (rescueLessonId: string) => void
}) {
  const theme = useDocumentTheme()
  const [lensIndex, setLensIndex] = useState(0)
  const [beatIndex, setBeatIndex] = useState(0)
  const [playing, setPlaying] = useState(true)
  const [showRescue, setShowRescue] = useState(false)
  const [semaTrack, setSemaTrack] = useState<SemaTrack | null>(null)
  const [videoFailed, setVideoFailed] = useState(false)
  const shellRef = useRef<HTMLDivElement | null>(null)
  const [isCompact, setIsCompact] = useState(false)
  const [topBarRevealed, setTopBarRevealed] = useState(false)

  // Observe floating window size to switch seamlessly into edge-to-edge corner mini-player mode
  useEffect(() => {
    if (!floating) {
      setIsCompact(false)
      return
    }
    const el = shellRef.current
    if (!el) return
    const check = () => {
      const rect = el.getBoundingClientRect()
      setIsCompact(rect.width <= 520 || rect.height <= 360)
    }
    check()
    const ro = new ResizeObserver(check)
    ro.observe(el)
    return () => ro.disconnect()
  }, [floating])

  const [promptMode, setPromptMode] = useState<SemaPromptDisplayMode>(() => {
    try {
      const saved = window.localStorage.getItem(PROMPT_MODE_STORAGE_KEY) as SemaPromptDisplayMode | null
      if (saved && PROMPT_MODES.some(m => m.id === saved)) return saved
    } catch {
      // ignore storage errors
    }
    return 'callout'
  })

  const cyclePromptMode = () => {
    setPromptMode(cur => {
      const idx = PROMPT_MODES.findIndex(m => m.id === cur)
      const next = PROMPT_MODES[(idx + 1) % PROMPT_MODES.length]!.id
      try {
        window.localStorage.setItem(PROMPT_MODE_STORAGE_KEY, next)
      } catch {
        // ignore storage errors
      }
      return next
    })
  }

  const lens = spec.lenses[lensIndex] ?? spec.lenses[0]!
  const beat = lens.beats[beatIndex] ?? lens.beats[0]!
  const activeStep = spec.steps[beat.stepIndex] ?? spec.steps[0]
  const asset = lens.asset

  // Prefer standalone per-step beat video so each step has its own dedicated Video.js timeline
  const beatAsset = asset?.beats?.[beat.id]
  const videoPath = beatAsset
    ? theme === 'dark'
      ? (beatAsset.dark ?? beatAsset.light ?? null)
      : (beatAsset.light ?? beatAsset.dark ?? null)
    : theme === 'dark'
      ? (asset?.dark ?? asset?.light ?? null)
      : (asset?.light ?? asset?.dark ?? null)
  const videoSrc = videoPath ? assetUrl(videoPath) : null
  const trackPath = beatAsset?.sema ?? asset?.sema ?? null
  const trackUrl = trackPath ? assetUrl(trackPath) : null
  const isManimVideo = Boolean(videoSrc) && !videoFailed

  useEffect(() => {
    setVideoFailed(false)
    if (!videoSrc) setPlaying(false)
  }, [videoSrc])
  const voiceActive = soundOn && voiceOn

  // Load Sema choreography track for the active step
  useEffect(() => {
    if (!trackUrl) {
      setSemaTrack(null)
      return
    }
    const cached = TRACK_CACHE.get(trackUrl)
    if (cached) {
      setSemaTrack(cached)
      return
    }
    let cancelled = false
    setSemaTrack(null)
    fetch(trackUrl)
      .then(r => (r.ok ? r.json() : null))
      .then((data: SemaTrack | null) => {
        if (cancelled) return
        if (data && Array.isArray(data.keyframes)) {
          TRACK_CACHE.set(trackUrl, data)
          setSemaTrack(data)
        } else {
          setSemaTrack(null)
        }
      })
      .catch(() => {
        if (!cancelled) setSemaTrack(null)
      })
    return () => {
      cancelled = true
    }
  }, [trackUrl])

  // Reset on page or initial step switch
  useEffect(() => {
    const startLens = spec.lenses[0]!
    const clampedStep = Math.max(0, Math.min(startLens.beats.length - 1, initialStepIndex))
    setLensIndex(0)
    setBeatIndex(clampedStep)
    setPlaying(true)
    setShowRescue(false)
  }, [spec.pageId, initialStepIndex])

  const selectBeat = (nextIdx: number) => {
    const clamped = Math.max(0, Math.min(lens.beats.length - 1, nextIdx))
    setBeatIndex(clamped)
  }

  const switchLens = (nextLensIdx: number) => {
    const nextLens = spec.lenses[nextLensIdx]
    if (!nextLens) return
    const targetBeat = Math.min(beatIndex, nextLens.beats.length - 1)
    setLensIndex(nextLensIdx)
    setBeatIndex(targetBeat)
  }

  const rescueCourse = CATCHUP_BY_ID.get(spec.rescueLessonId)
  const totalSteps = lens.beats.length
  const canPrev = beatIndex > 0
  const canNext = beatIndex < totalSteps - 1
  const currentPromptSpec = PROMPT_MODES.find(m => m.id === promptMode) ?? PROMPT_MODES[0]!

  const handleShellPointerMove = (e: React.PointerEvent<HTMLDivElement>) => {
    if (!isCompact) return
    const rect = e.currentTarget.getBoundingClientRect()
    const nearTop = e.clientY - rect.top <= 48
    if (nearTop !== topBarRevealed) setTopBarRevealed(nearTop)
  }

  return (
    <div
      ref={shellRef}
      className={`wt-shell${inline ? ' is-inline' : ''}${floating ? ' is-floating' : ''}${isCompact ? ' is-compact' : ''}${topBarRevealed || showRescue ? ' is-top-revealed' : ''}${playing ? ' is-playing' : ''}`}
      onPointerMove={handleShellPointerMove}
      onPointerLeave={() => {
        if (topBarRevealed) setTopBarRevealed(false)
      }}
    >
      {/* Single clean top bar: Step badge + title on left, breathing space in middle, Still stuck? + controls pinned in top-right corner */}
      <div className="wt-step-header-row">
        <div className="wt-step-header-left">
          <span className="wt-active-step-badge">
            Step {beatIndex + 1} of {totalSteps}
          </span>
          {activeStep && (
            <span className="wt-active-step-label" title={activeStep.label}>
              {activeStep.label}
            </span>
          )}
        </div>

        <div className="wt-toolbar-controls">
          {spec.lenses.length > 1 && (
            <div
              className="wt-lens-tabs"
              role="tablist"
              aria-label="Walkthrough lens"
              onKeyDown={e => {
                if (e.key !== 'ArrowLeft' && e.key !== 'ArrowRight') return
                e.preventDefault()
                const dir = e.key === 'ArrowRight' ? 1 : -1
                const nextIdx = (lensIndex + dir + spec.lenses.length) % spec.lenses.length
                switchLens(nextIdx)
                const tabs = e.currentTarget.querySelectorAll<HTMLButtonElement>('[role="tab"]')
                tabs[nextIdx]?.focus()
              }}
            >
              {spec.lenses.map((l, idx) => {
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

          {isManimVideo && (
            <button
              type="button"
              className="wt-br-mini-btn"
              title={currentPromptSpec.title}
              onClick={cyclePromptMode}
            >
              {currentPromptSpec.label}
            </button>
          )}

          {rescueCourse && (
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
               aria-hidden="true">
                <polyline points="6 9 12 15 18 9" />
              </svg>
            </button>
          )}

          {!floating && onToggleFloat && (
            <button
              type="button"
              className="wt-br-mini-btn"
              aria-label="Float walkthrough window"
              title="Float window"
              onClick={onToggleFloat}
            >
              Float
            </button>
          )}

          {!floating && (
            <button
              type="button"
              className="wt-icon-btn"
              aria-label="Close walkthrough"
              title="Close walkthrough"
              onClick={onClose}
            >
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.3" strokeLinecap="round" aria-hidden="true">
                <path d="M18 6 6 18M6 6l12 12" />
              </svg>
            </button>
          )}
        </div>
      </div>

      {/* Animated top dropdown for prerequisite rescue mini-lesson */}
      {showRescue && rescueCourse && (
        <div className="wt-rescue-card is-top-dropdown">
          <div className="wt-rescue-copy">
            <strong>{rescueCourse.title}</strong>
            <p>{spec.rescueMessage}</p>
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

      {/* Centerpiece Video.js Stage flanked by clean Left / Right per-step navigation arrows */}
      <div className={`wt-stage-carousel${totalSteps > 1 ? ' has-arrows' : ''}`}>
        {totalSteps > 1 && (
          <button
            type="button"
            className="wt-side-arrow is-prev"
            disabled={!canPrev}
            aria-label="Previous step video"
            title="Previous step"
            onClick={() => selectBeat(beatIndex - 1)}
          >
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
              <polyline points="15 18 9 12 15 6" />
            </svg>
          </button>
        )}

        <div className={`wt-stage-frame${isManimVideo ? ' is-manim-video' : ''}`}>
          {isManimVideo && videoSrc ? (
            <Player key={`${spec.pageId}-${lens.id}-${beat.id}`}>
              <WalkthroughVideoStage
                videoSrc={videoSrc}
                semaTrack={semaTrack}
                voiceActive={voiceActive}
                promptMode={promptMode}
                semaShape={semaShape}
                semaTail={semaTail}
                fallbackCaption={beat.caption}
                onPlayingChange={setPlaying}
                onToggleVoice={onToggleVoice}
                onVideoError={() => setVideoFailed(true)}
              />
            </Player>
          ) : (
            <div className="wt-static-fallback">
              <div className="wt-fallback-head">
                <strong className="wt-fallback-title">
                  <MathText text={beat.title} />
                </strong>
                {activeStep?.equation && (
                  <div className="wt-fallback-eq">
                    <MathText text={activeStep.equation} />
                  </div>
                )}
              </div>
              {beat.scene && (
                <div className="wt-fallback-graph">
                  <BrilliantGraph mode="display" scene={beat.scene} />
                </div>
              )}
              <div className="wt-fallback-lines">
                {(beat.mathLines ?? [beat.caption]).map((line, i) => (
                  <div key={i} className="wt-fallback-line">
                    <MathText text={line} />
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        {totalSteps > 1 && (
          <button
            type="button"
            className="wt-side-arrow is-next"
            disabled={!canNext}
            aria-label="Next step video"
            title="Next step"
            onClick={() => selectBeat(beatIndex + 1)}
          >
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
              <polyline points="9 18 15 12 9 6" />
            </svg>
          </button>
        )}
      </div>

      {/* Minimal action footer (no subtext clutter) */}
      <footer className="wt-footer is-clean">
        <button type="button" className="wt-btn-primary" onClick={onClose}>
          Got it, let me try
        </button>
      </footer>
    </div>
  )
}

export function WalkthroughModal({
  spec,
  open,
  soundOn,
  voiceOn,
  drawMode = false,
  semaShape = 'jenson',
  semaTail = 'jenson',
  initialStepIndex = 0,
  onToggleFloat,
  onToggleVoice,
  onClose,
  onLaunchRescue,
}: {
  spec: WalkthroughSpec | null
  open: boolean
  soundOn: boolean
  voiceOn: boolean
  drawMode?: boolean
  semaShape?: SemaShapeName
  semaTail?: SemaTailName
  initialStepIndex?: number
  onToggleFloat?: () => void
  onToggleVoice: () => void
  onClose: () => void
  onLaunchRescue: (rescueLessonId: string) => void
}) {
  if (!spec || !open) return null

  const headerActions = onToggleFloat ? (
    <button
      type="button"
      className="wt-wb-action-btn"
      onClick={onToggleFloat}
      title="Dock walkthrough into left lesson panel"
    >
      Dock
    </button>
  ) : undefined

  return (
    <WinBoxWindow
      id="syntax-walkthrough-winbox"
      className="wt-walkthrough-winbox"
      eyebrow="Guided walkthrough"
      title={spec.title}
      defaultWidth={700}
      defaultHeight={510}
      minWidth={260}
      minHeight={170}
      headerActions={headerActions}
      onClose={onClose}
    >
      <WalkthroughContent
        spec={spec}
        soundOn={soundOn}
        voiceOn={voiceOn}
        drawMode={drawMode}
        semaShape={semaShape}
        semaTail={semaTail}
        floating
        initialStepIndex={initialStepIndex}
        onToggleFloat={onToggleFloat}
        onToggleVoice={onToggleVoice}
        onClose={onClose}
        onLaunchRescue={onLaunchRescue}
      />
    </WinBoxWindow>
  )
}
