import { useEffect } from 'react'

export type RadialActionId = 'draw' | 'highlight' | 'line' | 'eraser' | 'hand' | 'undo'

export type RadialSectorItem = {
  id: RadialActionId
  label: string
  shortcut: string
  angleDeg: number
}

export const RADIAL_SECTORS: RadialSectorItem[] = [
  { id: 'draw', label: 'Pen', shortcut: 'D', angleDeg: -90 },
  { id: 'highlight', label: 'Highlight', shortcut: 'H', angleDeg: -30 },
  { id: 'line', label: 'Line', shortcut: 'L', angleDeg: 30 },
  { id: 'eraser', label: 'Eraser', shortcut: 'E', angleDeg: 90 },
  { id: 'hand', label: 'Pan', shortcut: 'Space', angleDeg: 150 },
  { id: 'undo', label: 'Undo', shortcut: 'Ctrl+Z', angleDeg: -150 },
]

export const RADIAL_DEADZONE = 24
const RING_RADIUS = 86
const NODE_RADIUS = 114
const WEDGE_RAY_LEN = 1800

export function angleToSectorIndex(angleRad: number): number {
  const deg = (angleRad * 180) / Math.PI
  const shifted = (((deg + 120) % 360) + 360) % 360
  return Math.floor(shifted / 60) % 6
}

function SectorIcon({ id }: { id: RadialActionId }) {
  switch (id) {
    case 'draw':
      return (
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M17 3a2.85 2.83 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5Z" />
          <path d="m15 5 4 4" />
        </svg>
      )
    case 'highlight':
      return (
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <path d="m9 11-6 6v3h9l3-3" />
          <path d="m22 12-4.6 4.6a2 2 0 0 1-2.8 0l-5.2-5.2a2 2 0 0 1 0-2.8L14 4" />
        </svg>
      )
    case 'line':
      return (
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round">
          <line x1="5" y1="19" x2="19" y2="5" />
          <circle cx="5" cy="19" r="1.6" fill="currentColor" stroke="none" />
          <circle cx="19" cy="5" r="1.6" fill="currentColor" stroke="none" />
        </svg>
      )
    case 'eraser':
      return (
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <path d="m7 21-4.3-4.3c-1-1-1-2.5 0-3.4l9.6-9.6c1-1 2.5-1 3.4 0l5.6 5.6c1 1 1 2.5 0 3.4L13 21" />
          <path d="M22 21H7" />
          <path d="m5 11 9 9" />
        </svg>
      )
    case 'hand':
      return (
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M18 11V6a2 2 0 0 0-4 0v4" />
          <path d="M14 10V4a2 2 0 0 0-4 0v6" />
          <path d="M10 10.5V6a2 2 0 0 0-4 0v8" />
          <path d="M18 8a2 2 0 1 1 4 0v6a8 8 0 0 1-8 8h-2c-2.8 0-4.5-.86-5.99-2.34l-3.6-3.6a2 2 0 0 1 2.83-2.82L7 15" />
        </svg>
      )
    case 'undo':
      return (
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M3 7v6h6" />
          <path d="M21 17a9 9 0 0 0-9-9 9 9 0 0 0-6 2.3L3 13" />
        </svg>
      )
  }
}

export type RadialMenuState = {
  open: boolean
  originX: number
  originY: number
  activeIdx: number | null
  stickX: number
  stickY: number
  pointerAngleRad: number | null
  latched: boolean
  openedAt: number
}

