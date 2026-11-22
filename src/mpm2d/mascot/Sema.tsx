import { useEffect, useId, useRef } from 'react'
import {
  HEAD_RADIUS,
  SemaEngine,
  clamp,
  lerp,
  squircleHeadPath,
  type SemaState,
} from './semaEngine'
import './sema.css'

export type { SemaState }

export type SemaLookPoint = {
  /** Normalized -1..1 horizontal target relative to Sema center */
  x: number
  /** Normalized -1..1 vertical target relative to Sema center (negative = up) */
  y: number
}

const HEAD_PATH = squircleHeadPath(HEAD_RADIUS, 2.55)

// Classic expressive semicolon comma tail path anchored around (0, 74)
const TAIL_PATH =
  'M -12,68 C -12,60 12,60 12,68 C 12,84 4,99 -10,109 C -14,111 -18,107 -15,103 C -6,95 -2,86 -3,78 C -9,77 -12,73 -12,68 Z'

const POKE_CYCLE: SemaState[] = ['wink', 'celebrate', 'nodding', 'bobbing']

function resolveEyeColor(
  tint: 'default' | 'blue' | 'green' | 'amber',
  isDark: boolean,
): string {
  switch (tint) {
    case 'blue':
      return isDark ? '#7491ff' : '#456dff'
    case 'green':
      return '#29cc57'
    case 'amber':
      return isDark ? '#f9d25c' : '#e0a810'
    default:
      return isDark ? '#141414' : '#ffffff'
  }
}

