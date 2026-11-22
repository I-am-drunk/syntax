import { useEffect, useRef, useState } from 'react'
import { MathText } from '../components/MathText'
import type { PaperStyle } from './MathPackageWorksheet'

export type PenToolId = 'draw' | 'highlight' | 'line' | 'eraser' | 'select' | 'hand'
export type PenColorId = 'black' | 'blue' | 'red' | 'green' | 'orange'
export type PenSizeId = 's' | 'm' | 'l' | 'xl'

export const PEN_SIZES: { id: PenSizeId; label: string; dotPx: number }[] = [
  { id: 's', label: 'Fine', dotPx: 4 },
  { id: 'm', label: 'Med', dotPx: 7 },
  { id: 'l', label: 'Bold', dotPx: 11 },
  { id: 'xl', label: 'Heavy', dotPx: 15 },
]

export const PEN_COLORS: { id: PenColorId; label: string; lightHex: string; darkHex: string }[] = [
  { id: 'black', label: 'Ink', lightHex: '#141414', darkHex: '#F2F2F2' },
  { id: 'blue', label: 'Blue', lightHex: '#456DFF', darkHex: '#7491FF' },
  { id: 'red', label: 'Red', lightHex: '#E14B4B', darkHex: '#FF8585' },
  { id: 'green', label: 'Green', lightHex: '#15B441', darkHex: '#5ED981' },
  { id: 'orange', label: 'Orange', lightHex: '#E77A16', darkHex: '#FFA95A' },
]

function ToolSvg({ id, size = 16 }: { id: PenToolId; size?: number }) {
  switch (id) {
    case 'draw':
      return (
        <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M17 3a2.85 2.83 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5Z" />
          <path d="m15 5 4 4" />
        </svg>
      )
    case 'highlight':
      return (
        <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <path d="m9 11-6 6v3h9l3-3" />
          <path d="m22 12-4.6 4.6a2 2 0 0 1-2.8 0l-5.2-5.2a2 2 0 0 1 0-2.8L14 4" />
        </svg>
      )
    case 'line':
      return (
        <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M5 19 19 5" />
          <circle cx="5" cy="19" r="1.8" fill="currentColor" stroke="none" />
          <circle cx="19" cy="5" r="1.8" fill="currentColor" stroke="none" />
        </svg>
      )
    case 'eraser':
      return (
        <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <path d="m7 21-4.3-4.3c-1-1-1-2.5 0-3.4l9.6-9.6c1-1 2.5-1 3.4 0l5.6 5.6c1 1 1 2.5 0 3.4L13 21" />
          <path d="M22 21H7" />
          <path d="m5 11 9 9" />
        </svg>
      )
    case 'select':
      return (
        <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <path d="m4 4 6.5 16 2.8-6.2L19.5 11 4 4Z" />
        </svg>
      )
    case 'hand':
      return (
        <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M18 11V6a2 2 0 0 0-4 0v4" />
          <path d="M14 10V4a2 2 0 0 0-4 0v6" />
          <path d="M10 10.5V6a2 2 0 0 0-4 0v8" />
          <path d="M18 8a2 2 0 1 1 4 0v6a8 8 0 0 1-8 8h-2c-2.8 0-4.5-.86-5.99-2.34l-3.6-3.6a2 2 0 0 1 2.83-2.82L7 15" />
        </svg>
      )
  }
}

const TOOL_ITEMS: { id: PenToolId; label: string; keyHint: string }[] = [
  { id: 'draw', label: 'Pen', keyHint: 'D' },
  { id: 'highlight', label: 'Highlighter', keyHint: 'H' },
  { id: 'line', label: 'Line', keyHint: 'L' },
  { id: 'eraser', label: 'Eraser', keyHint: 'E' },
  { id: 'select', label: 'Select', keyHint: 'V' },
  { id: 'hand', label: 'Pan', keyHint: 'Space' },
]

/**
 * Brilliant-styled top-left collapsible Procreate-style Brush/Size/Opacity drawer
 * + clean top bar (Sheet / Plan / Undo / Redo / Fullscreen).
 * Zero overlapping layers: drawer expands & collapses smoothly via its arrow tab.
 */
