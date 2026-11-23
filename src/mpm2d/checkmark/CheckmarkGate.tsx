import { useCallback, useEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { recognizeCheckmark, type StrokePoint } from './checkmarkGesture'
import './checkmark.css'

export type CheckmarkGateVisualState = 'ready' | 'disabled' | 'correct' | 'wrong'

const DOTTED_CHECKMARK_STROKE = 'M 86 58 C 96 68, 109 82, 120 92 C 124 96, 128 96, 132 90 C 154 60, 186 34, 232 16'
const STILLNESS_HOLD_MS = 500
const STILLNESS_MOVE_TOLERANCE_PX = 10

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
  ctx.lineWidth = 4.6
  ctx.lineCap = 'round'
  ctx.lineJoin = 'round'
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
  label = 'Draw a checkmark anywhere to check',
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
  screenGestureContainerRef?: React.RefObject<HTMLElement | null>
  enableScreenGesture?: boolean
  onTrigger: () => void
  onReject?: (reason?: string) => void
}) {
  const [isDrawing, setIsDrawing] = useState(false)
  const [rejectShake, setRejectShake] = useState(false)
  const [hintText, setHintText] = useState<string | null>(null)
  const [holdProgress, setHoldProgress] = useState<number | null>(null)

  const gateRef = useRef<HTMLDivElement>(null)
  const overlayCanvasRef = useRef<HTMLCanvasElement | null>(null)
  const pointsRef = useRef<StrokePoint[]>([])
  const activePointerRef = useRef<number | null>(null)
  const fadeRafRef = useRef<number>(0)
  const holdRafRef = useRef<number>(0)
  const holdCleanupRef = useRef<(() => void) | null>(null)
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
    const ctx = ensureCanvasSize()
    if (ctx) {
      ctx.clearRect(0, 0, window.innerWidth, window.innerHeight)
    }
  }, [ensureCanvasSize])

  const dissolveStroke = useCallback(
    (pts: StrokePoint[], color: string, durationMs = 260) => {
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

  const cancelStillnessHold = useCallback(
    (reason?: string, strokeToFade?: StrokePoint[]) => {
      cancelAnimationFrame(holdRafRef.current)
      holdRafRef.current = 0
      if (holdCleanupRef.current) {
        holdCleanupRef.current()
        holdCleanupRef.current = null
      }
      setHoldProgress(null)
      if (strokeToFade && strokeToFade.length >= 2) {
        dissolveStroke(strokeToFade, '#a3a3a3', 220)
      }
      if (reason) {
        setHintText(reason)
      }
    },
    [dissolveStroke],
  )

  const getInkColor = () => {
    const isDark = document.documentElement.getAttribute('data-theme') === 'dark'
    return isDark ? '#f2f2f2' : '#141414'
  }

  const startStillnessHold = useCallback(
    (pts: StrokePoint[], anchorX: number, anchorY: number) => {
      cancelStillnessHold()
      setHintText(null)
      setHoldProgress(0)

      const startTs = performance.now()
      let settled = false

      const onPointerMoveCheck = (ev: PointerEvent) => {
        if (settled) return
        const dist = Math.hypot(ev.clientX - anchorX, ev.clientY - anchorY)
        if (dist > STILLNESS_MOVE_TOLERANCE_PX) {
          settled = true
          cancelStillnessHold('Cursor moved. Hold still for 0.5s after drawing ✓', pts)
        }
      }

      const onPointerDownCheck = () => {
        if (settled) return
        settled = true
        cancelStillnessHold(undefined, pts)
      }

      window.addEventListener('pointermove', onPointerMoveCheck, { passive: true })
      window.addEventListener('pointerdown', onPointerDownCheck, { passive: true })

      holdCleanupRef.current = () => {
        window.removeEventListener('pointermove', onPointerMoveCheck)
        window.removeEventListener('pointerdown', onPointerDownCheck)
      }

      const tick = (now: number) => {
        if (settled) return
        const elapsed = now - startTs
        const frac = Math.min(1, elapsed / STILLNESS_HOLD_MS)
        setHoldProgress(frac)

        // Keep green checkmark illuminated during the 0.5-second stillness lock-in
        const ctx = ensureCanvasSize()
        if (ctx) {
          ctx.clearRect(0, 0, window.innerWidth, window.innerHeight)
          drawInkStroke(ctx, pts, '#29cc57', 0.92)
        }

        if (frac >= 1) {
          settled = true
          if (holdCleanupRef.current) {
            holdCleanupRef.current()
            holdCleanupRef.current = null
          }
          setHoldProgress(null)
          if (disabledRef.current) {
            dissolveStroke(pts, '#a3a3a3', 200)
            return
          }
          dissolveStroke(pts, '#29cc57', 240)
          onTriggerRef.current()
          return
        }
        holdRafRef.current = requestAnimationFrame(tick)
      }

      holdRafRef.current = requestAnimationFrame(tick)
    },
    [cancelStillnessHold, dissolveStroke, ensureCanvasSize],
  )

  const finishStroke = useCallback(
    (source: 'gate' | 'screen', releaseX?: number, releaseY?: number) => {
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
        if (disabledRef.current) {
          // Always let user draw anywhere even before answering; gently prompt for an answer
          dissolveStroke(pts, '#456dff', 300)
          setHintText('Enter or select an answer first, then draw ✓')
          return
        }
        const lastPt = pts[pts.length - 1]!
        startStillnessHold(pts, releaseX ?? lastPt.x, releaseY ?? lastPt.y)
      } else {
        dissolveStroke(pts, getInkColor(), 260)
        if (source === 'gate') {
          setRejectShake(true)
          setHintText('Sketch a short downstroke, then a longer up-right stroke')
          window.clearTimeout(shakeTimerRef.current)
          shakeTimerRef.current = window.setTimeout(() => {
            setRejectShake(false)
          }, 380)
          onRejectRef.current?.(res.reason)
        }
      }
    },
    [clearCanvas, dissolveStroke, startStillnessHold],
  )

  useEffect(() => {
    return () => {
      cancelAnimationFrame(fadeRafRef.current)
      cancelAnimationFrame(holdRafRef.current)
      if (holdCleanupRef.current) holdCleanupRef.current()
      window.clearTimeout(shakeTimerRef.current)
    }
  }, [])

  useEffect(() => {
    if (visualState === 'correct') {
      setHintText(null)
      cancelStillnessHold()
    }
  }, [visualState, cancelStillnessHold])

  // Pointer handlers on the footer checkmark pad itself (always drawable in Draw Mode)
  const onGatePointerDown = (e: React.PointerEvent<HTMLDivElement>) => {
    if (e.button !== 0 && e.pointerType === 'mouse') return
    if (activePointerRef.current !== null) return
    e.preventDefault()
    e.stopPropagation()
    cancelStillnessHold()
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
    finishStroke('gate', e.clientX, e.clientY)
  }

  const onGatePointerCancel = (e: React.PointerEvent<HTMLDivElement>) => {
    if (activePointerRef.current !== e.pointerId) return
    try {
      e.currentTarget.releasePointerCapture(e.pointerId)
    } catch {
      // ignore
    }
    activePointerRef.current = null
    pointsRef.current = []
    setIsDrawing(false)
    clearCanvas()
  }

  // Page-wide draw-anywhere capture (always active in Draw Mode even before an answer is entered!)
  useEffect(() => {
    if (!enableScreenGesture) return
    let screenPtrId: number | null = null
    let startedDrawing = false

    const isExcludedTarget = (target: EventTarget | null): boolean => {
      if (!(target instanceof Element)) return true
      return Boolean(
        target.closest(
          'button, a, input, textarea, select, label, [role="button"], [role="dialog"], [role="menu"], [role="listbox"], [role="radiogroup"], [role="slider"], [data-pen-workspace], .pen-workspace-surface, .pen-radial-backdrop, .workspace-splitter, .chk-gate-wrap, .br-choice-opt, .br-choice-btn, .br-plan-card, .br-plan-problem, .grid-tile, .br-graph-handle, .br-graph-svg, [data-draggable-handle], .sema-svg, .sema-runtime-anchor, .lesson-navigation, .winbox',
        ),
      )
    }

    const onDown = (e: PointerEvent) => {
      if (e.button !== 0 && e.pointerType === 'mouse') return
      if (activePointerRef.current !== null || screenPtrId !== null) return
      if (isExcludedTarget(e.target)) return
      const container = screenGestureContainerRef?.current
      if (container && (!(e.target instanceof Node) || !container.contains(e.target))) {
        return
      }
      cancelStillnessHold()
      cancelAnimationFrame(fadeRafRef.current)
      screenPtrId = e.pointerId
      startedDrawing = false
      pointsRef.current = [{ x: e.clientX, y: e.clientY, t: performance.now() }]
    }

    const onMove = (e: PointerEvent) => {
      if (screenPtrId !== e.pointerId || activePointerRef.current !== null) return
      const pts = pointsRef.current
      const first = pts[0]
      if (!first) return
      if (!startedDrawing) {
        if (Math.hypot(e.clientX - first.x, e.clientY - first.y) < 12) return
        cancelAnimationFrame(fadeRafRef.current)
        startedDrawing = true
        setIsDrawing(true)
        window.getSelection?.()?.removeAllRanges()
      }
      const last = pts[pts.length - 1]!
      if (Math.hypot(e.clientX - last.x, e.clientY - last.y) < 2.4) return
      pts.push({ x: e.clientX, y: e.clientY, t: performance.now() })
      const ctx = ensureCanvasSize()
      if (ctx) {
        ctx.clearRect(0, 0, window.innerWidth, window.innerHeight)
        drawInkStroke(ctx, pts, getInkColor(), 0.88)
      }
    }

    const onUp = (e: PointerEvent) => {
      if (screenPtrId !== e.pointerId) return
      screenPtrId = null
      if (startedDrawing) {
        startedDrawing = false
        finishStroke('screen', e.clientX, e.clientY)
      } else {
        pointsRef.current = []
      }
    }

    const onCancel = (e: PointerEvent) => {
      if (screenPtrId !== e.pointerId) return
      screenPtrId = null
      startedDrawing = false
      pointsRef.current = []
      setIsDrawing(false)
      clearCanvas()
    }

    window.addEventListener('pointerdown', onDown)
    window.addEventListener('pointermove', onMove, { passive: true })
    window.addEventListener('pointerup', onUp)
    window.addEventListener('pointercancel', onCancel)
    return () => {
      window.removeEventListener('pointerdown', onDown)
      window.removeEventListener('pointermove', onMove)
      window.removeEventListener('pointerup', onUp)
      window.removeEventListener('pointercancel', onCancel)
    }
  }, [enableScreenGesture, screenGestureContainerRef, ensureCanvasSize, finishStroke, cancelStillnessHold, clearCanvas])

  const isCorrect = visualState === 'correct'
  const isWrong = visualState === 'wrong'
  const isHolding = holdProgress !== null

  return (
    <div className="chk-gate-wrap">
      <div
        ref={gateRef}
        className={`chk-gate${disabled ? ' is-awaiting-answer' : ''}${isDrawing ? ' is-drawing' : ''}${
          isHolding ? ' is-holding' : ''
        }${isCorrect ? ' is-correct' : ''}${isWrong ? ' is-wrong' : ''}${rejectShake ? ' is-shake' : ''}`}
        role="button"
        tabIndex={disabled ? -1 : 0}
        aria-disabled={disabled || undefined}
        aria-label={label}
        onKeyDown={e => {
          if (disabled || (e.key !== 'Enter' && e.key !== ' ')) return
          e.preventDefault()
          onTriggerRef.current()
        }}
        onPointerDown={onGatePointerDown}
        onPointerMove={onGatePointerMove}
        onPointerUp={onGatePointerUp}
        onPointerCancel={onGatePointerCancel}
        onLostPointerCapture={onGatePointerCancel}
      >
        <svg className="chk-led-svg" viewBox="0 0 440 118" preserveAspectRatio="none" aria-hidden="true">
          <rect
            className="chk-led-rect"
            x="2"
            y="2"
            width="436"
            height="114"
            rx="20"
            ry="20"
            pathLength={100}
            vectorEffect="non-scaling-stroke"
          />
        </svg>

        <svg className="chk-guide-svg" viewBox="0 0 320 112" aria-hidden="true">
          <path className="chk-dotted-guide" d={DOTTED_CHECKMARK_STROKE} />
          <path className="chk-solid-check" d={DOTTED_CHECKMARK_STROKE} pathLength={100} />
        </svg>
      </div>

      {/* 0.5-second stillness green progress bar right below the checkmark box */}
      {isHolding && (
        <div className="chk-hold-progress-wrap" role="progressbar" aria-valuemin={0} aria-valuemax={100} aria-valuenow={Math.round(holdProgress * 100)}>
          <div className="chk-hold-progress-track">
            <div
              className="chk-hold-progress-fill"
              style={{ width: `${Math.round(holdProgress * 1000) / 10}%` }}
            />
          </div>
          <span className="chk-hold-progress-label">
            Hold still ({Math.max(0, ((1 - holdProgress) * STILLNESS_HOLD_MS) / 1000).toFixed(1)}s) · Complete the step
          </span>
        </div>
      )}

      <div className="chk-gate-subrow">
        {hintText ? (
          <span className="chk-gate-hint">{hintText}</span>
        ) : !isHolding ? (
          <span className={`chk-gate-instruction${isCorrect ? ' is-correct' : ''}`}>
            {isDrawing
              ? 'Release and hold still for 0.5s'
              : disabled
                ? 'Draw anywhere · enter an answer to submit'
                : label}
          </span>
        ) : null}
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
