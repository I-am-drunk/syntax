import { useEffect, useRef, useState, type RefObject } from 'react'
import { createPortal } from 'react-dom'
import {
  Sema,
  SEMA_JENSON_HEAD_PATH,
  SEMA_REST_COMMA_PATHS,
  type SemaExpressionName,
  type SemaLookPoint,
  type SemaShapeName,
  type SemaState,
  type SemaTailName,
} from './Sema'
import './sema.css'

type Phase = 'docked' | 'roaming' | 'returning'

const SEMA_SIZE = 34
const SEMA_HEIGHT = Math.round(SEMA_SIZE * 1.28)
const CATCH_BUBBLE_SIZE = 136
const CATCH_BUBBLE_HALF = CATCH_BUBBLE_SIZE / 2
const IDLE_TRIGGER_MS = 45_000
const SLEEPY_AFTER_MS = 25_000
const HOVER_DELAY_MS = 280
const BOUNCE_CLICK_THRESHOLD = 10
const BOUNCE_COOLDOWN_MS = 10_000

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
  shape = 'jenson',
  tail = 'jenson',
  expression = 'neutral',
  hasNotification = false,
  onPoke,
  onLogoClick,
}: {
  enableRoaming?: boolean
  dockedIntoLogo?: boolean
  scrollContainerRef?: RefObject<HTMLElement | null>
  shape?: SemaShapeName
  tail?: SemaTailName
  expression?: SemaExpressionName
  hasNotification?: boolean
  onPoke?: () => void
  onLogoClick?: () => void
}) {
  const dockRef = useRef<HTMLDivElement>(null)
  const ghostRef = useRef<HTMLSpanElement>(null)
  const roamHostRef = useRef<HTMLDivElement>(null)

  const [phase, setPhase] = useState<Phase>('docked')
  const phaseRef = useRef<Phase>('docked')
  phaseRef.current = phase

  const [justLanded, setJustLanded] = useState(false)
  const [hoverBubble, setHoverBubble] = useState(false)
  const [isSleepy, setIsSleepy] = useState(false)
  const sleepyRef = useRef(false)
  const [logoPhase, setLogoPhase] = useState<'normal' | 'merging' | 'unmerging'>('normal')
  const prevDockedLogoRef = useRef(dockedIntoLogo)
  const [roamState, setRoamState] = useState<SemaState>('idle')
  const [roamExpr, setRoamExpr] = useState<SemaExpressionName>('happy')
  const [roamLook, setRoamLook] = useState<SemaLookPoint | null>(null)
  const [roamBubblePlacement, setRoamBubblePlacement] = useState<'top' | 'bottom'>('top')
  const roamBubblePlacementRef = useRef<'top' | 'bottom'>('top')
  const [scrolling, setScrolling] = useState(false)
  const scrollingRef = useRef(false)

  const hoverTimerRef = useRef<number>(0)
  const moodTimerRef = useRef<number>(0)
  const landingTimerRef = useRef<number>(0)
  const scrollEndTimerRef = useRef<number>(0)
  const lastActivityRef = useRef<number>(Date.now())
  const pokeCountRef = useRef<number>(0)
  const cooldownUntilRef = useRef<number>(0)

  // Center coordinates (cx, cy) and velocity of Sema in viewport space
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

  const launchRoaming = () => {
    if (phaseRef.current !== 'docked') return
    const rect = dockRef.current?.getBoundingClientRect()
    const startCx = rect ? rect.left + rect.width / 2 : 140
    const startCy = rect ? Math.max(76, rect.top + rect.height / 2) : 84

    const vx = (Math.random() > 0.3 ? 1 : -1) * (128 + Math.random() * 28)
    const vy = 94 + Math.random() * 28

    posRef.current = { x: startCx, y: startCy, vx, vy }
    pokeCountRef.current = 0
    cooldownUntilRef.current = Date.now() + BOUNCE_COOLDOWN_MS
    clearHover()
    setIsSleepy(false)
    setJustLanded(false)
    window.clearTimeout(moodTimerRef.current)

    setRoamState('idle')
    setRoamExpr('excited')
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
    window.clearTimeout(moodTimerRef.current)
    // Keep full body visible and smiling during the return glide so there is no dissolve/pop-in
    setRoamState('idle')
    setRoamExpr('happy')
    setRoamLook(null)
    // Damp existing roam velocity for a graceful boomerang arc home
    posRef.current.vx *= 0.25
    posRef.current.vy *= 0.25
    setPhase('returning')
  }

  // Idle timer for sleepy -> auto-roaming; ANY click, scroll, wheel, touch, or keypress immediately recalls Sema home!
  useEffect(() => {
    if (!enableRoaming) {
      if (phaseRef.current === 'roaming') recallToDock()
      sleepyRef.current = false
      setIsSleepy(false)
      pokeCountRef.current = 0
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

    const onUserInteract = () => {
      bumpActivity()
      if (phaseRef.current === 'roaming') {
        recallToDock()
      }
    }

    const pauseForScroll = () => {
      onUserInteract()
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
    window.addEventListener('keydown', onUserInteract, { passive: true })
    window.addEventListener('pointerdown', onUserInteract, { passive: true })
    window.addEventListener('touchstart', onUserInteract, { passive: true })
    window.addEventListener('wheel', pauseForScroll, { passive: true })
    window.addEventListener('scroll', pauseForScroll, { passive: true })
    scroller?.addEventListener('scroll', pauseForScroll, { passive: true })

    const idleCheck = window.setInterval(() => {
      if (phaseRef.current !== 'docked') return
      if (document.hidden) return
      const now = Date.now()
      const idleMs = now - lastActivityRef.current
      if (idleMs >= IDLE_TRIGGER_MS && now >= cooldownUntilRef.current) {
        launchRoaming()
      } else if (idleMs >= SLEEPY_AFTER_MS && !sleepyRef.current) {
        sleepyRef.current = true
        setIsSleepy(true)
      }
    }, 1000)

    return () => {
      window.removeEventListener('pointermove', bumpActivity)
      window.removeEventListener('keydown', onUserInteract)
      window.removeEventListener('pointerdown', onUserInteract)
      window.removeEventListener('touchstart', onUserInteract)
      window.removeEventListener('wheel', pauseForScroll)
      window.removeEventListener('scroll', pauseForScroll)
      scroller?.removeEventListener('scroll', pauseForScroll)
      window.clearInterval(idleCheck)
      window.clearTimeout(scrollEndTimerRef.current)
      scrollingRef.current = false
      setScrolling(false)
    }
  }, [enableRoaming, scrollContainerRef])

  // Wall-bouncing + smooth critically-damped return flight physics loop (never freeze 'returning' on scroll!)
  useEffect(() => {
    if (phase === 'docked' || (scrolling && phase === 'roaming')) return
    let raf = 0
    let lastTs = performance.now()
    let lookUpdateAcc = 0
    let bounceIdx = 0
    let cachedTarget: { x: number; y: number } | null = null
    const onResizeTarget = () => { cachedTarget = null }
    window.addEventListener('resize', onResizeTarget, { passive: true })

    const applyHostTransform = (cx: number, cy: number, scale = 1) => {
      const host = roamHostRef.current
      if (!host) return
      const tx = cx - CATCH_BUBBLE_HALF
      const ty = cy - CATCH_BUBBLE_HALF
      host.style.transform =
        scale === 1
          ? `translate3d(${tx.toFixed(2)}px, ${ty.toFixed(2)}px, 0)`
          : `translate3d(${tx.toFixed(2)}px, ${ty.toFixed(2)}px, 0) scale(${scale.toFixed(3)})`
    }

    const syncBubblePlacement = (cy: number) => {
      const next = cy < 142 ? 'bottom' : 'top'
      if (next === roamBubblePlacementRef.current) return
      roamBubblePlacementRef.current = next
      setRoamBubblePlacement(next)
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

        syncBubblePlacement(p.y)
        applyHostTransform(p.x, p.y)
      } else if (phaseRef.current === 'returning') {
        if (!cachedTarget) {
          const rect = dockRef.current?.getBoundingClientRect()
          cachedTarget = {
            x: rect ? rect.left + rect.width / 2 : 140,
            y: rect ? rect.top + rect.height / 2 : 32,
          }
        }
        const tx = cachedTarget.x
        const ty = cachedTarget.y

        // Critically-damped spring toward the exact docked slot center
        const omega = 13.5
        const dx = p.x - tx
        const dy = p.y - ty
        const exp = Math.exp(-omega * dt)
        const nextX = tx + (dx + (p.vx + omega * dx) * dt) * exp
        const nextY = ty + (dy + (p.vy + omega * dy) * dt) * exp
        p.vx = (p.vx - omega * (p.vx + omega * dx) * dt) * exp
        p.vy = (p.vy - omega * (p.vy + omega * dy) * dt) * exp
        p.x = nextX
        p.y = nextY

        const dist = Math.hypot(tx - p.x, ty - p.y)
        const speed = Math.hypot(p.vx, p.vy)

        // Smoothly fade the dashed dock ghost out as Sema glides in
        if (ghostRef.current) {
          const ghostAlpha = Math.max(0, Math.min(0.42, (dist - 12) / 72))
          ghostRef.current.style.opacity = ghostAlpha.toFixed(3)
        }

        // Look gently toward the dock during arrival
        lookUpdateAcc += dt
        if (lookUpdateAcc > 0.08 && dist > 6) {
          lookUpdateAcc = 0
          setRoamLook({
            x: ((tx - p.x) / dist) * 0.6,
            y: ((ty - p.y) / dist) * 0.5,
          })
        }

        // Subtle mid-flight lift scale that settles back to exact 1.0 before handoff
        const flightScale = 1 + Math.min(0.06, dist / 2600)
        applyHostTransform(p.x, p.y, flightScale)

        if (dist < 0.9 && speed < 38) {
          applyHostTransform(tx, ty, 1)
          cooldownUntilRef.current = Date.now() + BOUNCE_COOLDOWN_MS
          pokeCountRef.current = 0
          lastActivityRef.current = Date.now()
          setRoamState('idle')
          setRoamLook(null)
          setPhase('docked')
          setJustLanded(true)
          window.clearTimeout(landingTimerRef.current)
          landingTimerRef.current = window.setTimeout(() => setJustLanded(false), 320)
          return
        }
      }

      raf = requestAnimationFrame(step)
    }

    applyHostTransform(posRef.current.x, posRef.current.y)
    raf = requestAnimationFrame(step)

    return () => {
      cancelAnimationFrame(raf)
      window.removeEventListener('resize', onResizeTarget)
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
      window.clearTimeout(landingTimerRef.current)
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
    : logoPhase === 'unmerging' || justLanded
      ? 'happy'
      : hoverBubble
        ? 'happy'
        : isSleepy
          ? 'sleepy'
          : expression

  const isAway = phase !== 'docked'

  return (
    <>
      <div
        ref={dockRef}
        className="sema-topbar-dock"
        data-logo-phase={logoPhase}
        onPointerEnter={phase === 'docked' && !dockedIntoLogo ? handlePointerEnter : undefined}
        onPointerLeave={phase === 'docked' && !dockedIntoLogo ? clearHover : undefined}
      >
        {/* Keep docked Sema mounted and warmed during 'returning' for a 0-ms zero-flash handoff */}
        <div className={`sema-bubble-anchor sema-docked-wrap${isAway ? ' is-away' : ''}${justLanded ? ' is-landing' : ''}`}>
          <div className="sema-pixar-body">
            <Sema
              state={dockedState}
              expression={dockedExpression}
              shape={shape}
              tail={tail}
              size={SEMA_SIZE}
              interactive={!dockedIntoLogo && !isAway}
              followCursor={!dockedIntoLogo && !isAway}
              animationPaused={scrolling || phase === 'roaming' || dockedIntoLogo}
              ariaLabel="Sema: poke for expressions or drag to stretch"
              onPoke={() => {
                clearHover()
                lastActivityRef.current = Date.now()
                onPoke?.()
              }}
            />
          </div>

          {/* Frozen semicolon glyph Sema transforms into at the end of "Syntax;" (matches traced Sema PNG) */}
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
              width="15"
              height="27"
              viewBox="-122 -122 244 426"
              fill="none"
              aria-hidden="true"
              shapeRendering="geometricPrecision"
            >
              {shape === 'jenson' ? (
                <path d={SEMA_JENSON_HEAD_PATH} fill="currentColor" />
              ) : (
                <circle cx="0" cy="0" r="98" fill="currentColor" />
              )}
              <path d={SEMA_REST_COMMA_PATHS[tail] ?? SEMA_REST_COMMA_PATHS.jenson} fill="currentColor" />
            </svg>
          </button>

          {hoverBubble && !dockedIntoLogo && !isAway && (
            <div className="sema-speech-bubble" data-placement="bottom" role="tooltip">
              Hi, I’m Sema
            </div>
          )}
        </div>

        {isAway && <span ref={ghostRef} className="sema-topbar-dock-ghost" aria-hidden="true" />}
      </div>

      {isAway &&
        typeof document !== 'undefined' &&
        createPortal(
          <div
            ref={roamHostRef}
            className={`sema-roam-layer${phase === 'returning' ? ' is-returning' : ''}`}
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
              onPointerEnter={phase === 'roaming' ? handlePointerEnter : undefined}
              onPointerLeave={clearHover}
            >
              <span className="sema-bubble-anchor" style={{ pointerEvents: 'none' }}>
                <Sema
                  state={roamState}
                  expression={roamExpr}
                  shape={shape}
                  tail={tail}
                  size={SEMA_SIZE}
                  interactive={false}
                  followCursor={false}
                  animationPaused={scrolling && phase === 'roaming'}
                  lookAt={roamLook}
                  ariaLabel="Roaming Sema"
                />
                {hoverBubble && phase === 'roaming' && (
                  <span className="sema-speech-bubble" data-placement={roamBubblePlacement} aria-hidden="true">
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