export function Sema({
  state = 'idle',
  size = 64,
  interactive = true,
  followCursor = true,
  lookAt = null,
  speakLevel = 0,
  className = '',
  ariaLabel = 'Sema mascot',
  onPoke,
}: {
  state?: SemaState
  size?: number
  interactive?: boolean
  followCursor?: boolean
  lookAt?: SemaLookPoint | null
  speakLevel?: number
  className?: string
  ariaLabel?: string
  onPoke?: () => void
}) {
  const uid = useId().replace(/:/g, '')
  const maskId = `sema-mask-${uid}`

  const svgRef = useRef<SVGSVGElement>(null)
  const headRigRef = useRef<SVGGElement>(null)
  const stretchRigRef = useRef<SVGGElement>(null)
  const tailRigRef = useRef<SVGGElement>(null)
  const eyeBgRef = useRef<SVGPathElement>(null)
  const bodyFillRef = useRef<SVGRectElement>(null)
  const tailFillRef = useRef<SVGPathElement>(null)
  const eye0Ref = useRef<SVGPathElement>(null)
  const eye1Ref = useRef<SVGPathElement>(null)
  const arc0Ref = useRef<SVGPathElement>(null)
  const arc1Ref = useRef<SVGPathElement>(null)
  const sparkleGroupRef = useRef<SVGGElement>(null)

  const engineRef = useRef<SemaEngine | null>(null)
  if (!engineRef.current) {
    engineRef.current = new SemaEngine()
  }

  const statePropRef = useRef<SemaState>(state)
  const followRef = useRef(followCursor)
  const lookAtRef = useRef(lookAt)
  const speakLevelRef = useRef(speakLevel)
  const onPokeRef = useRef(onPoke)

  statePropRef.current = state
  followRef.current = followCursor
  lookAtRef.current = lookAt
  speakLevelRef.current = speakLevel
  onPokeRef.current = onPoke

  // Interactive spring physics & pointer tracking refs (zero React re-renders per frame)
  const physRef = useRef({
    // Drag / tether spring (SVG coordinate units)
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
    // Poke squash spring
    pokeScaleY: 1,
    pokeVy: 0,
    // Trailing comma tail spring (120ms follow-through)
    tailX: 0,
    tailY: 0,
    tailVx: 0,
    tailVy: 0,
    tailRot: 0,
    // Cursor tracking
    cursorX: 0,
    cursorY: 0,
    cursorActive: false,
    cursorLastMove: 0,
    // Poke reaction override
    pokeIndex: 0,
    overrideState: null as SemaState | null,
    overrideUntil: 0,
  })

  useEffect(() => {
    const onPointerMove = (e: PointerEvent) => {
      const p = physRef.current
      p.cursorX = e.clientX
      p.cursorY = e.clientY
      p.cursorActive = true
      p.cursorLastMove = performance.now() * 0.001
    }
    const onPointerLeave = () => {
      physRef.current.cursorActive = false
    }
    window.addEventListener('pointermove', onPointerMove, { passive: true })
    document.addEventListener('pointerleave', onPointerLeave)
    return () => {
      window.removeEventListener('pointermove', onPointerMove)
      document.removeEventListener('pointerleave', onPointerLeave)
    }
  }, [])

  useEffect(() => {
    let raf = 0
    let lastTime = performance.now() * 0.001
    const startTime = lastTime

    const tick = (nowMs: number) => {
      const now = nowMs * 0.001
      const dt = Math.min(0.05, Math.max(0.001, now - lastTime))
      lastTime = now
      const t = now - startTime

      const engine = engineRef.current!
      const p = physRef.current

      // Determine active state (respect temporary poke reaction)
      let desiredState = statePropRef.current
      if (p.overrideState && now < p.overrideUntil) {
        desiredState = p.overrideState
      } else {
        p.overrideState = null
      }
      if (engine.state !== desiredState) {
        engine.setState(desiredState, t)
      }

      // Compute gaze target: priority = drag pull > explicit lookAt prop > cursor tracking
      const svg = svgRef.current
      if (p.dragging && (Math.abs(p.targetDx) > 2 || Math.abs(p.targetDy) > 2)) {
        engine.setLookTarget(
          clamp(p.targetDx * 1.15, -40, 40),
          clamp(-p.targetDy * 0.95, -32, 32),
          true,
          dt,
        )
      } else if (lookAtRef.current) {
        engine.setLookTarget(
          lookAtRef.current.x * 36,
          -lookAtRef.current.y * 28,
          true,
          dt,
        )
      } else if (followRef.current && p.cursorActive && now - p.cursorLastMove < 3.5 && svg) {
        const rect = svg.getBoundingClientRect()
        if (rect.width > 0 && rect.height > 0) {
          const cx = rect.left + rect.width * 0.5
          const cy = rect.top + rect.height * 0.44
          const rx = (p.cursorX - cx) / Math.max(120, rect.width * 3.2)
          const ry = (p.cursorY - cy) / Math.max(120, rect.height * 3.2)
          const dist = Math.hypot(rx, ry)
          const clamped = Math.min(1, dist)
          const nx = dist > 0.001 ? (rx / dist) * clamped : 0
          const ny = dist > 0.001 ? (ry / dist) * clamped : 0
          engine.setLookTarget(nx * 36, -ny * 26, true, dt)
        }
      } else {
        engine.setLookTarget(0, 0, false, dt)
      }

      // Integrate drag elastic tether spring
      if (p.dragging) {
        const followRate = 1 - Math.exp(-dt * 24)
        p.dx = lerp(p.dx, p.targetDx, followRate)
        p.dy = lerp(p.dy, p.targetDy, followRate)
        p.vx = (p.targetDx - p.dx) * 8
        p.vy = (p.targetDy - p.dy) * 8
      } else {
        // Juicy damped harmonic snapback
        const k = 280
        const c = 15
        const ax = -k * p.dx - c * p.vx
        const ay = -k * p.dy - c * p.vy
        p.vx += ax * dt
        p.vy += ay * dt
        p.dx += p.vx * dt
        p.dy += p.vy * dt
        if (Math.abs(p.dx) < 0.02 && Math.abs(p.vx) < 0.02) {
          p.dx = 0
          p.vx = 0
        }
        if (Math.abs(p.dy) < 0.02 && Math.abs(p.vy) < 0.02) {
          p.dy = 0
          p.vy = 0
        }
      }

      // Integrate poke vertical squash-and-bounce spring
      {
        const k = 320
        const c = 14
        const acc = -k * (p.pokeScaleY - 1) - c * p.pokeVy
        p.pokeVy += acc * dt
        p.pokeScaleY += p.pokeVy * dt
        if (Math.abs(p.pokeScaleY - 1) < 0.001 && Math.abs(p.pokeVy) < 0.001) {
          p.pokeScaleY = 1
          p.pokeVy = 0
        }
      }

      // Sample 3D eye & pose engine
      const frame = engine.sample(t, speakLevelRef.current)

      // Total head translation
      const headX = frame.offX + p.dx
      const headY = frame.offY + p.dy

      // Trailing ';' comma tail follows head with softer spring (~120ms elastic lag)
      {
        const tk = 125
        const tc = 11.5
        const tax = tk * (headX * 0.85 - p.tailX) - tc * p.tailVx
        const tay = tk * (headY * 0.72 - p.tailY) - tc * p.tailVy
        p.tailVx += tax * dt
        p.tailVy += tay * dt
        p.tailX += p.tailVx * dt
        p.tailY += p.tailVy * dt
        const desiredRot = clamp((headX - p.tailX) * 1.4 + frame.headRot * 0.65, -24, 24)
        p.tailRot = lerp(p.tailRot, desiredRot, 1 - Math.exp(-dt * 14))
      }

      // Elastic pull stretch (volume-preserving along drag/velocity vector)
      const pullMag = Math.hypot(p.dx, p.dy)
      const stretchAmt = clamp(pullMag / 145, 0, 0.22)
      const pullAngleDeg = pullMag > 0.5 ? (Math.atan2(p.dy, p.dx) * 180) / Math.PI : 0
      const stretchX = 1 + stretchAmt
      const stretchY = 1 / (1 + stretchAmt * 0.82)

      // Poke volume preservation
      const pokeSy = clamp(p.pokeScaleY, 0.74, 1.24)
      const pokeSx = 1 / Math.sqrt(pokeSy)

      const totalSx = frame.sx * pokeSx
      const totalSy = frame.sy * pokeSy

      // Theme detection (fast attribute check)
      const isDark =
        typeof document !== 'undefined' &&
        document.documentElement.getAttribute('data-theme') === 'dark'
      const bodyColor = isDark ? '#f2f2f2' : '#141414'
      const eyeColor = resolveEyeColor(frame.tint, isDark)

      if (bodyFillRef.current) bodyFillRef.current.setAttribute('fill', bodyColor)
      if (tailFillRef.current) tailFillRef.current.setAttribute('fill', bodyColor)
      if (eyeBgRef.current) eyeBgRef.current.setAttribute('fill', eyeColor)

      if (headRigRef.current) {
        headRigRef.current.setAttribute(
          'transform',
          `translate(${headX.toFixed(2)} ${headY.toFixed(2)}) rotate(${frame.headRot.toFixed(2)}) scale(${totalSx.toFixed(3)} ${totalSy.toFixed(3)})`,
        )
      }

      if (stretchRigRef.current) {
        if (stretchAmt > 0.002) {
          stretchRigRef.current.setAttribute(
            'transform',
            `rotate(${pullAngleDeg.toFixed(1)}) scale(${stretchX.toFixed(3)} ${stretchY.toFixed(3)}) rotate(${(-pullAngleDeg).toFixed(1)})`,
          )
        } else {
          stretchRigRef.current.removeAttribute('transform')
        }
      }

      if (tailRigRef.current) {
        tailRigRef.current.setAttribute(
          'transform',
          `translate(${p.tailX.toFixed(2)} ${p.tailY.toFixed(2)}) rotate(${p.tailRot.toFixed(2)} 0 74)`,
        )
      }

      // Update 3D spherical eyes inside mask
      const eyeRefs = [eye0Ref.current, eye1Ref.current]
      for (let i = 0; i < 2; i++) {
        const el = eyeRefs[i]
        if (!el) continue
        const eye = frame.eyes[i]
        if (eye && eye.alpha > 0.01) {
          el.setAttribute('d', eye.d)
          el.setAttribute('transform', eye.matrix)
          el.setAttribute('opacity', eye.alpha.toFixed(3))
        } else {
          el.setAttribute('opacity', '0')
        }
      }

      // Update eye-morphed orbital spinner arcs inside mask
      const arcRefs = [arc0Ref.current, arc1Ref.current]
      for (let i = 0; i < 2; i++) {
        const el = arcRefs[i]
        if (!el) continue
        const arc = frame.spinnerArcs[i]
        if (arc && arc.opacity > 0.01) {
          el.setAttribute('d', arc.d)
          el.setAttribute('stroke-width', String(arc.strokeWidth))
          el.setAttribute('opacity', arc.opacity.toFixed(3))
        } else {
          el.setAttribute('opacity', '0')
        }
      }

      // Celebrate sparkles
      if (sparkleGroupRef.current) {
        if (frame.sparkle > 0.02) {
          const pulse = 0.72 + 0.28 * Math.sin(frame.sparklePhase * 7.5)
          sparkleGroupRef.current.setAttribute('opacity', (frame.sparkle * pulse).toFixed(3))
          sparkleGroupRef.current.setAttribute(
            'transform',
            `translate(${headX.toFixed(2)} ${headY.toFixed(2)}) scale(${(0.88 + 0.14 * pulse).toFixed(3)})`,
          )
        } else {
          sparkleGroupRef.current.setAttribute('opacity', '0')
        }
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
    // Tiny tactile squish on grab
    p.pokeVy -= 3.2
  }

  const handlePointerMove = (e: React.PointerEvent<SVGSVGElement>) => {
    const p = physRef.current
    if (!p.dragging || e.pointerId !== p.pointerId) return
    const dxPx = e.clientX - p.startClientX
    const dyPx = e.clientY - p.startClientY
    const distPx = Math.hypot(dxPx, dyPx)
    if (distPx > p.maxDistPx) p.maxDistPx = distPx

    // Convert screen pixels to SVG units with smooth asymptotic rubber-band resistance
    const rect = svgRef.current?.getBoundingClientRect()
    const unitScale = rect && rect.width > 0 ? 196 / rect.width : 2.2
    const rawX = dxPx * unitScale
    const rawY = dyPx * unitScale
    const rawMag = Math.hypot(rawX, rawY)
    const maxPull = 38
    const dampedMag = maxPull * Math.tanh(rawMag / 58)
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
      // Crisp poke reaction!
      p.pokeScaleY = 0.8
      p.pokeVy = 5.4
      const nextMood = POKE_CYCLE[p.pokeIndex % POKE_CYCLE.length]!
      p.pokeIndex += 1
      p.overrideState = nextMood
      p.overrideUntil = performance.now() * 0.001 + 1.15
      onPokeRef.current?.()
    } else {
      // Release flick bounce
      p.pokeVy += 2.6
    }
  }

  return (
    <svg
      ref={svgRef}
      width={size}
      height={Math.round(size * 1.16)}
      viewBox="-98 -96 196 228"
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
          x="-98"
          y="-96"
          width="196"
          height="228"
        >
          <path d={HEAD_PATH} fill="#ffffff" />
          <path ref={eye0Ref} fill="#000000" opacity="0" />
          <path ref={eye1Ref} fill="#000000" opacity="0" />
          <path
            ref={arc0Ref}
            fill="none"
            stroke="#000000"
            strokeLinecap="round"
            strokeWidth="12"
            opacity="0"
          />
          <path
            ref={arc1Ref}
            fill="none"
            stroke="#000000"
            strokeLinecap="round"
            strokeWidth="12"
            opacity="0"
          />
        </mask>
      </defs>

      {/* Trailing ';' comma tail on elastic follow-through spring */}
      <g ref={tailRigRef}>
        <path ref={tailFillRef} d={TAIL_PATH} fill="#141414" />
      </g>

      {/* Sema squircle head with masked 3D spherical eyes + eye-to-spinner morph */}
      <g ref={headRigRef}>
        <g ref={stretchRigRef}>
          <path ref={eyeBgRef} d={HEAD_PATH} fill="#ffffff" />
          <g mask={`url(#${maskId})`}>
            <rect ref={bodyFillRef} x="-98" y="-96" width="196" height="228" fill="#141414" />
          </g>
        </g>
      </g>

      {/* Crisp geometric sparkles for celebrate */}
      <g ref={sparkleGroupRef} opacity="0" pointerEvents="none">
        <path
          d="M 56,-62 L 60,-53 L 69,-49 L 60,-45 L 56,-36 L 52,-45 L 43,-49 L 52,-53 Z"
          fill="#29cc57"
        />
        <path
          d="M -58,-52 L -55,-46 L -49,-43 L -55,-40 L -58,-34 L -61,-40 L -67,-43 L -61,-46 Z"
          fill="#456dff"
        />
      </g>
    </svg>
  )
}
