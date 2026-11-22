import { useEffect, useRef, useState } from 'react'
import { Sema, type SemaExpressionName, type SemaShapeName, type SemaState } from '../mascot/Sema'
import { assetUrl } from '../assetUrl'
import { CATCHUP_BY_ID } from '../data/catchupCourses'
import { BrilliantGraph } from '../graph/BrilliantGraph'
import { MathText } from '../components/MathText'
import { WinBoxWindow } from '../components/WinBoxWindow'
import type { WalkthroughSpec } from './walkthroughData'
import { SemaStageRuntime } from './SemaStageRuntime'
import type { SemaPromptDisplayMode, SemaTrack } from './semaTrackTypes'
import './walkthrough.css'

const PLAYBACK_RATES = [0.75, 1, 1.25, 1.5] as const
const PROMPT_MODE_STORAGE_KEY = "mpm2d-sema-prompt-mode-v1"
const PROMPT_MODES: { id: SemaPromptDisplayMode; label: string; title: string }[] = [
  { id: "callout", label: "Tags", title: "Sema callout tags (click to switch to speech bubbles)" },
  { id: "bubble", label: "Say", title: "Sema speech bubbles (click to switch to live CC subtitles)" },
  { id: "subtitle", label: "CC", title: "Word-synced subtitles (click to show All)" },
  { id: "all", label: "All", title: "Tags + Sema speech + live CC (click to hide prompts)" },
  { id: "off", label: "Quiet", title: "Prompts hidden (click to show Sema tags)" },
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

function formatClock(sec: number): string {
  const safe = Math.max(0, Math.floor(sec))
  const m = Math.floor(safe / 60)
  const s = safe % 60
  return `${m}:${s.toString().padStart(2, '0')}`
}

export function WalkthroughContent({
  spec,
  soundOn,
  voiceOn,
  semaShape = 'circle',
  inline = false,
  floating = false,
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
  inline?: boolean
  floating?: boolean
  onToggleFloat?: () => void
  onToggleVoice: () => void
  onClose: () => void
  onLaunchRescue: (rescueLessonId: string) => void
}) {
  const theme = useDocumentTheme()
  const [lensIndex, setLensIndex] = useState(0)
  const [beatIndex, setBeatIndex] = useState(0)
  const [progress, setProgress] = useState(0)
  const [duration, setDuration] = useState(10)
  const [playing, setPlaying] = useState(true)
  const [rateIndex, setRateIndex] = useState(1)
  const [showRescue, setShowRescue] = useState(false)
  const [scrubbing, setScrubbing] = useState(false)
  const [semaTrack, setSemaTrack] = useState<SemaTrack | null>(null)
  const [promptMode, setPromptMode] = useState<SemaPromptDisplayMode>(() => {
    try {
      const saved = window.localStorage.getItem(PROMPT_MODE_STORAGE_KEY) as SemaPromptDisplayMode | null
      if (saved && PROMPT_MODES.some(m => m.id === saved)) return saved
    } catch {
      // ignore storage errors
    }
    return "callout"
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

  const videoRef = useRef<HTMLVideoElement | null>(null)
  const trackRef = useRef<HTMLDivElement | null>(null)
  const pendingSeekRef = useRef<number | null>(null)

  const lens = spec.lenses[lensIndex] ?? spec.lenses[0]!
  const beat = lens.beats[beatIndex] ?? lens.beats[0]!
  const videoPath =
    theme === 'dark'
      ? (beat.videoDark ?? beat.videoLight ?? null)
      : (beat.videoLight ?? beat.videoDark ?? null)
  const videoSrc = videoPath ? assetUrl(videoPath) : null
  const isManimVideo = Boolean(videoSrc)
  const trackUrl = beat.trackPath ? assetUrl(beat.trackPath) : null

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
    fetch(trackUrl)
      .then(r => (r.ok ? r.json() : null))
      .then((data: SemaTrack | null) => {
        if (!cancelled && data && Array.isArray(data.keyframes)) {
          TRACK_CACHE.set(trackUrl, data)
          setSemaTrack(data)
        }
      })
      .catch(() => {
        if (!cancelled) setSemaTrack(null)
      })
    return () => {
      cancelled = true
    }
  }, [trackUrl])
  const voiceActive = soundOn && voiceOn
  const playbackRate = PLAYBACK_RATES[rateIndex] ?? 1

  // Reset on page switch
  useEffect(() => {
    setLensIndex(0)
    setBeatIndex(0)
    setProgress(0)
    setPlaying(true)
    setShowRescue(false)
    pendingSeekRef.current = null
  }, [spec.pageId])

  // Sync mute & playback rate live without reloading video
  useEffect(() => {
    const v = videoRef.current
    if (!v) return
    v.muted = !voiceActive
    v.playbackRate = playbackRate
  }, [voiceActive, playbackRate, videoSrc])

  // Preserve exact timestamp when user toggles Light <-> Dark theme mid-video
  const prevThemeRef = useRef(theme)
  useEffect(() => {
    if (prevThemeRef.current !== theme) {
      prevThemeRef.current = theme
      const v = videoRef.current
      if (v && Number.isFinite(v.currentTime) && v.currentTime > 0) {
        pendingSeekRef.current = v.currentTime
      }
    }
  }, [theme])

  // Sync play/pause with <video> element
  useEffect(() => {
    const v = videoRef.current
    if (!v || !isManimVideo) return
    if (playing && !scrubbing) {
      v.play().catch(() => {
        // Autoplay with audio may be blocked until gesture; retry muted if needed
        if (!v.muted) {
          v.muted = true
          v.play().catch(() => {})
        }
      })
    } else {
      v.pause()
    }
  }, [playing, scrubbing, isManimVideo, videoSrc])

  // Smooth 60fps progress bar tracking
  useEffect(() => {
    if (!isManimVideo) {
      setDuration(beat.durationSec)
      return
    }
    let raf = 0
    const tick = () => {
      const v = videoRef.current
      if (v && Number.isFinite(v.duration) && v.duration > 0.1) {
        setDuration(v.duration)
        if (!scrubbing) {
          setProgress(Math.min(1, Math.max(0, v.currentTime / v.duration)))
        }
      }
      raf = requestAnimationFrame(tick)
    }
    raf = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(raf)
  }, [isManimVideo, scrubbing, beat.durationSec, videoSrc])

  const selectBeat = (nextIdx: number) => {
    const clamped = Math.max(0, Math.min(lens.beats.length - 1, nextIdx))
    pendingSeekRef.current = null
    setBeatIndex(clamped)
    setProgress(0)
    setPlaying(true)
  }

  const switchLens = (nextLensIdx: number) => {
    const nextLens = spec.lenses[nextLensIdx]
    if (!nextLens) return
    pendingSeekRef.current = null
    setLensIndex(nextLensIdx)
    setBeatIndex(Math.min(beatIndex, nextLens.beats.length - 1))
    setProgress(0)
    setPlaying(true)
  }

  const seekToClientX = (clientX: number) => {
    const el = trackRef.current
    if (!el) return
    const rect = el.getBoundingClientRect()
    const frac = Math.max(0, Math.min(1, (clientX - rect.left) / Math.max(1, rect.width)))
    const totalBeats = lens.beats.length
    const scaled = frac * totalBeats
    const targetBeat = Math.min(totalBeats - 1, Math.floor(scaled))
    const beatFrac = Math.max(0, Math.min(0.995, scaled - targetBeat))

    if (targetBeat !== beatIndex) {
      pendingSeekRef.current = beatFrac * duration
      setBeatIndex(targetBeat)
    } else {
      const v = videoRef.current
      if (v && Number.isFinite(v.duration) && v.duration > 0.1) {
        v.currentTime = beatFrac * v.duration
      }
    }
    setProgress(beatFrac)
  }

  const togglePlay = () => {
    const v = videoRef.current
    if (progress >= 0.99) {
      if (v) v.currentTime = 0
      setProgress(0)
      setPlaying(true)
    } else {
      setPlaying(p => !p)
    }
  }

  const rescueCourse = CATCHUP_BY_ID.get(spec.rescueLessonId)

  const semaState: SemaState = showRescue
    ? 'nudge'
    : progress >= 0.98
      ? 'celebrate'
      : playing
        ? 'speaking'
        : 'idle'

  const semaExpression: SemaExpressionName | undefined = showRescue
    ? 'curious'
    : progress >= 0.98
      ? 'proud'
      : !playing
        ? 'attentive'
        : 'happy'

  return (
    <div className={`wt-shell${inline ? ' is-inline' : ''}${floating ? ' is-floating' : ''}${playing ? ' is-playing' : ''}`}>
      <header className="wt-header">
        <div className="wt-header-left">
          <h2 className="wt-title" title={`Guided walkthrough · ${spec.title}`}>
            <span className="wt-eyebrow">Guided walkthrough</span>
            <span className="wt-eyebrow-sep" aria-hidden="true">·</span>
            <span className="wt-title-main">{spec.title}</span>
          </h2>
        </div>

        <div className="wt-header-right">
          {spec.lenses.length > 1 && (
            <div className="wt-lens-tabs" role="tablist" aria-label="Walkthrough lens">
              {spec.lenses.map((l, idx) => {
                const active = idx === lensIndex
                return (
                  <button
                    key={l.id}
                    type="button"
                    role="tab"
                    aria-selected={active}
                    className={`wt-lens-tab${active ? ' is-active' : ''}`}
                    onClick={() => switchLens(idx)}
                  >
                    <span className="wt-lens-tab-label">{l.label}</span>
                  </button>
                )
              })}
            </div>
          )}

          {isManimVideo && semaTrack && (
            <button
              type="button"
              className={`wt-prompt-mode-btn${promptMode !== "off" ? " is-on" : ""}`}
              title={PROMPT_MODES.find(m => m.id === promptMode)?.title}
              onClick={cyclePromptMode}
            >
              {PROMPT_MODES.find(m => m.id === promptMode)?.label ?? "Tags"}
            </button>
          )}

          {isManimVideo && (
            <button
              type="button"
              className="wt-speed-btn"
              title="Playback speed"
              onClick={() => setRateIndex(i => (i + 1) % PLAYBACK_RATES.length)}
            >
              {playbackRate}×
            </button>
          )}

          <button
            type="button"
            className={`wt-icon-btn${voiceActive ? ' is-on' : ''}`}
            aria-label={voiceActive ? 'Mute voiceover' : 'Unmute voiceover'}
            title={
              !soundOn
                ? 'Sound is muted in the top bar'
                : voiceOn
                  ? 'Mute Andrew voiceover'
                  : 'Unmute Andrew voiceover'
            }
            onClick={onToggleVoice}
          >
            {voiceActive ? (
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.1" strokeLinecap="round" strokeLinejoin="round">
                <polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5" />
                <path d="M15.54 8.46a5 5 0 0 1 0 7.07" />
                <path d="M19.07 4.93a10 10 0 0 1 0 14.14" />
              </svg>
            ) : (
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.1" strokeLinecap="round" strokeLinejoin="round">
                <polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5" />
                <line x1="23" y1="9" x2="17" y2="15" />
                <line x1="17" y1="9" x2="23" y2="15" />
              </svg>
            )}
          </button>

          {onToggleFloat && (
            <button
              type="button"
              className="wt-icon-btn"
              aria-label={floating ? 'Dock walkthrough into lesson panel' : 'Pop walkthrough into floating window'}
              title={floating ? 'Dock into lesson panel' : 'Float window'}
              onClick={onToggleFloat}
            >
              {floating ? (
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.1" strokeLinecap="round" strokeLinejoin="round">
                  <rect x="3" y="4" width="18" height="16" rx="2.5" />
                  <line x1="9" y1="4" x2="9" y2="20" />
                </svg>
              ) : (
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.1" strokeLinecap="round" strokeLinejoin="round">
                  <rect x="3" y="3" width="18" height="18" rx="2.5" />
                  <path d="M14 3v6h7" />
                  <path d="M10 14 21 3" />
                </svg>
              )}
            </button>
          )}

          {!floating && (
            <button
              type="button"
              className="wt-icon-btn"
              aria-label="Close walkthrough"
              onClick={onClose}
            >
              <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.3" strokeLinecap="round">
                <path d="M18 6 6 18M6 6l12 12" />
              </svg>
            </button>
          )}
        </div>
      </header>

      {/* Step selector strip */}
      <div className="wt-steps-bar" role="tablist" aria-label="Problem steps">
        {spec.steps.map((st, idx) => {
          const active = beat.stepIndex === idx
          const matchingBeatIdx = lens.beats.findIndex(b => b.stepIndex === idx)
          return (
            <button
              key={st.id}
              type="button"
              role="tab"
              aria-selected={active}
              className={`wt-step-chip${active ? ' is-active' : ''}`}
              onClick={() => selectBeat(matchingBeatIdx >= 0 ? matchingBeatIdx : idx)}
            >
              <span className="wt-step-num">{st.stepNum}</span>
              <span className="wt-step-meta">
                <span className="wt-step-label">{st.label}</span>
                <span className="wt-step-eq">{st.equation}</span>
              </span>
            </button>
          )
        })}
      </div>

      {/* Main Manim Community Video Stage */}
      <div className={`wt-stage-frame${isManimVideo ? ' is-manim-video' : ''}`}>
        {isManimVideo && videoSrc ? (
          <div className="wt-video-wrap" onClick={togglePlay}>
            <video
              ref={videoRef}
              key={videoSrc}
              className="wt-manim-video"
              src={videoSrc}
              playsInline
              preload="auto"
              muted={!voiceActive}
              onLoadedMetadata={e => {
                const v = e.currentTarget
                v.muted = !voiceActive
                v.playbackRate = playbackRate
                if (Number.isFinite(v.duration)) setDuration(v.duration)
                if (pendingSeekRef.current !== null) {
                  v.currentTime = Math.min(v.duration - 0.05, Math.max(0, pendingSeekRef.current))
                  pendingSeekRef.current = null
                }
                if (playing) {
                  v.play().catch(() => {
                    v.muted = true
                    v.play().catch(() => {})
                  })
                }
              }}
              onEnded={() => {
                if (beatIndex < lens.beats.length - 1) {
                  selectBeat(beatIndex + 1)
                } else {
                  setProgress(1)
                  setPlaying(false)
                }
              }}
            />
            {!playing && (
              <button
                type="button"
                className="wt-video-center-play"
                aria-label="Play walkthrough video"
                onClick={e => {
                  e.stopPropagation()
                  togglePlay()
                }}
              >
                <svg width="24" height="24" viewBox="0 0 24 24" fill="currentColor">
                  <polygon points="7,4 20,12 7,20" />
                </svg>
              </button>
            )}
          </div>
        ) : (
          <div className="wt-static-fallback">
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

      {/* Caption bar with Sema companion + interactive Manim timeline scrubber */}
      <div className="wt-caption-card">
        <div className="wt-caption-top">
          {!semaTrack && (
            <div className="wt-caption-sema">
              <Sema
                state={semaState}
                expression={semaExpression}
                shape={semaShape}
                size={38}
                interactive
                followCursor={false}
                speakLevel={playing && isManimVideo ? 0.8 : 0}
                ariaLabel="Sema walkthrough companion"
              />
            </div>
          )}
          <div className="wt-caption-copy">
            <div className="wt-caption-title">{beat.title}</div>
            <p className="wt-caption-body">{beat.caption}</p>
          </div>
        </div>

        <div className="wt-player-controls">
          <button
            type="button"
            className="wt-play-btn"
            aria-label={playing ? 'Pause' : 'Play'}
            onClick={togglePlay}
          >
            {playing ? (
              <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor">
                <rect x="6" y="4" width="4.5" height="16" rx="1.2" />
                <rect x="13.5" y="4" width="4.5" height="16" rx="1.2" />
              </svg>
            ) : (
              <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor">
                <polygon points="6,4 20,12 6,20" />
              </svg>
            )}
          </button>

          <button
            type="button"
            className="wt-step-nav-btn"
            aria-label="Previous step"
            disabled={beatIndex === 0}
            onClick={() => selectBeat(beatIndex - 1)}
          >
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.3" strokeLinecap="round" strokeLinejoin="round">
              <polyline points="15 18 9 12 15 6" />
            </svg>
          </button>

          <div
            ref={trackRef}
            className={`wt-timeline-track${scrubbing ? ' is-scrubbing' : ''}`}
            role="slider"
            aria-label="Walkthrough timeline"
            aria-valuemin={0}
            aria-valuemax={100}
            aria-valuenow={Math.round(((beatIndex + progress) / lens.beats.length) * 100)}
            tabIndex={0}
            onPointerDown={e => {
              e.currentTarget.setPointerCapture(e.pointerId)
              setScrubbing(true)
              seekToClientX(e.clientX)
            }}
            onPointerMove={e => {
              if (!scrubbing) return
              seekToClientX(e.clientX)
            }}
            onPointerUp={e => {
              if (e.currentTarget.hasPointerCapture(e.pointerId)) {
                e.currentTarget.releasePointerCapture(e.pointerId)
              }
              setScrubbing(false)
            }}
          >
            {lens.beats.map((b, idx) => {
              const fillPct = idx < beatIndex ? 100 : idx === beatIndex ? progress * 100 : 0
              return (
                <div key={b.id} className="wt-timeline-seg">
                  <div className="wt-timeline-fill" style={{ width: `${fillPct}%` }} />
                </div>
              )
            })}
            <span
              className="wt-timeline-thumb"
              style={{
                left: `${((beatIndex + progress) / Math.max(1, lens.beats.length)) * 100}%`,
              }}
            />
          </div>

          <span className="wt-time-readout">
            {formatClock(progress * duration)} / {formatClock(duration)}
          </span>

          <button
            type="button"
            className="wt-step-nav-btn"
            aria-label="Next step"
            disabled={beatIndex >= lens.beats.length - 1}
            onClick={() => selectBeat(beatIndex + 1)}
          >
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.3" strokeLinecap="round" strokeLinejoin="round">
              <polyline points="9 18 15 12 9 6" />
            </svg>
          </button>
        </div>
      </div>

      {/* Still stuck? Rescue bridge */}
      {showRescue && rescueCourse && (
        <div className="wt-rescue-card">
          <div className="wt-rescue-text">
            <strong>{rescueCourse.title}</strong>
            <span>{spec.rescueMessage}</span>
          </div>
          <button
            type="button"
            className="wt-rescue-cta"
            onClick={() => onLaunchRescue(rescueCourse.id)}
          >
            Start {rescueCourse.minutes}-min catch-up →
          </button>
        </div>
      )}

      {/* Footer actions */}
      <footer className="wt-footer">
        <button
          type="button"
          className="wt-btn-secondary"
          onClick={() => setShowRescue(v => !v)}
        >
          {showRescue ? 'Hide catch-up' : 'Still stuck?'}
        </button>

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
  semaShape = 'circle',
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
  onToggleFloat?: () => void
  onToggleVoice: () => void
  onClose: () => void
  onLaunchRescue: (rescueLessonId: string) => void
}) {
  if (!spec || !open) return null

  return (
    <WinBoxWindow
      id="syntax-walkthrough-winbox"
      eyebrow="Guided walkthrough"
      title={spec.title}
      defaultWidth={688}
      defaultHeight={632}
      minWidth={320}
      minHeight={360}
      onClose={onClose}
    >
      <WalkthroughContent
        spec={spec}
        soundOn={soundOn}
        voiceOn={voiceOn}
        drawMode={drawMode}
        semaShape={semaShape}
        floating
        onToggleFloat={onToggleFloat}
        onToggleVoice={onToggleVoice}
        onClose={onClose}
        onLaunchRescue={onLaunchRescue}
      />
    </WinBoxWindow>
  )
}
