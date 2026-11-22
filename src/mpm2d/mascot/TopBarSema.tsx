import { useEffect, useRef, useState, type RefObject } from 'react'
import { createPortal } from 'react-dom'
import {
  Sema,
  type SemaDragLaunchInfo,
  type SemaExpressionName,
  type SemaLookPoint,
  type SemaShapeName,
  type SemaState,
} from './Sema'
import './sema.css'

type Phase = 'docked' | 'roaming' | 'returning'

const SEMA_SIZE = 34
const SEMA_HEIGHT = Math.round(SEMA_SIZE * 1.12)
const CATCH_BUBBLE_SIZE = 136
const CATCH_BUBBLE_HALF = CATCH_BUBBLE_SIZE / 2
const IDLE_TRIGGER_MS = 45_000
const SLEEPY_AFTER_MS = 25_000
const HOVER_DELAY_MS = 280

type BounceReaction = { state: SemaState; expression: SemaExpressionName }

const BOUNCE_REACTIONS: BounceReaction[] = [
  { state: 'idle', expression: 'surprised' },
  { state: 'wink', expression: 'happy' },
  { state: 'idle', expression: 'laughing' },
  { state: 'swirl', expression: 'excited' },
  { state: 'wide', expression: 'curious' },
  { state: 'orbit', expression: 'proud' },
  { state: 'checkbox', expression: 'happy' },
  { state: 'play', expression: 'excited' },
]

