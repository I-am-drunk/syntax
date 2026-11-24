import type { GeoCircle, GeoColor, GeoLine, GeoPoint, GeoRightAngle, GeoScene } from '../../../src/mpm2d/types.js'

const EPS = 1e-9

function gcd(a: number, b: number): number {
  a = Math.abs(Math.round(a))
  b = Math.abs(Math.round(b))
  while (b > 0) {
    const t = a % b
    a = b
    b = t
  }
  return a || 1
}

function normalizeABC(a: number, b: number, c: number): { a: number; b: number; c: number } {
  const isInts =
    Math.abs(a - Math.round(a)) < 1e-6 &&
    Math.abs(b - Math.round(b)) < 1e-6 &&
    Math.abs(c - Math.round(c)) < 1e-6
  if (isInts) {
    const g = gcd(gcd(a, b), c)
    a = Math.round(a) / g
    b = Math.round(b) / g
    c = Math.round(c) / g
  }
  if (a < -EPS || (Math.abs(a) < EPS && b < -EPS)) {
    a = -a
    b = -b
    c = -c
  }
  return { a, b, c }
}

/**
 * Compute ax + by + c = 0 for the line through two distinct points.
 */
export function lineThrough(
  p1: [number, number],
  p2: [number, number],
  opts?: { color?: GeoColor; dashed?: boolean; label?: string; dim?: boolean },
): GeoLine {
  const dx = p2[0] - p1[0]
  const dy = p2[1] - p1[1]
  if (Math.hypot(dx, dy) < EPS) {
    throw new Error(`lineThrough requires two distinct points, got (${p1}) and (${p2})`)
  }
  // dy*x - dx*y + (dx*y1 - dy*x1) = 0
  const { a, b, c } = normalizeABC(dy, -dx, dx * p1[1] - dy * p1[0])
  return { a, b, c, ...opts }
}

/**
 * Compute ax + by + c = 0 for the line perpendicular to `baseLine` passing through `point`.
 */
export function perpendicularThrough(
  baseLine: Pick<GeoLine, 'a' | 'b' | 'c'>,
  point: [number, number],
  opts?: { color?: GeoColor; dashed?: boolean; label?: string; dim?: boolean },
): GeoLine {
  if (Math.hypot(baseLine.a, baseLine.b) < EPS) {
    throw new Error('perpendicularThrough requires a non-degenerate base line')
  }
  // Normal to (a, b) is (-b, a) => -b*x + a*y + c' = 0
  const a2 = -baseLine.b
  const b2 = baseLine.a
  const c2 = -(a2 * point[0] + b2 * point[1])
  const { a, b, c } = normalizeABC(a2, b2, c2)
  return { a, b, c, ...opts }
}

/**
 * Compute midpoint of p1 and p2 as a GeoPoint.
 */
export function midpoint(
  p1: [number, number],
  p2: [number, number],
  opts?: { id?: string; label?: string; showCoords?: boolean; color?: GeoColor },
): GeoPoint {
  const x = (p1[0] + p2[0]) / 2
  const y = (p1[1] + p2[1]) / 2
  return {
    id: opts?.id ?? 'm',
    x,
    y,
    label: opts?.label ?? 'M',
    showCoords: opts?.showCoords ?? true,
    color: opts?.color ?? 'teal',
  }
}

/**
 * Compute circle centered at `center` passing through `throughPoint`.
 */
export function circleThrough(
  center: [number, number],
  throughPoint: [number, number],
  opts?: { color?: GeoColor; dashed?: boolean; label?: string; dim?: boolean },
): GeoCircle {
  const r = Math.hypot(throughPoint[0] - center[0], throughPoint[1] - center[1])
  if (r < EPS) {
    throw new Error('circleThrough requires throughPoint distinct from center')
  }
  return {
    cx: center[0],
    cy: center[1],
    r: Math.round(r * 1e6) / 1e6,
    ...opts,
  }
}

/**
 * Compute exact intersection of two lines, or null if parallel.
 */
export function lineIntersection(
  l1: Pick<GeoLine, 'a' | 'b' | 'c'>,
  l2: Pick<GeoLine, 'a' | 'b' | 'c'>,
): [number, number] | null {
  const det = l1.a * l2.b - l2.a * l1.b
  if (Math.abs(det) < EPS) return null
  const x = (l1.b * l2.c - l2.b * l1.c) / det
  const y = (l2.a * l1.c - l1.a * l2.c) / det
  return [Math.round(x * 1e6) / 1e6, Math.round(y * 1e6) / 1e6]
}

/**
 * Compute a verified GeoRightAngle marker at the exact intersection of two perpendicular lines.
 */
export function rightAngleAtIntersection(
  l1: Pick<GeoLine, 'a' | 'b' | 'c'>,
  l2: Pick<GeoLine, 'a' | 'b' | 'c'>,
  opts?: { color?: GeoColor },
): GeoRightAngle {
  const dot = l1.a * l2.a + l1.b * l2.b
  const norm = Math.hypot(l1.a, l1.b) * Math.hypot(l2.a, l2.b)
  if (norm < EPS || Math.abs(dot) / norm > 1e-3) {
    throw new Error(`Lines are not perpendicular (dot/norm = ${dot / norm})`)
  }
  const vertex = lineIntersection(l1, l2)
  if (!vertex) {
    throw new Error('Lines do not intersect')
  }
  // Direction vectors along l1 and l2 are (-b, a)
  const dir1: [number, number] = [-l1.b, l1.a]
  const dir2: [number, number] = [-l2.b, l2.a]
  return {
    vertex,
    dir1,
    dir2,
    color: opts?.color ?? 'green',
  }
}

/**
 * Compute clean integer bounds around a GeoScene with padding.
 */
export function computeAutoBounds(scene: GeoScene, pad = 2): Pick<GeoScene, 'xMin' | 'xMax' | 'yMin' | 'yMax'> {
  const xs: number[] = [0]
  const ys: number[] = [0]
  const add = (x: number, y: number) => {
    if (Number.isFinite(x) && Number.isFinite(y)) {
      xs.push(x)
      ys.push(y)
    }
  }
  scene.points?.forEach(p => add(p.x, p.y))
  scene.segments?.forEach(s => { add(s.from[0], s.from[1]); add(s.to[0], s.to[1]) })
  scene.polygons?.forEach(poly => poly.vertices.forEach(([x, y]) => add(x, y)))
  scene.circles?.forEach(c => { add(c.cx - c.r, c.cy - c.r); add(c.cx + c.r, c.cy + c.r) })
  scene.rightAngles?.forEach(ra => add(ra.vertex[0], ra.vertex[1]))
  return {
    xMin: Math.floor(Math.min(...xs) - pad),
    xMax: Math.ceil(Math.max(...xs) + pad),
    yMin: Math.floor(Math.min(...ys) - pad),
    yMax: Math.ceil(Math.max(...ys) + pad),
  }
}
