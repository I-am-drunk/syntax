import type { GeoColor, GeoLine, GeoScene } from '../types'

export type GraphMode = 'interactive' | 'display'

export type DraggableConstraintKind = 'free' | 'horizontal' | 'vertical' | 'line'

export type DraggablePointSpec = {
  id: string
  x: number
  y: number
  label?: string
  color?: GeoColor
  /** Optional custom constraint callback returning snapped [x, y] */
  constrain?: (x: number, y: number) => [number, number]
  /** Optional directional handle presentation (defaults to 'free') */
  direction?: DraggableConstraintKind
  /** Angle in math degrees (0 = horizontal, 90 = vertical) for 'line' pill orientation */
  lineAngleDeg?: number
  /** Optional explicit valid snap samples [x, y][] shown as r=2 dots while dragging */
  snapSamples?: [number, number][]
  /** Group ID for dynamic spotlighting */
  group?: string
}

export type GhostPreview =
  | { kind: 'line'; a: number; b: number; c: number; label?: string }
  | { kind: 'point'; x: number; y: number; label?: string }
  | { kind: 'circle'; cx?: number; cy?: number; r: number }

export type Bounds = {
  xMin: number
  xMax: number
  yMin: number
  yMax: number
}

export type Viewport = {
  width: number
  height: number
  padLeft: number
  padRight: number
  padTop: number
  padBottom: number
  plotX: number
  plotY: number
  plotW: number
  plotH: number
  scale: number // px per math unit (strictly 1:1 on X and Y)
  bounds: Bounds
  toPxX: (x: number) => number
  toPxY: (y: number) => number
  toMathX: (px: number) => number
  toMathY: (py: number) => number
}

export function fmtNum(n: number): string {
  if (Math.abs(n) < 1e-9) return '0'
  const r = Math.round(n * 100) / 100
  const s = Number.isInteger(r) ? String(r) : r.toFixed(1).replace(/\.0$/, '')
  return s.replace('-', '−')
}

export function fmtCoord(x: number, y: number): string {
  return `(${fmtNum(x)}, ${fmtNum(y)})`
}

export function computeBounds(
  scene: GeoScene,
  draggables?: DraggablePointSpec[],
): Bounds {
  if (
    scene.xMin !== undefined &&
    scene.xMax !== undefined &&
    scene.yMin !== undefined &&
    scene.yMax !== undefined
  ) {
    return {
      xMin: scene.xMin,
      xMax: scene.xMax,
      yMin: scene.yMin,
      yMax: scene.yMax,
    }
  }

  const xs: number[] = [0]
  const ys: number[] = [0]
  const add = (x: number, y: number) => {
    if (Number.isFinite(x) && Number.isFinite(y)) {
      xs.push(x)
      ys.push(y)
    }
  }

  scene.points?.forEach(p => add(p.x, p.y))
  draggables?.forEach(p => add(p.x, p.y))
  scene.segments?.forEach(s => {
    add(s.from[0], s.from[1])
    add(s.to[0], s.to[1])
  })
  scene.polygons?.forEach(poly => poly.vertices.forEach(([x, y]) => add(x, y)))
  scene.circles?.forEach(c => {
    add(c.cx - c.r, c.cy - c.r)
    add(c.cx + c.r, c.cy + c.r)
  })
  scene.riseRuns?.forEach(r => {
    add(r.from[0], r.from[1])
    add(r.to[0], r.to[1])
  })

  const rawXMin = Math.min(...xs)
  const rawXMax = Math.max(...xs)
  const rawYMin = Math.min(...ys)
  const rawYMax = Math.max(...ys)

  const spanX = Math.max(4, rawXMax - rawXMin)
  const spanY = Math.max(4, rawYMax - rawYMin)
  const padX = Math.max(1.5, Math.ceil(spanX * 0.18))
  const padY = Math.max(1.5, Math.ceil(spanY * 0.18))

  return {
    xMin: scene.xMin ?? Math.floor(rawXMin - padX),
    xMax: scene.xMax ?? Math.ceil(rawXMax + padX),
    yMin: scene.yMin ?? Math.floor(rawYMin - padY),
    yMax: scene.yMax ?? Math.ceil(rawYMax + padY),
  }
}

