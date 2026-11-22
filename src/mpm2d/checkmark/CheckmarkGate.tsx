import { useCallback, useEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { recognizeCheckmark, type StrokePoint } from './checkmarkGesture'
import './checkmark.css'

export type CheckmarkGateVisualState = 'ready' | 'disabled' | 'correct' | 'wrong'

/**
 * Exact hollow bubble-letter checkmark silhouette (viewBox 0 0 280 124).
 * Left down-stroke starts at mid-left (78, 66), dips to sharp valley (118, 106),
 * and sweeps dramatically up-right to (206, 18) — ~2.35x arm asymmetry so it reads
 * unmistakably as a checkmark, never a V.
 */
const BUBBLE_CHECKMARK_OUTLINE =
  'M 70 72 ' +
  'C 64 66 64 56 70 50 ' +
  'C 76 44 86 44 92 50 ' +
  'L 118 76 ' +
  'L 188 12 ' +
  'C 194 6 204 6 210 12 ' +
  'C 216 18 216 28 210 34 ' +
  'L 129 109 ' +
  'C 123 115 113 115 107 109 ' +
  'Z'

const SOLID_CHECKMARK_STROKE = 'M 81 62 L 118 96 L 199 21'

function drawInkStroke(
  ctx: CanvasRenderingContext2D,
  pts: StrokePoint[],
  color: string,
  alpha: number,
) {
  if (pts.length < 2 || alpha <= 0.01) return
  ctx.save()
  ctx.globalAlpha = alpha
  ctx.strokeStyle = color
  ctx.lineCap = 'round'
  ctx.lineJoin = 'round'
  ctx.lineWidth = 6.5

  ctx.beginPath()
  ctx.moveTo(pts[0]!.x, pts[0]!.y)
  for (let i = 1; i < pts.length - 1; i++) {
    const cur = pts[i]!
    const next = pts[i + 1]!
    const mx = (cur.x + next.x) * 0.5
    const my = (cur.y + next.y) * 0.5
    ctx.quadraticCurveTo(cur.x, cur.y, mx, my)
  }
  const last = pts[pts.length - 1]!
  ctx.lineTo(last.x, last.y)
  ctx.stroke()
  ctx.restore()
}

export function CheckmarkGate({
  label = 'Check',
  fallbackLabel = 'Tap to check',
  disabled = false,
  visualState = 'ready',
  screenGestureContainerRef,
  enableScreenGesture = false,
  onTrigger,
  onReject,
}: {
  label?: string
  fallbackLabel?: string
  disabled?: boolean
  visualState?: CheckmarkGateVisualState
  /** Optional container ref (left lesson pane) for screen-wide draw-to-check */
  screenGestureContainerRef?: React.RefObject<HTMLElement | null>
  enableScreenGesture?: boolean
  onTrigger: () => void
  onReject?: (reason?: string) => void
}) {
  const [isDrawing, setIsDrawing] = useState(false)
  const [rejectShake, setRejectShake] = useState(false)
  const [hintText, setHintText] = useState<string | null>(null)

  const gateRef = useRef<HTMLDivElement>(null)
  const overlayCanvasRef = useRef<HTMLCanvasElement | null>(null)
  const pointsRef = useRef<StrokePoint[]>([])
  const activePointerRef = useRef<number | null>(null)
  const fadeRafRef = useRef<number>(0)
  const shakeTimerRef = useRef<number>(0)

  const disabledRef = useRef(disabled)
  const onTriggerRef = useRef(onTrigger)
  const onRejectRef = useRef(onReject)
  disabledRef.current = disabled
  onTriggerRef.current = onTrigger
  onRejectRef.current = onReject

  const ensureCanvasSize = useCallback(() => {
    const canvas = overlayCanvasRef.current
    if (!canvas) return null
    const dpr = window.devicePixelRatio || 1
    const w = window.innerWidth
    const h = window.innerHeight
    if (canvas.width !== Math.round(w * dpr) || canvas.height !== Math.round(h * dpr)) {
      canvas.width = Math.round(w * dpr)
      canvas.height = Math.round(h * dpr)
      canvas.style.width = `${w}px`
      canvas.style.height = `${h}px`
    }
    const ctx = canvas.getContext('2d')
    if (ctx) {
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0)
    }
    return ctx
  }, [])

  const clearCanvas = useCallback(() => {
    cancelAnimationFrame(fadeRafRef.current)
    const canvas = overlayCanvasRef.current
    if (!canvas) return
    const ctx = canvas.getContext('2d')
    if (ctx) {
      ctx.setTransform(1, 0, 0, 1, 0, 0)
      ctx.clearRect(0, 0, canvas.width, canvas.height)
    }
  }, [])

  const dissolveStroke = useCallback(
    (pts: StrokePoint[], color: string, durationMs: number) => {
      cancelAnimationFrame(fadeRafRef.current)
      const start = performance.now()
      const step = (now: number) => {
        const prog = Math.min(1, (now - start) / durationMs)
        const ctx = ensureCanvasSize()
        if (!ctx) return
        ctx.clearRect(0, 0, window.innerWidth, window.innerHeight)
        if (prog < 1) {
          drawInkStroke(ctx, pts, color, (1 - prog) * (1 - prog))
          fadeRafRef.current = requestAnimationFrame(step)
        }
      }
      fadeRafRef.current = requestAnimationFrame(step)
    },
    [ensureCanvasSize],
  )

  const getInkColor = () => {
    const isDark = document.documentElement.getAttribute('data-theme') === 'dark'
    return isDark ? '#f2f2f2' : '#141414'
  }

  const finishStroke = useCallback(
    (source: 'gate' | 'screen') => {
      const pts = pointsRef.current.slice()
      pointsRef.current = []
      activePointerRef.current = null
      setIsDrawing(false)

      if (pts.length < 4) {
        clearCanvas()
        return
      }

      const res = recognizeCheckmark(pts)
      if (res.ok) {
        dissolveStroke(pts, '#29cc57', 220)
        setHintText(null)
        onTriggerRef.current()
      } else {
        dissolveStroke(pts, getInkColor(), 260)
        if (source === 'gate') {
          setRejectShake(true)
          setHintText('Draw a checkmark (short down, long up-right)')
          window.clearTimeout(shakeTimerRef.current)
          shakeTimerRef.current = window.setTimeout(() => {
            setRejectShake(false)
          }, 380)
          onRejectRef.current?.(res.reason)
        }
      }
    },
    [clearCanvas, dissolveStroke],
  )

  useEffect(() => {
    return () => {
      cancelAnimationFrame(fadeRafRef.current)
      window.clearTimeout(shakeTimerRef.current)
    }
  }, [])

  // Reset hint when visual state changes
  useEffect(() => {
    if (visualState === 'correct') setHintText(null)
  }, [visualState])

  // Pointer handlers on the bubble-checkmark gate itself (captures pointer so fast upstrokes never clip)
  const onGatePointerDown = (e: React.PointerEvent<HTMLDivElement>) => {
    if (disabled || visualState === 'correct') return
    if (e.button !== 0 && e.pointerType === 'mouse') return
    e.preventDefault()
    e.stopPropagation()
    try {
      e.currentTarget.setPointerCapture(e.pointerId)
    } catch {
      // ignore
    }
    cancelAnimationFrame(fadeRafRef.current)
    activePointerRef.current = e.pointerId
    pointsRef.current = [{ x: e.clientX, y: e.clientY, t: performance.now() }]
    setIsDrawing(true)
    setHintText(null)

    const ctx = ensureCanvasSize()
    if (ctx) ctx.clearRect(0, 0, window.innerWidth, window.innerHeight)
  }

  const onGatePointerMove = (e: React.PointerEvent<HTMLDivElement>) => {
    if (activePointerRef.current !== e.pointerId) return
    const pts = pointsRef.current
    const last = pts[pts.length - 1]
    if (last && Math.hypot(e.clientX - last.x, e.clientY - last.y) < 2.2) return
    pts.push({ x: e.clientX, y: e.clientY, t: performance.now() })
    const ctx = ensureCanvasSize()
    if (ctx) {
      ctx.clearRect(0, 0, window.innerWidth, window.innerHeight)
      drawInkStroke(ctx, pts, getInkColor(), 0.92)
    }
  }

  const onGatePointerUp = (e: React.PointerEvent<HTMLDivElement>) => {
    if (activePointerRef.current !== e.pointerId) return
    try {
      e.currentTarget.releasePointerCapture(e.pointerId)
    } catch {
      // ignore
    }
    finishStroke('gate')
  }

  // Screen-wide draw-to-check on empty space of the left lesson surface (NEVER touches right tldraw pane)
  useEffect(() => {
    if (!enableScreenGesture || !screenGestureContainerRef?.current) return
    const el = screenGestureContainerRef.current
    let screenPtrId: number | null = null
    let startedDrawing = false

    const isInteractiveTarget = (target: EventTarget | null): boolean => {
      if (!(target instanceof Element)) return true
      return Boolean(
        target.closest(
          'button, a, input, textarea, select, label, [role="button"], [data-pen-workspace], .chk-gate-wrap, .br-graph, .br-choice-opt, .br-plan-card, .sema-svg',
        ),
      )
    }

    const onDown = (e: PointerEvent) => {
      if (disabledRef.current) return
      if (e.button !== 0 && e.pointerType === 'mouse') return
      if (isInteractiveTarget(e.target)) return
      screenPtrId = e.pointerId
      startedDrawing = false
      pointsRef.current = [{ x: e.clientX, y: e.clientY, t: performance.now() }]
    }

    const onMove = (e: PointerEvent) => {
      if (screenPtrId !== e.pointerId) return
      const pts = pointsRef.current
      const first = pts[0]
      if (!first) return
      if (!startedDrawing) {
        if (Math.hypot(e.clientX - first.x, e.clientY - first.y) < 12) return
        startedDrawing = true
        setIsDrawing(true)
      }
      const last = pts[pts.length - 1]!
      if (Math.hypot(e.clientX - last.x, e.clientY - last.y) < 2.5) return
      pts.push({ x: e.clientX, y: e.clientY, t: performance.now() })
      const ctx = ensureCanvasSize()
      if (ctx) {
        ctx.clearRect(0, 0, window.innerWidth, window.innerHeight)
        drawInkStroke(ctx, pts, getInkColor(), 0.85)
      }
    }

    const onUp = (e: PointerEvent) => {
      if (screenPtrId !== e.pointerId) return
      screenPtrId = null
      if (startedDrawing) {
        startedDrawing = false
        finishStroke('screen')
      } else {
        pointsRef.current = []
      }
    }

    el.addEventListener('pointerdown', onDown)
    window.addEventListener('pointermove', onMove, { passive: true })
    window.addEventListener('pointerup', onUp)
    window.addEventListener('pointercancel', onUp)
    return () => {
      el.removeEventListener('pointerdown', onDown)
      window.removeEventListener('pointermove', onMove)
      window.removeEventListener('pointerup', onUp)
      window.removeEventListener('pointercancel', onUp)
    }
  }, [enableScreenGesture, screenGestureContainerRef, ensureCanvasSize, finishStroke])

  const isCorrect = visualState === 'correct'
  const isWrong = visualState === 'wrong'

  return (
    <div className="chk-gate-wrap">
      <div
        ref={gateRef}
        className={`chk-gate${disabled ? ' is-disabled' : ''}${isDrawing ? ' is-drawing' : ''}${
          isCorrect ? ' is-correct' : ''
        }${isWrong ? ' is-wrong' : ''}${rejectShake ? ' is-shake' : ''}`}
        role="group"
        aria-label={`${label}: draw a checkmark`}
        onPointerDown={onGatePointerDown}
        onPointerMove={onGatePointerMove}
        onPointerUp={onGatePointerUp}
        onPointerCancel={onGatePointerUp}
      >
        {/* Green LED perimeter sweep overlay on correct check */}
        <svg className="chk-led-svg" viewBox="0 0 280 124" preserveAspectRatio="none" aria-hidden="true">
          <rect
            className="chk-led-rect"
            x="2"
            y="2"
            width="276"
            height="120"
            rx="20"
            ry="20"
            pathLength={100}
          />
        </svg>

        {/* Unmistakable giant bubble-letter hollow checkmark guide (vanishes cleanly on draw) */}
        <svg className="chk-guide-svg" viewBox="0 0 280 124" aria-hidden="true">
          <path className="chk-bubble-outline" d={BUBBLE_CHECKMARK_OUTLINE} />
          <path className="chk-solid-check" d={SOLID_CHECKMARK_STROKE} pathLength={100} />
        </svg>

        <span className="chk-gate-caption">
          {isCorrect ? 'Checked' : isDrawing ? '' : label}
        </span>
      </div>

      <div className="chk-gate-subrow">
        {hintText ? (
          <span className="chk-gate-hint">{hintText}</span>
        ) : (
          <button
            type="button"
            className="chk-tap-fallback"
            disabled={disabled}
            onClick={() => onTrigger()}
          >
            {fallbackLabel}
          </button>
        )}
      </div>

      {typeof document !== 'undefined' &&
        createPortal(
          <canvas
            ref={overlayCanvasRef}
            className="chk-viewport-ink"
            aria-hidden="true"
          />,
          document.body,
        )}
    </div>
  )
}
