import type { GeoColor, GeoScene } from '../types'
import {
  clipLineToBounds,
  distPointToSegmentPx,
  fmtCoord,
  fmtNum,
  type DraggablePointSpec,
  type GraphMode,
  type Viewport,
} from './math'

export type PlacedLabel = {
  id: string
  x: number
  y: number
  text: string
  color: GeoColor
  dim?: boolean
  group?: string
  kind: 'point' | 'line' | 'segment' | 'riserun' | 'circle'
  fontSize: number
  fontWeight: number
  anchor: 'start' | 'middle' | 'end'
  /** Optional secondary emphasis (e.g. merged convergence label) */
  merged?: boolean
  /** Tier 1 high-presence frosted acrylic pill (rise/run, m = undefined, merged, etc.) */
  prominent?: boolean
}

type Box = { x1: number; y1: number; x2: number; y2: number }

function estimateLabelBox(
  x: number,
  y: number,
  text: string,
  fontSize: number,
  anchor: 'start' | 'middle' | 'end',
): Box {
  const charW = fontSize * 0.59
  const w = Math.max(16, text.length * charW + 6)
  const h = fontSize + 4
  const x1 = anchor === 'middle' ? x - w / 2 : anchor === 'end' ? x - w : x
  return { x1, y1: y - h / 2, x2: x1 + w, y2: y + h / 2 }
}

function boxesOverlapArea(a: Box, b: Box, pad = 3): number {
  const ox = Math.min(a.x2 + pad, b.x2 + pad) - Math.max(a.x1 - pad, b.x1 - pad)
  const oy = Math.min(a.y2 + pad, b.y2 + pad) - Math.max(a.y1 - pad, b.y1 - pad)
  return ox > 0 && oy > 0 ? ox * oy : 0
}

function boxInsidePenalty(b: Box, vp: Viewport): number {
  const minX = vp.plotX - 8
  const maxX = vp.plotX + vp.plotW + 8
  const minY = vp.plotY - 8
  const maxY = vp.plotY + vp.plotH + 6
  let p = 0
  if (b.x1 < minX) p += (minX - b.x1) * 18
  if (b.x2 > maxX) p += (b.x2 - maxX) * 18
  if (b.y1 < minY) p += (minY - b.y1) * 18
  if (b.y2 > maxY) p += (b.y2 - maxY) * 18
  return p
}

function distToLineInfPx(
  px: number,
  py: number,
  x1: number,
  y1: number,
  x2: number,
  y2: number,
): number {
  const dx = x2 - x1
  const dy = y2 - y1
  const len = Math.hypot(dx, dy)
  if (len < 1e-6) return Math.hypot(px - x1, py - y1)
  return Math.abs((px - x1) * dy - (py - y1) * dx) / len
}