/**
 * Builds a 1:1 aspect-ratio-preserving coordinate viewport.
 * - Interactive mode uses Brilliant's exact 380x382 geometry (padL=26, padR=26, padT=32, padB=22).
 * - Display mode adapts canvas height cleanly to the scene's data aspect ratio
 *   (clamped between 270px and 366px tall) so static quiz/worked diagrams feel balanced and calm.
 */
export function buildViewport(
  scene: GeoScene,
  mode: GraphMode,
  draggables?: DraggablePointSpec[],
): Viewport {
  const b = computeBounds(scene, draggables)
  const width = 380
  const padLeft = 26
  const padRight = 26
  const padTop = 32
  const padBottom = 22
  const availW = width - padLeft - padRight // 328, exact Brilliant match!

  const rawSpanX = Math.max(1, b.xMax - b.xMin)
  const rawSpanY = Math.max(1, b.yMax - b.yMin)

  let availH: number
  if (mode === 'interactive') {
    availH = 328 // 380 x 382 exact Brilliant FunctionGraph proportions
  } else {
    const idealH = (availW * rawSpanY) / rawSpanX
    availH = Math.round(Math.max(216, Math.min(312, idealH)))
  }
  const height = padTop + availH + padBottom

  // Strict 1:1 scale so 90 deg angles and circles are mathematically faithful
  const scale = Math.min(availW / rawSpanX, availH / rawSpanY)

  // Expand the tighter axis symmetrically around its center so the plot fills availW x availH
  const effSpanX = availW / scale
  const effSpanY = availH / scale
  const cx = (b.xMin + b.xMax) / 2
  const cy = (b.yMin + b.yMax) / 2

  const bounds: Bounds = {
    xMin: cx - effSpanX / 2,
    xMax: cx + effSpanX / 2,
    yMin: cy - effSpanY / 2,
    yMax: cy + effSpanY / 2,
  }

  const toPxX = (x: number) => padLeft + (x - bounds.xMin) * scale
  const toPxY = (y: number) => padTop + (bounds.yMax - y) * scale
  const toMathX = (px: number) => bounds.xMin + (px - padLeft) / scale
  const toMathY = (py: number) => bounds.yMax - (py - padTop) / scale

  return {
    width,
    height,
    padLeft,
    padRight,
    padTop,
    padBottom,
    plotX: padLeft,
    plotY: padTop,
    plotW: availW,
    plotH: availH,
    scale,
    bounds,
    toPxX,
    toPxY,
    toMathX,
    toMathY,
  }
}

/**
 * Computes clean grid spacing and label step so gridlines and tick numbers
 * NEVER crowd, matching Brilliant's readable axis cadence.
 */
export function computeAxisCadence(vp: Viewport): { gridStep: number; labelStep: number } {
  const span = Math.max(vp.bounds.xMax - vp.bounds.xMin, vp.bounds.yMax - vp.bounds.yMin)
  if (span <= 9) return { gridStep: 1, labelStep: 1 }
  if (span <= 15) return { gridStep: 1, labelStep: 2 }
  if (span <= 22) return { gridStep: 2, labelStep: 2 }
  if (span <= 36) return { gridStep: 2, labelStep: 4 }
  return { gridStep: 5, labelStep: 5 }
}

/**
 * Clips an infinite line (ax + by + c = 0) to the visible plot bounds.
 */
export function clipLineToBounds(
  line: Pick<GeoLine, 'a' | 'b' | 'c'>,
  b: Bounds,
): [[number, number], [number, number]] | null {
  const { a, b: B, c } = line
  const eps = 1e-9
  const pts: [number, number][] = []

  const pushUnique = (x: number, y: number) => {
    if (
      x < b.xMin - 1e-6 ||
      x > b.xMax + 1e-6 ||
      y < b.yMin - 1e-6 ||
      y > b.yMax + 1e-6
    ) {
      return
    }
    if (!pts.some(([px, py]) => Math.hypot(px - x, py - y) < 1e-4)) {
      pts.push([x, y])
    }
  }

  if (Math.abs(B) > eps) {
    pushUnique(b.xMin, -(a * b.xMin + c) / B)
    pushUnique(b.xMax, -(a * b.xMax + c) / B)
  }
  if (Math.abs(a) > eps) {
    pushUnique(-(B * b.yMin + c) / a, b.yMin)
    pushUnique(-(B * b.yMax + c) / a, b.yMax)
  }

  if (pts.length < 2) return null
  // Pick the farthest pair if a line passes through a corner
  let best: [[number, number], [number, number]] = [pts[0], pts[1]]
  let bestDist = -1
  for (let i = 0; i < pts.length; i++) {
    for (let j = i + 1; j < pts.length; j++) {
      const d = Math.hypot(pts[i][0] - pts[j][0], pts[i][1] - pts[j][1])
      if (d > bestDist) {
        bestDist = d
        best = [pts[i], pts[j]]
      }
    }
  }
  return best
}

