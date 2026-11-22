import { useEffect, useMemo, useRef, useState } from 'react'
import { motion } from 'framer-motion'
import { Dialog } from '@base-ui/react/dialog'
import { Sema } from '../mascot/Sema'
import { assetUrl } from '../assetUrl'
import { CATCHUP_BY_ID } from '../data/catchupCourses'
import { WalkthroughStage } from './WalkthroughStage'
import type { WalkthroughCue, WalkthroughSpec } from './walkthroughData'
import './walkthrough.css'

function activeCueForProgress(cues: WalkthroughCue[], progress: number): WalkthroughCue {
  let chosen = cues[0] ?? {
    at: 0,
    semaX: 18,
    semaY: 22,
    lookX: 0.7,
    lookY: 0.4,
    semaState: 'speaking' as const,
  }
  for (const cue of cues) {
    if (progress >= cue.at) chosen = cue
  }
  return chosen
}

export function WalkthroughContent({
  spec,
  soundOn,
  voiceOn,
  inline = false,
  onToggleVoice,
  onClose,
  onLaunchRescue,
}: {
  spec: WalkthroughSpec
  soundOn: boolean
  voiceOn: boolean
  inline?: boolean
  onToggleVoice: () => void
  onClose: () => void
  onLaunchRescue: (rescueLessonId: string) => void
}) {
  const [lensIndex, setLensIndex] = useState(0)
  const [beatIndex, setBeatIndex] = useState(0)
  const [progress, setProgress] = useState(0)
  const [playing, setPlaying] = useState(true)
  const [showRescue, setShowRescue] = useState(false)

  const audioRef = useRef<HTMLAudioElement | null>(null)
  const progressRef = useRef(0)
  progressRef.current = progress

  const lens = spec.lenses[lensIndex] ?? spec.lenses[0]!
  const beat = lens.beats[beatIndex] ?? lens.beats[0]!
  const hasVoiceClip = Boolean(beat.audioPath)
  const voiceActive = hasVoiceClip && soundOn && voiceOn

  // Reset when spec changes
  useEffect(() => {
    setLensIndex(0)
    setBeatIndex(0)
    setProgress(0)
    setPlaying(true)
    setShowRescue(false)
  }, [spec.pageId])

  // Manage audio playback + 60fps smooth timeline clock
  useEffect(() => {
    let raf = 0
    let lastTs = performance.now()
    let audio: HTMLAudioElement | null = null
    let usingAudio = false

    const stopAudio = () => {
      if (audio) {
        audio.pause()
        audio.src = ''
        audio = null
      }
      audioRef.current = null
    }

    if (voiceActive && beat.audioPath) {
      audio = new Audio(assetUrl(beat.audioPath))
      audio.preload = 'auto'
      audioRef.current = audio
      audio.currentTime = Math.max(0, progressRef.current * beat.durationSec)
      if (playing) {
        usingAudio = true
        audio.play().catch(() => {
          // Autoplay blocked or offline: seamlessly fall back to rAF clock
          usingAudio = false
        })
      }
    }

    const tick = (now: number) => {
      const dt = Math.min(0.05, Math.max(0, (now - lastTs) * 0.001))
      lastTs = now

      if (playing) {
        if (usingAudio && audio && Number.isFinite(audio.duration) && audio.duration > 0.2 && !audio.paused) {
          const p = Math.min(1, audio.currentTime / audio.duration)
          setProgress(p)
          if (audio.ended || p >= 0.998) {
            setProgress(1)
            setPlaying(false)
            return
          }
        } else {
          const next = progressRef.current + dt / Math.max(2, beat.durationSec)
          if (next >= 1) {
            setProgress(1)
            setPlaying(false)
            return
          }
          setProgress(next)
        }
      }
      raf = requestAnimationFrame(tick)
    }

    raf = requestAnimationFrame(tick)
    return () => {
      cancelAnimationFrame(raf)
      stopAudio()
    }
  }, [beat.id, beat.audioPath, beat.durationSec, playing, voiceActive])

  const cue = useMemo(() => activeCueForProgress(beat.cues, progress), [beat.cues, progress])
  const rescueLesson = CATCHUP_BY_ID.get(spec.rescueLessonId)

  const selectBeat = (nextIdx: number) => {
    const clamped = Math.max(0, Math.min(lens.beats.length - 1, nextIdx))
    setBeatIndex(clamped)
    setProgress(0)
    setPlaying(true)
  }

  const switchLens = (nextLensIdx: number) => {
    const nextLens = spec.lenses[nextLensIdx]
    if (!nextLens) return
    const targetBeat = Math.min(beatIndex, nextLens.beats.length - 1)
    setLensIndex(nextLensIdx)
    setBeatIndex(targetBeat)
    setProgress(0)
    setPlaying(true)
  }

  const handleReplay = () => {
    setProgress(0)
    setPlaying(true)
  }

  const handleTogglePlay = () => {
    if (progress >= 0.99) {
      setProgress(0)
      setPlaying(true)
    } else {
      setPlaying(p => !p)
    }
  }

  const handleScrub = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = Number(e.target.value)
    setProgress(val)
    if (audioRef.current && Number.isFinite(audioRef.current.duration) && audioRef.current.duration > 0) {
      audioRef.current.currentTime = val * audioRef.current.duration
    }
  }

  const semaActiveState = showRescue
    ? 'nudge'
    : !playing && progress >= 0.99
      ? 'nodding'
      : !playing
        ? 'idle'
        : cue.semaState

  return (
    <div className={`wt-shell${inline ? ' is-inline' : ''}`}>
      <header className="wt-header">
        <div className="wt-header-left">
          <span className="wt-eyebrow">Walk me through</span>
          <h2 className="wt-title">{spec.title}</h2>
        </div>

        <div className="wt-header-right">
          {spec.lenses.length > 1 && (
            <div className="wt-lens-tabs" role="tablist" aria-label="Walkthrough lens">
              {spec.lenses.map((l, idx) => (
                <button
                  key={l.id}
                  type="button"
                  role="tab"
                  aria-selected={idx === lensIndex}
                  className={`wt-lens-tab${idx === lensIndex ? ' is-active' : ''}`}
                  onClick={() => switchLens(idx)}
                >
                  {l.label}
                </button>
              ))}
            </div>
          )}

          {hasVoiceClip && (
            <button
              type="button"
              className={`wt-icon-btn${voiceActive ? ' is-on' : ''}`}
              aria-label={voiceOn ? 'Mute Sema voice' : 'Enable Sema voice'}
              title={voiceOn ? 'Voice on' : 'Voice muted'}
              onClick={onToggleVoice}
            >
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5" />
                {voiceActive ? (
                  <>
                    <path d="M15.54 8.46a5 5 0 0 1 0 7.07" />
                    <path d="M19.07 4.93a10 10 0 0 1 0 14.14" />
                  </>
                ) : (
                  <>
                    <line x1="23" y1="9" x2="17" y2="15" />
                    <line x1="17" y1="9" x2="23" y2="15" />
                  </>
                )}
              </svg>
            </button>
          )}

          <button
            type="button"
            className="wt-icon-btn"
            aria-label="Close walkthrough"
            onClick={onClose}
          >
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round">
              <path d="M18 6 6 18M6 6l12 12" />
            </svg>
          </button>
        </div>
      </header>

      {/* Step Picker showing actual equations/expressions */}
      {spec.steps.length > 1 && (
        <div className="wt-step-picker" role="tablist" aria-label="Pick a step">
          {spec.steps.map((st, idx) => {
            const isActive = idx === beatIndex
            return (
              <button
                key={st.id}
                type="button"
                role="tab"
                aria-selected={isActive}
                className={`wt-step-btn${isActive ? ' is-active' : ''}`}
                onClick={() => selectBeat(idx)}
              >
                <span className="wt-step-num">{st.stepNum}</span>
                <span className="wt-step-eq">{st.equation}</span>
              </button>
            )
          })}
        </div>
      )}

      {/* Choreographed Live Animation Stage + Physically Flying Sema! */}
      <div className="wt-stage-frame">
        <WalkthroughStage beat={beat} progress={progress} />

        {/* Flying Sema Layer */}
        <motion.div
          className="wt-flying-sema"
          animate={{
            left: `${cue.semaX}%`,
            top: `${cue.semaY}%`,
          }}
          transition={{
            type: 'spring',
            stiffness: 155,
            damping: 20,
            mass: 0.9,
          }}
        >
          <div className="wt-sema-anchor">
            <Sema
              state={semaActiveState}
              size={52}
              interactive
              followCursor={false}
              lookAt={{ x: cue.lookX, y: cue.lookY }}
              speakLevel={playing && semaActiveState === 'speaking' ? 0.65 : 0}
              ariaLabel="Sema guiding walkthrough"
            />
            {cue.tag && (
              <motion.span
                key={cue.tag}
                className={`wt-sema-tag${cue.semaX > 62 ? ' is-left' : ' is-right'}`}
                initial={{ opacity: 0, scale: 0.88, y: 4 }}
                animate={{ opacity: 1, scale: 1, y: 0 }}
                transition={{ duration: 0.22 }}
              >
                {cue.tag}
              </motion.span>
            )}
          </div>
        </motion.div>
      </div>

      {/* Live Narration Caption & Playback Scrubber */}
      <div className="wt-caption-bar">
        <div className="wt-caption-text">
          <strong>{beat.title}</strong>
          <p>{beat.caption}</p>
        </div>

        <div className="wt-controls-row">
          <button
            type="button"
            className="wt-ctrl-btn"
            aria-label={playing ? 'Pause' : 'Play'}
            onClick={handleTogglePlay}
          >
            {playing ? (
              <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor">
                <rect x="6" y="4" width="4" height="16" rx="1" />
                <rect x="14" y="4" width="4" height="16" rx="1" />
              </svg>
            ) : (
              <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor">
                <polygon points="6 4 20 12 6 20 6 4" />
              </svg>
            )}
          </button>

          <button
            type="button"
            className="wt-ctrl-btn"
            aria-label="Replay step"
            title="Replay step"
            onClick={handleReplay}
          >
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
              <polyline points="1 4 1 10 7 10" />
              <path d="M3.51 15a9 9 0 1 0 2.13-9.36L1 10" />
            </svg>
          </button>

          <input
            type="range"
            min={0}
            max={1}
            step={0.005}
            value={progress}
            onChange={handleScrub}
            className="wt-scrubber"
            aria-label="Walkthrough timeline"
          />

          <div className="wt-step-nav">
            <button
              type="button"
              className="wt-ctrl-btn"
              disabled={beatIndex === 0}
              aria-label="Previous step"
              onClick={() => selectBeat(beatIndex - 1)}
            >
              ‹
            </button>
            <span className="wt-step-counter">
              {beatIndex + 1}/{lens.beats.length}
            </span>
            <button
              type="button"
              className="wt-ctrl-btn"
              disabled={beatIndex >= lens.beats.length - 1}
              aria-label="Next step"
              onClick={() => selectBeat(beatIndex + 1)}
            >
              ›
            </button>
          </div>
        </div>
      </div>

      {/* Optional "Still stuck?" Catch-Up Rescue Card */}
      {showRescue && rescueLesson && (
        <div className="wt-rescue-card">
          <div className="wt-rescue-copy">
            <strong>{rescueLesson.title}</strong>
            <p>{spec.rescueMessage}</p>
          </div>
          <button
            type="button"
            className="wt-rescue-launch"
            onClick={() => onLaunchRescue(rescueLesson.id)}
          >
            Start catch-up ({rescueLesson.minutes} min) →
          </button>
        </div>
      )}

      {/* Footer Actions */}
      <footer className="wt-footer">
        <button
          type="button"
          className="wt-secondary-btn"
          onClick={() => setShowRescue(v => !v)}
        >
          {showRescue ? 'Hide catch-up' : 'Still stuck?'}
        </button>

        <button
          type="button"
          className="wt-primary-btn"
          onClick={onClose}
        >
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
  onToggleVoice,
  onClose,
  onLaunchRescue,
}: {
  spec: WalkthroughSpec | null
  open: boolean
  soundOn: boolean
  voiceOn: boolean
  onToggleVoice: () => void
  onClose: () => void
  onLaunchRescue: (rescueLessonId: string) => void
}) {
  if (!spec) return null
  return (
    <Dialog.Root
      open={open}
      onOpenChange={v => {
        if (!v) onClose()
      }}
    >
      <Dialog.Portal>
        <Dialog.Backdrop className="wt-backdrop" />
        <Dialog.Popup className="wt-modal-popup" initialFocus={false}>
          {open && (
            <WalkthroughContent
              spec={spec}
              soundOn={soundOn}
              voiceOn={voiceOn}
              onToggleVoice={onToggleVoice}
              onClose={onClose}
              onLaunchRescue={onLaunchRescue}
            />
          )}
        </Dialog.Popup>
      </Dialog.Portal>
    </Dialog.Root>
  )
}
