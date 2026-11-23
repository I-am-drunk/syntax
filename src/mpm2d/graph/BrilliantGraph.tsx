import { useEffect, useId, useMemo, useRef, useState } from 'react'
import type { PointerEvent as ReactPointerEvent } from 'react'
import type { GeoScene } from '../types'
import {
  buildViewport,
  clipLineToBounds,
  computeSnapLattice,
  distPointToSegmentPx,
  type DraggablePointSpec,
  type GhostPreview,
  type GraphMode,
} from './math'
import { computeLabelLayout } from './labelLayout'
import { AxesLayer } from './layers/AxesLayer'
import { FunctionLinesAndStrokesLayer, PolygonFillsLayer } from './layers/GeometryLayer'
import { LabelsLayer } from './layers/LabelsLayer'
import { HandlesLayer } from './layers/HandlesLayer'
import { useHandlePhysics } from './useHandlePhysics'

export type GraphSoundCue = 'drag-started' | 'drag-released' | 'grid-snap'

export type BrilliantGraphProps = {
  scene: GeoScene
  mode?: GraphMode
  draggablePoints?: DraggablePointSpec[]
  onDragPoint?: (id: string, x: number, y: number) => void
  onDragStateChange?: (draggingId: string | null) => void
  onSound?: (cue: GraphSoundCue) => void
  snapToGrid?: number | null
  ghost?: GhostPreview | null
  caption?: string
  externalFocusGroup?: string | null
  onFocusGroupChange?: (group: string | null) => void
  mergeNearbyHandles?: boolean
  animateDrawIn?: boolean
  emptyMessage?: string | null
}

