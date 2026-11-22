import { useEffect, useMemo, useRef, useState } from 'react'
import {
  BufferingIndicator,
  Container,
  Controls,
  ErrorDialog,
  FullscreenButton,
  Gesture,
  Hotkey,
  MuteButton,
  PlayButton,
  PlaybackRateButton,
  StatusAnnouncer,
  Time,
  TimeSlider,
  createPlayer,
  useCreateTextTrack,
  type TextCueInit,
} from '@videojs/react'
import { Video, videoFeatures } from '@videojs/react/video'
import { Sema, type SemaExpressionName, type SemaShapeName, type SemaState } from '../mascot/Sema'
import { assetUrl } from '../assetUrl'
import { CATCHUP_BY_ID } from '../data/catchupCourses'
import { BrilliantGraph } from '../graph/BrilliantGraph'
import { MathText } from '../components/MathText'
import { WinBoxWindow } from '../components/WinBoxWindow'
import type { WalkthroughLens, WalkthroughSpec } from './walkthroughData'
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
const CIRCLED_NUMS = ['①', '②', '③', '④', '⑤', '⑥']

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

function splitCaptionBullets(caption: string): string[] {
  const raw = caption
    .split(/(?:   ·   |(?<=[.!?])\s+)/)
    .map(s => s.trim())
    .filter(Boolean)
  return raw.length > 0 ? raw : [caption]
}

function findBeatIndexAtTime(lens: WalkthroughLens, timeSec: number): number {
  const chapters = lens.asset?.chapters
  if (!chapters || chapters.length === 0) return 0
  for (let i = chapters.length - 1; i >= 0; i--) {
    const ch = chapters[i]!
    if (timeSec >= ch.start - 0.05) {
      const idx = lens.beats.findIndex(b => b.id === ch.beatId)
      return idx >= 0 ? idx : i
    }
  }
  return 0
}

function WalkthroughChapterTrack({ cues }: { cues: readonly TextCueInit[] }) {
  useCreateTextTrack({
    kind: 'chapters',
    label: 'Steps',
    language: 'en',
    cues,
  })
  return null
}

