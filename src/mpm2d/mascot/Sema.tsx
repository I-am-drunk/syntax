import { useEffect, useId, useRef, useState } from 'react'
import {
  BotEngine,
  DEMI_VIEWBOX,
  NOTIF_BLUE,
  RAYON_BOULE,
  mixHex,
  resolveExpression,
  resolveShapeRadii,
  type BotFrame,
  type SemaExpressionName,
  type SemaShapeName,
  type StateId,
} from './bloub'
import './sema.css'

export type { SemaExpressionName, SemaShapeName, StateId }

/** Full set of supported Sema states: all 16 bloub morph animations + Sema legacy shorthand states */
export type SemaState =
  | StateId
  | 'speaking'
  | 'guiding'
  | 'nodding'
  | 'bobbing'
  | 'nudge'
  | 'celebrate'
  | 'focus'
  | 'spinner'

export type SemaLookPoint = {
  /** Normalized -1..1 horizontal target relative to Sema center */
  x: number
  /** Normalized -1..1 vertical target relative to Sema center (negative = up) */
  y: number
}

const R = RAYON_BOULE // 100
const VB = DEMI_VIEWBOX // 158

// Sema's signature semicolon comma tail scaled for R = 100 coordinate space (anchored below body at y ≈ 108)
const TAIL_PATH =
  'M -17,108 C -17,97 17,97 17,108 C 17,131 6,152 -15,166 C -21,169 -26,163 -22,157 C -9,146 -3,133 -4,122 C -13,120 -17,115 -17,108 Z'

// Crisp checkmark cutout stroke in R = 100 coordinate space (punched through mask during 'checkbox' state)
const CHECKBOX_CUTOUT_PATH = 'M -42,4 L -12,34 L 46,-28'

type ResolvedBehavior = {
  engineState: StateId
  expressionOverride?: SemaExpressionName
  bobAmp?: number
  bobFreq?: number
  nodPitchAmp?: number
  speakBounce?: boolean
}

function resolveSemaBehavior(state: SemaState): ResolvedBehavior {
  switch (state) {
    case 'speaking':
      return { engineState: 'idle', expressionOverride: 'attentive', speakBounce: true }
    case 'guiding':
      return { engineState: 'idle', expressionOverride: 'curious', bobAmp: 3.5, bobFreq: 2.0 }
    case 'nodding':
      return { engineState: 'idle', expressionOverride: 'proud', nodPitchAmp: 12 }
    case 'bobbing':
      return { engineState: 'idle', expressionOverride: 'happy', bobAmp: 5.5, bobFreq: 2.3 }
    case 'nudge':
      return { engineState: 'notify' }
    case 'celebrate':
      return { engineState: 'checkbox' }
    case 'focus':
      return { engineState: 'idle', expressionOverride: 'attentive' }
    case 'spinner':
      return { engineState: 'thinking' }
    default:
      return { engineState: state }
  }
}

type PokeReaction = { state: StateId; expression?: SemaExpressionName; dur: number }

const POKE_REACTIONS: PokeReaction[] = [
  { state: 'wink', dur: 1.35 },
  { state: 'checkbox', dur: 1.45 },
  { state: 'idle', expression: 'laughing', dur: 1.35 },
  { state: 'notify', dur: 1.55 },
  { state: 'wide', dur: 1.3 },
  { state: 'swirl', expression: 'excited', dur: 1.35 },
  { state: 'idle', expression: 'curious', dur: 1.3 },
  { state: 'orbit', dur: 1.9 },
  { state: 'idle', expression: 'proud', dur: 1.3 },
  { state: 'play', dur: 1.45 },
]

function clamp(v: number, lo: number, hi: number): number {
  return v < lo ? lo : v > hi ? hi : v
}

function detectDark(): boolean {
  return (
    typeof document !== 'undefined' &&
    document.documentElement.getAttribute('data-theme') === 'dark'
  )
}

