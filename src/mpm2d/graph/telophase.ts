/**
 * Exact G1-continuous circular-fillet union ("telophase / nucleus" geometry)
 * for two 2D circles in SVG screen coordinates (+x right, +y down).
 *
 * Guarantees:
 * - Zero engagement across empty air: rims must be practically touching
 *   (d < r1 + r2 + engageMargin) before any bridge forms.
 * - Plump, smooth biological cleavage furrow via exact external tangent
 *   circular arcs (no narrow pinched cubic bowties).
 * - Single closed SVG path with 4 arcs so filled translucent membranes
 *   never show double-opacity internal overlap seams.
 */

export interface FilletUnionResult {
  /** Single closed SVG path describing the smooth union of both circles. */
  path: string
  /** 0 at initial contact -> 1 when fully merged (coincident). */
  mergeT: number
  /** Midpoint center for unified shadow blending. */
  midX: number
  midY: number
}

function clamp(v: number, lo: number, hi: number): number {
  return v < lo ? lo : v > hi ? hi : v
}

function smoothstep(edge0: number, edge1: number, x: number): number {
  const t = clamp((x - edge0) / (edge1 - edge0), 0, 1)
  return t * t * (3 - 2 * t)
}

function fmt(n: number): string {
  return Number.isFinite(n) ? n.toFixed(2) : '0'
}

function circlePath(cx: number, cy: number, r: number): string {
  const rStr = fmt(r)
  return `M ${fmt(cx - r)} ${fmt(cy)} A ${rStr} ${rStr} 0 1 0 ${fmt(cx + r)} ${fmt(cy)} A ${rStr} ${rStr} 0 1 0 ${fmt(cx - r)} ${fmt(cy)} Z`
}

/**
 * Computes the exact 4-arc circular-fillet silhouette of two circles
 * (x1, y1, r1) and (x2, y2, r2) with concave fillet radius Rf.
 */
export function buildCircularFilletPath(
  x1: number,
  y1: number,
  r1: number,
  x2: number,
  y2: number,
  r2: number,
  filletR: number,
): string | null {
  const dx = x2 - x1
  const dy = y2 - y1
  const d = Math.hypot(dx, dy)

  // Completely contained / coincident -> single smooth circle
  if (d <= Math.abs(r1 - r2) + 0.6) {
    const bigX = r1 >= r2 ? x1 : x2
    const bigY = r1 >= r2 ? y1 : y2
    const bigR = Math.max(r1, r2)
    return circlePath(bigX, bigY, bigR)
  }

  const a = r1 + filletR
  const b = r2 + filletR

  // Triangle inequality check for external tangent circle
  if (a + b <= d + 0.05 || d + a <= b + 0.05 || d + b <= a + 0.05) {
    return null
  }

  const xF = (d * d + a * a - b * b) / (2 * d)
  const hSq = a * a - xF * xF
  if (hSq <= 0.01) return null
  const hF = Math.sqrt(hSq)

  // Unit vector along C1 -> C2 and upward-left normal (in SVG +y down)
  const ux = dx / d
  const uy = dy / d
  // When u = (1, 0), n = (0, -1) (visually UP on screen)
  const nx = uy
  const ny = -ux

  // Centers of top (+) and bottom (-) concave fillet circles
  const fpx = x1 + xF * ux + hF * nx
  const fpy = y1 + xF * uy + hF * ny
  const fmx = x1 + xF * ux - hF * nx
  const fmy = y1 + xF * uy - hF * ny

  // Exact tangent points on Circle 1 and Circle 2
  const k1 = r1 / a
  const k2 = r2 / b

  const t1px = x1 + k1 * (fpx - x1)
  const t1py = y1 + k1 * (fpy - y1)
  const t2px = x2 + k2 * (fpx - x2)
  const t2py = y2 + k2 * (fpy - y2)

  const t1mx = x1 + k1 * (fmx - x1)
  const t1my = y1 + k1 * (fmy - y1)
  const t2mx = x2 + k2 * (fmx - x2)
  const t2my = y2 + k2 * (fmy - y2)

  // Outer circle large-arc flags:
  // Circle 1 outer arc wraps around the -u side -> largeArc if F lies in +u half (xF > 0)
  // Circle 2 outer arc wraps around the +u side -> largeArc if F lies in -u half (xF < d)
  const large1 = xF > 0 ? 1 : 0
  const large2 = xF < d ? 1 : 0

  const r1s = fmt(r1)
  const r2s = fmt(r2)
  const rfs = fmt(filletR)

  // Path order (clockwise around the unified exterior silhouette in SVG +y down):
  // 1. T1+ -> T2+ along concave top fillet (sweep=0)
  // 2. T2+ -> T2- around Circle 2 right exterior (sweep=1)
  // 3. T2- -> T1- along concave bottom fillet (sweep=0)
  // 4. T1- -> T1+ around Circle 1 left exterior (sweep=1)
  return [
    `M ${fmt(t1px)} ${fmt(t1py)}`,
    `A ${rfs} ${rfs} 0 0 0 ${fmt(t2px)} ${fmt(t2py)}`,
    `A ${r2s} ${r2s} 0 ${large2} 1 ${fmt(t2mx)} ${fmt(t2my)}`,
    `A ${rfs} ${rfs} 0 0 0 ${fmt(t1mx)} ${fmt(t1my)}`,
    `A ${r1s} ${r1s} 0 ${large1} 1 ${fmt(t1px)} ${fmt(t1py)}`,
    'Z',
  ].join(' ')
}

