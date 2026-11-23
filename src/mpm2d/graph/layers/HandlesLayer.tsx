import type { KeyboardEvent as ReactKeyboardEvent, PointerEvent as ReactPointerEvent } from 'react'
import type { GeoScene } from '../../types'
import type { DraggablePointSpec, GhostPreview, Viewport } from '../math'

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
import { computeNucleusUnion, computeOuterMembraneUnion } from '../telophase'
import { CHEVRON_LEFT, CHEVRON_RIGHT, HANDLE_METRICS, resolveColor } from '../tokens'
import type { VisualHandleState } from '../useHandlePhysics'

function isDirectionalHandle(pt: DraggablePointSpec): boolean {
  return (
    pt.direction === 'horizontal' ||
    pt.direction === 'vertical' ||
    pt.direction === 'line'
  )
}

/**
 * Layer 4 & 5: Static points, ghost preview points, and Brilliant interactive drag handles
 * with organic Grade-10-biology telophase / nucleus merge & separation geometry.
 */
export function HandlesLayer({
  scene,
  vp,
  mode,
  draggables,
  visualHandles,
  pressedId,
  shadowId,
  activeGroup,
  isDragging,
  mergeNearbyHandles,
  ghost,
  onHandlePointerDown,
  onHandleKeyDown,
}: {
  scene: GeoScene
  vp: Viewport
  mode: 'interactive' | 'display'
  draggables?: DraggablePointSpec[]
  visualHandles: Record<string, VisualHandleState>
  pressedId: string | null
  shadowId: string
  activeGroup: string | null
  isDragging: boolean
  mergeNearbyHandles: boolean
  ghost?: GhostPreview | null
  onHandlePointerDown: (e: ReactPointerEvent<SVGGElement>, pt: DraggablePointSpec) => void
  onHandleKeyDown?: (e: ReactKeyboardEvent<SVGGElement>, pt: DraggablePointSpec) => void
}) {
  const m = vp.scale < 22 ? HANDLE_METRICS.compact : HANDLE_METRICS.regular
  const draggableIds = new Set((draggables ?? []).map(d => d.id))
  const list = draggables ?? []

  // Resolve visual state for every draggable handle
  const resolved = list.map(pt => {
    const isDir = isDirectionalHandle(pt)
    const vis = visualHandles[pt.id]
    const x = vis ? vis.x : vp.toPxX(pt.x)
    const y = vis ? vis.y : vp.toPxY(pt.y)
    const dotR = vis ? vis.dotR : isDir ? 4 : m.dotRadius
    const col = resolveColor(pt.color, 'blue')
    return { pt, isDir, x, y, dotR, col }
  })

  // Compute outer membrane & inner nucleus telophase unions for free 2D handles
  const freeItems = resolved.filter(item => !item.isDir)
  const outerUnions: Array<{
    i: number
    j: number
    path: string
    mergeT: number
    midX: number
    midY: number
  }> = []
  const outerMergedIds = new Set<string>()
  const shadowAttenuation = new Map<string, number>()

  for (let i = 0; i < freeItems.length; i++) {
    for (let j = i + 1; j < freeItems.length; j++) {
      if (!mergeNearbyHandles) continue
      const a = freeItems[i]
      const b = freeItems[j]
      const union = computeOuterMembraneUnion(a.x, a.y, b.x, b.y, m.discRadius)
      if (union) {
        outerUnions.push({ i, j, ...union })
        outerMergedIds.add(a.pt.id)
        outerMergedIds.add(b.pt.id)
        shadowAttenuation.set(
          a.pt.id,
          Math.max(shadowAttenuation.get(a.pt.id) ?? 0, union.mergeT),
        )
        shadowAttenuation.set(
          b.pt.id,
          Math.max(shadowAttenuation.get(b.pt.id) ?? 0, union.mergeT),
        )
      }
    }
  }

  // Inner nucleus unions (same-color nuclei smoothly fuse & bud inside the membrane)
  const nucleusUnions: Array<{
    idA: string
    idB: string
    path: string
    col: string
    mergeT: number
    midX: number
    midY: number
    coincidentResting: boolean
  }> = []
  const nucleusMergedIds = new Set<string>()

  for (let i = 0; i < freeItems.length; i++) {
    for (let j = i + 1; j < freeItems.length; j++) {
      if (!mergeNearbyHandles) continue
      const a = freeItems[i]
      const b = freeItems[j]
      if (a.col !== b.col) continue
      const union = computeNucleusUnion(a.x, a.y, a.dotR, b.x, b.y, b.dotR)
      if (union) {
        const d = Math.hypot(a.x - b.x, a.y - b.y)
        const eitherPressed = pressedId === a.pt.id || pressedId === b.pt.id
        nucleusUnions.push({
          idA: a.pt.id,
          idB: b.pt.id,
          path: union.path,
          col: a.col,
          mergeT: union.mergeT,
          midX: union.midX,
          midY: union.midY,
          coincidentResting: !eitherPressed && d < 1.8,
        })
        nucleusMergedIds.add(a.pt.id)
        nucleusMergedIds.add(b.pt.id)
      }
    }
  }

  // Draw pressed handle last so its hit target and nucleus sit cleanly on top
  const orderedResolved = [...resolved].sort((a, b) => {
    if (a.pt.id === pressedId) return 1
    if (b.pt.id === pressedId) return -1
    return 0
  })

  return (
    <>
      {/* Static Points Layer */}
      <g data-layer="static-points" pointerEvents="none">
        {(scene.points ?? []).map(pt => {
          if (draggableIds.has(pt.id)) return null
          const x = vp.toPxX(pt.x)
          const y = vp.toPxY(pt.y)
          const col = resolveColor(pt.dim ? 'muted' : pt.color, 'blue')
          const opacity = computeGroupOpacity(pt.dim, pt.group, activeGroup, isDragging)
          const r = pt.emphasis ? 5.2 : pt.dim ? 3.5 : 4.4

          return (
            <g key={`pt-${pt.id}`} opacity={opacity} className="bg-anim-opacity">
              {pt.emphasis && !pt.dim && (
                <circle cx={x} cy={y} r={r + 4.5} fill={col} opacity={0.14} />
              )}
              <circle
                cx={x}
                cy={y}
                r={r}
                fill={col}
                stroke="var(--bg-surface)"
                strokeWidth={1.75}
              />
            </g>
          )
        })}

        {/* Ghost preview points */}
        {ghost && ghost.kind === 'point' && (
          <g>
            <circle
              cx={vp.toPxX(ghost.x)}
              cy={vp.toPxY(ghost.y)}
              r={10}
              className="bg-ghost-aura"
            />
            <circle
              cx={vp.toPxX(ghost.x)}
              cy={vp.toPxY(ghost.y)}
              r={4.8}
              className="bg-ghost-dot"
            />
          </g>
        )}

      </g>

      {/* Interactive Brilliant Handles Layer */}
      {mode === 'interactive' && resolved.length > 0 && (
        <g data-layer="handles">
          {/* 1. Soft radial shadows (blended smoothly so merged cells never double-darken) */}
          <g pointerEvents="none">
            {resolved.map(item => {
              const atten = shadowAttenuation.get(item.pt.id) ?? 0
              const op = 1 - 0.55 * atten
              return (
                <circle
                  key={`sh-${item.pt.id}`}
                  cx={item.x}
                  cy={item.y + 0.75}
                  r={m.shadowRadius}
                  fill={`url(#${shadowId})`}
                  opacity={op}
                />
              )
            })}
            {outerUnions.map((u, idx) => (
              <circle
                key={`sh-u-${idx}`}
                cx={u.midX}
                cy={u.midY + 0.75}
                r={m.shadowRadius * (1 + 0.06 * u.mergeT)}
                fill={`url(#${shadowId})`}
                opacity={0.9 * u.mergeT}
              />
            ))}
          </g>

          {/* 2. Unified Outer Cell Membrane (single opacity=0.9 group -> zero overlap seam!) */}
          <g className="bg-drag-disc-group" pointerEvents="none">
            {outerUnions.map((u, idx) => (
              <path key={`mem-u-${idx}`} d={u.path} className="bg-drag-disc-shape" />
            ))}
          </g>
          <g pointerEvents="none">
            {freeItems.map(item => {
              if (outerMergedIds.has(item.pt.id)) return null
              return (
                <circle
                  key={`mem-${item.pt.id}`}
                  cx={item.x}
                  cy={item.y}
                  r={m.discRadius}
                  className="bg-drag-disc"
                />
              )
            })}
          </g>
          <g className="bg-drag-disc-group" pointerEvents="none">
            {resolved
              .filter(item => item.isDir)
              .map(item => {
                const pillRotateDeg =
                  item.pt.direction === 'vertical'
                    ? 90
                    : item.pt.direction === 'line'
                      ? -(item.pt.lineAngleDeg ?? 0)
                      : 0
                return (
                  <g
                    key={`pill-${item.pt.id}`}
                    transform={`translate(${item.x} ${item.y}) rotate(${pillRotateDeg})`}
                  >
                    <rect
                      x={-m.pillWidth / 2}
                      y={-m.pillHeight / 2}
                      width={m.pillWidth}
                      height={m.pillHeight}
                      rx={m.pillRx}
                      className="bg-drag-disc-shape"
                    />
                  </g>
                )
              })}
          </g>

          {/* Directional chevrons above membrane */}
          <g pointerEvents="none">
            {resolved
              .filter(item => item.isDir)
              .map(item => {
                const pillRotateDeg =
                  item.pt.direction === 'vertical'
                    ? 90
                    : item.pt.direction === 'line'
                      ? -(item.pt.lineAngleDeg ?? 0)
                      : 0
                return (
                  <g
                    key={`chev-${item.pt.id}`}
                    transform={`translate(${item.x} ${item.y}) rotate(${pillRotateDeg})`}
                  >
                    <path
                      d={CHEVRON_LEFT}
                      fill="none"
                      stroke={item.col}
                      strokeWidth={2}
                      strokeLinecap="round"
                      strokeLinejoin="round"
                    />
                    <path
                      d={CHEVRON_RIGHT}
                      fill="none"
                      stroke={item.col}
                      strokeWidth={2}
                      strokeLinecap="round"
                      strokeLinejoin="round"
                    />
                  </g>
                )
              })}
          </g>

          {/* 3. Inner Blue Nuclei (true telophase fusion & division inside the membrane!) */}
          <g pointerEvents="none">
            {nucleusUnions.map((nu, idx) => (
              <g key={`nuc-u-${idx}`}>
                {nu.coincidentResting ? (
                  <>
                    <circle cx={nu.midX - 4.4} cy={nu.midY} r={4} fill={nu.col} />
                    <circle cx={nu.midX + 4.4} cy={nu.midY} r={4} fill={nu.col} />
                  </>
                ) : (
                  <path d={nu.path} fill={nu.col} />
                )}
              </g>
            ))}
            {orderedResolved.map(item => {
              if (!item.isDir && nucleusMergedIds.has(item.pt.id)) return null
              return (
                <circle
                  key={`nuc-${item.pt.id}`}
                  cx={item.x}
                  cy={item.y}
                  r={item.dotR}
                  fill={item.col}
                />
              )
            })}
          </g>

          {/* 4. Interactive Hit Targets (pressed handle last so it stays on top) */}
          {orderedResolved.map(item => {
            const isPressed = pressedId === item.pt.id
            const isOtherDragging = pressedId !== null && !isPressed
            return (
              <g
                key={`drag-${item.pt.id}`}
                data-scene-graph-name={`point-${item.pt.id}`}
                data-point-x={item.pt.x}
                data-point-y={item.pt.y}
                className="bg-drag-handle"
                role="slider"
                tabIndex={0}
                aria-label={`Point ${item.pt.label ?? item.pt.id} at (${item.pt.x}, ${item.pt.y}). Use arrow keys to move.`}
                aria-valuetext={`(${item.pt.x}, ${item.pt.y})`}
                style={{
                  cursor: isPressed ? 'grabbing' : isOtherDragging ? 'default' : 'grab',
                }}
                onPointerDown={e => onHandlePointerDown(e, item.pt)}
                onKeyDown={e => onHandleKeyDown?.(e, item.pt)}
              >
                <circle cx={item.x} cy={item.y} r={m.hitRadius} fill="transparent" />
              </g>
            )
          })}
        </g>
      )}
    </>
  )
}