export function TopBarSema({
  enableRoaming = true,
  dockedIntoLogo = false,
  scrollContainerRef,
  shape = 'circle',
  expression = 'neutral',
  hasNotification = false,
  onPoke,
  onLogoClick,
}: {
  enableRoaming?: boolean
  dockedIntoLogo?: boolean
  scrollContainerRef?: RefObject<HTMLElement | null>
  shape?: SemaShapeName
  expression?: SemaExpressionName
  hasNotification?: boolean
  onPoke?: () => void
  onLogoClick?: () => void
}) {
  const dockRef = useRef<HTMLDivElement>(null)
  const roamHostRef = useRef<HTMLDivElement>(null)

  const [phase, setPhase] = useState<Phase>('docked')
  const phaseRef = useRef<Phase>('docked')
  phaseRef.current = phase

  const [hoverBubble, setHoverBubble] = useState(false)
  const [isSleepy, setIsSleepy] = useState(false)
  const sleepyRef = useRef(false)
  const [logoPhase, setLogoPhase] = useState<'normal' | 'merging' | 'unmerging'>('normal')
  const prevDockedLogoRef = useRef(dockedIntoLogo)
  const [roamState, setRoamState] = useState<SemaState>('idle')
  const [roamExpr, setRoamExpr] = useState<SemaExpressionName>('happy')
  const [roamLook, setRoamLook] = useState<SemaLookPoint | null>(null)
  const [scrolling, setScrolling] = useState(false)
  const scrollingRef = useRef(false)

  const hoverTimerRef = useRef<number>(0)
  const moodTimerRef = useRef<number>(0)
  const scrollEndTimerRef = useRef<number>(0)
  const lastActivityRef = useRef<number>(Date.now())

  // Center coordinates (cx, cy) of Sema in viewport space
  const posRef = useRef({ x: 140, y: 32, vx: 132, vy: 94 })

  const clearHover = () => {
    window.clearTimeout(hoverTimerRef.current)
    setHoverBubble(false)
  }

  const handlePointerEnter = () => {
    window.clearTimeout(hoverTimerRef.current)
    hoverTimerRef.current = window.setTimeout(() => {
      setHoverBubble(true)
    }, HOVER_DELAY_MS)
  }

  const launchRoaming = (fromDrag?: SemaDragLaunchInfo) => {
    if (phaseRef.current !== 'docked') return
    const rect = dockRef.current?.getBoundingClientRect()
    const startCx = fromDrag
      ? fromDrag.clientX
      : rect
        ? rect.left + rect.width / 2
        : 140
    const startCy = fromDrag
      ? Math.max(78, fromDrag.clientY)
      : rect
        ? Math.max(78, rect.top + rect.height / 2)
        : 84

    let vx = 148
    let vy = 104
    if (fromDrag) {
      const mag = Math.hypot(fromDrag.vx, fromDrag.vy)
      if (mag > 12) {
        const speed = Math.max(150, Math.min(235, mag * 0.45))
        vx = (fromDrag.vx / mag) * speed
        vy = (fromDrag.vy / mag) * speed
      } else {
        vx = (Math.random() > 0.5 ? 1 : -1) * 150
        vy = 115
      }
      if (Math.abs(vy) < 55) vy = vy >= 0 ? 75 : -75
      if (Math.abs(vx) < 55) vx = vx >= 0 ? 85 : -85
    } else {
      vx = (Math.random() > 0.3 ? 1 : -1) * (128 + Math.random() * 28)
      vy = 94 + Math.random() * 28
    }

    posRef.current = { x: startCx, y: startCy, vx, vy }
    clearHover()
    setIsSleepy(false)
    window.clearTimeout(moodTimerRef.current)

    setRoamState('idle')
    setRoamExpr(fromDrag ? 'surprised' : 'excited')
    setPhase('roaming')
    moodTimerRef.current = window.setTimeout(() => {
      if (phaseRef.current === 'roaming') {
        setRoamState('idle')
        setRoamExpr('happy')
      }
    }, 900)
  }

  const recallToDock = () => {
    if (phaseRef.current !== 'roaming') return
    clearHover()
    setRoamState('swirl')
    setRoamExpr('happy')
    setRoamLook(null)
    setPhase('returning')
  }

  // Idle timer for sleepy -> auto-roaming (does NOT recall when clicking/scrolling page!)
  useEffect(() => {
    if (!enableRoaming) {
      if (phaseRef.current === 'roaming') recallToDock()
      sleepyRef.current = false
      setIsSleepy(false)
      return
    }

    lastActivityRef.current = Date.now()
    const scroller = scrollContainerRef?.current

    const bumpActivity = () => {
      lastActivityRef.current = Date.now()
      if (sleepyRef.current) {
        sleepyRef.current = false
        setIsSleepy(false)
      }
    }

    const pauseForScroll = () => {
      bumpActivity()
      if (!scrollingRef.current) {
        scrollingRef.current = true
        setScrolling(true)
      }
      window.clearTimeout(scrollEndTimerRef.current)
      scrollEndTimerRef.current = window.setTimeout(() => {
        scrollingRef.current = false
        setScrolling(false)
      }, 140)
    }

    window.addEventListener('pointermove', bumpActivity, { passive: true })
    window.addEventListener('keydown', bumpActivity, { passive: true })
    window.addEventListener('wheel', pauseForScroll, { passive: true })
    window.addEventListener('pointerdown', bumpActivity, { passive: true })
    scroller?.addEventListener('scroll', pauseForScroll, { passive: true })

    const idleCheck = window.setInterval(() => {
      if (phaseRef.current !== 'docked') return
      if (document.hidden) return
      const idleMs = Date.now() - lastActivityRef.current
      if (idleMs >= IDLE_TRIGGER_MS) {
        launchRoaming()
      } else if (idleMs >= SLEEPY_AFTER_MS && !sleepyRef.current) {
        sleepyRef.current = true
        setIsSleepy(true)
      }
    }, 1000)

    return () => {
      window.removeEventListener('pointermove', bumpActivity)
      window.removeEventListener('keydown', bumpActivity)
      window.removeEventListener('wheel', pauseForScroll)
      window.removeEventListener('pointerdown', bumpActivity)
      scroller?.removeEventListener('scroll', pauseForScroll)
      window.clearInterval(idleCheck)
      window.clearTimeout(scrollEndTimerRef.current)
      scrollingRef.current = false
    }
  }, [enableRoaming, scrollContainerRef])

  // Wall-bouncing physics loop (uses center coords; host is CATCH_BUBBLE_SIZE square centered on Sema)
  useEffect(() => {
    if (phase === 'docked' || scrolling) return
    let raf = 0
    let lastTs = performance.now()
    let lookUpdateAcc = 0
    let bounceIdx = 0

    const applyHostTransform = (cx: number, cy: number) => {
      const host = roamHostRef.current
      if (!host) return
      const tx = cx - CATCH_BUBBLE_HALF
      const ty = cy - CATCH_BUBBLE_HALF
      host.style.transform = `translate3d(${tx.toFixed(1)}px, ${ty.toFixed(1)}px, 0)`
    }

    const step = (now: number) => {
      const dt = Math.min(0.05, Math.max(0.001, (now - lastTs) * 0.001))
      lastTs = now

      const p = posRef.current

      if (phaseRef.current === 'roaming') {
        p.x += p.vx * dt
        p.y += p.vy * dt

        const halfW = (SEMA_SIZE + 8) / 2
        const halfH = (SEMA_HEIGHT + 8) / 2
        const minX = 16 + halfW
        const maxX = Math.max(minX + 10, window.innerWidth - 16 - halfW)
        const minY = 72 + halfH
        const maxY = Math.max(minY + 10, window.innerHeight - 16 - halfH)

        let bounced = false
        if (p.x <= minX) {
          p.x = minX
          p.vx = Math.abs(p.vx)
          bounced = true
        } else if (p.x >= maxX) {
          p.x = maxX
          p.vx = -Math.abs(p.vx)
          bounced = true
        }

        if (p.y <= minY) {
          p.y = minY
          p.vy = Math.abs(p.vy)
          bounced = true
        } else if (p.y >= maxY) {
          p.y = maxY
          p.vy = -Math.abs(p.vy)
          bounced = true
        }

        if (bounced) {
          const r = BOUNCE_REACTIONS[bounceIdx % BOUNCE_REACTIONS.length]!
          bounceIdx += 1
          setRoamState(r.state)
          setRoamExpr(r.expression)
          window.clearTimeout(moodTimerRef.current)
          moodTimerRef.current = window.setTimeout(() => {
            if (phaseRef.current === 'roaming') {
              setRoamState('idle')
              setRoamExpr('happy')
            }
          }, 950)
        }

        lookUpdateAcc += dt
        if (lookUpdateAcc > 0.16) {
          lookUpdateAcc = 0
          const mag = Math.hypot(p.vx, p.vy) || 1
          setRoamLook({ x: (p.vx / mag) * 0.72, y: (p.vy / mag) * 0.62 })
        }

        applyHostTransform(p.x, p.y)
      } else if (phaseRef.current === 'returning') {
        const rect = dockRef.current?.getBoundingClientRect()
        const tx = rect ? rect.left + rect.width / 2 : 140
        const ty = rect ? rect.top + rect.height / 2 : 32

        const k = 1 - Math.exp(-11.5 * dt)
        p.x += (tx - p.x) * k
        p.y += (ty - p.y) * k

        applyHostTransform(p.x, p.y)

        if (Math.hypot(tx - p.x, ty - p.y) < 2.4) {
          setPhase('docked')
          setRoamState('idle')
          setRoamLook(null)
          lastActivityRef.current = Date.now()
          return
        }
      }

      raf = requestAnimationFrame(step)
    }

    applyHostTransform(posRef.current.x, posRef.current.y)
    raf = requestAnimationFrame(step)

    return () => {
      cancelAnimationFrame(raf)
      window.clearTimeout(moodTimerRef.current)
    }
  }, [phase, scrolling])

  useEffect(() => {
    const prev = prevDockedLogoRef.current
    prevDockedLogoRef.current = dockedIntoLogo
    if (dockedIntoLogo) {
      clearHover()
      setIsSleepy(false)
      if (phaseRef.current !== 'docked') {
        setPhase('docked')
      }
      setLogoPhase('merging')
      return
    }
    if (prev && !dockedIntoLogo) {
      setLogoPhase('unmerging')
      const t = window.setTimeout(() => setLogoPhase('normal'), 560)
      return () => window.clearTimeout(t)
    }
    setLogoPhase('normal')
  }, [dockedIntoLogo])

  useEffect(() => {
    return () => {
      window.clearTimeout(hoverTimerRef.current)
      window.clearTimeout(moodTimerRef.current)
      window.clearTimeout(scrollEndTimerRef.current)
    }
  }, [])

  const dockedState: SemaState = dockedIntoLogo
    ? 'idle'
    : !hoverBubble && !isSleepy && hasNotification
      ? 'notify'
      : 'idle'
  const dockedExpression: SemaExpressionName = dockedIntoLogo
    ? 'surprised'
    : logoPhase === 'unmerging'
      ? 'happy'
      : hoverBubble
        ? 'happy'
        : isSleepy
          ? 'sleepy'
          : expression

  return (
    <>
      <div
        ref={dockRef}
        className="sema-topbar-dock"
        data-logo-phase={logoPhase}
        onPointerEnter={phase === 'docked' && !dockedIntoLogo ? handlePointerEnter : undefined}
        onPointerLeave={phase === 'docked' && !dockedIntoLogo ? clearHover : undefined}
      >
        {phase === 'docked' ? (
          <div className="sema-bubble-anchor">
            <div className="sema-pixar-body">
              <Sema
                state={dockedState}
                expression={dockedExpression}
                shape={shape}
                size={SEMA_SIZE}
                interactive={!dockedIntoLogo}
                followCursor={!dockedIntoLogo}
                dragLaunchThresholdPx={enableRoaming && !dockedIntoLogo ? 148 : undefined}
                animationPaused={scrolling}
                onDragLaunch={
                  enableRoaming && !dockedIntoLogo
                    ? info => {
                        onPoke?.()
                        launchRoaming(info)
                      }
                    : undefined
                }
                ariaLabel="Sema — poke for expressions, or drag out far to let them bounce around"
                onPoke={() => {
                  clearHover()
                  onPoke?.()
                  if (enableRoaming && Math.floor(Math.random() * 16) === 0) {
                    launchRoaming()
                  }
                }}
              />
            </div>

            {/* Frozen semicolon glyph Sema transforms into at the end of "Syntax;" */}
            <button
              type="button"
              className="sema-frozen-semicolon"
              tabIndex={dockedIntoLogo ? 0 : -1}
              aria-label="Exit Settings and wake Sema"
              title="Back to Unit 2"
              onClick={() => onLogoClick?.()}
            >
              <svg
                className="sema-frozen-semicolon-svg"
                width="14"
                height="32"
                viewBox="0 0 14 32"
                fill="none"
                aria-hidden="true"
                shapeRendering="geometricPrecision"
              >
                <rect x="4" y="6.5" width="6.2" height="6.2" rx="2.4" fill="currentColor" />
                <path
                  d="M4.2 17.5C4.2 16.1 5.3 15 6.8 15H8C9.4 15 10.4 16.1 10.3 17.6C10.1 21.6 8.3 25 4.4 27.6C3.7 28.1 2.8 27.4 3.2 26.6C4.7 23.9 5.2 22.1 5.2 20.5C4.6 19.7 4.2 18.7 4.2 17.5Z"
                  fill="currentColor"
                />
              </svg>
            </button>

            {hoverBubble && !dockedIntoLogo && (
              <div className="sema-speech-bubble" data-placement="bottom" role="tooltip">
                Hi, I’m Sema
              </div>
            )}
          </div>
        ) : (
          <span className="sema-topbar-dock-ghost" aria-hidden="true" />
        )}
      </div>

      {phase !== 'docked' &&
        typeof document !== 'undefined' &&
        createPortal(
          <div
            ref={roamHostRef}
            className="sema-roam-layer"
            style={{ width: CATCH_BUBBLE_SIZE, height: CATCH_BUBBLE_SIZE }}
          >
            {/* Generous invisible circular catch bubble so clicking a moving Sema is effortless */}
            <button
              type="button"
              className="sema-roam-catch-bubble"
              aria-label="Catch Sema and return to top bar"
              onPointerDown={e => {
                e.stopPropagation()
                onPoke?.()
                recallToDock()
              }}
              onPointerEnter={handlePointerEnter}
              onPointerLeave={clearHover}
            >
              <span className="sema-bubble-anchor" style={{ pointerEvents: 'none' }}>
                <Sema
                  state={roamState}
                  expression={roamExpr}
                  shape={shape}
                  size={SEMA_SIZE}
                  interactive={false}
                  followCursor={false}
                  animationPaused={scrolling}
                  lookAt={roamLook}
                  ariaLabel="Roaming Sema"
                />
                {hoverBubble && (
                  <span className="sema-speech-bubble" data-placement="top" aria-hidden="true">
                    Catch me!
                  </span>
                )}
              </span>
            </button>
          </div>,
          document.body,
        )}
    </>
  )
}
