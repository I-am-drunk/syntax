import { useEffect, useId, useLayoutEffect, useRef } from 'react'
import {
  BotEngine,
  DEMI_VIEWBOX,
  NOTIF_BLUE,
  RAYON_BOULE,
  SEMA_REST_COMMA_PATHS,
  mixHex,
  closedPath,
  toPoints,
  projectSemicolonTail3D,
  resolveExpression,
  resolveShapeRadii,
  resolveTailProfile,
  type BotFrame,
  type SemaExpressionName,
  type SemaShapeName,
  type SemaTailName,
  type StateId,
} from './bloub'
import './sema.css'

export type { SemaExpressionName, SemaShapeName, SemaTailName, StateId }
export { SEMA_REST_COMMA_PATHS }

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

export type SemaDragLaunchInfo = {
  clientX: number
  clientY: number
  vx: number
  vy: number
}

const SVG_NS = 'http://www.w3.org/2000/svg'
const R = RAYON_BOULE // 100
const VB = DEMI_VIEWBOX // 158

// True typographic semicolon framing in bloub's R = 100 coordinate space:
// Head sphere occupies y in [-100, +100] (Jenson star tips reach [-114, +114]),
// followed by a crisp ~65-78u typographic gap and a full-proportioned ~180-197u traced comma
// (y ~ 165..375), giving Sema unmistakable semicolon silhouette & balance.
const TAIL_VB_TOP = -130
const TAIL_VB_HEIGHT = 436

export const SEMA_REST_COMMA_PATH = SEMA_REST_COMMA_PATHS.jenson
export const SEMA_REST_COMMA_JENSON_PATH = SEMA_REST_COMMA_PATHS.jenson
export const SEMA_JENSON_HEAD_PATH = closedPath(
  toPoints({ radii: resolveShapeRadii('jenson'), rot: 0, cx: 0, cy: 0, sx: 1, sy: 1 }, 100),
)

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
  { state: 'idle', expression: 'happy', dur: 1.25 },
  { state: 'wink', dur: 1.35 },
  { state: 'idle', expression: 'curious', dur: 1.25 },
  { state: 'idle', expression: 'shy', dur: 1.3 },
  { state: 'idle', expression: 'surprised', dur: 1.2 },
  { state: 'idle', expression: 'proud', dur: 1.3 },
  { state: 'checkbox', dur: 1.45 },
  { state: 'idle', expression: 'laughing', dur: 1.35 },
  { state: 'idle', expression: 'excited', dur: 1.3 },
  { state: 'idle', expression: 'unimpressed', dur: 1.3 },
]

function clamp(v: number, lo: number, hi: number): number {
  return v < lo ? lo : v > hi ? hi : v
}

function detectDark(): boolean {
  if (typeof document === 'undefined') return false
  return document.documentElement.getAttribute('data-theme') === 'dark'
}

function syncDotsGroup(
  g: SVGGElement | null,
  dots: BotFrame['dots'],
  paper: string,
  ink: string,
) {
  if (!g) return
  if (dots.length === 0) {
    if (g.childNodes.length > 0) g.textContent = ''
    return
  }
  while (g.childNodes.length > dots.length) {
    g.removeChild(g.lastChild!)
  }
  for (let i = 0; i < dots.length; i++) {
    const dot = dots[i]!
    const fill =
      dot.color ?? (dot.depth === undefined ? ink : mixHex(paper, ink, dot.depth))
    const wantTag = dot.d ? 'path' : 'circle'
    let el = g.childNodes[i] as SVGElement | undefined
    if (!el || el.tagName !== wantTag) {
      const next = document.createElementNS(SVG_NS, wantTag)
      if (el) g.replaceChild(next, el)
      else g.appendChild(next)
      el = next
    }
    el.setAttribute('fill', fill)
    el.setAttribute('opacity', dot.opacity.toFixed(3))
    if (dot.d) {
      el.setAttribute('d', dot.d)
      el.setAttribute(
        'transform',
        `translate(${dot.x.toFixed(2)} ${dot.y.toFixed(2)}) rotate(${(dot.rot ?? 0).toFixed(2)}) scale(${R})`,
      )
    } else {
      el.setAttribute('cx', dot.x.toFixed(2))
      el.setAttribute('cy', dot.y.toFixed(2))
      el.setAttribute('r', dot.r.toFixed(2))
    }
  }
}

