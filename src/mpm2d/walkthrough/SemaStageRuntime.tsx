import { useEffect, useMemo, useRef, useState } from 'react'
import { Sema, type SemaExpressionName, type SemaShapeName, type SemaState, type SemaTailName } from '../mascot/Sema'
import {
  findActivePrompt,
  findActiveWordIndex,
  sampleSemaTrack,
  type SemaPromptDisplayMode,
  type SemaTrack,
} from './semaTrackTypes'

const POKE_QUIPS = [
  'Watch how the math moves!',
  'Grab and stretch me anytime!',
  'Pause the video and I will follow your cursor!',
  'Every color matches its step.',
]

const STRETCH_QUIPS = [
  'Boing! Back to the math!',
  'Whoa, stretchy!',
  'Wheee, right back on track!',
]

export function SemaStageRuntime({
  track,
  videoRef,
  playing,
  voiceOn,
  displayMode,
  userShape = 'jenson',
  userTail = 'jenson',
  fallbackCaption,
}: {
  track: SemaTrack | null
  videoRef: React.RefObject<HTMLVideoElement | null>
  playing: boolean
  voiceOn: boolean
  displayMode: SemaPromptDisplayMode
  userShape?: SemaShapeName
  userTail?: SemaTailName
  fallbackCaption?: string
}) {
  const actorRef = useRef<HTMLDivElement | null>(null)
  const stretchWrapRef = useRef<HTMLDivElement | null>(null)
  const haloRef = useRef<HTMLDivElement | null>(null)
  const tetherLineRef = useRef<SVGLineElement | null>(null)
  const tetherAnchorDotRef = useRef<SVGCircleElement | null>(null)

  // Flight spring + interactive elastic pull/stretch spring (60-120fps, zero React re-renders per frame!)
  const physRef = useRef({
    // Choreographed flight position (normalized 0..1)
    x: 0.16,
    y: 0.22,
    vx: 0,
    vy: 0,
    initialized: false,
    lastFrameMs: 0,
    // Interactive elastic pull offset (CSS pixels relative to choreographed perch)
    dragging: false,
    pointerId: -1,
    startClientX: 0,
    startClientY: 0,
    movedMaxPx: 0,
    targetPullX: 0,
    targetPullY: 0,
    pullX: 0,
    pullY: 0,
    pullVx: 0,
    pullVy: 0,
  })

  const [isStretching, setIsStretching] = useState(false)
  const [justSnapped, setJustSnapped] = useState(false)
  const snapTimerRef = useRef<number | null>(null)
  const [pokeQuip, setPokeQuip] = useState<string | null>(null)
  const pokeTimerRef = useRef<number | null>(null)
  const quipIdxRef = useRef(0)

  const [hud, setHud] = useState<{
    t: number
    x: number
    y: number
    lookX: number
    lookY: number
    state: SemaState
    expression?: SemaExpressionName
    shape: SemaShapeName
    speakingNow: boolean
    activeWordIdx: number
    isRightSide: boolean
  }>({
    t: 0,
    x: 0.16,
    y: 0.22,
    lookX: 0.5,
    lookY: 0.3,
    state: 'speaking',
    expression: 'attentive',
    shape: userShape,
    speakingNow: false,
    activeWordIdx: -1,
    isRightSide: false,
  })

  useEffect(() => {
    physRef.current.initialized = false
    setPokeQuip(null)
  }, [track])

  useEffect(() => {
    return () => {
      if (pokeTimerRef.current) window.clearTimeout(pokeTimerRef.current)
      if (snapTimerRef.current) window.clearTimeout(snapTimerRef.current)
    }
  }, [])

  useEffect(() => {
    physRef.current.initialized = false
    setHud(prev => ({ ...prev, t: 0, activeWordIdx: -1, speakingNow: false }))
  }, [track])

  const showTempQuip = (msg: string, durationMs = 2100) => {
    setPokeQuip(msg)
    if (pokeTimerRef.current) window.clearTimeout(pokeTimerRef.current)
    pokeTimerRef.current = window.setTimeout(() => setPokeQuip(null), durationMs)
  }

  // 60fps requestAnimationFrame loop locked directly to video.currentTime
  useEffect(() => {
    if (!track) return
    let rafId = 0
    let lastHudCommit = 0

    const tick = (nowMs: number) => {
      const p = physRef.current
      const dt = p.lastFrameMs ? Math.min(0.05, (nowMs - p.lastFrameMs) / 1000) : 1 / 60
      p.lastFrameMs = nowMs

      const video = videoRef.current
      const t = video ? video.currentTime : 0

      if (track) {
        const sample = sampleSemaTrack(track, t)
        if (!p.initialized) {
          p.x = sample.x
          p.y = sample.y
          p.vx = 0
          p.vy = 0
          p.initialized = true
        } else {
          // Flight spring
          const stiffness = 135
          const damping = 18.5
          const ax = (sample.x - p.x) * stiffness - p.vx * damping
          const ay = (sample.y - p.y) * stiffness - p.vy * damping
          p.vx += ax * dt
          p.vy += ay * dt
          p.x += p.vx * dt
          p.y += p.vy * dt
        }

        // Elastic pull & snap-back spring (juicy underdamped boing on release!)
        const kPull = p.dragging ? 340 : 235
        const dPull = p.dragging ? 24 : 10.2
        p.pullVx += ((p.targetPullX - p.pullX) * kPull - p.pullVx * dPull) * dt
        p.pullVy += ((p.targetPullY - p.pullY) * kPull - p.pullVy * dPull) * dt
        p.pullX += p.pullVx * dt
        p.pullY += p.pullVy * dt

        if (!p.dragging && Math.hypot(p.pullX, p.pullY) < 0.25 && Math.hypot(p.pullVx, p.pullVy) < 0.5) {
          p.pullX = 0
          p.pullY = 0
          p.pullVx = 0
          p.pullVy = 0
        }

        const pullMag = Math.hypot(p.pullX, p.pullY)
        const bankDeg = p.dragging ? 0 : Math.max(-15, Math.min(15, p.vx * 34))
        const bobPx = p.dragging ? 0 : Math.sin(nowMs * 0.0034) * (playing ? 3.2 : 2.0)
        const scale = sample.scale ?? 1

        if (actorRef.current) {
          actorRef.current.style.left = `${(p.x * 100).toFixed(3)}%`
          actorRef.current.style.top = `${(p.y * 100).toFixed(3)}%`
          actorRef.current.style.transform = `translate(-50%, -50%) translate3d(${p.pullX.toFixed(2)}px, ${(p.pullY + bobPx).toFixed(2)}px, 0) rotate(${bankDeg.toFixed(2)}deg) scale(${scale.toFixed(3)})`
        }

        // Directional elastic taffy stretch along the pull vector!
        if (stretchWrapRef.current) {
          if (pullMag > 1.5) {
            const angDeg = (Math.atan2(p.pullY, p.pullX) * 180) / Math.PI
            const stretchAmt = Math.min(0.46, pullMag * 0.0052)
            const sx = 1 + stretchAmt
            const sy = 1 / Math.sqrt(sx)
            stretchWrapRef.current.style.transform = `rotate(${angDeg.toFixed(1)}deg) scale(${sx.toFixed(3)}, ${sy.toFixed(3)}) rotate(${(-angDeg).toFixed(1)}deg)`
          } else {
            stretchWrapRef.current.style.transform = ''
          }
        }

        // Elastic tether connecting stretched Sema back to choreographed stage perch
        if (tetherLineRef.current && tetherAnchorDotRef.current) {
          if (pullMag > 6) {
            const opacity = Math.min(0.75, (pullMag - 6) / 48)
            tetherLineRef.current.setAttribute('x1', '0')
            tetherLineRef.current.setAttribute('y1', '0')
            tetherLineRef.current.setAttribute('x2', (-p.pullX).toFixed(1))
            tetherLineRef.current.setAttribute('y2', (-p.pullY).toFixed(1))
            tetherLineRef.current.style.opacity = opacity.toFixed(3)
            tetherAnchorDotRef.current.setAttribute('cx', (-p.pullX).toFixed(1))
            tetherAnchorDotRef.current.setAttribute('cy', (-p.pullY).toFixed(1))
            tetherAnchorDotRef.current.style.opacity = opacity.toFixed(3)
          } else {
            tetherLineRef.current.style.opacity = '0'
            tetherAnchorDotRef.current.style.opacity = '0'
          }
        }

        if (haloRef.current) {
          const haloScale = Math.max(0.45, 1 - bobPx * 0.025 - pullMag * 0.004)
          haloRef.current.style.transform = `translateX(-50%) scale(${haloScale.toFixed(3)})`
          haloRef.current.style.opacity = Math.max(0.12, 1 - pullMag / 110).toFixed(3)
        }

        // Throttle React HUD/gaze updates (~20Hz)
        if (nowMs - lastHudCommit > 48) {
          lastHudCommit = nowMs
          const wordIdx = findActiveWordIndex(track.words ?? [], t)
          const activeWord = wordIdx >= 0 ? track.words[wordIdx] : null
          const isVocalizing = Boolean(
            playing &&
              voiceOn &&
              activeWord &&
              t >= activeWord.start - 0.02 &&
              t <= activeWord.end + 0.06,
          )
          const resolvedShape = (sample.shape && sample.shape !== 'circle'
            ? sample.shape
            : userShape) as SemaShapeName

          // While pulling Sema, eyes look dramatically back toward the elastic tether anchor!
          let lookX = sample.lookX
          let lookY = sample.lookY
          if (pullMag > 8) {
            lookX = Math.max(-1, Math.min(1, -p.pullX / 55))
            lookY = Math.max(-1, Math.min(1, -p.pullY / 55))
          }

          const nextExpr = (sample.expression ?? undefined) as SemaExpressionName | undefined
          const nextIsRight = p.x > 0.6
          setHud(prev => {
            if (
              Math.abs(prev.t - t) < 0.04 &&
              prev.activeWordIdx === wordIdx &&
              prev.state === sample.state &&
              prev.expression === nextExpr &&
              prev.shape === resolvedShape &&
              prev.isRightSide === nextIsRight &&
              prev.speakingNow === isVocalizing &&
              Math.abs(prev.lookX - lookX) < 0.08 &&
              Math.abs(prev.lookY - lookY) < 0.08
            ) {
              return prev
            }
            return {
              t,
              x: p.x,
              y: p.y,
              lookX,
              lookY,
              state: sample.state,
              expression: (sample.expression ?? undefined) as SemaExpressionName | undefined,
              shape: resolvedShape,
              speakingNow: isVocalizing,
              activeWordIdx: wordIdx,
              isRightSide: p.x > 0.6,
            }
          })
        }
      }

      rafId = requestAnimationFrame(tick)
    }

    rafId = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(rafId)
  }, [track, videoRef, playing, voiceOn, userShape])

  const activePrompt = useMemo(() => findActivePrompt(track, hud.t), [track, hud.t])

  const subtitleChunk = useMemo(() => {
    const words = track?.words ?? []
    if (!words.length) return null
    const idx = Math.max(0, hud.activeWordIdx)
    const windowSize = 10
    const chunkStart = Math.floor(idx / windowSize) * windowSize
    const slice = words.slice(chunkStart, chunkStart + windowSize)
    return {
      words: slice,
      activeLocalIdx: hud.activeWordIdx >= 0 ? hud.activeWordIdx - chunkStart : -1,
    }
  }, [track, hud.activeWordIdx])

  // Interactive elastic grab-and-stretch handlers (completely isolated from video click-to-pause!)
  const handlePointerDown = (e: React.PointerEvent<HTMLDivElement>) => {
    if (e.button !== 0) return
    e.stopPropagation()
    e.preventDefault()
    const el = e.currentTarget
    try {
      el.setPointerCapture(e.pointerId)
    } catch {
      // ignore
    }
    const p = physRef.current
    p.dragging = true
    p.pointerId = e.pointerId
    p.startClientX = e.clientX
    p.startClientY = e.clientY
    p.movedMaxPx = 0
    setIsStretching(true)
  }

  const handlePointerMove = (e: React.PointerEvent<HTMLDivElement>) => {
    const p = physRef.current
    if (!p.dragging || p.pointerId !== e.pointerId) return
    e.stopPropagation()
    const rawX = e.clientX - p.startClientX
    const rawY = e.clientY - p.startClientY
    const rawDist = Math.hypot(rawX, rawY)
    if (rawDist > p.movedMaxPx) p.movedMaxPx = rawDist

    // Smooth asymptotic rubber-band resistance (max ~115px pull)
    const resisted = (rawDist / (1 + rawDist / 165)) * 0.92
    const ratio = rawDist > 0.001 ? resisted / rawDist : 0
    p.targetPullX = rawX * ratio
    p.targetPullY = rawY * ratio
  }

  const finishStretch = (e: React.PointerEvent<HTMLDivElement>) => {
    const p = physRef.current
    if (!p.dragging || p.pointerId !== e.pointerId) return
    e.stopPropagation()
    try {
      if (e.currentTarget.hasPointerCapture(e.pointerId)) {
        e.currentTarget.releasePointerCapture(e.pointerId)
      }
    } catch {
      // ignore
    }
    const maxPull = p.movedMaxPx
    p.dragging = false
    p.pointerId = -1
    p.targetPullX = 0
    p.targetPullY = 0
    setIsStretching(false)

    if (maxPull > 16) {
      setJustSnapped(true)
      if (snapTimerRef.current) window.clearTimeout(snapTimerRef.current)
      snapTimerRef.current = window.setTimeout(() => setJustSnapped(false), 950)
      const msg = STRETCH_QUIPS[quipIdxRef.current % STRETCH_QUIPS.length]!
      quipIdxRef.current += 1
      showTempQuip(msg, 1900)
    } else {
      const msg = POKE_QUIPS[quipIdxRef.current % POKE_QUIPS.length]!
      quipIdxRef.current += 1
      showTempQuip(msg, 2200)
    }
  }

  if (!track) return null
  const resolvedState: SemaState = isStretching
    ? 'wide'
    : justSnapped
      ? 'wink'
      : playing
        ? hud.state
        : 'idle'

  const resolvedExpression: SemaExpressionName | undefined = isStretching
    ? 'surprised'
    : justSnapped
      ? 'laughing'
      : playing
        ? hud.expression
        : 'curious'

  const showCallout =
    !isStretching &&
    !pokeQuip &&
    (displayMode === 'callout' || displayMode === 'all') &&
    Boolean(activePrompt?.callout)

  const showBubble =
    !isStretching &&
    (Boolean(pokeQuip) || ((displayMode === 'bubble' || displayMode === 'all') && Boolean(activePrompt?.say)))

  const showSubtitle = displayMode === 'subtitle' || displayMode === 'all'

  const sideClass =
    activePrompt?.side === 'left'
      ? 'is-left'
      : activePrompt?.side === 'right'
        ? 'is-right'
        : activePrompt?.side === 'top'
          ? 'is-top'
          : activePrompt?.side === 'bottom'
            ? 'is-bottom'
            : hud.isRightSide
              ? 'is-left'
              : 'is-right'

  const accentClass = activePrompt?.accent ? `accent-${activePrompt.accent}` : 'accent-blue'

  return (
    <div className="sema-runtime-layer">
      {/* Physically Flying, Grab-and-Stretchable Interactive Sema */}
      <div ref={actorRef} className="sema-runtime-actor">
        {/* Elastic tether SVG rendered behind Sema when stretched */}
        <svg className="sema-tether-svg" viewBox="-200 -200 400 400" aria-hidden="true">
          <line
            ref={tetherLineRef}
            className="sema-tether-line"
            x1="0"
            y1="0"
            x2="0"
            y2="0"
            style={{ opacity: 0 }}
          />
          <circle
            ref={tetherAnchorDotRef}
            className="sema-tether-dot"
            cx="0"
            cy="0"
            r="4.5"
            style={{ opacity: 0 }}
          />
        </svg>

        <div
          className={`sema-runtime-anchor${isStretching ? ' is-stretching' : ''}`}
          role="button"
          tabIndex={0}
          aria-label="Interact with Sema (press Enter to say hi, or drag to stretch)"
          onPointerDown={handlePointerDown}
          onPointerMove={handlePointerMove}
          onPointerUp={finishStretch}
          onPointerCancel={finishStretch}
          onClick={e => e.stopPropagation()}
          onKeyDown={e => {
            if (e.key !== 'Enter' && e.key !== ' ') return
            e.preventDefault()
            e.stopPropagation()
            const msg = POKE_QUIPS[quipIdxRef.current % POKE_QUIPS.length]!
            quipIdxRef.current += 1
            showTempQuip(msg, 2200)
          }}
          title="Grab & stretch Sema, or click to say hi (pause video for cursor eye-tracking)"
        >
          <div ref={haloRef} className="sema-runtime-halo" aria-hidden="true" />
          <div ref={stretchWrapRef} className="sema-stretch-wrap">
            <Sema
              state={resolvedState}
              expression={resolvedExpression}
              shape={hud.shape}
              tail={userTail}
              size={56}
              interactive={false}
              followCursor={!playing && !isStretching}
              lookAt={playing || isStretching ? { x: hud.lookX, y: hud.lookY } : null}
              speakLevel={hud.speakingNow && !isStretching ? 0.72 : 0}
              ariaLabel="Sema guiding walkthrough (drag to stretch)"
            />
          </div>

          {/* Compact Callout Pill Tag */}
          {showCallout && activePrompt?.callout && (
            <span
              key={activePrompt.callout}
              className={`sema-runtime-callout ${sideClass} ${accentClass}`}
            >
              <span className="sema-callout-dot" aria-hidden="true" />
              {activePrompt.callout}
            </span>
          )}

          {/* Optional Rich Sema Speech Bubble */}
          {showBubble && (pokeQuip || activePrompt?.say) && (
            <div
              key={pokeQuip ?? activePrompt?.say ?? 'bubble'}
              className={`sema-runtime-bubble ${sideClass} ${accentClass}`}
            >
              {pokeQuip ?? activePrompt?.say}
            </div>
          )}
        </div>
      </div>

      {/* Optional Word-Highlighted Karaoke CC Subtitle Bar */}
      {showSubtitle && (subtitleChunk || activePrompt?.subtitle || fallbackCaption) && (
        <div className="sema-runtime-cc-bar" role="status">
          <div className="sema-runtime-cc-pill">
            {subtitleChunk ? (
              subtitleChunk.words.map((w, i) => {
                const isActive = i === subtitleChunk.activeLocalIdx
                const isPast = subtitleChunk.activeLocalIdx >= 0 && i < subtitleChunk.activeLocalIdx
                return (
                  <span
                    key={`${w.start}-${i}`}
                    className={`sema-cc-word${isActive ? ' is-active' : ''}${isPast ? ' is-past' : ''}`}
                  >
                    {w.text}{' '}
                  </span>
                )
              })
            ) : (
              <span>{activePrompt?.subtitle ?? fallbackCaption ?? ''}</span>
            )}
          </div>
        </div>
      )}
    </div>
  )
}
