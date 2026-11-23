import { resolveColor } from '../tokens'
import type { PlacedLabel } from '../labelLayout'
import { fmtCoord, type Viewport } from '../math'

export function LabelsLayer({
  labels,
  activeGroup,
  isDragging,
  activeDragBadge,
  emptyMessage,
  vp,
}: {
  labels: PlacedLabel[]
  activeGroup: string | null
  isDragging: boolean
  activeDragBadge: { id: string; label?: string; x: number; y: number; px: number; py: number } | null
  emptyMessage?: string | null
  vp: Viewport
}) {
  return (
    <>
      <g data-layer="function-labels" pointerEvents="none">
        {labels.map(lbl => {
          if (activeDragBadge && lbl.id === `pt-${activeDragBadge.id}`) return null

          let opacity = 1
          const isHighlighted = Boolean(activeGroup && lbl.group === activeGroup)
          if (activeGroup) {
            if (isHighlighted) opacity = 1
            else if (lbl.group) opacity = 0.16
            else opacity = lbl.dim ? 0.28 : 0.78
          } else if (lbl.dim) {
            opacity = isDragging ? 0.25 : 0.45
          }

          return (
            <text
              key={lbl.id}
              x={lbl.x}
              y={lbl.y}
              textAnchor={lbl.anchor}
              dominantBaseline="central"
              fontSize={isHighlighted ? lbl.fontSize + 1 : lbl.fontSize}
              fontWeight={isHighlighted ? 700 : lbl.fontWeight}
              fill={resolveColor(lbl.color, 'ink')}
              opacity={opacity}
              className="bg-label-text bg-anim-opacity"
            >
              {lbl.text}
            </text>
          )
        })}
      </g>

      <g data-layer="polygon-annotations" pointerEvents="none">
        {activeDragBadge &&
          (() => {
            const basePx = activeDragBadge.px
            const basePy = activeDragBadge.py
            const above = basePy > vp.plotY + 42
            const ly = above ? basePy - 30 : basePy + 32
            const clampedLx = Math.max(vp.plotX + 38, Math.min(vp.plotX + vp.plotW - 38, basePx))
            const text = activeDragBadge.label
              ? `${activeDragBadge.label} ${fmtCoord(activeDragBadge.x, activeDragBadge.y)}`
              : fmtCoord(activeDragBadge.x, activeDragBadge.y)

            return (
              <g className="bg-drag-coord-pop">
                <text
                  x={clampedLx}
                  y={ly}
                  textAnchor="middle"
                  dominantBaseline="central"
                  fontSize={13}
                  fontWeight={700}
                  fill="var(--bg-ink)"
                  className="bg-label-text"
                >
                  {text}
                </text>
              </g>
            )
          })()}

        {emptyMessage && !activeDragBadge && (
          <text
            x={vp.width / 2}
            y={vp.plotY + 22}
            textAnchor="middle"
            dominantBaseline="central"
            fontSize={12.5}
            fontWeight={600}
            fill="var(--bg-muted)"
            className="bg-label-text"
          >
            {emptyMessage}
          </text>
        )}
      </g>
    </>
  )
}