/**
 * Perpendicular pixel distance from point (px, py) to segment (x1, y1)-(x2, y2).
 */
export function distPointToSegmentPx(
  px: number,
  py: number,
  x1: number,
  y1: number,
  x2: number,
  y2: number,
): number {
  const dx = x2 - x1
  const dy = y2 - y1
  const lenSq = dx * dx + dy * dy
  if (lenSq < 1e-6) return Math.hypot(px - x1, py - y1)
  const t = Math.max(0, Math.min(1, ((px - x1) * dx + (py - y1) * dy) / lenSq))
  return Math.hypot(px - (x1 + t * dx), py - (y1 + t * dy))
}

/**
 * Generates the exact list of valid snap points (in math coordinates) to show
 * as Brilliant's crisp r=2 lattice dots while a draggable handle is pressed.
 */
export function computeSnapLattice(
  vp: Viewport,
  activePoint: DraggablePointSpec,
  snapToGrid: number | null,
): [number, number][] {
  if (activePoint.snapSamples && activePoint.snapSamples.length > 0) {
    return activePoint.snapSamples.filter(
      ([x, y]) =>
        x >= vp.bounds.xMin - 1e-6 &&
        x <= vp.bounds.xMax + 1e-6 &&
        y >= vp.bounds.yMin - 1e-6 &&
        y <= vp.bounds.yMax + 1e-6,
    )
  }

  // If constrained with a callback but no explicit snapSamples, sample a 2D grid and dedupe
  if (activePoint.constrain) {
    const seen = new Map<string, [number, number]>()
    const gridSteps = 10
    for (let ix = 0; ix <= gridSteps; ix++) {
      const mx = vp.bounds.xMin + ((vp.bounds.xMax - vp.bounds.xMin) * ix) / gridSteps
      for (let iy = 0; iy <= gridSteps; iy++) {
        const my = vp.bounds.yMin + ((vp.bounds.yMax - vp.bounds.yMin) * iy) / gridSteps
        const [sx, sy] = activePoint.constrain(mx, my)
        if (
          Number.isFinite(sx) &&
          Number.isFinite(sy) &&
          sx >= vp.bounds.xMin - 1e-6 &&
          sx <= vp.bounds.xMax + 1e-6 &&
          sy >= vp.bounds.yMin - 1e-6 &&
          sy <= vp.bounds.yMax + 1e-6
        ) {
          const key = `${Math.round(sx * 100)},${Math.round(sy * 100)}`
          if (!seen.has(key)) seen.set(key, [sx, sy])
        }
      }
    }
    return [...seen.values()]
  }

  const step = snapToGrid ?? 1
  if (step <= 0) return []

  const dots: [number, number][] = []
  const xStart = Math.ceil((vp.bounds.xMin + 1e-6) / step) * step
  const xEnd = Math.floor((vp.bounds.xMax - 1e-6) / step) * step
  const yStart = Math.ceil((vp.bounds.yMin + 1e-6) / step) * step
  const yEnd = Math.floor((vp.bounds.yMax - 1e-6) / step) * step

  // Guard against overly dense lattices (> 225 dots)
  const nx = Math.floor((xEnd - xStart) / step) + 1
  const ny = Math.floor((yEnd - yStart) / step) + 1
  const effectiveStep = nx * ny > 225 ? step * 2 : step

  for (let x = xStart; x <= xEnd + 1e-6; x += effectiveStep) {
    for (let y = yStart; y <= yEnd + 1e-6; y += effectiveStep) {
      dots.push([Math.round(x * 1000) / 1000, Math.round(y * 1000) / 1000])
    }
  }
  return dots
}