export function Sema({
  state = 'idle',
  expression = 'neutral',
  shape = 'squircle',
  size = 64,
  interactive = true,
  followCursor = true,
  lookAt = null,
  speakLevel = 0,
  showTail = true,
  accentColor,
  className = '',
  ariaLabel = 'Sema mascot',
  onPoke,
}: {
  state?: SemaState
  expression?: SemaExpressionName
  shape?: SemaShapeName
  size?: number
  interactive?: boolean
  followCursor?: boolean
  lookAt?: SemaLookPoint | null
  speakLevel?: number
  showTail?: boolean
  accentColor?: string
  className?: string
  ariaLabel?: string
  onPoke?: () => void
}) {
  const uid = useId().replace(/:/g, '')
  const maskId = `sema-bloub-mask-${uid}`

  const svgRef = useRef<SVGSVGElement>(null)
  const rigRef = useRef<SVGGElement>(null)
  const stretchRef = useRef<SVGGElement>(null)
  const tailRef = useRef<SVGGElement>(null)

  const engineRef = useRef<BotEngine | null>(null)
  if (!engineRef.current) {
    const beh = resolveSemaBehavior(state)
    engineRef.current = new BotEngine(
      R,
      beh.engineState,
      resolveShapeRadii(shape),
      resolveExpression(beh.expressionOverride ?? expression),
    )
  }

  const [frame, setFrame] = useState<BotFrame>(() => engineRef.current!.sample(0))
  const [isDark, setIsDark] = useState<boolean>(detectDark)

  const statePropRef = useRef<SemaState>(state)
  const exprPropRef = useRef<SemaExpressionName>(expression)
  const shapePropRef = useRef<SemaShapeName>(shape)
  const followRef = useRef(followCursor)
  const lookAtRef = useRef(lookAt)
  const speakLevelRef = useRef(speakLevel)
  const showTailRef = useRef(showTail)
  const onPokeRef = useRef(onPoke)

  statePropRef.current = state
  exprPropRef.current = expression
  shapePropRef.current = shape
  followRef.current = followCursor
  lookAtRef.current = lookAt
  speakLevelRef.current = speakLevel
  showTailRef.current = showTail
  onPokeRef.current = onPoke

  // Interactive elastic drag + poke + trailing semicolon tail spring state
  const physRef = useRef({
    clock: 0,
    dragging: false,
    pointerId: -1,
    startClientX: 0,
    startClientY: 0,
    maxDistPx: 0,
    targetDx: 0,
    targetDy: 0,
    dx: 0,
    dy: 0,
    vx: 0,
    vy: 0,
    pokeScaleY: 1,
    pokeVy: 0,
    tailX: 0,
    tailY: 0,
    tailVx: 0,
    tailVy: 0,
    tailRot: 0,
    tailAlpha: 1,
    cursorX: 0,
    cursorY: 0,
    hasCursor: false,
    overrideReaction: null as PokeReaction | null,
    overrideUntil: 0,
    pokeIndex: 0,
  })

  // Track pointer for smooth cursor-following eye gaze
  useEffect(() => {
    const onMove = (e: PointerEvent) => {
      physRef.current.cursorX = e.clientX
      physRef.current.cursorY = e.clientY
      physRef.current.hasCursor = true
    }
    const onLeave = () => {
      physRef.current.hasCursor = false
    }
    window.addEventListener('pointermove', onMove, { passive: true })
    document.addEventListener('pointerleave', onLeave)
    return () => {
      window.removeEventListener('pointermove', onMove)
      document.removeEventListener('pointerleave', onLeave)
    }
  }, [])

  // Main 60fps animation loop powered by bloub's stateless BotEngine + Sema spring physics
  useEffect(() => {
    let raf = 0
    let lastTs = performance.now()
    let lookUpdateTimer = 0
    let darkCheckTimer = 0

    const tick = (nowMs: number) => {
      const dt = Math.min(0.05, Math.max(0.001, (nowMs - lastTs) * 0.001))
      lastTs = nowMs

      const p = physRef.current
      p.clock += dt
      const clock = p.clock
      const engine = engineRef.current!

      // Theme sync every ~150ms
      darkCheckTimer += dt
      if (darkCheckTimer > 0.15) {
        darkCheckTimer = 0
        const nextDark = detectDark()
        setIsDark(prev => (prev === nextDark ? prev : nextDark))
      }

      // Resolve effective state + expression (with temporary poke override)
      let activeState = statePropRef.current
      let activeExpr = exprPropRef.current
      if (p.overrideReaction && clock < p.overrideUntil) {
        activeState = p.overrideReaction.state
        if (p.overrideReaction.expression) activeExpr = p.overrideReaction.expression
      } else if (p.overrideReaction && clock >= p.overrideUntil) {
        p.overrideReaction = null
      }

      const beh = resolveSemaBehavior(activeState)
      const targetExpr = resolveExpression(beh.expressionOverride ?? activeExpr)
      const targetRadii = resolveShapeRadii(shapePropRef.current)

      engine.setState(beh.engineState, clock)
      engine.setExpression(targetExpr, clock)
      engine.setShape(targetRadii, clock)

      // Gaze target (explicit lookAt, nod oscillation, drag follow, or cursor tracking)
      lookUpdateTimer += dt
      if (lookUpdateTimer >= 0.032) {
        lookUpdateTimer = 0
        let lookYaw = 0
        let lookPitch = 0
        let lookMix = 0

        if (p.dragging) {
          lookYaw = clamp((p.dx / 44) * 32, -34, 34)
          lookPitch = clamp((-p.dy / 44) * 26, -28, 28)
          lookMix = 0.95
        } else if (lookAtRef.current) {
          lookYaw = clamp(lookAtRef.current.x * 34, -36, 36)
          lookPitch = clamp(-lookAtRef.current.y * 28, -30, 30)
          lookMix = 0.92
        } else if (beh.nodPitchAmp) {
          lookYaw = 4
          lookPitch = 6 + Math.sin(clock * Math.PI * 2 * 1.45) * beh.nodPitchAmp
          lookMix = 0.85
        } else if (followRef.current && p.hasCursor && svgRef.current) {
          const rect = svgRef.current.getBoundingClientRect()
          if (rect.width > 0 && rect.height > 0) {
            const cx = rect.left + rect.width * 0.5
            const cy = rect.top + rect.height * 0.45
            const nx = clamp((p.cursorX - cx) / 260, -1, 1)
            const ny = clamp((p.cursorY - cy) / 260, -1, 1)
            lookYaw = nx * 30
            lookPitch = -ny * 24
            lookMix = 0.88
          }
        }

        if (lookMix > 0.01) {
          engine.setLook({ yaw: lookYaw, pitch: lookPitch, mix: lookMix, spin: 0, wander: 0.12 }, clock)
        } else {
          engine.setLook(null, clock)
        }
      }

      // Sample bloub BotEngine frame
      const sampled = engine.sample(clock)
      setFrame(sampled)

      // Elastic drag spring
      const kPos = p.dragging ? 240 : 195
      const dPos = p.dragging ? 20 : 12.5
      p.vx += ((p.targetDx - p.dx) * kPos - p.vx * dPos) * dt
      p.vy += ((p.targetDy - p.dy) * kPos - p.vy * dPos) * dt
      p.dx += p.vx * dt
      p.dy += p.vy * dt

      // Squash & stretch poke spring
      p.pokeVy += ((1 - p.pokeScaleY) * 240 - p.pokeVy * 14) * dt
      p.pokeScaleY += p.pokeVy * dt

      // Extra bobbing / speech motion layered cleanly on the SVG rig
      let extraY = 0
      let extraScaleY = 1
      if (beh.bobAmp && beh.bobFreq) {
        extraY += Math.sin(clock * Math.PI * 2 * beh.bobFreq) * beh.bobAmp
      }
      if (beh.speakBounce && speakLevelRef.current > 0.05) {
        const pulse = Math.sin(clock * 14) * 0.5 + 0.5
        extraScaleY += pulse * 0.045 * speakLevelRef.current
        extraY -= pulse * 3.5 * speakLevelRef.current
      }

      const headX = p.dx
      const headY = p.dy + extraY
      const pullMag = Math.hypot(p.dx, p.dy)
      const pullAngleDeg = (Math.atan2(p.dy, p.dx) * 180) / Math.PI
      const stretchAmt = Math.min(0.22, pullMag * 0.0042)
      const stretchX = 1 + stretchAmt
      const stretchY = 1 / Math.sqrt(stretchX)
      const pokeSy = clamp(p.pokeScaleY, 0.74, 1.24) * extraScaleY
      const pokeSx = 1 / Math.sqrt(pokeSy)

      // Trailing semicolon tail spring
      const tailTargetX = headX * 0.72
      const tailTargetY = headY * 0.72
      p.tailVx += ((tailTargetX - p.tailX) * 135 - p.tailVx * 10.5) * dt
      p.tailVy += ((tailTargetY - p.tailY) * 135 - p.tailVy * 10.5) * dt
      p.tailX += p.tailVx * dt
      p.tailY += p.tailVy * dt
      const targetRot = clamp((headX - p.tailX) * 0.7, -20, 20)
      p.tailRot += (targetRot - p.tailRot) * Math.min(1, dt * 11)

      const wantsTail = showTailRef.current && sampled.baseBody && sampled.bodyAlpha > 0.6
      const tailGoal = wantsTail ? 1 : 0
      p.tailAlpha += (tailGoal - p.tailAlpha) * Math.min(1, dt * 10)

      if (rigRef.current) {
        rigRef.current.setAttribute(
          'transform',
          `translate(${headX.toFixed(2)} ${headY.toFixed(2)}) scale(${pokeSx.toFixed(3)} ${pokeSy.toFixed(3)})`,
        )
      }

      if (stretchRef.current) {
        if (stretchAmt > 0.002) {
          stretchRef.current.setAttribute(
            'transform',
            `rotate(${pullAngleDeg.toFixed(1)}) scale(${stretchX.toFixed(3)} ${stretchY.toFixed(3)}) rotate(${(-pullAngleDeg).toFixed(1)})`,
          )
        } else {
          stretchRef.current.removeAttribute('transform')
        }
      }

      if (tailRef.current) {
        tailRef.current.setAttribute(
          'transform',
          `translate(${p.tailX.toFixed(2)} ${p.tailY.toFixed(2)}) rotate(${p.tailRot.toFixed(2)} 0 112)`,
        )
        tailRef.current.setAttribute('opacity', p.tailAlpha.toFixed(3))
      }

      raf = requestAnimationFrame(tick)
    }

    raf = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(raf)
  }, [])

  const handlePointerDown = (e: React.PointerEvent<SVGSVGElement>) => {
    if (!interactive) return
    e.stopPropagation()
    const svg = svgRef.current
    if (!svg) return
    try {
      svg.setPointerCapture(e.pointerId)
    } catch {
      // ignore
    }
    const p = physRef.current
    p.dragging = true
    p.pointerId = e.pointerId
    p.startClientX = e.clientX
    p.startClientY = e.clientY
    p.maxDistPx = 0
    p.targetDx = 0
    p.targetDy = 0
    p.pokeVy -= 3.4
  }

  const handlePointerMove = (e: React.PointerEvent<SVGSVGElement>) => {
    const p = physRef.current
    if (!p.dragging || e.pointerId !== p.pointerId) return
    const dxPx = e.clientX - p.startClientX
    const dyPx = e.clientY - p.startClientY
    const distPx = Math.hypot(dxPx, dyPx)
    if (distPx > p.maxDistPx) p.maxDistPx = distPx

    const rect = svgRef.current?.getBoundingClientRect()
    const unitScale = rect && rect.width > 0 ? (VB * 2) / rect.width : 4
    const rawX = dxPx * unitScale
    const rawY = dyPx * unitScale
    const rawMag = Math.hypot(rawX, rawY)
    const maxPull = 54
    const dampedMag = maxPull * Math.tanh(rawMag / 80)
    const factor = rawMag > 0.001 ? dampedMag / rawMag : 0
    p.targetDx = rawX * factor
    p.targetDy = rawY * factor
  }

  const finishDragOrPoke = (e: React.PointerEvent<SVGSVGElement>) => {
    const p = physRef.current
    if (!p.dragging || e.pointerId !== p.pointerId) return
    p.dragging = false
    p.pointerId = -1
    p.targetDx = 0
    p.targetDy = 0

    try {
      svgRef.current?.releasePointerCapture(e.pointerId)
    } catch {
      // ignore
    }

    if (p.maxDistPx < 7) {
      p.pokeScaleY = 0.78
      p.pokeVy = 5.6
      const reaction = POKE_REACTIONS[p.pokeIndex % POKE_REACTIONS.length]!
      p.pokeIndex += 1
      p.overrideReaction = reaction
      p.overrideUntil = p.clock + reaction.dur
      onPokeRef.current?.()
    } else {
      p.pokeVy += 2.8
    }
  }

  const paper = isDark ? '#171717' : '#ffffff'
  const baseInk = accentColor ?? (isDark ? '#f2f2f2' : '#141414')
  const ink = frame.tintHex ?? baseInk

  const renderDot = (dot: BotFrame['dots'][number], key: string) => {
    const fill =
      dot.color ?? (dot.depth === undefined ? ink : mixHex(paper, ink, dot.depth))
    if (dot.d) {
      return (
        <path
          key={key}
          d={dot.d}
          fill={fill}
          opacity={dot.opacity}
          transform={`translate(${dot.x} ${dot.y}) rotate(${dot.rot ?? 0}) scale(${R})`}
        />
      )
    }
    return <circle key={key} cx={dot.x} cy={dot.y} r={dot.r} fill={fill} opacity={dot.opacity} />
  }

  const svgHeight = showTail ? Math.round(size * 1.12) : size
  const vbHeight = showTail ? VB * 2 + 34 : VB * 2

  return (
    <svg
      ref={svgRef}
      width={size}
      height={svgHeight}
      viewBox={`${-VB} ${-VB} ${VB * 2} ${vbHeight}`}
      className={`sema-svg${interactive ? ' is-interactive' : ''}${className ? ` ${className}` : ''}`}
      role="img"
      aria-label={ariaLabel}
      onPointerDown={handlePointerDown}
      onPointerMove={handlePointerMove}
      onPointerUp={finishDragOrPoke}
      onPointerCancel={finishDragOrPoke}
    >
      <defs>
        <mask
          id={maskId}
          maskUnits="userSpaceOnUse"
          x={-VB}
          y={-VB}
          width={VB * 2}
          height={vbHeight}
        >
          <path d={frame.bodyPath} fill="#ffffff" />
          {frame.eyes.map((eye, i) => (
            <path
              key={i}
              d={eye.d}
              transform={eye.matrix}
              opacity={eye.alpha}
              fill="#000000"
            />
          ))}
          {frame.notch && (
            <circle cx={frame.notch.x} cy={frame.notch.y} r={frame.notch.r} fill="#000000" />
          )}
          {frame.checkDraw > 0.01 && (
            <path
              d={CHECKBOX_CUTOUT_PATH}
              fill="none"
              stroke="#000000"
              strokeWidth="22"
              strokeLinecap="round"
              strokeLinejoin="round"
              pathLength={100}
              strokeDasharray="100"
              strokeDashoffset={(1 - frame.checkDraw) * 100}
            />
          )}
        </mask>

        {frame.arcs.map(arc => (
          <linearGradient
            key={arc.id}
            id={`${uid}-${arc.id}`}
            gradientUnits="userSpaceOnUse"
            x1={arc.grad.x1}
            y1={arc.grad.y1}
            x2={arc.grad.x2}
            y2={arc.grad.y2}
          >
            {arc.grad.stops.map((c, idx) => (
              <stop
                key={idx}
                offset={idx / Math.max(1, arc.grad.stops.length - 1)}
                stopColor={c}
              />
            ))}
          </linearGradient>
        ))}
      </defs>

      {/* Sema's trailing ';' semicolon comma tail (fades out cleanly on icon morphs) */}
      {showTail && (
        <g ref={tailRef}>
          <path d={TAIL_PATH} fill={ink} />
        </g>
      )}

      {/* Main animated bloub rig + elastic drag/poke transform */}
      <g ref={rigRef}>
        <g ref={stretchRef}>
          {/* Back half of 3D orbital rings / comet ribbons (occluded by body) */}
          {frame.arcs.length > 0 && (
            <g fill="none" strokeLinecap="round">
              {frame.arcs.map(arc => (
                <path
                  key={`b-${arc.id}`}
                  d={arc.back}
                  stroke={`url(#${uid}-${arc.id})`}
                  strokeWidth={arc.width}
                  opacity={arc.opacity}
                />
              ))}
            </g>
          )}

          {/* Background burst particles */}
          {frame.dotsBehind && frame.dots.length > 0 && (
            <g>{frame.dots.map((dot, i) => renderDot(dot, `db-${i}`))}</g>
          )}

          {/* Opaque body backing + masked silhouette (so orbital rings don't bleed through cutout eyes) */}
          <g opacity={frame.bodyAlpha}>
            <path d={frame.bodyPath} fill={paper} />
            <g mask={`url(#${maskId})`}>
              <rect x={-VB} y={-VB} width={VB * 2} height={vbHeight} fill={ink} />
            </g>
          </g>

          {/* Foreground dots (thinking dots, exclamation dot / italic teardrop) */}
          {!frame.dotsBehind && frame.dots.length > 0 && (
            <g>{frame.dots.map((dot, i) => renderDot(dot, `df-${i}`))}</g>
          )}

          {/* Popped blue notification badge */}
          {frame.notif && (
            <circle
              cx={frame.notif.x}
              cy={frame.notif.y}
              r={frame.notif.r}
              fill={NOTIF_BLUE}
            />
          )}

          {/* Front half of 3D orbital rings / comet ribbons */}
          {frame.arcs.length > 0 && (
            <g fill="none" strokeLinecap="round">
              {frame.arcs.map(arc => (
                <path
                  key={`f-${arc.id}`}
                  d={arc.front}
                  stroke={`url(#${uid}-${arc.id})`}
                  strokeWidth={arc.width}
                  opacity={arc.opacity}
                />
              ))}
            </g>
          )}
        </g>
      </g>
    </svg>
  )
}