function syncArcs(
  defsEl: SVGDefsElement | null,
  backGroup: SVGGElement | null,
  frontGroup: SVGGElement | null,
  arcs: BotFrame['arcs'],
  uid: string,
  gradNodes: Map<string, SVGLinearGradientElement>,
) {
  if (!defsEl || !backGroup || !frontGroup) return
  if (arcs.length === 0) {
    if (backGroup.childNodes.length > 0) backGroup.textContent = ''
    if (frontGroup.childNodes.length > 0) frontGroup.textContent = ''
    if (gradNodes.size > 0) {
      for (const node of gradNodes.values()) node.remove()
      gradNodes.clear()
    }
    return
  }

  const seen = new Set<string>()
  for (const arc of arcs) {
    seen.add(arc.id)
    let grad = gradNodes.get(arc.id)
    if (!grad) {
      grad = document.createElementNS(SVG_NS, 'linearGradient')
      grad.setAttribute('id', `${uid}-${arc.id}`)
      grad.setAttribute('gradientUnits', 'userSpaceOnUse')
      defsEl.appendChild(grad)
      gradNodes.set(arc.id, grad)
    }
    grad.setAttribute('x1', arc.grad.x1.toFixed(2))
    grad.setAttribute('y1', arc.grad.y1.toFixed(2))
    grad.setAttribute('x2', arc.grad.x2.toFixed(2))
    grad.setAttribute('y2', arc.grad.y2.toFixed(2))

    const stops = arc.grad.stops
    while (grad.childNodes.length > stops.length) grad.removeChild(grad.lastChild!)
    for (let i = 0; i < stops.length; i++) {
      let stop = grad.childNodes[i] as SVGStopElement | undefined
      if (!stop) {
        stop = document.createElementNS(SVG_NS, 'stop')
        grad.appendChild(stop)
      }
      stop.setAttribute('offset', String(i / Math.max(1, stops.length - 1)))
      stop.setAttribute('stop-color', stops[i]!)
    }
  }

  for (const [id, node] of gradNodes.entries()) {
    if (!seen.has(id)) {
      node.remove()
      gradNodes.delete(id)
    }
  }

  while (backGroup.childNodes.length > arcs.length) backGroup.removeChild(backGroup.lastChild!)
  while (frontGroup.childNodes.length > arcs.length) frontGroup.removeChild(frontGroup.lastChild!)

  for (let i = 0; i < arcs.length; i++) {
    const arc = arcs[i]!
    const strokeUrl = `url(#${uid}-${arc.id})`
    let bp = backGroup.childNodes[i] as SVGPathElement | undefined
    if (!bp) {
      bp = document.createElementNS(SVG_NS, 'path')
      backGroup.appendChild(bp)
    }
    bp.setAttribute('d', arc.back)
    bp.setAttribute('stroke', strokeUrl)
    bp.setAttribute('stroke-width', arc.width.toFixed(2))
    bp.setAttribute('opacity', arc.opacity.toFixed(3))

    let fp = frontGroup.childNodes[i] as SVGPathElement | undefined
    if (!fp) {
      fp = document.createElementNS(SVG_NS, 'path')
      frontGroup.appendChild(fp)
    }
    fp.setAttribute('d', arc.front)
    fp.setAttribute('stroke', strokeUrl)
    fp.setAttribute('stroke-width', arc.width.toFixed(2))
    fp.setAttribute('opacity', arc.opacity.toFixed(3))
  }
}