export function PenRadialMenu({
  state,
  activeToolId,
  theme,
  onSelect,
  onCancel,
}: {
  state: RadialMenuState
  activeToolId: string
  theme: 'light' | 'dark'
  onSelect: (id: RadialActionId) => void
  onCancel: () => void
}) {
  useEffect(() => {
    if (!state.open) return
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.preventDefault()
        onCancel()
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [state.open, onCancel])

  if (!state.open) return null

  const { originX, originY, activeIdx, stickX, stickY, pointerAngleRad } = state
  const activeSector = activeIdx !== null ? RADIAL_SECTORS[activeIdx] : null

  // Build SVG path for the active full-screen angular wedge chunk
  let activeWedgePath = ''
  if (activeSector) {
    const startRad = ((activeSector.angleDeg - 30) * Math.PI) / 180
    const endRad = ((activeSector.angleDeg + 30) * Math.PI) / 180
    const x1 = originX + Math.cos(startRad) * WEDGE_RAY_LEN
    const y1 = originY + Math.sin(startRad) * WEDGE_RAY_LEN
    const x2 = originX + Math.cos(endRad) * WEDGE_RAY_LEN
    const y2 = originY + Math.sin(endRad) * WEDGE_RAY_LEN
    activeWedgePath = `M ${originX} ${originY} L ${x1} ${y1} L ${x2} ${y2} Z`
  }

  // Build active highlight arc on the circular ring (60deg arc aligned to active sector)
  let activeArcPath = ''
  if (activeSector) {
    const startRad = ((activeSector.angleDeg - 28) * Math.PI) / 180
    const endRad = ((activeSector.angleDeg + 28) * Math.PI) / 180
    const ax1 = originX + Math.cos(startRad) * RING_RADIUS
    const ay1 = originY + Math.sin(startRad) * RING_RADIUS
    const ax2 = originX + Math.cos(endRad) * RING_RADIUS
    const ay2 = originY + Math.sin(endRad) * RING_RADIUS
    activeArcPath = `M ${ax1} ${ay1} A ${RING_RADIUS} ${RING_RADIUS} 0 0 1 ${ax2} ${ay2}`
  }

  const dividerAngles = [-120, -60, 0, 60, 120, 180]

  return (
    <div
      className="pen-radial-backdrop"
      data-theme={theme}
      data-has-selection={activeIdx !== null || undefined}
      onContextMenu={e => e.preventDefault()}
    >
      {/* Full-screen angular sector rays + active chunk highlight + spinning completion ring */}
      <svg className="pen-radial-svg" aria-hidden="true">
        {/* Active directional screen chunk */}
        {activeWedgePath && (
          <path className="pen-radial-wedge-fill" d={activeWedgePath} />
        )}

        {/* Full-screen sector split divider rays */}
        {dividerAngles.map(deg => {
          const rad = (deg * Math.PI) / 180
          const x1 = originX + Math.cos(rad) * (RADIAL_DEADZONE + 8)
          const y1 = originY + Math.sin(rad) * (RADIAL_DEADZONE + 8)
          const x2 = originX + Math.cos(rad) * WEDGE_RAY_LEN
          const y2 = originY + Math.sin(rad) * WEDGE_RAY_LEN
          return (
            <line
              key={deg}
              className="pen-radial-ray"
              x1={x1}
              y1={y1}
              x2={x2}
              y2={y2}
            />
          )
        })}

        {/* Subtle inner structural circle */}
        <circle
          className="pen-radial-ring-base"
          cx={originX}
          cy={originY}
          r={RING_RADIUS}
        />

        {/* Signature spinning sweep-to-complete bright emerald ring */}
        <g
          className="pen-radial-spin-group"
          style={{
            transformOrigin: `${originX}px ${originY}px`,
          }}
        >
          <circle
            className="pen-radial-ring-sweep"
            cx={originX}
            cy={originY}
            r={RING_RADIUS}
            pathLength={1000}
          />
        </g>

        {/* Crisp bright completion flash right when the circle closes */}
        <circle
          className="pen-radial-ring-flash"
          cx={originX}
          cy={originY}
          r={RING_RADIUS}
        />

        {/* Active directional arc locked to the selected chunk */}
        {activeArcPath && (
          <path className="pen-radial-active-arc" d={activeArcPath} />
        )}

        {/* Crisp directional needle from center hub toward active joystick angle */}
        {pointerAngleRad !== null && activeIdx !== null && (
          <line
            className="pen-radial-needle"
            x1={originX + Math.cos(pointerAngleRad) * 20}
            y1={originY + Math.sin(pointerAngleRad) * 20}
            x2={originX + Math.cos(pointerAngleRad) * (RING_RADIUS - 4)}
            y2={originY + Math.sin(pointerAngleRad) * (RING_RADIUS - 4)}
          />
        )}
      </svg>

      {/* Center Joystick Hub */}
      <div
        className="pen-radial-hub"
        style={{ left: originX, top: originY }}
        onPointerDown={e => {
          e.stopPropagation()
          if (state.latched) onCancel()
        }}
      >
        <span
          className="pen-radial-stick-dot"
          style={{
            transform: `translate(${stickX.toFixed(1)}px, ${stickY.toFixed(1)}px)`,
          }}
        />
        {activeSector ? (
          <span className="pen-radial-hub-label">{activeSector.label}</span>
        ) : (
          <span className="pen-radial-hub-hint">Tilt / Flick</span>
        )}
      </div>

      {/* 6 Directional Radial Nodes */}
      {RADIAL_SECTORS.map((item, idx) => {
        const rad = (item.angleDeg * Math.PI) / 180
        const nx = originX + Math.cos(rad) * NODE_RADIUS
        const ny = originY + Math.sin(rad) * NODE_RADIUS
        const isSelected = activeIdx === idx
        const isCurrentTool = item.id === activeToolId
        return (
          <button
            key={item.id}
            type="button"
            className="pen-radial-node"
            data-selected={isSelected || undefined}
            data-current={isCurrentTool || undefined}
            style={
              {
                left: nx,
                top: ny,
                '--node-delay': `${idx * 22}ms`,
                '--from-x': `${-Math.cos(rad) * 34}px`,
                '--from-y': `${-Math.sin(rad) * 34}px`,
              } as React.CSSProperties
            }
            onPointerDown={e => {
              e.stopPropagation()
              onSelect(item.id)
            }}
          >
            <span className="pen-radial-node-icon">
              <SectorIcon id={item.id} />
            </span>
            <span className="pen-radial-node-label">{item.label}</span>
          </button>
        )
      })}
    </div>
  )
}
