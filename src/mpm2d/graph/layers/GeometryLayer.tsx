import type { GeoScene } from '../../types'
import { resolveColor, STROKE } from '../tokens'
import { clipLineToBounds, type GhostPreview, type Viewport } from '../math'

function computeGroupOpacity(
  dim: boolean | undefined,
  group: string | undefined,
  activeGroup: string | null,
  isDragging: boolean,
): number {
  if (activeGroup) {
    if (group === activeGroup) return 1
    if (group) return 0.18
    return dim ? 0.24 : 0.72
  }
  if (dim) return isDragging ? 0.24 : 0.34
  return 1
}

export function PolygonFillsLayer({
  scene,
  vp,
  clipPathId,
  activeGroup,
  isDragging,
}: {
  scene: GeoScene
  vp: Viewport
  clipPathId: string
  activeGroup: string | null
  isDragging: boolean
}) {
  return (
    <>
      <g data-layer="function-regions" pointerEvents="none" clipPath={`url(#${clipPathId})`}>
        {(scene.riseRuns ?? []).map((rr, idx) => {
          const x1 = vp.toPxX(rr.from[0])
          const y1 = vp.toPxY(rr.from[1])
          const x2 = vp.toPxX(rr.to[0])
          const y2 = vp.toPxY(rr.to[1])
          if (Math.abs(x2 - x1) < 2 || Math.abs(y2 - y1) < 2) return null
          const col = resolveColor(rr.color, 'teal')
          const opacity = computeGroupOpacity(rr.dim, rr.group, activeGroup, isDragging)
          return (
            <polygon
              key={`rr-fill-${idx}`}
              points={`${x1},${y1} ${x2},${y1} ${x2},${y2}`}
              fill={col}
              fillOpacity={0.08 * opacity}
              className="bg-anim-opacity"
            />
          )
        })}
      </g>

      <g data-layer="polygon-fills" pointerEvents="none" clipPath={`url(#${clipPathId})`}>
        {(scene.polygons ?? []).map((poly, idx) => {
          const pts = poly.vertices.map(([x, y]) => `${vp.toPxX(x)},${vp.toPxY(y)}`).join(' ')
          const col = resolveColor(poly.dim ? 'muted' : poly.color, 'blue')
          const baseFill =
            poly.fillOpacity ??
            (poly.dim ? STROKE.polygonDimFillOpacity : STROKE.polygonFillOpacity)
          const opacity = computeGroupOpacity(poly.dim, poly.group, activeGroup, isDragging)
          return (
            <polygon
              key={`poly-fill-${idx}`}
              points={pts}
              fill={col}
              fillOpacity={baseFill * opacity}
              strokeLinejoin="round"
              strokeLinecap="round"
              className="bg-anim-opacity"
            />
          )
        })}
      </g>
    </>
  )
}

