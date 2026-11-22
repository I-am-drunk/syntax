import { useEffect, useMemo, useRef, useState } from 'react'
import { AnimatePresence, motion } from 'framer-motion'
import { Sema, type SemaExpressionName, type SemaShapeName, type SemaState } from '../mascot/Sema'
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

const stageVariants = {
  enter: (dir: number) => ({
    x: dir >= 0 ? 30 : -30,
    opacity: 0,
    scale: 0.985,
  }),
  center: {
    x: 0,
    opacity: 1,
    scale: 1,
  },
  exit: (dir: number) => ({
    x: dir >= 0 ? -30 : 30,
    opacity: 0,
    scale: 0.985,
  }),
}

export function WalkthroughContent({
  spec,
  soundOn,
  voiceOn,
  semaShape = 'circle',
  inline = false,
  floating = false,
  onToggleFloat,
  onDragStart,
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
  onDragStart?: (e: React.PointerEvent) => void
  onToggleVoice: () => void
  onClose: () => void
  onLaunchRescue: (rescueLessonId: string) => void
}) {
  const [lensIndex, setLensIndex] = useState(0)
  const [beatIndex, setBeatIndex] = useState(0)
  const [stepDir, setStepDir] = useState(1)
  const [progress, setProgress] = useState(0)
  const [playing, setPlaying] = useState(true)
  const [showRescue, setShowRescue] = useState(false)
  const [scrubbing, setScrubbing] = useState(false)

  const audioRef = useRef<HTMLAudioElement | null>(null)
  const trackRef = useRef<HTMLDivElement>(null)
  const progressRef = useRef(0)
  progressRef.current = progress
  const prevSemaXRef = useRef(18)

  const lens = spec.lenses[lensIndex] ?? spec.lenses[0]!
  const beat = lens.beats[beatIndex] ?? lens.beats[0]!
  const hasVoiceClip = Boolean(beat.audioPath)
  const voiceActive = hasVoiceClip && soundOn && voiceOn

  useEffect(() => {
    setLensIndex(0)
    setBeatIndex(0)
    setStepDir(1)
    setProgress(0)
    setPlaying(true)
    setShowRescue(false)
  }, [spec.pageId])

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
      audio.addEventListener('loadedmetadata', () => {
        if (audio && Number.isFinite(audio.duration)) {
          audio.currentTime = progressRef.current * audio.duration
        }
      }, { once: true })
      if (playing && !scrubbing) {
        usingAudio = true
        audio.play().catch(() => {
          usingAudio = false
        })
      }
    }

    const tick = (now: number) => {
      const dt = Math.min(0.05, Math.max(0, (now - lastTs) * 0.001))
      lastTs = now

      if (playing && !scrubbing) {
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

    if (playing && !scrubbing) raf = requestAnimationFrame(tick)
    return () => {
      cancelAnimationFrame(raf)
      stopAudio()
    }
  }, [beat.id, beat.audioPath, beat.durationSec, playing, scrubbing, voiceActive])

  const cue = useMemo(() => activeCueForProgress(beat.cues, progress), [beat.cues, progress])
  const rescueLesson = CATCHUP_BY_ID.get(spec.rescueLessonId)

  // Compute subtle flight banking tilt as Sema glides horizontally across the stage
  const bankTilt = useMemo(() => {
    const dx = cue.semaX - prevSemaXRef.current
    prevSemaXRef.current = cue.semaX
    return Math.max(-13, Math.min(13, dx * 0.24))
  }, [cue.semaX])

  const selectBeat = (nextIdx: number) => {
    const clamped = Math.max(0, Math.min(lens.beats.length - 1, nextIdx))
    if (clamped === beatIndex) return
    setStepDir(clamped > beatIndex ? 1 : -1)
    setBeatIndex(clamped)
    setProgress(0)
    setPlaying(true)
  }

  const switchLens = (nextLensIdx: number) => {
    const nextLens = spec.lenses[nextLensIdx]
    if (!nextLens || nextLensIdx === lensIndex) return
    const targetBeat = Math.min(beatIndex, nextLens.beats.length - 1)
    setStepDir(nextLensIdx > lensIndex ? 1 : -1)
    setLensIndex(nextLensIdx)
    setBeatIndex(targetBeat)
    setProgress(0)
    setPlaying(true)
  }

  const handleReplay = () => {
    seek(0)
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

  const seekToClientX = (clientX: number) => {
    const rect = trackRef.current?.getBoundingClientRect()
    if (!rect || rect.width <= 0) return
    seek((clientX - rect.left) / rect.width)
  }

  const seek = (fraction: number) => {
    const val = Math.max(0, Math.min(1, fraction))
    setProgress(val)
    if (audioRef.current && Number.isFinite(audioRef.current.duration) && audioRef.current.duration > 0) {
      audioRef.current.currentTime = val * audioRef.current.duration
    }
  }

  const onTrackPointerDown = (e: React.PointerEvent<HTMLDivElement>) => {
    e.currentTarget.setPointerCapture(e.pointerId)
    setScrubbing(true)
    seekToClientX(e.clientX)
  }

  const onTrackPointerMove = (e: React.PointerEvent<HTMLDivElement>) => {
    if (!scrubbing) return
    seekToClientX(e.clientX)
  }

  const onTrackPointerUp = (e: React.PointerEvent<HTMLDivElement>) => {
    if (!scrubbing) return
    try {
      e.currentTarget.releasePointerCapture(e.pointerId)
    } catch {
      // ignore
    }
    setScrubbing(false)
  }

  const isFinalBeatDone = !playing && progress >= 0.99 && beatIndex === lens.beats.length - 1
  const semaActiveState: SemaState = showRescue
    ? 'notify'
    : isFinalBeatDone
      ? 'checkbox'
      : !playing && progress >= 0.99
        ? 'nodding'
        : !playing
          ? 'idle'
          : cue.semaState
  const semaActiveExpression: SemaExpressionName | undefined = showRescue
    ? 'curious'
    : !playing && progress >= 0.99
      ? 'proud'
      : !playing
        ? 'attentive'
        : undefined

  return (
    <div className={`wt-shell${inline ? ' is-inline' : ''}${floating ? ' is-floating' : ''}${playing ? ' is-playing' : ''}`}>
      <header
        className={`wt-header${onDragStart ? " is-draggable" : ""}`}
        onPointerDown={onDragStart}
      >
        <div className="wt-header-left">
          {onDragStart && (
            <span className="wt-drag-grip" aria-hidden="true" title="Drag window anywhere">
              ⋮⋮
            </span>
          )}
          <h2 className="wt-title">
            <span className="wt-eyebrow">Guided walkthrough · </span>
            {spec.title}
          </h2>
        </div>

        <div className="wt-header-right" onPointerDown={e => e.stopPropagation()}>
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
                    {active && (
                      <motion.span
                        layoutId="wt-lens-pill"
                        className="wt-lens-pill"
                        transition={{ type: 'spring', stiffness: 460, damping: 36 }}
                      />
                    )}
                    <span className="wt-lens-tab-label">{l.label}</span>
                  </button>
                )
              })}
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
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.1" strokeLinecap="round" strokeLinejoin="round">
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

          {rescueLesson && (
            <button
              type="button"
              className={`wt-top-stuck-btn${showRescue ? " is-open" : ""}`}
              aria-expanded={showRescue}
              onClick={() => setShowRescue(v => !v)}
            >
              <span>Still stuck?</span>
              <svg
                className="wt-top-stuck-chevron"
                width="12"
                height="12"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2.5"
                strokeLinecap="round"
                strokeLinejoin="round"
              >
                <polyline points="6 9 12 15 18 9" />
              </svg>
            </button>
          )}

          {onToggleFloat && (
            <button
              type="button"
              className={`wt-icon-btn${floating ? " is-on" : ""}`}
              aria-label={floating ? "Dock walkthrough to side panel" : "Pop out as draggable floating window"}
              title={floating ? "Dock to side panel" : "Pop out as draggable window"}
              onClick={onToggleFloat}
            >
              <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.1" strokeLinecap="round" strokeLinejoin="round">
                <rect x="3" y="3" width="18" height="18" rx="3" />
                <rect x="11" y="7" width="7" height="6" rx="1.2" fill="currentColor" fillOpacity="0.22" />
              </svg>
            </button>
          )}

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
        </div>
      </header>

      <AnimatePresence initial={false}>
        {showRescue && rescueLesson && (
          <motion.div
            key="wt-top-rescue"
            initial={{ opacity: 0, height: 0, y: -8 }}
            animate={{ opacity: 1, height: "auto", y: 0 }}
            exit={{ opacity: 0, height: 0, y: -8 }}
            transition={{ duration: 0.22, ease: [0.22, 1, 0.36, 1] }}
            className="wt-top-rescue-wrap"
          >
            <div className="wt-rescue-card is-top-dropdown">
              <div className="wt-rescue-copy">
                <strong>Catch-Up · {rescueLesson.title}</strong>
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
          </motion.div>
        )}
      </AnimatePresence>

      {spec.steps.length > 1 && (
        <div className="wt-current-step">
          <span className="wt-current-step-badge">Step {beat.stepIndex + 1}</span>
          <span className="wt-current-step-label">{spec.steps[beat.stepIndex]?.label ?? beat.title}</span>
          {spec.steps[beat.stepIndex]?.equation && (
            <span className="wt-current-step-eq">· {spec.steps[beat.stepIndex]?.equation}</span>
          )}
        </div>
      )}

      {/* Animated Stage with directional slide transitions + Flying Sema Choreography */}
      <div className="wt-stage-frame">
        <AnimatePresence mode="wait" custom={stepDir} initial={false}>
          <motion.div
            key={`${lens.id}:${beat.id}`}
            custom={stepDir}
            variants={stageVariants}
            initial="enter"
            animate="center"
            exit="exit"
            transition={{ type: 'spring', stiffness: 320, damping: 30, mass: 0.8 }}
            className="wt-stage-slide"
          >
            <WalkthroughStage beat={beat} progress={progress} />
          </motion.div>
        </AnimatePresence>

        {/* Flying Sema with velocity bank, breathing hover, and soft floor halo */}
        <motion.div
          className="wt-flying-sema"
          animate={{
            left: `${cue.semaX}%`,
            top: `${cue.semaY}%`,
            rotate: [bankTilt, bankTilt * 0.35, 0],
            scale: playing ? 1 : 0.96,
          }}
          transition={{
            left: { type: 'spring', stiffness: 165, damping: 20, mass: 0.78 },
            top: { type: 'spring', stiffness: 165, damping: 20, mass: 0.78 },
            rotate: { duration: 0.55, ease: 'easeOut' },
            scale: { duration: 0.2 },
          }}
        >
          <motion.div
            className="wt-sema-float-bob"
            animate={playing ? { y: [0, -4, 0] } : { y: 0 }}
            transition={{ duration: 2.2, repeat: Infinity, ease: 'easeInOut' }}
          >
            <Sema
              state={semaActiveState}
              expression={semaActiveExpression}
              shape={semaShape}
              size={52}
              interactive
              followCursor={false}
              lookAt={{ x: cue.lookX, y: cue.lookY }}
              speakLevel={playing ? 0.78 : 0}
              ariaLabel="Sema guiding this step"
            />
            <span className="wt-sema-halo" aria-hidden="true" />
          </motion.div>
        </motion.div>
      </div>

      {/* Sleek Brilliant Caption & Custom Interactive Segmented Timeline */}
      <div className="wt-caption-bar">
        <AnimatePresence mode="wait" custom={stepDir} initial={false}>
          <motion.div
            key={`cap-${lens.id}:${beat.id}`}
            initial={{ opacity: 0, y: 6 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -6 }}
            transition={{ duration: 0.18, ease: 'easeOut' }}
            className="wt-caption-text"
          >
            <strong>{beat.title}</strong>
            <ul className="wt-caption-bullets">
              {beat.caption
                .split(/(?<=[.!?])\s+/)
                .map(s => s.trim())
                .filter(Boolean)
                .map((sentence, idx) => (
                  <li key={idx}>{sentence}</li>
                ))}
            </ul>
          </motion.div>
        </AnimatePresence>

        <div className="wt-controls-row">
          <button
            type="button"
            className="wt-ctrl-btn is-play"
            aria-label={playing ? 'Pause' : 'Play'}
            onClick={handleTogglePlay}
          >
            {playing ? (
              <svg width="13" height="13" viewBox="0 0 24 24" fill="currentColor">
                <rect x="6" y="4" width="4.5" height="16" rx="1.2" />
                <rect x="13.5" y="4" width="4.5" height="16" rx="1.2" />
              </svg>
            ) : (
              <svg width="13" height="13" viewBox="0 0 24 24" fill="currentColor">
                <polygon points="7 4 20 12 7 20 7 4" />
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
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.3" strokeLinecap="round" strokeLinejoin="round">
              <polyline points="1 4 1 10 7 10" />
              <path d="M3.51 15a9 9 0 1 0 2.13-9.36L1 10" />
            </svg>
          </button>

          {/* Custom Brilliant interactive timeline bar (zero native range input) */}
          <div
            ref={trackRef}
            className={`wt-timeline-track${scrubbing ? ' is-scrubbing' : ''}`}
            role="slider"
            tabIndex={0}
            aria-label="Walkthrough progress"
            aria-valuemin={0}
            aria-valuemax={100}
            aria-valuenow={Math.round(progress * 100)}
            onPointerDown={onTrackPointerDown}
            onPointerMove={onTrackPointerMove}
            onPointerUp={onTrackPointerUp}
            onPointerCancel={onTrackPointerUp}
            onKeyDown={e => {
              const destination = ({
                ArrowRight: progress + 0.08,
                ArrowLeft: progress - 0.08,
                Home: 0,
                End: 1,
              } as Record<string, number>)[e.key]
              if (destination === undefined) return
              e.preventDefault()
              e.stopPropagation()
              seek(destination)
            }}
          >
            <div className="wt-timeline-rail">
              <div
                className="wt-timeline-fill"
                style={{ width: `${Math.round(progress * 1000) / 10}%` }}
              />
              {beat.cues.slice(1).map((c, idx) => (
                <span
                  key={idx}
                  className="wt-timeline-tick"
                  style={{ left: `${Math.round(c.at * 100)}%` }}
                />
              ))}
              <span
                className="wt-timeline-thumb"
                style={{ left: `${Math.round(progress * 1000) / 10}%` }}
              />
            </div>
          </div>

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

      {!floating && (
        <footer className="wt-footer">
          <span className="wt-footer-hint">
            Tip: drag the timeline or switch Visual / Algebra anytime
          </span>
          <button
            type="button"
            className="wt-primary-btn"
            onClick={onClose}
          >
            Got it, let me try
          </button>
        </footer>
      )}
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
  const [offset, setOffset] = useState({ x: 0, y: 0 })
  const dragRef = useRef<{ startX: number; startY: number; origX: number; origY: number } | null>(null)

  const handleDragStart = (e: React.PointerEvent) => {
    if (e.button !== 0) return
    e.preventDefault()
    dragRef.current = {
      startX: e.clientX,
      startY: e.clientY,
      origX: offset.x,
      origY: offset.y,
    }
    const onMove = (ev: PointerEvent) => {
      const d = dragRef.current
      if (!d) return
      const nx = Math.max(-window.innerWidth * 0.44, Math.min(window.innerWidth * 0.44, d.origX + (ev.clientX - d.startX)))
      const ny = Math.max(-window.innerHeight * 0.42, Math.min(window.innerHeight * 0.42, d.origY + (ev.clientY - d.startY)))
      setOffset({ x: nx, y: ny })
    }
    const onUp = () => {
      dragRef.current = null
      window.removeEventListener('pointermove', onMove)
      window.removeEventListener('pointerup', onUp)
      window.removeEventListener('pointercancel', onUp)
    }
    window.addEventListener('pointermove', onMove)
    window.addEventListener('pointerup', onUp)
    window.addEventListener('pointercancel', onUp)
  }

  if (!spec || !open) return null

  return (
    <div
      className="wt-floating-window"
      role="dialog"
      aria-label={`Guided walkthrough: ${spec.title}`}
      style={{
        transform: `translate3d(calc(-50% + ${Math.round(offset.x)}px), calc(-50% + ${Math.round(offset.y)}px), 0)`,
      }}
    >
      <WalkthroughContent
        spec={spec}
        soundOn={soundOn}
        voiceOn={voiceOn}
        drawMode={drawMode}
        semaShape={semaShape}
        floating
        onToggleFloat={onToggleFloat}
        onDragStart={handleDragStart}
        onToggleVoice={onToggleVoice}
        onClose={onClose}
        onLaunchRescue={onLaunchRescue}
      />
    </div>
  )
}