export function Sema({
  state = 'idle',
  expression = 'neutral',
  shape = 'jenson',
  tail = 'jenson',
  size = 56,
  interactive = false,
  followCursor = true,
  lookAt = null,
  speakLevel = 0,
  showTail = true,
  accentColor,
  className,
  ariaLabel = 'Sema, your Syntax companion',
  onPoke,
  dragLaunchThresholdPx,
  onDragLaunch,
  animationPaused = false,
}: {
  state?: SemaState
  expression?: SemaExpressionName
  shape?: SemaShapeName
  tail?: SemaTailName
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
  /** If set, dropping Sema on the page or beyond this distance fires onDragLaunch. */
  dragLaunchThresholdPx?: number
  onDragLaunch?: (info: SemaDragLaunchInfo) => void
  /** Freeze the expensive SVG engine while another interaction needs the frame budget. */
  animationPaused?: boolean
}) {
  const uid = useId().replace(/[^a-zA-Z0-9_-]/g, '')
  const maskId = `sema-mask-${uid}`

  const svgRef = useRef<SVGSVGElement | null>(null)
  const defsRef = useRef<SVGDefsElement | null>(null)
  const rigRef = useRef<SVGGElement | null>(null)
  const stretchRef = useRef<SVGGElement | null>(null)
  const tailRef = useRef<SVGGElement | null>(null)
  const tailPathRef = useRef<SVGPathElement | null>(null)
  const bodyGroupRef = useRef<SVGGElement | null>(null)
  const bodyPaperRef = useRef<SVGPathElement | null>(null)
  const bodyMaskPathRef = useRef<SVGPathElement | null>(null)
  const bodyFillRectRef = useRef<SVGRectElement | null>(null)
  const eye0Ref = useRef<SVGPathElement | null>(null)
  const eye1Ref = useRef<SVGPathElement | null>(null)
  const notchRef = useRef<SVGCircleElement | null>(null)
  const checkRef = useRef<SVGPathElement | null>(null)
  const notifRef = useRef<SVGCircleElement | null>(null)
  const dotsBehindRef = useRef<SVGGElement | null>(null)
  const dotsFrontRef = useRef<SVGGElement | null>(null)
  const arcsBackRef = useRef<SVGGElement | null>(null)
  const arcsFrontRef = useRef<SVGGElement | null>(null)

  const engineRef = useRef<BotEngine | null>(null)
  if (!engineRef.current) {
    engineRef.current = new BotEngine(R)
  }

  // Live prop refs so animation loop runs with ZERO React re-renders
  const statePropRef = useRef(state)
  const exprPropRef = useRef(expression)
  const shapePropRef = useRef(shape)
  const tailPropRef = useRef(tail)
  const followRef = useRef(followCursor)
  const lookAtRef = useRef(lookAt)
  const speakLevelRef = useRef(speakLevel)
  const showTailRef = useRef(showTail)
  const accentRef = useRef(accentColor)
  const onPokeRef = useRef(onPoke)
  const dragLaunchThreshRef = useRef(dragLaunchThresholdPx)
  const onDragLaunchRef = useRef(onDragLaunch)

  statePropRef.current = state
  exprPropRef.current = expression
  shapePropRef.current = shape
  tailPropRef.current = tail
  followRef.current = followCursor
  lookAtRef.current = lookAt
  speakLevelRef.current = speakLevel
  showTailRef.current = showTail
  accentRef.current = accentColor
  onPokeRef.current = onPoke
  dragLaunchThreshRef.current = dragLaunchThresholdPx
  onDragLaunchRef.current = onDragLaunch

  const isDarkRef = useRef<boolean>(detectDark())
  const centerCacheRef = useRef<{ cx: number; cy: number; width: number; valid: boolean }>({
    cx: 0,
    cy: 0,
    width: size,
    valid: false,
  })

  const physRef = useRef({
    clock: 0,
    dragging: false,
    pointerId: -1,
    startClientX: 0,
    startClientY: 0,
    lastClientX: 0,
    lastClientY: 0,
    lastMoveTs: 0,
    velX: 0,
    velY: 0,
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
    tailYaw: 0,
    tailYawV: 0,
    tailPitch: 0,
    tailPitchV: 0,
    tailRoll: 0,
    tailRollV: 0,
    tailBodyRot: 0,
    tailSx: 1,
    tailSy: 1,
    tailAlpha: 1,
    tailScale: 1,
    cursorX: 0,
    cursorY: 0,
    hasCursor: false,
    overrideReaction: null as PokeReaction | null,
    overrideUntil: 0,
    pokeIndex: 0,
    dragHoldSec: 0,
    peakPullMag: 0,
    stretchMoodIdx: 0,
  })

  // Immediately apply external expression/state/shape changes (e.g. clicking chips in Settings studio)
  const mountedSyncRef = useRef(false)
  useEffect(() => {
    if (!mountedSyncRef.current) {
      mountedSyncRef.current = true
      return
    }
    physRef.current.overrideReaction = null
    physRef.current.overrideUntil = 0
    physRef.current.pokeScaleY = 0.91
    physRef.current.pokeVy = 3.3
  }, [expression, state, shape, tail])

  // Observe theme changes without polling inside rAF
  useEffect(() => {
    isDarkRef.current = detectDark()
    const obs = new MutationObserver(() => {
      isDarkRef.current = detectDark()
    })
    obs.observe(document.documentElement, { attributes: true, attributeFilter: ['data-theme'] })
    return () => obs.disconnect()
  }, [])

  // Cache SVG viewport rect ONLY on mount / resize (NEVER call getBoundingClientRect inside rAF!)
  useEffect(() => {
    const svg = svgRef.current
    if (!svg) return
    const updateCache = () => {
      const rect = svg.getBoundingClientRect()
      if (rect.width > 0 && rect.height > 0) {
        centerCacheRef.current = {
          cx: rect.left + rect.width * 0.5,
          cy: rect.top + rect.height * (showTailRef.current ? 0.37 : 0.50),
          width: rect.width,
          valid: true,
        }
      }
    }
    updateCache()
    const ro = new ResizeObserver(updateCache)
    ro.observe(svg)
    window.addEventListener('resize', updateCache, { passive: true })
    return () => {
      ro.disconnect()
      window.removeEventListener('resize', updateCache)
    }
  }, [size, showTail])

  // Track pointer for smooth cursor-following eye gaze (only attached when followCursor is enabled)
  useEffect(() => {
    if (!followCursor) return
    let lastRectRefresh = 0
    const onMove = (e: PointerEvent) => {
      physRef.current.cursorX = e.clientX
      physRef.current.cursorY = e.clientY
      physRef.current.hasCursor = true
      const now = performance.now()
      if (now - lastRectRefresh > 450 && svgRef.current) {
        lastRectRefresh = now
        const rect = svgRef.current.getBoundingClientRect()
        if (rect.width > 0 && rect.height > 0) {
          centerCacheRef.current = {
            cx: rect.left + rect.width * 0.5,
            cy: rect.top + rect.height * (showTailRef.current ? 0.37 : 0.50),
            width: rect.width,
            valid: true,
          }
        }
      }
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
  }, [followCursor])

  // Zero-React-Re-render 60fps imperative SVG loop. useLayoutEffect paints the
  // first frame before the browser presents a newly mounted Sema, preventing a
  // blank flash when the roaming copy docks again or when mounted paused.
  useLayoutEffect(() => {
    let raf = 0
    let lastTs = performance.now()
    let lookUpdateTimer = 0
    let lastEngineState: StateId | null = null
    let lastExprKey: SemaExpressionName | null = null
    let lastShapeKey: SemaShapeName | null = null
    let lastTailKey: SemaTailName | null = null
    let lastBodyPath = ''
    let lastInk = ''
    let lastPaper = ''
    const gradNodes = new Map<string, SVGLinearGradientElement>()
    if (defsRef.current) {
      defsRef.current.querySelectorAll('linearGradient').forEach(el => el.remove())
    }

    const tick = (nowMs: number) => {
      if (!animationPaused) {
        raf = requestAnimationFrame(tick)
      }
      if (document.hidden && !animationPaused) {
        lastTs = nowMs
        return
      }

      const dt = Math.min(0.05, Math.max(0.001, (nowMs - lastTs) * 0.001))
      lastTs = nowMs

      const p = physRef.current
      p.clock += dt
      const clock = p.clock
      const engine = engineRef.current!

      // Resolve effective state + expression (live stretch emotions + temporary poke/release override)
      let activeState = statePropRef.current
      let activeExpr = exprPropRef.current
      const livePullMag = Math.hypot(p.targetDx, p.targetDy)
      if (p.dragging && livePullMag > 10) {
        p.dragHoldSec += dt
        if (livePullMag > p.peakPullMag) p.peakPullMag = livePullMag
        activeState = 'idle'
        if (livePullMag >= 40 || (livePullMag >= 28 && p.dragHoldSec > 0.65)) {
          activeExpr = 'angry'
        } else if (livePullMag >= 22) {
          activeExpr = p.stretchMoodIdx % 2 === 0 ? 'scared' : 'sad'
        } else {
          activeExpr = 'surprised'
        }
      } else if (p.overrideReaction && clock < p.overrideUntil) {
        activeState = p.overrideReaction.state
        if (p.overrideReaction.expression) activeExpr = p.overrideReaction.expression
      } else if (p.overrideReaction && clock >= p.overrideUntil) {
        p.overrideReaction = null
      }

      const beh = resolveSemaBehavior(activeState)
      const nextExprKey = beh.expressionOverride ?? activeExpr
      const nextShapeKey = shapePropRef.current
      const nextTailKey = tailPropRef.current

      // Only push into BotEngine when inputs actually change
      if (beh.engineState !== lastEngineState) {
        engine.setState(beh.engineState, clock)
        lastEngineState = beh.engineState
      }
      if (nextExprKey !== lastExprKey) {
        engine.setExpression(resolveExpression(nextExprKey), clock)
        lastExprKey = nextExprKey
      }
      if (nextShapeKey !== lastShapeKey) {
        engine.setShape(resolveShapeRadii(nextShapeKey), clock)
        lastShapeKey = nextShapeKey
      }
      if (nextTailKey !== lastTailKey) {
        engine.setTail(resolveTailProfile(nextTailKey), clock)
        lastTailKey = nextTailKey
      }

      // Gaze target (zero layout reads: uses cached center!)
      lookUpdateTimer += dt
      if (lookUpdateTimer >= 0.04) {
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
        } else if (followRef.current && p.hasCursor && centerCacheRef.current.valid) {
          const { cx, cy } = centerCacheRef.current
          const nx = clamp((p.cursorX - cx) / 260, -1, 1)
          const ny = clamp((p.cursorY - cy) / 260, -1, 1)
          lookYaw = nx * 30
          lookPitch = -ny * 24
          lookMix = 0.88
        }

        if (lookMix > 0.01) {
          engine.setLook({ yaw: lookYaw, pitch: lookPitch, mix: lookMix, spin: 0, wander: 0.12 }, clock)
        } else {
          engine.setLook(null, clock)
        }
      }

      // Sample BotEngine frame & write directly to SVG DOM (zero React re-renders!)
      const f = engine.sample(clock)
      const isDark = isDarkRef.current
      const paper = isDark ? '#171717' : '#ffffff'
      const baseInk = accentRef.current ?? (isDark ? '#f2f2f2' : '#141414')
      const ink = f.tintHex ?? baseInk

      if (f.bodyPath !== lastBodyPath) {
        lastBodyPath = f.bodyPath
        bodyMaskPathRef.current?.setAttribute('d', f.bodyPath)
        bodyPaperRef.current?.setAttribute('d', f.bodyPath)
      }
      if (paper !== lastPaper) {
        lastPaper = paper
        bodyPaperRef.current?.setAttribute('fill', paper)
      }
      if (ink !== lastInk) {
        lastInk = ink
        bodyFillRectRef.current?.setAttribute('fill', ink)
        tailPathRef.current?.setAttribute('fill', ink)
      }

      bodyGroupRef.current?.setAttribute('opacity', f.bodyAlpha.toFixed(3))

      // Eyes (up to 2)
      const eyeRefs = [eye0Ref.current, eye1Ref.current]
      for (let i = 0; i < 2; i++) {
        const el = eyeRefs[i]
        const eye = f.eyes[i]
        if (!el) continue
        if (eye && eye.alpha > 0.004) {
          el.setAttribute('d', eye.d)
          el.setAttribute('transform', eye.matrix)
          el.setAttribute('opacity', eye.alpha.toFixed(3))
          el.style.display = ''
        } else {
          el.style.display = 'none'
        }
      }

      // Notification notch cutout + popped blue badge
      if (notchRef.current) {
        if (f.notch) {
          notchRef.current.setAttribute('cx', f.notch.x.toFixed(2))
          notchRef.current.setAttribute('cy', f.notch.y.toFixed(2))
          notchRef.current.setAttribute('r', f.notch.r.toFixed(2))
          notchRef.current.style.display = ''
        } else {
          notchRef.current.style.display = 'none'
        }
      }
      if (notifRef.current) {
        if (f.notif) {
          notifRef.current.setAttribute('cx', f.notif.x.toFixed(2))
          notifRef.current.setAttribute('cy', f.notif.y.toFixed(2))
          notifRef.current.setAttribute('r', f.notif.r.toFixed(2))
          notifRef.current.style.display = ''
        } else {
          notifRef.current.style.display = 'none'
        }
      }

      // Checkbox cutout stroke draw
      if (checkRef.current) {
        if (f.checkDraw > 0.01) {
          checkRef.current.setAttribute('stroke-dashoffset', ((1 - f.checkDraw) * 100).toFixed(2))
          checkRef.current.style.display = ''
        } else {
          checkRef.current.style.display = 'none'
        }
      }

      // Background & foreground dots
      if (f.dotsBehind) {
        syncDotsGroup(dotsBehindRef.current, f.dots, paper, ink)
        syncDotsGroup(dotsFrontRef.current, [], paper, ink)
      } else {
        syncDotsGroup(dotsBehindRef.current, [], paper, ink)
        syncDotsGroup(dotsFrontRef.current, f.dots, paper, ink)
      }

      // 3D occluded orbital arcs / comet ribbons
      syncArcs(defsRef.current, arcsBackRef.current, arcsFrontRef.current, f.arcs, uid, gradNodes)

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
      const stretchAmt = Math.min(0.24, pullMag * 0.0044)
      const stretchX = 1 + stretchAmt
      const stretchY = 1 / Math.sqrt(stretchX)
      const pokeSy = clamp(p.pokeScaleY, 0.74, 1.24) * extraScaleY
      const pokeSx = 1 / Math.sqrt(pokeSy)

      // Deeply integrated 3D semicolon tail follow-through driven by bloub's native f.semicolon choreography
      const pose3d = f.pose3d
      const semi = f.semicolon
      const choreo = semi.choreo
      const followLagX = pose3d.offX * R + choreo.extraOffX - headX * 0.14
      const followLagY = pose3d.offY * R + choreo.extraOffY - headY * 0.14
      p.tailVx += ((followLagX - p.tailX) * 190 - p.tailVx * 15) * dt
      p.tailVy += ((followLagY - p.tailY) * 190 - p.tailVy * 15) * dt
      p.tailX += p.tailVx * dt
      p.tailY += p.tailVy * dt

      // 3D attitude spring: comma turns in 3D space a beat behind head gaze + bloub choreography
      const targetYaw = pose3d.yaw + choreo.extraYaw + clamp((headX - p.tailX) * 0.45, -18, 18)
      const targetPitch = pose3d.pitch + choreo.extraPitch
      const targetRoll = pose3d.roll + choreo.extraRoll + clamp((headX - p.tailX) * 0.35, -14, 14)
      p.tailYawV += ((targetYaw - p.tailYaw) * 125 - p.tailYawV * 13) * dt
      p.tailPitchV += ((targetPitch - p.tailPitch) * 125 - p.tailPitchV * 13) * dt
      p.tailRollV += ((targetRoll - p.tailRoll) * 135 - p.tailRollV * 13.5) * dt
      p.tailYaw += p.tailYawV * dt
      p.tailPitch += p.tailPitchV * dt
      p.tailRoll += p.tailRollV * dt

      const lerpK = Math.min(1, dt * 13)
      p.tailBodyRot += (pose3d.rot - p.tailBodyRot) * lerpK
      const targetSx = 1 + (pose3d.sx - 1) * 0.72
      const targetSy = 1 + (pose3d.sy - 1) * 0.72
      p.tailSx += (targetSx - p.tailSx) * lerpK
      p.tailSy += (targetSy - p.tailSy) * lerpK

      const tailGoal = showTailRef.current ? choreo.alphaMult : 0
      p.tailAlpha += (tailGoal - p.tailAlpha) * Math.min(1, dt * 11)
      const scaleGoal = showTailRef.current ? choreo.scaleMult : 0.45
      p.tailScale += (scaleGoal - p.tailScale) * Math.min(1, dt * 11)

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
        } else if (stretchRef.current.hasAttribute('transform')) {
          stretchRef.current.removeAttribute('transform')
        }
      }
      if (tailRef.current && tailPathRef.current) {
        if (p.tailAlpha > 0.01) {
          const commaPath = projectSemicolonTail3D(
            semi.from,
            semi.to,
            semi.morphT,
            p.tailYaw,
            p.tailPitch,
            p.tailRoll,
            p.tailBodyRot,
            p.tailX,
            p.tailY,
            p.tailSx,
            p.tailSy,
            p.tailScale,
            0,
          )
          tailPathRef.current.setAttribute('d', commaPath)
          tailPathRef.current.setAttribute('fill', ink)
          tailRef.current.setAttribute('opacity', p.tailAlpha.toFixed(3))
          tailRef.current.style.display = ''
        } else {
          tailRef.current.style.display = 'none'
        }
      }
    }

    isDarkRef.current = detectDark()
    tick(lastTs)
    let pausedThemeObs: MutationObserver | null = null
    if (animationPaused) {
      pausedThemeObs = new MutationObserver(() => {
        isDarkRef.current = detectDark()
        tick(performance.now())
      })
      pausedThemeObs.observe(document.documentElement, {
        attributes: true,
        attributeFilter: ['data-theme'],
      })
    }
    return () => {
      cancelAnimationFrame(raf)
      pausedThemeObs?.disconnect()
      for (const node of gradNodes.values()) node.remove()
      gradNodes.clear()
    }
  }, [uid, animationPaused, shape, tail, expression, state])

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
    p.lastClientX = e.clientX
    p.lastClientY = e.clientY
    p.lastMoveTs = performance.now()
    p.velX = 0
    p.velY = 0
    p.maxDistPx = 0
    p.dragHoldSec = 0
    p.peakPullMag = 0
    p.targetDx = 0
    p.targetDy = 0
    p.pokeVy -= 3.4
  }

  const handlePointerMove = (e: React.PointerEvent<SVGSVGElement>) => {
    const p = physRef.current
    if (!p.dragging || e.pointerId !== p.pointerId) return
    const now = performance.now()
    const dtSec = Math.max(0.008, (now - p.lastMoveTs) * 0.001)
    p.velX = p.velX * 0.55 + ((e.clientX - p.lastClientX) / dtSec) * 0.45
    p.velY = p.velY * 0.55 + ((e.clientY - p.lastClientY) / dtSec) * 0.45
    p.lastClientX = e.clientX
    p.lastClientY = e.clientY
    p.lastMoveTs = now

    const dxPx = e.clientX - p.startClientX
    const dyPx = e.clientY - p.startClientY
    const distPx = Math.hypot(dxPx, dyPx)
    if (distPx > p.maxDistPx) p.maxDistPx = distPx

    const thresh = dragLaunchThreshRef.current
    const width = centerCacheRef.current.width || size
    const unitScale = width > 0 ? (VB * 2) / width : 4
    const rawX = dxPx * unitScale
    const rawY = dyPx * unitScale
    const rawMag = Math.hypot(rawX, rawY)
    // Stay tethered to the dock while held: dragging stretches Sema, and only
    // the release decision can break the tether and start roaming.
    const maxPull = thresh ? 76 : 54
    const dampedMag = maxPull * Math.tanh(rawMag / 90)
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

    const dxPx = e.clientX - p.startClientX
    const dyPx = e.clientY - p.startClientY
    const distPx = Math.hypot(dxPx, dyPx)
    const thresh = dragLaunchThreshRef.current

    if (thresh && onDragLaunchRef.current && distPx >= thresh) {
      onDragLaunchRef.current({
        clientX: e.clientX,
        clientY: e.clientY,
        vx: p.velX || dxPx * 3,
        vy: p.velY || dyPx * 3,
      })
      return
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
      p.pokeVy += 3.1
      p.stretchMoodIdx += 1
      const releaseReaction: PokeReaction =
        p.peakPullMag >= 40 || p.dragHoldSec > 0.65
          ? { state: 'idle', expression: 'angry', dur: 1.35 }
          : p.peakPullMag >= 22
            ? {
                state: 'idle',
                expression: p.stretchMoodIdx % 2 === 0 ? 'sad' : 'unimpressed',
                dur: 1.25,
              }
            : { state: 'idle', expression: 'shy', dur: 1.1 }
      p.overrideReaction = releaseReaction
      p.overrideUntil = p.clock + releaseReaction.dur
    }
  }

  const vbTop = showTail ? TAIL_VB_TOP : -VB
  const vbHeight = showTail ? TAIL_VB_HEIGHT : VB * 2
  const svgHeight = showTail ? Math.round(size * 1.28) : size
  const svgWidth = showTail ? Math.round(svgHeight * ((VB * 2) / vbHeight)) : size

  return (
    <svg
      ref={svgRef}
      width={svgWidth}
      height={svgHeight}
      viewBox={`${-VB} ${vbTop} ${VB * 2} ${vbHeight}`}
      className={`sema-svg${interactive ? ' is-interactive' : ''}${className ? ` ${className}` : ''}`}
      role={interactive ? 'button' : 'img'}
      tabIndex={interactive ? 0 : undefined}
      aria-label={ariaLabel}
      onKeyDown={e => {
        if (!interactive || (e.key !== 'Enter' && e.key !== ' ')) return
        e.preventDefault()
        const p = physRef.current
        p.pokeScaleY = 0.78
        p.pokeVy = 5.6
        const reaction = POKE_REACTIONS[p.pokeIndex % POKE_REACTIONS.length]!
        p.pokeIndex += 1
        p.overrideReaction = reaction
        p.overrideUntil = p.clock + reaction.dur
        onPokeRef.current?.()
      }}
      onPointerDown={handlePointerDown}
      onPointerMove={handlePointerMove}
      onPointerUp={finishDragOrPoke}
      onPointerCancel={finishDragOrPoke}
    >
      <defs ref={defsRef}>
        <mask
          id={maskId}
          maskUnits="userSpaceOnUse"
          x={-VB}
          y={vbTop}
          width={VB * 2}
          height={vbHeight}
        >
          <path ref={bodyMaskPathRef} d="" fill="#ffffff" />
          <path ref={eye0Ref} d="" fill="#000000" style={{ display: 'none' }} />
          <path ref={eye1Ref} d="" fill="#000000" style={{ display: 'none' }} />
          <circle ref={notchRef} cx="0" cy="0" r="0" fill="#000000" style={{ display: 'none' }} />
          <path
            ref={checkRef}
            d={CHECKBOX_CUTOUT_PATH}
            fill="none"
            stroke="#000000"
            strokeWidth="22"
            strokeLinecap="round"
            strokeLinejoin="round"
            pathLength={100}
            strokeDasharray="100"
            strokeDashoffset="100"
            style={{ display: 'none' }}
          />
        </mask>
      </defs>

      <g ref={rigRef}>
        <g ref={stretchRef}>
          {showTail && (
            <g ref={tailRef}>
              <path ref={tailPathRef} d={SEMA_REST_COMMA_PATH} fill="#141414" />
            </g>
          )}
          <g ref={arcsBackRef} fill="none" strokeLinecap="round" />
          <g ref={dotsBehindRef} />

          <g ref={bodyGroupRef} opacity="1">
            <path ref={bodyPaperRef} d="" fill="#ffffff" />
            <g mask={`url(#${maskId})`}>
              <rect ref={bodyFillRectRef} x={-VB} y={vbTop} width={VB * 2} height={vbHeight} fill="#141414" />
            </g>
          </g>

          <g ref={dotsFrontRef} />
          <circle
            ref={notifRef}
            cx="0"
            cy="0"
            r="0"
            fill={NOTIF_BLUE}
            style={{ display: 'none' }}
          />
          <g ref={arcsFrontRef} fill="none" strokeLinecap="round" />
        </g>
      </g>
    </svg>
  )
}