/**
 * Outer cell membrane union (translucent dark/light handle disc, r = 20px).
 * Engages only after the discs overlap deeply. On a one-unit grid step the
 * original two handles remain visually separate. The merge is reserved for
 * the animated snap into the same point.
 */
export function computeOuterMembraneUnion(
  x1: number,
  y1: number,
  x2: number,
  y2: number,
  baseR: number,
): FilletUnionResult | null {
  const d = Math.hypot(x2 - x1, y2 - y1)
  const maxDist = baseR * 1.22
  if (d >= maxDist) return null

  // 0 at the intentional merge threshold -> 1 at full overlap
  const mergeT = smoothstep(maxDist, 0, d)
  const effR = baseR
  const midX = (x1 + x2) / 2
  const midY = (y1 + y2) / 2

  if (d <= 1.2) {
    return {
      path: circlePath(midX, midY, effR),
      mergeT: 1,
      midX,
      midY,
    }
  }

  // Grow the concave fillet as the final snap closes. The outer shape stays
  // broad enough to read as one dividing membrane rather than a thin bridge.
  const overlapRatio = clamp((maxDist - d) / maxDist, 0, 1)
  const minRequiredFillet = Math.max(1.2, (d - 2 * effR) / 2 + 0.8)
  const filletR = Math.max(
    minRequiredFillet,
    1.2 + Math.pow(overlapRatio, 1.35) * (baseR * 2.1),
  )

  const path = buildCircularFilletPath(x1, y1, effR, x2, y2, effR, filletR)
  if (!path) return null

  return { path, mergeT, midX, midY }
}

/**
 * Inner blue nucleus union (r = 5px idle, up to 15px when pressed).
 * Engages ONLY when the two inner blue nuclei are right up against each other
 * (d < r1 + r2 + 1.5px), so at 1 grid unit apart (d ~ 26px) you see the classic
 * telophase stage: TWO separate blue nuclei inside ONE dividing outer membrane!
 * Closer than that, the blue nuclei themselves smoothly bridge and fuse into one.
 */
export function computeNucleusUnion(
  x1: number,
  y1: number,
  r1: number,
  x2: number,
  y2: number,
  r2: number,
): FilletUnionResult | null {
  const d = Math.hypot(x2 - x1, y2 - y1)
  const maxDist = r1 + r2 + 1.4
  if (d >= maxDist) return null

  const minR = Math.min(r1, r2)
  const maxR = Math.max(r1, r2)
  const diff = Math.abs(r1 - r2)
  const mergeT = smoothstep(maxDist, diff, d)

  const midX = (x1 * r1 + x2 * r2) / (r1 + r2)
  const midY = (y1 * r1 + y2 * r2) / (r1 + r2)

  // Slight organic volume boost when two resting nuclei fuse completely
  const swell = minR * 0.22 * Math.pow(mergeT, 2)
  const er1 = r1 + swell * (r2 / (r1 + r2))
  const er2 = r2 + swell * (r1 / (r1 + r2))

  if (d <= Math.abs(er1 - er2) + 0.7) {
    const cx = er1 >= er2 ? x1 : x2
    const cy = er1 >= er2 ? y1 : y2
    return {
      path: circlePath(cx, cy, Math.max(er1, er2)),
      mergeT: 1,
      midX: cx,
      midY: cy,
    }
  }

  const overlapRatio = clamp((maxDist - d) / Math.max(1, maxDist - diff), 0, 1)
  const minReq = Math.max(0.9, (d - (er1 + er2)) / 2 + 0.6)
  const filletR = Math.max(
    minReq,
    0.9 + Math.pow(overlapRatio, 1.25) * (maxR * 1.45),
  )

  const path = buildCircularFilletPath(x1, y1, er1, x2, y2, er2, filletR)
  if (!path) return null

  return { path, mergeT, midX, midY }
}