export function BrilliantGraph({
  scene,
  mode: explicitMode,
  draggablePoints,
  onDragPoint,
  onDragStateChange,
  onSound,
  snapToGrid = 1,
  ghost,
  caption,
  externalFocusGroup = null,
  onFocusGroupChange,
  mergeNearbyHandles = false,
  animateDrawIn = false,
  emptyMessage = null,
}: BrilliantGraphProps) {
  const mode: GraphMode =
    explicitMode ?? (draggablePoints && draggablePoints.length > 0 ? 'interactive' : 'display')

  const rawUid = useId()
  const uid = rawUid.replace(/[^a-zA-Z0-9_-]/g, '')
  const clipPathId = `bg-clip-${uid}`
  const shadowId = `bg-drag-shadow-${uid}`

  const svgRef = useRef<SVGSVGElement | null>(null)

  const [pressedId, setPressedId] = useState<string | null>(null)
  useEffect(() => {
    if (pressedId && !draggablePoints?.some(d => d.id === pressedId)) {
      dragSessionRef.current = null
      setPressedId(null)
      setDragOffset({ dx: 0, dy: 0 })
    }
  }, [pressedId, draggablePoints])
  const [dragOffset, setDragOffset] = useState<{ dx: number; dy: number }>({ dx: 0, dy: 0 })
  const [hoverGroup, setHoverGroup] = useState<string | null>(null)

  const dragSessionRef = useRef<{
    id: string
    pointerId: number
    grabOffX: number
    grabOffY: number
    lastSnappedX: number
    lastSnappedY: number
  } | null>(null)

  const vp = useMemo(
    () => buildViewport(scene, mode, draggablePoints),
    [scene, mode, draggablePoints],
  )

  const labels = useMemo(
    () => computeLabelLayout(scene, vp, mode, draggablePoints),
    [scene, vp, mode, draggablePoints],
  )

  const hasMultipleGroups = useMemo(() => {
    const groups = new Set<string>()
    scene.lines?.forEach(l => l.group && groups.add(l.group))
    scene.segments?.forEach(s => s.group && groups.add(s.group))
    return groups.size >= 2
  }, [scene.lines, scene.segments])

  const pressedPoint = useMemo(
    () => (pressedId ? draggablePoints?.find(d => d.id === pressedId) ?? null : null),
    [pressedId, draggablePoints],
  )

  const snapDots = useMemo(() => {
    if (mode !== 'interactive' || !pressedPoint) return null
    return computeSnapLattice(vp, pressedPoint, snapToGrid)
  }, [mode, pressedPoint, vp, snapToGrid])

  const visualHandles = useHandlePhysics(
    draggablePoints,
    vp,
    pressedId,
    dragOffset,
    vp.scale < 22,
    mergeNearbyHandles,
  )

  const activeGroup = pressedId ? null : externalFocusGroup ?? hoverGroup

  useEffect(() => {
    onFocusGroupChange?.(activeGroup)
  }, [activeGroup, onFocusGroupChange])

  const clientToSvg = (clientX: number, clientY: number): [number, number] | null => {
    const svg = svgRef.current
    if (!svg) return null
    const rect = svg.getBoundingClientRect()
    if (rect.width < 1 || rect.height < 1) return null
    return [
      ((clientX - rect.left) / rect.width) * vp.width,
      ((clientY - rect.top) / rect.height) * vp.height,
    ]
  }

  const handleHandlePointerDown = (
    e: ReactPointerEvent<SVGGElement>,
    pt: DraggablePointSpec,
  ) => {
    if (mode !== 'interactive') return
    e.stopPropagation()
    e.preventDefault()

    const svgPt = clientToSvg(e.clientX, e.clientY)
    const vis = visualHandles[pt.id]
    const anchorX = vis ? vis.x : vp.toPxX(pt.x)
    const anchorY = vis ? vis.y : vp.toPxY(pt.y)
    const grabOffX = svgPt ? svgPt[0] - anchorX : 0
    const grabOffY = svgPt ? svgPt[1] - anchorY : 0

    try {
      svgRef.current?.setPointerCapture(e.pointerId)
    } catch {
      // Ignore synthetic events without active pointerId
    }

    dragSessionRef.current = {
      id: pt.id,
      pointerId: e.pointerId,
      grabOffX,
      grabOffY,
      lastSnappedX: pt.x,
      lastSnappedY: pt.y,
    }
    setPressedId(pt.id)
    setHoverGroup(null)
    setDragOffset({ dx: 0, dy: 0 })
    onSound?.('drag-started')
    onDragStateChange?.(pt.id)
  }

  const handleSvgPointerMove = (e: ReactPointerEvent<SVGSVGElement>) => {
    const svgPt = clientToSvg(e.clientX, e.clientY)
    if (!svgPt) return
    const [svgX, svgY] = svgPt

    const session = dragSessionRef.current
    if (session && pressedId === session.id) {
      const pt = draggablePoints?.find(d => d.id === session.id)
      if (!pt) return

      const clampedPxX = Math.max(vp.plotX, Math.min(vp.plotX + vp.plotW, svgX - session.grabOffX))
      const clampedPxY = Math.max(vp.plotY, Math.min(vp.plotY + vp.plotH, svgY - session.grabOffY))

      const rawMathX = vp.toMathX(clampedPxX)
      const rawMathY = vp.toMathY(clampedPxY)

      let sx = rawMathX
      let sy = rawMathY
      if (pt.constrain) {
        ;[sx, sy] = pt.constrain(rawMathX, rawMathY)
      } else {
        if (snapToGrid && snapToGrid > 0) {
          sx = Math.round(rawMathX / snapToGrid) * snapToGrid
          sy = Math.round(rawMathY / snapToGrid) * snapToGrid
        }
        sx = Math.max(
          Math.ceil(vp.bounds.xMin * 2) / 2,
          Math.min(Math.floor(vp.bounds.xMax * 2) / 2, sx),
        )
        sy = Math.max(
          Math.ceil(vp.bounds.yMin * 2) / 2,
          Math.min(Math.floor(vp.bounds.yMax * 2) / 2, sy),
        )
      }

      if (
        Math.abs(sx - session.lastSnappedX) > 1e-6 ||
        Math.abs(sy - session.lastSnappedY) > 1e-6
      ) {
        session.lastSnappedX = sx
        session.lastSnappedY = sy
        onDragPoint?.(pt.id, sx, sy)
        onSound?.('grid-snap')
      }

      const snappedPxX = vp.toPxX(sx)
      const snappedPxY = vp.toPxY(sy)
      let resX = (clampedPxX - snappedPxX) * 0.22
      let resY = (clampedPxY - snappedPxY) * 0.22

      if (pt.direction === 'horizontal') {
        resY = 0
      } else if (pt.direction === 'vertical') {
        resX = 0
      } else if (pt.direction === 'line' && pt.lineAngleDeg !== undefined) {
        const rad = (-pt.lineAngleDeg * Math.PI) / 180
        const ux = Math.cos(rad)
        const uy = Math.sin(rad)
        const proj = resX * ux + resY * uy
        resX = proj * ux
        resY = proj * uy
      }

      const resLen = Math.hypot(resX, resY)
      const maxPull = 6
      if (resLen > maxPull) {
        resX = (resX / resLen) * maxPull
        resY = (resY / resLen) * maxPull
      }
      setDragOffset({ dx: resX, dy: resY })
      return
    }

    if (!hasMultipleGroups) {
      if (hoverGroup !== null) setHoverGroup(null)
      return
    }

    if (mode === 'interactive' && draggablePoints) {
      for (const d of draggablePoints) {
        if (Math.hypot(svgX - vp.toPxX(d.x), svgY - vp.toPxY(d.y)) < 26) {
          if (hoverGroup !== null) setHoverGroup(null)
          return
        }
      }
    }

    let bestGroup: string | null = null
    let bestDist = 20
    let currentGroupDist = Infinity

    ;(scene.lines ?? []).forEach(line => {
      if (!line.group) return
      const clip = clipLineToBounds(line, vp.bounds)
      if (!clip) return
      const d = distPointToSegmentPx(
        svgX,
        svgY,
        vp.toPxX(clip[0][0]),
        vp.toPxY(clip[0][1]),
        vp.toPxX(clip[1][0]),
        vp.toPxY(clip[1][1]),
      )
      if (line.group === hoverGroup && d < currentGroupDist) {
        currentGroupDist = d
      }
      if (d < bestDist) {
        bestDist = d
        bestGroup = line.group
      }
    })

    ;(scene.segments ?? []).forEach(seg => {
      if (!seg.group) return
      const d = distPointToSegmentPx(
        svgX,
        svgY,
        vp.toPxX(seg.from[0]),
        vp.toPxY(seg.from[1]),
        vp.toPxX(seg.to[0]),
        vp.toPxY(seg.to[1]),
      )
      if (seg.group === hoverGroup && d < currentGroupDist) {
        currentGroupDist = d
      }
      if (d < bestDist) {
        bestDist = d
        bestGroup = seg.group
      }
    })

    // 5px hysteresis stickiness so moving across intersections never flickers
    if (
      hoverGroup &&
      bestGroup &&
      bestGroup !== hoverGroup &&
      currentGroupDist <= 18 &&
      bestDist > currentGroupDist - 5
    ) {
      bestGroup = hoverGroup
    }

    if (bestGroup !== hoverGroup) {
      setHoverGroup(bestGroup)
    }
  }

  const endDrag = () => {
    const session = dragSessionRef.current
    if (!session) return
    try {
      svgRef.current?.releasePointerCapture(session.pointerId)
    } catch {
      // Ignore if pointer already released
    }
    dragSessionRef.current = null
    setPressedId(null)
    setDragOffset({ dx: 0, dy: 0 })
    onSound?.('drag-released')
    onDragStateChange?.(null)
  }

  const handleSvgPointerLeave = () => {
    if (!dragSessionRef.current && hoverGroup !== null) {
      setHoverGroup(null)
    }
  }

  const pressedVis = pressedPoint ? visualHandles[pressedPoint.id] : undefined
  const activeDragBadge =
    mode === 'interactive' && pressedPoint
      ? {
          id: pressedPoint.id,
          label: pressedPoint.label,
          x: pressedPoint.x,
          y: pressedPoint.y,
          px: pressedVis ? pressedVis.x : vp.toPxX(pressedPoint.x) + dragOffset.dx,
          py: pressedVis ? pressedVis.y : vp.toPxY(pressedPoint.y) + dragOffset.dy,
        }
      : null

  return (
    <div className={`bg-graph-shell is-${mode}`}>
      <svg
        ref={svgRef}
        viewBox={`0 0 ${vp.width} ${vp.height}`}
        className={`bg-graph-svg${pressedId ? ' is-dragging' : ''}`}
        overflow="visible"
        role="img"
        aria-label={caption ?? 'Coordinate plane graph'}
        onPointerMove={handleSvgPointerMove}
        onPointerUp={endDrag}
        onPointerCancel={endDrag}
        onPointerLeave={handleSvgPointerLeave}
      >
        <defs>
          <clipPath id={clipPathId}>
            <rect
              x={vp.plotX}
              y={vp.plotY}
              width={vp.plotW}
              height={vp.plotH}
            />
          </clipPath>

          <radialGradient id={shadowId}>
            <stop offset="0%" stopColor="#000000" stopOpacity="0.2" />
            <stop offset="100%" stopColor="#000000" stopOpacity="0" />
          </radialGradient>
        </defs>

        <PolygonFillsLayer
          scene={scene}
          vp={vp}
          clipPathId={clipPathId}
          activeGroup={activeGroup}
          isDragging={pressedId !== null}
        />

        <AxesLayer
          vp={vp}
          showGrid={scene.showGrid !== false}
          showAxisNumbers={scene.showAxisNumbers !== false}
          snapDots={snapDots}
          activeSnapPt={pressedPoint ? [pressedPoint.x, pressedPoint.y] : null}
        />

        <FunctionLinesAndStrokesLayer
          scene={scene}
          vp={vp}
          clipPathId={clipPathId}
          activeGroup={activeGroup}
          isDragging={pressedId !== null}
          ghost={ghost}
          animateDrawIn={animateDrawIn}
        />

        <LabelsLayer
          labels={labels}
          activeGroup={activeGroup}
          isDragging={pressedId !== null}
          activeDragBadge={activeDragBadge}
          emptyMessage={emptyMessage}
          vp={vp}
        />

        <HandlesLayer
          scene={scene}
          vp={vp}
          mode={mode}
          draggables={draggablePoints}
          visualHandles={visualHandles}
          pressedId={pressedId}
          shadowId={shadowId}
          activeGroup={activeGroup}
          isDragging={pressedId !== null}
          mergeNearbyHandles={mergeNearbyHandles}
          ghost={ghost}
          onHandlePointerDown={handleHandlePointerDown}
        />
      </svg>

      {caption && <div className="bg-graph-caption">{caption}</div>}
    </div>
  )
}