export function computeLabelLayout(
  scene: GeoScene,
  vp: Viewport,
  mode: GraphMode,
  draggables?: DraggablePointSpec[],
): PlacedLabel[] {
  const placed: PlacedLabel[] = []
  const placedBoxes: Box[] = []

  // Obstacle points (static points + draggable handles with larger exclusion radius)
  const obstacles: { x: number; y: number; r: number }[] = []
  const dragMap = new Set((draggables ?? []).map(d => d.id))

  ;(draggables ?? []).forEach(d => {
    obstacles.push({
      x: vp.toPxX(d.x),
      y: vp.toPxY(d.y),
      r: mode === 'interactive' ? 24 : 9,
    })
  })
  ;(scene.points ?? []).forEach(p => {
    if (dragMap.has(p.id)) return
    obstacles.push({
      x: vp.toPxX(p.x),
      y: vp.toPxY(p.y),
      r: p.emphasis ? 10 : 7,
    })
  })

  // Obstacle line segments in pixel coords (infinite lines clipped + segments + polygon edges)
  type SegPx = { x1: number; y1: number; x2: number; y2: number; idx?: number }
  const segsPx: SegPx[] = []

  const clippedLines: {
    idx: number
    x1: number
    y1: number
    x2: number
    y2: number
    label?: string
    color: GeoColor
    dim?: boolean
    group?: string
  }[] = []

  ;(scene.lines ?? []).forEach((line, idx) => {
    const clip = clipLineToBounds(line, vp.bounds)
    if (!clip) return
    const x1 = vp.toPxX(clip[0][0])
    const y1 = vp.toPxY(clip[0][1])
    const x2 = vp.toPxX(clip[1][0])
    const y2 = vp.toPxY(clip[1][1])
    clippedLines.push({
      idx,
      x1,
      y1,
      x2,
      y2,
      label: line.label,
      color: line.color ?? 'blue',
      dim: line.dim,
      group: line.group,
    })
    segsPx.push({ x1, y1, x2, y2, idx })
  })

  ;(scene.segments ?? []).forEach(s => {
    segsPx.push({
      x1: vp.toPxX(s.from[0]),
      y1: vp.toPxY(s.from[1]),
      x2: vp.toPxX(s.to[0]),
      y2: vp.toPxY(s.to[1]),
    })
  })

  ;(scene.polygons ?? []).forEach(poly => {
    const verts = poly.vertices
    for (let i = 0; i < verts.length; i++) {
      const a = verts[i]
      const b = verts[(i + 1) % verts.length]
      segsPx.push({
        x1: vp.toPxX(a[0]),
        y1: vp.toPxY(a[1]),
        x2: vp.toPxX(b[0]),
        y2: vp.toPxY(b[1]),
      })
    }
  })

  const axisX = vp.bounds.xMin <= 0 && vp.bounds.xMax >= 0 ? vp.toPxX(0) : null
  const axisY = vp.bounds.yMin <= 0 && vp.bounds.yMax >= 0 ? vp.toPxY(0) : null

  const scoreBox = (
    cx: number,
    cy: number,
    box: Box,
    ignoreSegIdx?: number,
    ignoreObsPt?: { x: number; y: number },
  ): number => {
    let cost = boxInsidePenalty(box, vp)

    // Strong penalty for overlapping already-placed labels
    for (const pb of placedBoxes) {
      const area = boxesOverlapArea(box, pb, 4)
      if (area > 0) cost += 600 + area * 6
    }

    // Strong penalty for overlapping plotted points / drag discs
    for (const o of obstacles) {
      if (ignoreObsPt && Math.hypot(o.x - ignoreObsPt.x, o.y - ignoreObsPt.y) < 1) continue
      const clampedX = Math.max(box.x1, Math.min(o.x, box.x2))
      const clampedY = Math.max(box.y1, Math.min(o.y, box.y2))
      const d = Math.hypot(o.x - clampedX, o.y - clampedY)
      if (d < o.r + 3) {
        cost += (o.r + 3 - d) * 32
      }
    }

    // Mild penalty for sitting directly on top of axes or other geometry strokes
    if (axisX !== null && Math.abs(cx - axisX) < 14) cost += (14 - Math.abs(cx - axisX)) * 1.4
    if (axisY !== null && Math.abs(cy - axisY) < 12) cost += (12 - Math.abs(cy - axisY)) * 1.4

    for (const seg of segsPx) {
      if (ignoreSegIdx !== undefined && seg.idx === ignoreSegIdx) continue
      const d = distPointToSegmentPx(cx, cy, seg.x1, seg.y1, seg.x2, seg.y2)
      if (d < 13) cost += (13 - d) * 3.2
    }

    return cost
  }

  // ---------------------------------------------------------------------------
  // 1. Place Point Labels FIRST (highest semantic priority, anchored near dots)
  // ---------------------------------------------------------------------------
  const allPointSpecs: {
    id: string
    x: number
    y: number
    text: string
    color: GeoColor
    dim?: boolean
    group?: string
    isDraggable: boolean
  }[] = []

  ;(draggables ?? []).forEach(d => {
    if (!d.label) return
    allPointSpecs.push({
      id: `pt-${d.id}`,
      x: d.x,
      y: d.y,
      text: d.label,
      color: d.color ?? 'blue',
      group: d.group,
      isDraggable: mode === 'interactive',
    })
  })

  ;(scene.points ?? []).forEach(p => {
    if (dragMap.has(p.id)) return
    const text = p.showCoords
      ? p.label
        ? `${p.label}${fmtCoord(p.x, p.y)}`
        : fmtCoord(p.x, p.y)
      : p.label ?? ''
    if (!text) return
    allPointSpecs.push({
      id: `pt-${p.id}`,
      x: p.x,
      y: p.y,
      text,
      color: p.dim ? 'muted' : p.color ?? 'ink',
      dim: p.dim,
      group: p.group,
      isDraggable: false,
    })
  })

  // Compass directions (N, NE, E, SE, S, SW, W, NW)
  const dirs: { dx: number; dy: number; anchor: 'start' | 'middle' | 'end'; bias: number }[] = [
    { dx: 0, dy: -1, anchor: 'middle', bias: 0 },
    { dx: 0.78, dy: -0.78, anchor: 'start', bias: 2 },
    { dx: 1, dy: 0, anchor: 'start', bias: 3 },
    { dx: -0.78, dy: -0.78, anchor: 'end', bias: 3 },
    { dx: 0.78, dy: 0.78, anchor: 'start', bias: 4 },
    { dx: 0, dy: 1, anchor: 'middle', bias: 5 },
    { dx: -1, dy: 0, anchor: 'end', bias: 5 },
    { dx: -0.78, dy: 0.78, anchor: 'end', bias: 6 },
  ]

  for (const pt of allPointSpecs) {
    const px = vp.toPxX(pt.x)
    const py = vp.toPxY(pt.y)
    // Skip labels for points outside visible bounds
    if (
      px < vp.plotX - 10 ||
      px > vp.plotX + vp.plotW + 10 ||
      py < vp.plotY - 10 ||
      py > vp.plotY + vp.plotH + 10
    ) {
      continue
    }

    const fontSize = pt.dim ? 12 : 13.5
    const dist = pt.isDraggable ? 27 : 13.5
    let best = { x: px, y: py - dist, anchor: 'middle' as 'start' | 'middle' | 'end', cost: Infinity, box: estimateLabelBox(px, py - dist, pt.text, fontSize, 'middle') }

    for (const d of dirs) {
      const lx = px + d.dx * dist
      const ly = py + d.dy * dist
      const box = estimateLabelBox(lx, ly, pt.text, fontSize, d.anchor)
      const cost = scoreBox(lx, ly, box, undefined, { x: px, y: py }) + d.bias
      if (cost < best.cost) {
        best = { x: lx, y: ly, anchor: d.anchor, cost, box }
      }
    }

    placedBoxes.push(best.box)
    placed.push({
      id: pt.id,
      x: best.x,
      y: best.y,
      text: pt.text,
      color: pt.color,
      dim: pt.dim,
      group: pt.group,
      kind: 'point',
      fontSize,
      fontWeight: pt.dim ? 500 : 600,
      anchor: best.anchor,
    })
  }

  // ---------------------------------------------------------------------------
  // 2. Place Line Labels (with automatic Collinear Convergence Merging!)
  // ---------------------------------------------------------------------------
  const labeledLines = clippedLines.filter(l => Boolean(l.label))
  const consumed = new Set<number>()

  for (let i = 0; i < labeledLines.length; i++) {
    if (consumed.has(i)) continue
    const base = labeledLines[i]
    const cluster = [base]
    consumed.add(i)

    // Check if other labeled lines physically coincide with this line
    for (let j = i + 1; j < labeledLines.length; j++) {
      if (consumed.has(j)) continue
      const other = labeledLines[j]
      const d1 = distToLineInfPx(other.x1, other.y1, base.x1, base.y1, base.x2, base.y2)
      const d2 = distToLineInfPx(other.x2, other.y2, base.x1, base.y1, base.x2, base.y2)
      if (d1 < 8.5 && d2 < 8.5) {
        cluster.push(other)
        consumed.add(j)
      }
    }

    const isMerged = cluster.length > 1
    const text =
      cluster.length >= 3
        ? 'All 3 coincide'
        : cluster.length === 2
          ? `${cluster[0].label} = ${cluster[1].label}`
          : base.label!
    const color: GeoColor = isMerged ? 'green' : base.color
    const fontSize = base.dim && !isMerged ? 11.5 : 13

    const dx = base.x2 - base.x1
    const dy = base.y2 - base.y1
    const len = Math.hypot(dx, dy) || 1
    const nx = -dy / len
    const ny = dx / len

    const tSamples = [0.22, 0.3, 0.38, 0.48, 0.58, 0.68, 0.78]
    const sideSamples = [14, -14]

    let best = {
      x: (base.x1 + base.x2) / 2,
      y: (base.y1 + base.y2) / 2 - 14,
      cost: Infinity,
      box: estimateLabelBox(0, 0, text, fontSize, 'middle'),
    }

    for (const t of tSamples) {
      const bx = base.x1 + dx * t
      const by = base.y1 + dy * t
      for (const s of sideSamples) {
        const lx = bx + nx * s
        const ly = by + ny * s
        const box = estimateLabelBox(lx, ly, text, fontSize, 'middle')
        // Slight preference for outer ends (t near 0.25 or 0.75) so center stays open
        const edgeBonus = Math.abs(t - 0.5) * -12
        const cost = scoreBox(lx, ly, box, base.idx) + edgeBonus
        if (cost < best.cost) {
          best = { x: lx, y: ly, cost, box }
        }
      }
    }

    placedBoxes.push(best.box)
    placed.push({
      id: `line-lbl-${base.idx}`,
      x: best.x,
      y: best.y,
      text,
      color,
      dim: isMerged ? false : base.dim,
      group: isMerged ? undefined : base.group,
      kind: 'line',
      fontSize,
      fontWeight: isMerged ? 700 : 600,
      anchor: 'middle',
      merged: isMerged,
      prominent: isMerged || /undefined|\bm\s*=\s*0\b/i.test(text),
    })
  }

  // ---------------------------------------------------------------------------
  // 3. Place Segment Labels
  // ---------------------------------------------------------------------------
  ;(scene.segments ?? []).forEach((seg, idx) => {
    if (!seg.label) return
    const x1 = vp.toPxX(seg.from[0])
    const y1 = vp.toPxY(seg.from[1])
    const x2 = vp.toPxX(seg.to[0])
    const y2 = vp.toPxY(seg.to[1])
    const mx = (x1 + x2) / 2
    const my = (y1 + y2) / 2
    const dx = x2 - x1
    const dy = y2 - y1
    const len = Math.hypot(dx, dy) || 1
    const nx = -dy / len
    const ny = dx / len
    const fontSize = seg.dim ? 11.5 : 12.5

    let best = {
      x: mx + nx * 13,
      y: my + ny * 13,
      cost: Infinity,
      box: estimateLabelBox(mx, my, seg.label, fontSize, 'middle'),
    }
    for (const s of [13, -13, 18, -18]) {
      const lx = mx + nx * s
      const ly = my + ny * s
      const box = estimateLabelBox(lx, ly, seg.label, fontSize, 'middle')
      const cost = scoreBox(lx, ly, box)
      if (cost < best.cost) best = { x: lx, y: ly, cost, box }
    }

    placedBoxes.push(best.box)
    placed.push({
      id: `seg-lbl-${idx}`,
      x: best.x,
      y: best.y,
      text: seg.label,
      color: seg.dim ? 'muted' : seg.color ?? 'blue',
      dim: seg.dim,
      group: seg.group,
      kind: 'segment',
      fontSize,
      fontWeight: 600,
      anchor: 'middle',
    })
  })

  // ---------------------------------------------------------------------------
  // 4. Place Rise / Run Labels
  // ---------------------------------------------------------------------------
  ;(scene.riseRuns ?? []).forEach((rr, idx) => {
    if (!rr.showLabels) return
    const [x1m, y1m] = rr.from
    const [x2m, y2m] = rr.to
    const dxm = x2m - x1m
    const dym = y2m - y1m
    const x1 = vp.toPxX(x1m)
    const y1 = vp.toPxY(y1m)
    const x2 = vp.toPxX(x2m)
    const y2 = vp.toPxY(y2m)
    const cx = x2
    const cy = y1
    const color = rr.dim ? 'muted' : rr.color ?? 'teal'

    if (Math.abs(dxm) > 1e-6 && Math.abs(x2 - x1) > 20) {
      const runText = `run ${fmtNum(dxm)}`
      const side = y2 < y1 ? 14 : -13
      const lx = Math.max(vp.plotX + 30, Math.min(vp.plotX + vp.plotW - 30, (x1 + cx) / 2))
      const ly = Math.max(vp.plotY + 14, Math.min(vp.plotY + vp.plotH - 14, cy + side))
      const box = estimateLabelBox(lx, ly, runText, 12, 'middle')
      placedBoxes.push(box)
      placed.push({
        id: `rr-run-${idx}`,
        x: lx,
        y: ly,
        text: runText,
        color,
        dim: rr.dim,
        group: rr.group,
        kind: 'riserun',
        fontSize: 13,
        fontWeight: 700,
        anchor: 'middle',
        prominent: true,
      })
    }

    if (Math.abs(dym) > 1e-6 && Math.abs(y2 - y1) > 20) {
      const riseText = `rise ${fmtNum(dym)}`
      const rightSide = x2 >= x1
      const lx = Math.max(vp.plotX + 10, Math.min(vp.plotX + vp.plotW - 10, cx + (rightSide ? 11 : -11)))
      const ly = Math.max(vp.plotY + 14, Math.min(vp.plotY + vp.plotH - 14, (cy + y2) / 2))
      const anchor = rightSide ? 'start' : 'end'
      const box = estimateLabelBox(lx, ly, riseText, 12, anchor)
      placedBoxes.push(box)
      placed.push({
        id: `rr-rise-${idx}`,
        x: lx,
        y: ly,
        text: riseText,
        color,
        dim: rr.dim,
        group: rr.group,
        kind: 'riserun',
        fontSize: 13,
        fontWeight: 700,
        anchor,
        prominent: true,
      })
    }
  })

  // ---------------------------------------------------------------------------
  // 5. Place Circle Labels
  // ---------------------------------------------------------------------------
  ;(scene.circles ?? []).forEach((c, idx) => {
    if (!c.label) return
    const cx = vp.toPxX(c.cx)
    const cy = vp.toPxY(c.cy)
    const rPx = c.r * vp.scale
    const lx = cx + rPx * 0.72 + 6
    const ly = cy - rPx * 0.72 - 6
    const box = estimateLabelBox(lx, ly, c.label, 12.5, 'start')
    placedBoxes.push(box)
    placed.push({
      id: `circ-lbl-${idx}`,
      x: lx,
      y: ly,
      text: c.label,
      color: c.dim ? 'muted' : c.color ?? 'blue',
      dim: c.dim,
      group: c.group,
      kind: 'circle',
      fontSize: 12.5,
      fontWeight: 600,
      anchor: 'start',
    })
  })

  return placed
}