export function PenBrilliantChrome({
  theme,
  activeTool,
  activeColor,
  activeSize,
  activeOpacity,
  paperStyle,
  canUndo,
  canRedo,
  fullscreen,
  flipped,
  planSteps,
  dimmed,
  defaultDrawerCollapsed = true,
  canvasPointerEpoch,
  onSelectTool,
  onSelectColor,
  onSelectSize,
  onSetOpacity,
  onSetPaperStyle,
  onUndo,
  onRedo,
  onStampGrid,
  onClearInk,
  onResetZoom,
  onToggleFlip,
  onToggleFullscreen,
  onExportPng,
}: {
  theme: 'light' | 'dark'
  activeTool: PenToolId
  activeColor: PenColorId
  activeSize: PenSizeId
  activeOpacity: number
  paperStyle: PaperStyle
  canUndo: boolean
  canRedo: boolean
  fullscreen: boolean
  flipped: boolean
  planSteps: string[]
  dimmed: boolean
  defaultDrawerCollapsed?: boolean
  canvasPointerEpoch: number
  onSelectTool: (t: PenToolId) => void
  onSelectColor: (c: PenColorId) => void
  onSelectSize: (s: PenSizeId) => void
  onSetOpacity: (o: number) => void
  onSetPaperStyle: (style: PaperStyle) => void
  onUndo: () => void
  onRedo: () => void
  onStampGrid: () => void
  onClearInk: () => void
  onResetZoom: () => void
  onToggleFlip: () => void
  onToggleFullscreen: () => void
  onExportPng: () => void
}) {
  const [drawerOpen, setDrawerOpen] = useState(!defaultDrawerCollapsed)

  useEffect(() => {
    setDrawerOpen(!defaultDrawerCollapsed)
  }, [defaultDrawerCollapsed])
  const [openMenu, setOpenMenu] = useState<'sheet' | 'plan' | null>(null)
  const [confirmClear, setConfirmClear] = useState(false)
  const topRef = useRef<HTMLDivElement>(null)
  const sizeTrackRef = useRef<HTMLDivElement>(null)
  const opacityTrackRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    setOpenMenu(null)
    setConfirmClear(false)
  }, [canvasPointerEpoch])

  useEffect(() => {
    if (!openMenu) return
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setOpenMenu(null)
        setConfirmClear(false)
      }
    }
    const onDown = (e: PointerEvent) => {
      if (topRef.current && !topRef.current.contains(e.target as Node)) {
        setOpenMenu(null)
        setConfirmClear(false)
      }
    }
    window.addEventListener('keydown', onKey)
    window.addEventListener('pointerdown', onDown)
    return () => {
      window.removeEventListener('keydown', onKey)
      window.removeEventListener('pointerdown', onDown)
    }
  }, [openMenu])

  const sizeIdx = Math.max(
    0,
    PEN_SIZES.findIndex(s => s.id === activeSize),
  )
  const currentColorObj =
    PEN_COLORS.find(c => c.id === activeColor) ?? PEN_COLORS[0]
  const activeHex =
    theme === 'dark' ? currentColorObj.darkHex : currentColorObj.lightHex

  const scrubSize = (clientY: number) => {
    const rect = sizeTrackRef.current?.getBoundingClientRect()
    if (!rect || rect.height <= 0) return
    const ratio = Math.max(0, Math.min(1, 1 - (clientY - rect.top) / rect.height))
    const idx = Math.min(PEN_SIZES.length - 1, Math.round(ratio * (PEN_SIZES.length - 1)))
    onSelectSize(PEN_SIZES[idx].id)
  }

  const scrubOpacity = (clientY: number) => {
    const rect = opacityTrackRef.current?.getBoundingClientRect()
    if (!rect || rect.height <= 0) return
    const ratio = Math.max(0, Math.min(1, 1 - (clientY - rect.top) / rect.height))
    const next = Math.round((0.25 + ratio * 0.75) * 20) / 20
    onSetOpacity(next)
  }

  const beginVerticalScrub = (e: React.PointerEvent, fn: (y: number) => void) => {
    if (e.button !== 0) return
    e.stopPropagation()
    e.preventDefault()
    fn(e.clientY)
    const onMove = (ev: PointerEvent) => fn(ev.clientY)
    const onUp = () => {
      window.removeEventListener('pointermove', onMove)
      window.removeEventListener('pointerup', onUp)
    }
    window.addEventListener('pointermove', onMove)
    window.addEventListener('pointerup', onUp)
  }

  const sizePct = (sizeIdx / (PEN_SIZES.length - 1)) * 100
  const opacityPct = Math.round(((activeOpacity - 0.25) / 0.75) * 100)

  return (
    <>
      {/* 1. Minimal Brilliant Header Strip (normal flex flow above paper — zero collisions) */}
      <div
        ref={topRef}
        className="pen-br-topbar-wrap"
        data-theme={theme}
        data-dimmed={dimmed || undefined}
      >
        <div className="pen-br-topbar" role="toolbar" aria-label="Worksheet controls">
          {/* Left: Sheet & Plan pills */}
          <div className="pen-br-bar-group">
            <button
              type="button"
              className="pen-br-chip"
              data-active={openMenu === 'sheet' || undefined}
              onClick={() => {
                setConfirmClear(false)
                setOpenMenu(m => (m === 'sheet' ? null : 'sheet'))
              }}
              aria-expanded={openMenu === 'sheet'}
            >
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
                <polyline points="14 2 14 8 20 8" />
              </svg>
              <span>Sheet</span>
              <svg className="pen-br-chevron" width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                <polyline points="6 9 12 15 18 9" />
              </svg>
            </button>

            {planSteps.length > 0 && (
              <button
                type="button"
                className="pen-br-chip"
                data-active={openMenu === 'plan' || undefined}
                onClick={() => setOpenMenu(m => (m === 'plan' ? null : 'plan'))}
                aria-expanded={openMenu === 'plan'}
              >
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                  <line x1="8" y1="6" x2="21" y2="6" />
                  <line x1="8" y1="12" x2="21" y2="12" />
                  <line x1="8" y1="18" x2="21" y2="18" />
                  <line x1="3" y1="6" x2="3.01" y2="6" />
                  <line x1="3" y1="12" x2="3.01" y2="12" />
                  <line x1="3" y1="18" x2="3.01" y2="18" />
                </svg>
                <span>Plan</span>
              </button>
            )}
          </div>

          {/* Center: Clean Brilliant Tool Strip */}
          <div className="pen-br-tools" role="group" aria-label="Drawing tools">
            {TOOL_ITEMS.map(item => (
              <button
                key={item.id}
                type="button"
                className="pen-br-tool-btn"
                data-active={activeTool === item.id || undefined}
                onClick={() => onSelectTool(item.id)}
                aria-label={item.label}
                aria-pressed={activeTool === item.id}
                title={`${item.label} (${item.keyHint})`}
              >
                <ToolSvg id={item.id} />
              </button>
            ))}
          </div>

          {/* Right: Undo, Redo, Fullscreen */}
          <div className="pen-br-bar-group">
            <button
              type="button"
              className="pen-br-icon-btn"
              disabled={!canUndo}
              onClick={onUndo}
              aria-label="Undo"
              title="Undo (Ctrl+Z)"
            >
              <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.1" strokeLinecap="round" strokeLinejoin="round">
                <path d="M3 7v6h6" />
                <path d="M21 17a9 9 0 0 0-9-9 9 9 0 0 0-6 2.3L3 13" />
              </svg>
            </button>
            <button
              type="button"
              className="pen-br-icon-btn"
              disabled={!canRedo}
              onClick={onRedo}
              aria-label="Redo"
              title="Redo (Ctrl+Shift+Z)"
            >
              <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.1" strokeLinecap="round" strokeLinejoin="round">
                <path d="M21 7v6h-6" />
                <path d="M3 17a9 9 0 0 1 9-9 9 9 0 0 1 6 2.3L21 13" />
              </svg>
            </button>
            <button
              type="button"
              className="pen-br-icon-btn"
              data-active={fullscreen || undefined}
              onClick={onToggleFullscreen}
              aria-label={fullscreen ? 'Restore split view' : 'Full-screen sheet'}
              title={fullscreen ? 'Restore split view' : 'Full-screen sheet'}
            >
              {fullscreen ? (
                <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M8 3v3a2 2 0 0 1-2 2H3" />
                  <path d="M21 8h-3a2 2 0 0 1-2-2V3" />
                  <path d="M3 16h3a2 2 0 0 1 2 2v3" />
                  <path d="M16 21v-3a2 2 0 0 1 2-2h3" />
                </svg>
              ) : (
                <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M15 3h6v6" />
                  <path d="M9 21H3v-6" />
                  <path d="M21 3l-7 7" />
                  <path d="M3 21l7-7" />
                </svg>
              )}
            </button>
          </div>
        </div>

        {/* Sheet Popover — strictly z:70 above everything, cleanly below top bar */}
        {openMenu === 'sheet' && (
          <div className="pen-br-popover pen-br-popover-sheet" role="menu">
            <div className="pen-br-pop-eyebrow">Paper Style</div>
            <div className="pen-br-paper-grid">
              {(['dots', 'grid', 'lined', 'blank'] as PaperStyle[]).map(style => (
                <button
                  key={style}
                  type="button"
                  className="pen-br-paper-chip"
                  data-active={paperStyle === style || undefined}
                  onClick={() => onSetPaperStyle(style)}
                >
                  {style === 'dots'
                    ? 'Dots'
                    : style === 'grid'
                      ? 'Grid'
                      : style === 'lined'
                        ? 'Lined'
                        : 'Blank'}
                </button>
              ))}
            </div>

            <div className="pen-br-pop-sep" />

            <button
              type="button"
              className="pen-br-pop-row"
              onClick={() => {
                onStampGrid()
                setOpenMenu(null)
              }}
            >
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M3 12h18M12 3v18" />
                <rect x="3" y="3" width="18" height="18" rx="2" />
              </svg>
              <span>Insert coordinate axes</span>
            </button>

            <button
              type="button"
              className="pen-br-pop-row"
              onClick={() => {
                onResetZoom()
                setOpenMenu(null)
              }}
            >
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <circle cx="11" cy="11" r="8" />
                <line x1="21" y1="21" x2="16.65" y2="16.65" />
                <line x1="8" y1="11" x2="14" y2="11" />
              </svg>
              <span>Reset zoom to fit</span>
            </button>

            <button
              type="button"
              className="pen-br-pop-row"
              onClick={() => {
                onToggleFlip()
                setOpenMenu(null)
              }}
            >
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="m17 2 4 4-4 4" />
                <path d="M3 6h18" />
                <path d="m7 22-4-4 4-4" />
                <path d="M21 18H3" />
              </svg>
              <span>{flipped ? 'Move sheet to right side' : 'Move sheet to left side'}</span>
            </button>

            <button
              type="button"
              className="pen-br-pop-row"
              onClick={() => {
                onExportPng()
                setOpenMenu(null)
              }}
            >
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
                <polyline points="7 10 12 15 17 10" />
                <line x1="12" y1="15" x2="12" y2="3" />
              </svg>
              <span>Save step as PNG</span>
            </button>

            <div className="pen-br-pop-sep" />

            {!confirmClear ? (
              <button
                type="button"
                className="pen-br-pop-row is-danger"
                onClick={() => setConfirmClear(true)}
              >
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <polyline points="3 6 5 6 21 6" />
                  <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" />
                </svg>
                <span>Clear ink on this step</span>
              </button>
            ) : (
              <div className="pen-br-confirm-row">
                <span>Clear this step?</span>
                <button
                  type="button"
                  className="pen-br-confirm-yes"
                  onClick={() => {
                    onClearInk()
                    setConfirmClear(false)
                    setOpenMenu(null)
                  }}
                >
                  Clear
                </button>
                <button
                  type="button"
                  className="pen-br-confirm-no"
                  onClick={() => setConfirmClear(false)}
                >
                  Cancel
                </button>
              </div>
            )}

            <div className="pen-br-pop-foot">
              Right-click or stylus button opens quick radial wheel
            </div>
          </div>
        )}

        {/* Strategy Plan Popover */}
        {openMenu === 'plan' && planSteps.length > 0 && (
          <div className="pen-br-popover pen-br-popover-plan" role="dialog" aria-label="Strategy Plan">
            <div className="pen-br-pop-eyebrow">Strategy Plan</div>
            <ol className="pen-br-plan-list">
              {planSteps.map((step, i) => (
                <li key={i}>
                  <span className="pen-br-plan-num">{i + 1}</span>
                  <span>
                    <MathText text={step} />
                  </span>
                </li>
              ))}
            </ol>
          </div>
        )}
      </div>

      {/* 2. Top-Left Pull-In / Pull-Out Reference Brush Drawer (Size, Opacity, Ink Colors) */}
      <aside
        className="pen-br-brush-dock"
        data-theme={theme}
        data-open={drawerOpen || undefined}
        data-dimmed={dimmed || undefined}
        aria-label="Pen size, opacity, and ink color controls"
        onPointerDown={e => e.stopPropagation()}
      >
        {/* Sliding vertical Procreate-grade control slab */}
        <div className="pen-br-brush-slab" aria-hidden={!drawerOpen}>
          {/* Live Nib Size Slider */}
          <div className="pen-br-slider-block" title={`Size: ${PEN_SIZES[sizeIdx].label}`}>
            <span className="pen-br-nib-preview" aria-hidden="true">
              <span
                className="pen-br-nib-dot"
                style={{
                  width: PEN_SIZES[sizeIdx].dotPx,
                  height: PEN_SIZES[sizeIdx].dotPx,
                  background: activeHex,
                  opacity: activeOpacity,
                }}
              />
            </span>
            <div
              ref={sizeTrackRef}
              className="pen-br-vtrack"
              role="slider"
              aria-label="Stroke size"
              aria-valuemin={1}
              aria-valuemax={4}
              aria-valuenow={sizeIdx + 1}
              aria-valuetext={PEN_SIZES[sizeIdx].label}
              tabIndex={drawerOpen ? 0 : -1}
              onPointerDown={e => beginVerticalScrub(e, scrubSize)}
            >
              <div className="pen-br-vtrack-taper" aria-hidden="true" />
              <div className="pen-br-vtrack-fill" style={{ height: `${Math.max(10, sizePct)}%` }} />
              <div className="pen-br-vtrack-knob" style={{ bottom: `calc(${sizePct}% - 7px)` }} />
            </div>
            <span className="pen-br-slider-val">{PEN_SIZES[sizeIdx].label}</span>
          </div>

          <span className="pen-br-slab-divider" aria-hidden="true" />

          {/* Opacity Slider */}
          <div className="pen-br-slider-block" title={`Opacity: ${Math.round(activeOpacity * 100)}%`}>
            <div
              ref={opacityTrackRef}
              className="pen-br-vtrack is-opacity"
              role="slider"
              aria-label="Ink opacity"
              aria-valuemin={25}
              aria-valuemax={100}
              aria-valuenow={Math.round(activeOpacity * 100)}
              tabIndex={drawerOpen ? 0 : -1}
              onPointerDown={e => beginVerticalScrub(e, scrubOpacity)}
            >
              <div className="pen-br-vtrack-fill" style={{ height: `${Math.max(8, opacityPct)}%` }} />
              <div className="pen-br-vtrack-knob" style={{ bottom: `calc(${opacityPct}% - 7px)` }} />
            </div>
            <span className="pen-br-slider-val">{Math.round(activeOpacity * 100)}%</span>
          </div>

          <span className="pen-br-slab-divider" aria-hidden="true" />

          {/* Ink Color Swatches */}
          <div className="pen-br-color-col" role="group" aria-label="Ink colors">
            {PEN_COLORS.map(c => {
              const hex = theme === 'dark' ? c.darkHex : c.lightHex
              const selected = activeColor === c.id
              return (
                <button
                  key={c.id}
                  type="button"
                  className="pen-br-color-dot"
                  data-active={selected || undefined}
                  style={{ '--dot-hex': hex } as React.CSSProperties}
                  onClick={() => onSelectColor(c.id)}
                  aria-label={`${c.label} ink`}
                  aria-pressed={selected}
                  tabIndex={drawerOpen ? 0 : -1}
                  title={c.label}
                />
              )
            })}
          </div>
        </div>

        {/* Tactile Pull-In / Pull-Out Arrow Handle */}
        <button
          type="button"
          className="pen-br-dock-tab"
          onClick={() => setDrawerOpen(v => !v)}
          aria-expanded={drawerOpen}
          aria-label={drawerOpen ? 'Hide brush controls' : 'Show brush controls'}
          title={drawerOpen ? 'Collapse pen controls' : 'Expand pen controls'}
        >
          {!drawerOpen && (
            <span
              className="pen-br-tab-ink-pip"
              style={{
                background: activeHex,
                width: 5 + sizeIdx * 2,
                height: 5 + sizeIdx * 2,
                opacity: activeOpacity,
              }}
              aria-hidden="true"
            />
          )}
          <svg
            className="pen-br-dock-arrow"
            width="13"
            height="13"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2.6"
            strokeLinecap="round"
            strokeLinejoin="round"
            aria-hidden="true"
          >
            <polyline points="15 18 9 12 15 6" />
          </svg>
        </button>
      </aside>
    </>
  )
}

