import { useCallback, useEffect, useId, useRef, useState } from 'react'
import { useEditor } from 'tldraw'
import { MathText } from '../components/MathText'
import {
  SHEET_WIDTH,
  clampExtraHeight,
  type WorksheetField,
} from './worksheetModel'

export type PaperStyle = 'dots' | 'grid' | 'lined' | 'blank'

const CIRCLED_NUMS = ['①', '②', '③', '④', '⑤', '⑥', '⑦', '⑧', '⑨']

export function MathPackageWorksheet({
  field,
  totalSteps,
  baseHeight,
  paperStyle,
  theme,
  onChangeExtraHeight,
}: {
  field: WorksheetField
  totalSteps: number
  baseHeight: number
  paperStyle: PaperStyle
  theme: 'light' | 'dark'
  onChangeExtraHeight: (fieldId: string, nextExtra: number) => void
}) {
  const editor = useEditor()
  const uid = useId().replace(/:/g, '')
  const [pointerPage, setPointerPage] = useState<{ x: number; y: number } | null>(null)
  const [isResizing, setIsResizing] = useState(false)
  const dragRef = useRef<{ startClientY: number; startExtra: number } | null>(null)

  const sheetH = Math.max(baseHeight, baseHeight + field.extraHeight)

  // Track pointer purely for the bottom-edge resize highlight (never wakes up while writing on the sheet)
  useEffect(() => {
    const container = editor.getContainer()
    if (!container) return
    let raf = 0
    let latest: { x: number; y: number } | null = null

    const onMove = (e: PointerEvent) => {
      latest = { x: e.clientX, y: e.clientY }
      if (!raf) {
        raf = requestAnimationFrame(() => {
          raf = 0
          if (!latest) return
          const pt = editor.screenToPage(latest)
          setPointerPage({ x: pt.x, y: pt.y })
        })
      }
    }
    const onLeave = () => {
      latest = null
      if (!dragRef.current) setPointerPage(null)
    }

    container.addEventListener('pointermove', onMove, { passive: true })
    container.addEventListener('pointerleave', onLeave)
    return () => {
      if (raf) cancelAnimationFrame(raf)
      container.removeEventListener('pointermove', onMove)
      container.removeEventListener('pointerleave', onLeave)
    }
  }, [editor])

  const handleStartResize = useCallback(
    (e: React.PointerEvent) => {
      if (e.button !== 0) return
      e.stopPropagation()
      e.preventDefault()
      dragRef.current = {
        startClientY: e.clientY,
        startExtra: field.extraHeight,
      }
      setIsResizing(true)

      const onMove = (ev: PointerEvent) => {
        const drag = dragRef.current
        if (!drag) return
        const zoom = editor.getZoomLevel() || 1
        const pageDeltaY = (ev.clientY - drag.startClientY) / zoom
        const nextExtra = clampExtraHeight(drag.startExtra + pageDeltaY)
        onChangeExtraHeight(field.id, nextExtra)
        const pt = editor.screenToPage({ x: ev.clientX, y: ev.clientY })
        setPointerPage({ x: pt.x, y: pt.y })
      }

      const onUp = () => {
        dragRef.current = null
        setIsResizing(false)
        window.removeEventListener('pointermove', onMove)
        window.removeEventListener('pointerup', onUp)
        window.removeEventListener('pointercancel', onUp)
      }

      window.addEventListener('pointermove', onMove)
      window.addEventListener('pointerup', onUp)
      window.addEventListener('pointercancel', onUp)
    },
    [editor, field.extraHeight, field.id, onChangeExtraHeight],
  )

  // Bottom-edge-only razor-sharp cursor highlight (bends cleanly around bottom corners, zero blur)
  let glowStrength = 0
  let glowX = SHEET_WIDTH * 0.5
  if (isResizing) {
    glowStrength = 1
    if (pointerPage) glowX = Math.max(12, Math.min(SHEET_WIDTH - 12, pointerPage.x))
  } else if (pointerPage) {
    const distFromBottom = Math.abs(pointerPage.y - sheetH)
    if (
      pointerPage.x >= -16 &&
      pointerPage.x <= SHEET_WIDTH + 16 &&
      distFromBottom <= 36 &&
      pointerPage.y >= sheetH - 36
    ) {
      glowStrength = Math.max(0, 1 - distFromBottom / 36)
      glowX = Math.max(8, Math.min(SHEET_WIDTH - 8, pointerPage.x))
    }
  }

  const r = 14
  const cornerRise = 28
  const bottomEdgePath = [
    `M 2 ${sheetH - cornerRise}`,
    `L 2 ${sheetH - r}`,
    `A ${r} ${r} 0 0 0 ${2 + r} ${sheetH - 2}`,
    `L ${SHEET_WIDTH - 2 - r} ${sheetH - 2}`,
    `A ${r} ${r} 0 0 0 ${SHEET_WIDTH - 2} ${sheetH - r}`,
    `L ${SHEET_WIDTH - 2} ${sheetH - cornerRise}`,
  ].join(' ')

  const gradId = `br-bottom-glow-${uid}`
  const blueHex = theme === 'dark' ? '#7491ff' : '#456dff'
  const numGlyph = CIRCLED_NUMS[field.index - 1] ?? `${field.index}.`

  return (
    <div
      className="pen-br-sheet"
      data-theme={theme}
      data-paper={paperStyle}
      data-checked={field.checked || undefined}
      data-near-resize={glowStrength > 0.05 || undefined}
      data-resizing={isResizing || undefined}
      style={{
        width: SHEET_WIDTH,
        height: sheetH,
      }}
    >
      {/* Full-bleed paper ruling */}
      <div className="pen-br-ruling" data-paper={paperStyle} aria-hidden="true" />

      {/* Quiet Brilliant editorial step heading — unboxed, generous breathing room */}
      <header className="pen-br-step-head">
        <div className="pen-br-step-title-row">
          <span className="pen-br-step-circle" aria-hidden="true">
            {numGlyph}
          </span>
          <h2 className="pen-br-step-title">
            <MathText text={field.title} />
          </h2>
          {totalSteps > 1 && (
            <span className="pen-br-step-count">
              {field.index} / {totalSteps}
            </span>
          )}
        </div>
        {field.subtitle && (
          <p className="pen-br-step-sub">
            <MathText text={field.subtitle} />
          </p>
        )}
      </header>

      {/* Animated Brilliant Green completion perimeter when marked Done */}
      {field.checked && (
        <svg
          className="pen-br-led-svg"
          width={SHEET_WIDTH}
          height={sheetH}
          viewBox={`0 0 ${SHEET_WIDTH} ${sheetH}`}
          aria-hidden="true"
        >
          <rect
            className="pen-br-led-rect"
            x="2"
            y="2"
            width={SHEET_WIDTH - 4}
            height={sheetH - 4}
            rx="12"
            ry="12"
            pathLength={1000}
          />
        </svg>
      )}

      {/* Razor-sharp bottom-edge resize highlight (ONLY appears near bottom edge) */}
      <svg
        className="pen-br-resize-glow"
        width={SHEET_WIDTH}
        height={sheetH}
        viewBox={`0 0 ${SHEET_WIDTH} ${sheetH}`}
        aria-hidden="true"
        style={{ opacity: glowStrength }}
      >
        <defs>
          <radialGradient
            id={gradId}
            gradientUnits="userSpaceOnUse"
            cx={glowX}
            cy={sheetH - 2}
            r={isResizing ? 230 : 170}
          >
            <stop offset="0%" stopColor={blueHex} stopOpacity="1" />
            <stop offset="55%" stopColor={blueHex} stopOpacity="0.88" />
            <stop offset="100%" stopColor={blueHex} stopOpacity="0" />
          </radialGradient>
        </defs>
        <path
          d={bottomEdgePath}
          fill="none"
          stroke={`url(#${gradId})`}
          strokeWidth={isResizing ? 2.6 : 2}
          strokeLinecap="round"
        />
      </svg>

      {/* Bottom drag bar to optionally extend page height */}
      <div
        className="pen-br-resize-bar"
        role="separator"
        aria-orientation="horizontal"
        aria-label="Drag down for more vertical writing space"
        title="Drag down to extend page length"
        onPointerDown={handleStartResize}
      >
        <span className="pen-br-resize-pill" aria-hidden="true" />
      </div>
    </div>
  )
}