export function FunctionLinesAndStrokesLayer({
  scene,
  vp,
  clipPathId,
  activeGroup,
  isDragging,
  ghost,
  animateDrawIn,
}: {
  scene: GeoScene
  vp: Viewport
  clipPathId: string
  activeGroup: string | null
  isDragging: boolean
  ghost?: GhostPreview | null
  animateDrawIn?: boolean
}) {
  return (
    <>
      <g data-layer="function-lines" pointerEvents="none" clipPath={`url(#${clipPathId})`}>
        {(scene.circles ?? []).map((c, idx) => {
          const col = resolveColor(c.dim ? 'muted' : c.color, 'blue')
          const opacity = computeGroupOpacity(c.dim, c.group, activeGroup, isDragging)
          const isFocused = Boolean(activeGroup && c.group === activeGroup)
          return (
            <circle
              key={`circ-${idx}`}
              cx={vp.toPxX(c.cx)}
              cy={vp.toPxY(c.cy)}
              r={c.r * vp.scale}
              fill={col}
              fillOpacity={c.dim ? 0.03 : 0.06}
              stroke={col}
              strokeWidth={
                isFocused ? STROKE.lineHighlight : c.dim ? STROKE.lineDim : STROKE.lineDefault
              }
              strokeDasharray={c.dashed ? STROKE.dashArray : undefined}
              opacity={opacity}
              className="bg-anim-stroke"
            />
          )
        })}

        {(scene.riseRuns ?? []).map((rr, idx) => {
          const x1 = vp.toPxX(rr.from[0])
          const y1 = vp.toPxY(rr.from[1])
          const x2 = vp.toPxX(rr.to[0])
          const y2 = vp.toPxY(rr.to[1])
          const col = resolveColor(rr.dim ? 'muted' : rr.color, 'teal')
          const opacity = computeGroupOpacity(rr.dim, rr.group, activeGroup, isDragging)
          return (
            <g key={`rr-${idx}`} opacity={opacity} className="bg-anim-opacity">
              <line
                x1={x1}
                y1={y1}
                x2={x2}
                y2={y1}
                stroke={col}
                strokeWidth={1.65}
                strokeDasharray={STROKE.dotArray}
                strokeLinecap="round"
              />
              <line
                x1={x2}
                y1={y1}
                x2={x2}
                y2={y2}
                stroke={col}
                strokeWidth={1.65}
                strokeDasharray={STROKE.dotArray}
                strokeLinecap="round"
              />
            </g>
          )
        })}

        {(scene.lines ?? []).map((line, idx) => {
          const clipped = clipLineToBounds(line, vp.bounds)
          if (!clipped) return null
          const x1 = vp.toPxX(clipped[0][0])
          const y1 = vp.toPxY(clipped[0][1])
          const x2 = vp.toPxX(clipped[1][0])
          const y2 = vp.toPxY(clipped[1][1])
          const len = Math.hypot(x2 - x1, y2 - y1)
          const col = resolveColor(line.dim ? 'muted' : line.color, 'blue')
          const opacity = computeGroupOpacity(line.dim, line.group, activeGroup, isDragging)
          const isFocused = Boolean(activeGroup && line.group === activeGroup)
          const baseW = line.width
            ? Math.min(2.6, line.width)
            : line.dim
              ? STROKE.lineDim
              : STROKE.lineDefault
          const sw = isFocused ? Math.max(baseW + 0.75, STROKE.lineHighlight) : baseW
          const shouldAnimate = animateDrawIn && !line.dim && !line.dashed

          return (
            <line
              key={`line-${idx}`}
              x1={x1}
              y1={y1}
              x2={x2}
              y2={y2}
              stroke={col}
              strokeWidth={sw}
              strokeDasharray={
                line.dashed ? STROKE.dashArray : shouldAnimate ? `${len}` : undefined
              }
              strokeDashoffset={shouldAnimate ? len : undefined}
              strokeLinecap="round"
              opacity={opacity}
              className={shouldAnimate ? 'bg-anim-stroke bg-line-draw' : 'bg-anim-stroke'}
            />
          )
        })}

        {(scene.segments ?? []).map((seg, idx) => {
          const x1 = vp.toPxX(seg.from[0])
          const y1 = vp.toPxY(seg.from[1])
          const x2 = vp.toPxX(seg.to[0])
          const y2 = vp.toPxY(seg.to[1])
          const col = resolveColor(seg.dim ? 'muted' : seg.color, 'blue')
          const opacity = computeGroupOpacity(seg.dim, seg.group, activeGroup, isDragging)
          const isFocused = Boolean(activeGroup && seg.group === activeGroup)
          const baseW = seg.width
            ? Math.min(2.6, seg.width)
            : seg.dim
              ? STROKE.lineDim
              : STROKE.lineDefault
          const sw = isFocused ? Math.max(baseW + 0.75, STROKE.lineHighlight) : baseW

          const mx = (x1 + x2) / 2
          const my = (y1 + y2) / 2
          const dx = x2 - x1
          const dy = y2 - y1
          const len = Math.hypot(dx, dy) || 1
          const ux = dx / len
          const uy = dy / len
          const nx = -uy
          const ny = ux
          const tickOffsets = seg.ticks === 2 ? [-3.2, 3.2] : seg.ticks === 1 ? [0] : []

          return (
            <g key={`seg-${idx}`} opacity={opacity} className="bg-anim-opacity">
              <line
                x1={x1}
                y1={y1}
                x2={x2}
                y2={y2}
                stroke={col}
                strokeWidth={sw}
                strokeDasharray={seg.dashed ? STROKE.dashArray : undefined}
                strokeLinecap="round"
                className="bg-anim-stroke"
              />
              {tickOffsets.map((off, ti) => {
                const tx = mx + ux * off
                const ty = my + uy * off
                return (
                  <line
                    key={ti}
                    x1={tx - nx * 4.8}
                    y1={ty - ny * 4.8}
                    x2={tx + nx * 4.8}
                    y2={ty + ny * 4.8}
                    stroke={col}
                    strokeWidth={1.7}
                    strokeLinecap="round"
                  />
                )
              })}
            </g>
          )
        })}

        {(scene.rightAngles ?? []).map((ra, idx) => {
          const vx = vp.toPxX(ra.vertex[0])
          const vy = vp.toPxY(ra.vertex[1])
          const d1x = ra.dir1[0]
          const d1y = -ra.dir1[1]
          const d2x = ra.dir2[0]
          const d2y = -ra.dir2[1]
          const l1 = Math.hypot(d1x, d1y)
          const l2 = Math.hypot(d2x, d2y)
          if (l1 < 1e-6 || l2 < 1e-6) return null
          const sz = 10.5
          const u1x = (d1x / l1) * sz
          const u1y = (d1y / l1) * sz
          const u2x = (d2x / l2) * sz
          const u2y = (d2y / l2) * sz
          const col = resolveColor(ra.dim ? 'muted' : ra.color, 'teal')
          const opacity = computeGroupOpacity(ra.dim, ra.group, activeGroup, isDragging)

          const d = `M ${vx + u1x} ${vy + u1y} L ${vx + u1x + u2x} ${vy + u1y + u2y} L ${vx + u2x} ${vy + u2y}`
          return (
            <path
              key={`ra-${idx}`}
              d={d}
              fill="none"
              stroke={col}
              strokeWidth={1.65}
              strokeLinecap="round"
              strokeLinejoin="round"
              opacity={opacity}
              className="bg-anim-opacity"
            />
          )
        })}

        {ghost &&
          ghost.kind === 'line' &&
          (() => {
            const clipped = clipLineToBounds(ghost, vp.bounds)
            if (!clipped) return null
            return (
              <line
                x1={vp.toPxX(clipped[0][0])}
                y1={vp.toPxY(clipped[0][1])}
                x2={vp.toPxX(clipped[1][0])}
                y2={vp.toPxY(clipped[1][1])}
                className="bg-ghost-line"
              />
            )
          })()}

        {ghost && ghost.kind === 'circle' && (
          <circle
            cx={vp.toPxX(ghost.cx ?? 0)}
            cy={vp.toPxY(ghost.cy ?? 0)}
            r={ghost.r * vp.scale}
            className="bg-ghost-line"
            fill="none"
          />
        )}
      </g>

      <g data-layer="polygon-strokes" pointerEvents="none" clipPath={`url(#${clipPathId})`}>
        {(scene.polygons ?? []).map((poly, idx) => {
          const pts = poly.vertices.map(([x, y]) => `${vp.toPxX(x)},${vp.toPxY(y)}`).join(' ')
          const col = resolveColor(poly.dim ? 'muted' : poly.color, 'blue')
          const opacity = computeGroupOpacity(poly.dim, poly.group, activeGroup, isDragging)
          return (
            <polygon
              key={`poly-stroke-${idx}`}
              points={pts}
              fill="none"
              stroke={col}
              strokeWidth={poly.dim ? STROKE.lineDim : STROKE.lineDefault}
              strokeLinejoin="round"
              strokeLinecap="round"
              opacity={opacity}
              className="bg-anim-opacity"
            />
          )
        })}
      </g>
    </>
  )
}