function WalkthroughVideoStage({
  spec,
  lens,
  videoSrc,
  captionsSrc,
  semaTrack,
  voiceActive,
  promptMode,
  semaShape,
  beatIndex,
  seekRequest,
  onBeatChange,
  onPlayingChange,
  onToggleVoice,
}: {
  spec: WalkthroughSpec
  lens: WalkthroughLens
  videoSrc: string
  captionsSrc: string | null
  semaTrack: SemaTrack | null
  voiceActive: boolean
  promptMode: SemaPromptDisplayMode
  semaShape: SemaShapeName
  beatIndex: number
  seekRequest: { seq: number; time: number } | null
  onBeatChange: (idx: number) => void
  onPlayingChange: (playing: boolean) => void
  onToggleVoice: () => void
}) {
  const videoRef = useRef<HTMLVideoElement | null>(null)
  const store = usePlayer()
  const paused = usePlayer(s => s.paused)
  const ended = usePlayer(s => s.ended)
  const currentTime = usePlayer(s => s.currentTime)
  const muted = usePlayer(s => s.muted)

  const chapterCues = useMemo<readonly TextCueInit[]>(() => {
    const chapters = lens.asset?.chapters ?? []
    return chapters.map((ch, idx) => {
      const beat = lens.beats.find(b => b.id === ch.beatId) ?? lens.beats[idx]
      const step = spec.steps[beat?.stepIndex ?? idx]
      const circle = CIRCLED_NUMS[beat?.stepIndex ?? idx] ?? `${idx + 1}.`
      const text = step ? `${circle} ${step.label}` : (beat?.title ?? `Step ${idx + 1}`)
      return {
        id: ch.beatId,
        startTime: ch.start,
        endTime: ch.end,
        text,
      }
    })
  }, [lens, spec.steps])

  const playing = !paused && !ended

  useEffect(() => {
    onPlayingChange(playing)
  }, [playing, onPlayingChange])

  // Drive active beat/step index directly from playback position
  useEffect(() => {
    const idx = findBeatIndexAtTime(lens, currentTime)
    if (idx !== beatIndex) {
      onBeatChange(idx)
    }
  }, [currentTime, lens, beatIndex, onBeatChange])

  // Sync external voice preference into the player store
  useEffect(() => {
    const v = videoRef.current
    if (v && v.muted === voiceActive) {
      store.setMuted(!voiceActive)
    }
  }, [voiceActive, store, videoSrc])

  // Propagate user clicks on Video.js MuteButton back to app voice setting
  const prevMutedRef = useRef(muted)
  useEffect(() => {
    if (prevMutedRef.current !== muted) {
      prevMutedRef.current = muted
      const shouldBeMuted = !voiceActive
      if (muted !== shouldBeMuted) {
        onToggleVoice()
      }
    }
  }, [muted, voiceActive, onToggleVoice])

  // Apply explicit chapter / lens / theme seek requests smoothly
  const appliedSeekSeqRef = useRef(0)
  const pendingSeekTimeRef = useRef<number | null>(null)
  useEffect(() => {
    if (!seekRequest || seekRequest.seq === appliedSeekSeqRef.current) return
    appliedSeekSeqRef.current = seekRequest.seq
    const v = videoRef.current
    if (v && v.readyState >= 1) {
      store.seek(seekRequest.time)
      if (v.paused) {
        store.play().catch(() => {
          store.setMuted(true)
          store.play().catch(() => {})
        })
      }
    } else {
      pendingSeekTimeRef.current = seekRequest.time
    }
  }, [seekRequest, store])

  const jumpToBeat = (targetIdx: number) => {
    const chapters = lens.asset?.chapters
    if (!chapters || !chapters[targetIdx]) return
    const targetTime = chapters[targetIdx]!.start
    onBeatChange(targetIdx)
    store.seek(targetTime)
    store.play().catch(() => {})
  }

  return (
    <Container className="wt-vjs-container">
      <WalkthroughChapterTrack key={`${spec.pageId}-${lens.id}`} cues={chapterCues} />

      <Video
        ref={videoRef}
        className="wt-manim-video"
        src={videoSrc}
        playsInline
        preload="auto"
        muted={!voiceActive}
        onLoadedMetadata={e => {
          const v = e.currentTarget
          v.muted = !voiceActive
          if (pendingSeekTimeRef.current !== null && Number.isFinite(v.duration)) {
            v.currentTime = Math.min(Math.max(0, pendingSeekTimeRef.current), Math.max(0, v.duration - 0.05))
            pendingSeekTimeRef.current = null
          }
          v.play().catch(() => {
            v.muted = true
            v.play().catch(() => {})
          })
        }}
      >
        {captionsSrc && (
          <track kind="captions" src={captionsSrc} srcLang="en" label="English" />
        )}
      </Video>

      {/* Interactive Flying & Stretchable Sema Runtime Overlay */}
      <SemaStageRuntime
        track={semaTrack}
        videoRef={videoRef}
        playing={playing}
        voiceOn={voiceActive}
        displayMode={promptMode}
        userShape={semaShape}
        fallbackCaption={lens.beats[beatIndex]?.caption}
      />

      {/* Tap center to play/pause; double-tap sides to seek ±5s; double-tap center for fullscreen */}
      <Gesture type="tap" action="togglePaused" region="center" />
      <Gesture type="doubletap" action="seekStep" value={-5} region="left" />
      <Gesture type="doubletap" action="toggleFullscreen" region="center" />
      <Gesture type="doubletap" action="seekStep" value={5} region="right" />

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
                <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.3" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M3 12a9 9 0 1 0 3-6.7L3 8" />
                  <path d="M3 3v5h5" />
                </svg>
              ) : (
                <svg width="24" height="24" viewBox="0 0 24 24" fill="currentColor">
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
          <TimeSlider.Root className="wt-vjs-slider" pauseOnDrag step={1} largeStep={5}>
            <TimeSlider.Chapters
              className="wt-vjs-chapters"
              renderChapter={props => (
                <div {...props} className="wt-vjs-chapter">
                  <TimeSlider.Track className="wt-vjs-track">
                    <TimeSlider.Buffer className="wt-vjs-buffer" />
                    <TimeSlider.Fill className="wt-vjs-fill" />
                  </TimeSlider.Track>
                </div>
              )}
            />
            <TimeSlider.Thumb className="wt-vjs-thumb" />
            <TimeSlider.Preview className="wt-vjs-preview" overflow="clamp">
              <TimeSlider.ChapterTitle className="wt-vjs-preview-chapter" />
              <TimeSlider.Value type="pointer" className="wt-vjs-preview-time" />
            </TimeSlider.Preview>
          </TimeSlider.Root>

          <Controls.Group className="wt-vjs-bar" aria-label="Walkthrough playback controls">
            <div className="wt-vjs-bar-left">
              <PlayButton
                className="wt-vjs-btn is-primary"
                render={(props, state) => (
                  <button {...props} type="button">
                    {state.ended ? (
                      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.3" strokeLinecap="round" strokeLinejoin="round">
                        <path d="M3 12a9 9 0 1 0 3-6.7L3 8" />
                        <path d="M3 3v5h5" />
                      </svg>
                    ) : state.paused ? (
                      <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor">
                        <polygon points="6,4 20,12 6,20" />
                      </svg>
                    ) : (
                      <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor">
                        <rect x="6" y="4" width="4.5" height="16" rx="1.2" />
                        <rect x="13.5" y="4" width="4.5" height="16" rx="1.2" />
                      </svg>
                    )}
                  </button>
                )}
              />

              <button
                type="button"
                className="wt-vjs-btn"
                aria-label="Previous step"
                title="Previous step"
                disabled={beatIndex <= 0}
                onClick={() => jumpToBeat(Math.max(0, beatIndex - 1))}
              >
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.3" strokeLinecap="round" strokeLinejoin="round">
                  <polyline points="15 18 9 12 15 6" />
                </svg>
              </button>

              <button
                type="button"
                className="wt-vjs-btn"
                aria-label="Next step"
                title="Next step"
                disabled={beatIndex >= lens.beats.length - 1}
                onClick={() => jumpToBeat(Math.min(lens.beats.length - 1, beatIndex + 1))}
              >
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.3" strokeLinecap="round" strokeLinejoin="round">
                  <polyline points="9 18 15 12 9 6" />
                </svg>
              </button>

              <Time.Group className="wt-vjs-time">
                <Time.Value type="current" />
                <Time.Separator>/</Time.Separator>
                <Time.Value type="duration" />
              </Time.Group>
            </div>

            <div className="wt-vjs-bar-right">
              <PlaybackRateButton
                className="wt-vjs-pill-btn"
                rates={PLAYBACK_RATES}
                render={(props, state) => (
                  <button {...props} type="button">
                    {state.rate}×
                  </button>
                )}
              />

              <MuteButton
                className="wt-vjs-btn"
                render={(props, state) => (
                  <button {...props} type="button">
                    {state.muted || state.volumeLevel === 'off' ? (
                      <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.1" strokeLinecap="round" strokeLinejoin="round">
                        <polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5" />
                        <line x1="23" y1="9" x2="17" y2="15" />
                        <line x1="17" y1="9" x2="23" y2="15" />
                      </svg>
                    ) : (
                      <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.1" strokeLinecap="round" strokeLinejoin="round">
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
                      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                        <path d="M8 3v3a2 2 0 0 1-2 2H3m18 0h-3a2 2 0 0 1-2-2V3m0 18v-3a2 2 0 0 1 2-2h3M3 16h3a2 2 0 0 1 2 2v3" />
                      </svg>
                    ) : (
                      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
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
  semaShape = 'circle',
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
  const [seekRequest, setSeekRequest] = useState<{ seq: number; time: number } | null>(null)
  const seekSeqRef = useRef(0)

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

  const videoPath =
    theme === 'dark'
      ? (asset?.dark ?? asset?.light ?? null)
      : (asset?.light ?? asset?.dark ?? null)
  const videoSrc = videoPath ? assetUrl(videoPath) : null
  const captionsSrc = asset?.captions ? assetUrl(asset.captions) : null
  const trackUrl = asset?.sema ? assetUrl(asset.sema) : null
  const isManimVideo = Boolean(videoSrc)
  const voiceActive = soundOn && voiceOn

  const issueSeek = (time: number) => {
    seekSeqRef.current += 1
    setSeekRequest({ seq: seekSeqRef.current, time: Math.max(0, time) })
  }

  // Load merged Sema choreography track for the active lens
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

  // Reset on page or initial step switch
  useEffect(() => {
    const startLens = spec.lenses[0]!
    const clampedStep = Math.max(0, Math.min(startLens.beats.length - 1, initialStepIndex))
    setLensIndex(0)
    setBeatIndex(clampedStep)
    setPlaying(true)
    setShowRescue(false)
    const ch = startLens.asset?.chapters[clampedStep]
    issueSeek(ch ? ch.start : 0)
  }, [spec.pageId, initialStepIndex])

  // Preserve chapter position when user toggles Light <-> Dark theme mid-video
  const prevThemeRef = useRef(theme)
  useEffect(() => {
    if (prevThemeRef.current !== theme) {
      prevThemeRef.current = theme
      const ch = lens.asset?.chapters[beatIndex]
      if (ch) issueSeek(ch.start)
    }
  }, [theme, lens, beatIndex])

  const selectBeat = (nextIdx: number) => {
    const clamped = Math.max(0, Math.min(lens.beats.length - 1, nextIdx))
    setBeatIndex(clamped)
    const ch = lens.asset?.chapters[clamped]
    if (ch) issueSeek(ch.start)
  }

  const switchLens = (nextLensIdx: number) => {
    const nextLens = spec.lenses[nextLensIdx]
    if (!nextLens) return
    const targetBeat = Math.min(beatIndex, nextLens.beats.length - 1)
    setLensIndex(nextLensIdx)
    setBeatIndex(targetBeat)
    const ch = nextLens.asset?.chapters[targetBeat]
    issueSeek(ch ? ch.start : 0)
  }

  const rescueCourse = CATCHUP_BY_ID.get(spec.rescueLessonId)
  const captionBullets = useMemo(() => splitCaptionBullets(beat.caption), [beat.caption])

  const semaState: SemaState = showRescue ? 'nudge' : playing ? 'speaking' : 'idle'
  const semaExpression: SemaExpressionName | undefined = showRescue
    ? 'curious'
    : !playing
      ? 'attentive'
      : 'happy'

  return (
    <div
      className={`wt-shell${inline ? ' is-inline' : ''}${floating ? ' is-floating' : ''}${playing ? ' is-playing' : ''}`}
    >
      {/* Top toolbar: single-line title (when inline) + Visual/Algebra lens switcher + Sema prompt mode + Still stuck? dropdown trigger */}
      <header className="wt-toolbar">
        {!floating && (
          <h2 className="wt-title" title={`Guided walkthrough · ${spec.title}`}>
            <span className="wt-eyebrow">Guided walkthrough</span>
            <span className="wt-eyebrow-sep" aria-hidden="true">·</span>
            <span className="wt-title-main">{spec.title}</span>
          </h2>
        )}

        <div className="wt-toolbar-controls">
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
                    {l.label}
                  </button>
                )
              })}
            </div>
          )}

          {isManimVideo && semaTrack && (
            <button
              type="button"
              className={`wt-prompt-mode-btn${promptMode !== 'off' ? ' is-on' : ''}`}
              title={PROMPT_MODES.find(m => m.id === promptMode)?.title}
              onClick={cyclePromptMode}
            >
              {PROMPT_MODES.find(m => m.id === promptMode)?.label ?? 'Tags'}
            </button>
          )}

          {rescueCourse && (
            <button
              type="button"
              className={`wt-top-stuck-btn${showRescue ? ' is-open' : ''}`}
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
              >
                <polyline points="6 9 12 15 18 9" />
              </svg>
            </button>
          )}

          {!floating && onToggleFloat && (
            <button
              type="button"
              className="wt-icon-btn"
              aria-label="Pop walkthrough into floating window"
              title="Float window"
              onClick={onToggleFloat}
            >
              <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.1" strokeLinecap="round" strokeLinejoin="round">
                <rect x="3" y="3" width="18" height="18" rx="2.5" />
                <path d="M14 3v6h7" />
                <path d="M10 14 21 3" />
              </svg>
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
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.3" strokeLinecap="round">
                <path d="M18 6 6 18M6 6l12 12" />
              </svg>
            </button>
          )}
        </div>
      </header>

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

      {/* Focused single active-step banner at the top (no 3-tab clutter; full video scrubbable below) */}
      {activeStep && (
        <div className="wt-active-step-bar">
          <span className="wt-active-step-badge">
            Step {activeStep.stepNum} of {spec.steps.length}
          </span>
          <span className="wt-active-step-label">{activeStep.label}</span>
          <span className="wt-active-step-sep" aria-hidden="true">·</span>
          <span className="wt-active-step-eq">{activeStep.equation}</span>
        </div>
      )}

      {/* Video.js 10 Stage or Static Fallback */}
      <div className={`wt-stage-frame${isManimVideo ? ' is-manim-video' : ''}`}>
        {isManimVideo && videoSrc ? (
          <Player>
            <WalkthroughVideoStage
              spec={spec}
              lens={lens}
              videoSrc={videoSrc}
              captionsSrc={captionsSrc}
              semaTrack={semaTrack}
              voiceActive={voiceActive}
              promptMode={promptMode}
              semaShape={semaShape}
              beatIndex={beatIndex}
              seekRequest={seekRequest}
              onBeatChange={setBeatIndex}
              onPlayingChange={setPlaying}
              onToggleVoice={onToggleVoice}
            />
          </Player>
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
            {lens.beats.length > 1 && (
              <div className="wt-fallback-nav">
                <button
                  type="button"
                  className="wt-vjs-btn"
                  disabled={beatIndex <= 0}
                  onClick={() => selectBeat(beatIndex - 1)}
                >
                  ← Prev step
                </button>
                <span className="wt-step-counter">
                  {beatIndex + 1} / {lens.beats.length}
                </span>
                <button
                  type="button"
                  className="wt-vjs-btn"
                  disabled={beatIndex >= lens.beats.length - 1}
                  onClick={() => selectBeat(beatIndex + 1)}
                >
                  Next step →
                </button>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Bullet-formatted step summary card */}
      <div className="wt-caption-card">
        <div className="wt-caption-top">
          {(!isManimVideo || !semaTrack) && (
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
            <ul className="wt-caption-bullets">
              {captionBullets.map((item, i) => (
                <li key={i}>{item}</li>
              ))}
            </ul>
          </div>
        </div>
      </div>

      {/* Action-first footer */}
      <footer className="wt-footer">
        <span className="wt-footer-hint">
          {isManimVideo
            ? 'Drag Sema to stretch · Hover video for chapter timeline'
            : 'Use the step arrows to review each move'}
        </span>
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
      eyebrow="Guided walkthrough"
      title={spec.title}
      defaultWidth={688}
      defaultHeight={624}
      minWidth={320}
      minHeight={360}
      headerActions={headerActions}
      onClose={onClose}
    >
      <WalkthroughContent
        spec={spec}
        soundOn={soundOn}
        voiceOn={voiceOn}
        drawMode={drawMode}
        semaShape={semaShape}
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
