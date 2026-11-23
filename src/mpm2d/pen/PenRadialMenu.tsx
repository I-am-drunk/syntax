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

export const RADIAL_DEADZONE = 16
const RING_RADIUS = 44
const NODE_RADIUS = 68

export function angleToSectorIndex(angleRad: number): number {
  const deg = (angleRad * 180) / Math.PI
  const shifted = (((deg + 120) % 360) + 360) % 360
  return Math.floor(shifted / 60) % 6
}

function SectorIcon({ id }: { id: RadialActionId }) {
  switch (id) {
    case 'draw':
      return (
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.1" strokeLinecap="round" strokeLinejoin="round">
          <path d="M17 3a2.85 2.83 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5Z" />
          <path d="m15 5 4 4" />
        </svg>
      )
    case 'highlight':
      return (
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.1" strokeLinecap="round" strokeLinejoin="round">
          <path d="m9 11-6 6v3h9l3-3" />
          <path d="m22 12-4.6 4.6a2 2 0 0 1-2.8 0l-5.2-5.2a2 2 0 0 1 0-2.8L14 4" />
        </svg>
      )
    case 'line':
      return (
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round">
          <line x1="5" y1="19" x2="19" y2="5" />
          <circle cx="5" cy="19" r="1.8" fill="currentColor" stroke="none" />
          <circle cx="19" cy="5" r="1.8" fill="currentColor" stroke="none" />
        </svg>
      )
    case 'eraser':
      return (
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.1" strokeLinecap="round" strokeLinejoin="round">
          <path d="m7 21-4.3-4.3c-1-1-1-2.5 0-3.4l9.6-9.6c1-1 2.5-1 3.4 0l5.6 5.6c1 1 1 2.5 0 3.4L13 21" />
          <path d="M22 21H7" />
          <path d="m5 11 9 9" />
        </svg>
      )
    case 'hand':
      return (
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.1" strokeLinecap="round" strokeLinejoin="round">
          <path d="M18 11V6a2 2 0 0 0-4 0v4" />
          <path d="M14 10V4a2 2 0 0 0-4 0v6" />
          <path d="M10 10.5V6a2 2 0 0 0-4 0v8" />
          <path d="M18 8a2 2 0 1 1 4 0v6a8 8 0 0 1-8 8h-2c-2.8 0-4.5-.86-5.99-2.34l-3.6-3.6a2 2 0 0 1 2.83-2.82L7 15" />
        </svg>
      )
    case 'undo':
      return (
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.1" strokeLinecap="round" strokeLinejoin="round">
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
  cursorX: number
  cursorY: number
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

  const { originX, originY, cursorX, cursorY, activeIdx, stickX, stickY } = state
  const activeSector = activeIdx !== null ? RADIAL_SECTORS[activeIdx] : null

  // Compact active arc on the small ring tightly around the cursor (zero full-screen rays or wedges!)
  let activeArcPath = ''
  if (activeSector) {
    const startRad = ((activeSector.angleDeg - 26) * Math.PI) / 180
    const endRad = ((activeSector.angleDeg + 26) * Math.PI) / 180
    const ax1 = originX + Math.cos(startRad) * RING_RADIUS
    const ay1 = originY + Math.sin(startRad) * RING_RADIUS
    const ax2 = originX + Math.cos(endRad) * RING_RADIUS
    const ay2 = originY + Math.sin(endRad) * RING_RADIUS
    activeArcPath = `M ${ax1.toFixed(1)} ${ay1.toFixed(1)} A ${RING_RADIUS} ${RING_RADIUS} 0 0 1 ${ax2.toFixed(1)} ${ay2.toFixed(1)}`
  }

  // Clamp nucleus slip cleanly inside the BrilliantGraph-style outer membrane (r = 18)
  const slipMag = Math.hypot(stickX, stickY)
  const slipFactor = slipMag > 8 ? 8 / slipMag : 1
  const nucX = originX + stickX * slipFactor
  const nucY = originY + stickY * slipFactor

  return (
    <div
      className="pen-radial-backdrop"
      data-theme={theme}
      data-latched={state.latched || undefined}
      data-has-selection={activeIdx !== null || undefined}
      onContextMenu={e => e.preventDefault()}
      onPointerDown={e => {
        if (state.latched && e.button === 0 && e.target === e.currentTarget) {
          e.preventDefault()
          e.stopPropagation()
          onCancel()
        }
      }}
    >
      {/* Compact Procreate-inspired ring + BrilliantGraph nucleus-in-membrane hub */}
      <svg className="pen-radial-svg" aria-hidden="true">
        <circle
          className="pen-radial-ring-base"
          cx={originX}
          cy={originY}
          r={RING_RADIUS}
        />

        {activeArcPath && (
          <path className="pen-radial-active-arc" d={activeArcPath} />
        )}

        {/* Reused BrilliantGraph outer translucent membrane + inner slipping nucleus */}
        <g
          className="pen-radial-nucleus-hub"
          style={{ pointerEvents: 'auto', cursor: 'pointer' }}
          onPointerDown={e => {
            e.stopPropagation()
            if (state.latched) onCancel()
          }}
        >
          <circle
            cx={originX}
            cy={originY}
            r={19}
            className="bg-drag-disc pen-radial-membrane"
          />
          <circle
            cx={nucX}
            cy={nucY}
            r={activeSector ? 7.2 : 5.8}
            fill={activeSector ? '#29cc57' : '#456dff'}
            className="pen-radial-nucleus-core"
          />
        </g>

        {/* Always-visible vivid colored cursor indicator so you never lose your pointer */}
        <g className="pen-radial-cursor-dot">
          <circle
            cx={cursorX}
            cy={cursorY}
            r={6.5}
            fill={activeSector ? '#29cc57' : '#456dff'}
            fillOpacity={0.22}
          />
          <circle
            cx={cursorX}
            cy={cursorY}
            r={3.5}
            fill={activeSector ? '#29cc57' : '#456dff'}
            stroke="#ffffff"
            strokeWidth={1.4}
          />
        </g>
      </svg>

      {/* 6 Compact Procreate-style Radial Tool Pills around the cursor */}
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
                '--node-delay': `${idx * 14}ms`,
                '--from-x': `${-Math.cos(rad) * 18}px`,
                '--from-y': `${-Math.sin(rad) * 18}px`,
              } as React.CSSProperties
            }
            onPointerDown={e => {
              if (e.button !== 0) return
              e.preventDefault()
              e.stopPropagation()
              onSelect(item.id)
            }}
            onClick={e => {
              if (e.detail === 0) {
                e.stopPropagation()
                onSelect(item.id)
              }
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