/**
 * Brilliant-native bottom footer bar for Pen Studio:
 * Mirrors the left pane's .lesson-footer with stylized back/forward arrows,
 * step indicator dots, + Page, and Brilliant 3D-pressable Done/Check button.
 */
export function PenStepFooter({
  theme,
  stepIndex,
  totalSteps,
  checkedSteps,
  isCustomSteps = [],
  currentChecked,
  dimmed,
  onPrevStep,
  onNextStep,
  onSelectStep,
  onAddStep,
  onDeleteStep,
  onToggleChecked,
}: {
  theme: 'light' | 'dark'
  stepIndex: number
  totalSteps: number
  checkedSteps: boolean[]
  isCustomSteps?: boolean[]
  currentChecked: boolean
  dimmed: boolean
  onPrevStep: () => void
  onNextStep: () => void
  onSelectStep: (idx: number) => void
  onAddStep: () => void
  onDeleteStep?: (idx: number) => void
  onToggleChecked: () => void
}) {
  const canPrev = stepIndex > 0
  const canNext = stepIndex < totalSteps - 1

  return (
    <footer
      className="pen-br-footer"
      data-theme={theme}
      data-checked={currentChecked || undefined}
      data-dimmed={dimmed || undefined}
      aria-label="Step navigation"
    >
      {/* Left: Stylized Brilliant Back / Step Dots / Forward Arrows */}
      <div className="pen-br-step-nav">
        <button
          type="button"
          className="pen-br-arrow-btn"
          disabled={!canPrev}
          onClick={onPrevStep}
          aria-label="Previous step"
          title="Previous step"
        >
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
            <path d="M19 12H5" />
            <path d="m12 19-7-7 7-7" />
          </svg>
        </button>

        <div className="pen-br-step-pills" role="tablist" aria-label="Equation steps">
          {checkedSteps.map((isDone, idx) => {
            const isCustom = Boolean(isCustomSteps[idx])
            return (
              <div key={idx} className="pen-br-step-dot-wrap">
                <button
                  type="button"
                  role="tab"
                  aria-selected={idx === stepIndex}
                  className="pen-br-step-dot"
                  data-current={idx === stepIndex || undefined}
                  data-done={isDone || undefined}
                  data-custom={isCustom || undefined}
                  onClick={() => onSelectStep(idx)}
                  aria-label={`${isCustom ? 'Scratch page' : 'Step'} ${idx + 1}${isDone ? ' (done)' : ''}`}
                  title={isCustom ? `Scratch page ${idx + 1}` : `Step ${idx + 1}`}
                >
                  {isCustom && (
                    <svg className="pen-br-step-dot-ring" viewBox="0 0 30 30" aria-hidden="true">
                      <circle
                        cx="15"
                        cy="15"
                        r="13.5"
                        fill="none"
                        stroke="currentColor"
                        strokeWidth="1.75"
                        strokeDasharray="3.6 3.47"
                        strokeLinecap="round"
                      />
                    </svg>
                  )}
                  <span>{idx + 1}</span>
                </button>
                {isCustom && onDeleteStep && (
                  <button
                    type="button"
                    className="pen-br-step-del-btn"
                    onClick={(e) => {
                      e.stopPropagation()
                      onDeleteStep(idx)
                    }}
                    aria-label={`Delete scratch page ${idx + 1}`}
                    title="Delete extra scratch page"
                  >
                    <svg width="8" height="8" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" aria-hidden="true">
                      <path d="M18 6 6 18M6 6l12 12" />
                    </svg>
                  </button>
                )}
              </div>
            )
          })}

          <button
            type="button"
            className="pen-br-step-add"
            onClick={onAddStep}
            aria-label="Add blank scratch page"
            title="Add extra blank step page"
          >
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.8" strokeLinecap="round" aria-hidden="true">
              <path d="M12 5v14M5 12h14" />
            </svg>
          </button>
        </div>

        <button
          type="button"
          className="pen-br-arrow-btn"
          disabled={!canNext}
          onClick={onNextStep}
          aria-label="Next step"
          title="Next step"
        >
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
            <path d="M5 12h14" />
            <path d="m12 5 7 7-7 7" />
          </svg>
        </button>
      </div>

      {/* Right: Brilliant-style tactile pill CTA (Check Step / Done) */}
      <div className="pen-br-footer-cta">
        <button
          type="button"
          className="pen-br-done-btn"
          data-checked={currentChecked || undefined}
          onClick={onToggleChecked}
          aria-pressed={currentChecked}
        >
          <span className="pen-br-done-face">
            <svg
              width="14"
              height="14"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2.8"
              strokeLinecap="round"
              strokeLinejoin="round"
              aria-hidden="true"
            >
              <polyline points="20 6 9 17 4 12" />
            </svg>
            <span>{currentChecked ? 'Step done' : 'Mark step done'}</span>
          </span>
        </button>
      </div>
    </footer>
  )
}
