export type StrokePoint = {
  x: number
  y: number
  t?: number
}

export type CheckmarkResult = {
  ok: boolean
  score: number
  reason?: string
  vertex?: StrokePoint
}

function dist(a: StrokePoint, b: StrokePoint): number {
  return Math.hypot(b.x - a.x, b.y - a.y)
}

function pathLength(pts: StrokePoint[]): number {
  let sum = 0
  for (let i = 1; i < pts.length; i++) {
    sum += dist(pts[i - 1]!, pts[i]!)
  }
  return sum
}

function resample(pts: StrokePoint[], count: number): StrokePoint[] {
  const total = pathLength(pts)
  if (total <= 1e-6 || pts.length < 2) {
    return Array.from({ length: count }, () => pts[0] ?? { x: 0, y: 0 })
  }
  const step = total / (count - 1)
  const out: StrokePoint[] = [{ x: pts[0]!.x, y: pts[0]!.y }]
  let acc = 0
  let i = 1
  let prev = pts[0]!

  while (out.length < count && i < pts.length) {
    const cur = pts[i]!
    const segLen = dist(prev, cur)
    if (acc + segLen >= step) {
      const ratio = segLen > 1e-6 ? (step - acc) / segLen : 0
      const nx = prev.x + (cur.x - prev.x) * ratio
      const ny = prev.y + (cur.y - prev.y) * ratio
      const nextPt = { x: nx, y: ny }
      out.push(nextPt)
      prev = nextPt
      acc = 0
    } else {
      acc += segLen
      prev = cur
      i += 1
    }
  }
  while (out.length < count) {
    const last = pts[pts.length - 1]!
    out.push({ x: last.x, y: last.y })
  }
  return out
}

function pointToSegmentDist(p: StrokePoint, a: StrokePoint, b: StrokePoint): number {
  const dx = b.x - a.x
  const dy = b.y - a.y
  const lenSq = dx * dx + dy * dy
  if (lenSq <= 1e-9) return dist(p, a)
  const t = Math.max(0, Math.min(1, ((p.x - a.x) * dx + (p.y - a.y) * dy) / lenSq))
  return Math.hypot(p.x - (a.x + t * dx), p.y - (a.y + t * dy))
}

function angleBetweenDeg(ax: number, ay: number, bx: number, by: number): number {
  const la = Math.hypot(ax, ay)
  const lb = Math.hypot(bx, by)
  if (la < 1e-6 || lb < 1e-6) return 180
  const dot = Math.max(-1, Math.min(1, (ax * bx + ay * by) / (la * lb)))
  return (Math.acos(dot) * 180) / Math.PI
}

/**
 * Strict, forgiving-where-it-should-be checkmark gesture recognizer.
 *
 * Accepts:
 * - Standard forward checkmarks (short down-right leg, sharp valley, tall up-right sweep)
 * - Tilted-L checkmarks (straight-down first leg, ~70-120 deg corner, long up-right sweep)
 * - Natural slightly curved wrist checkmarks & fast flick upstrokes
 *
 * Rejects:
 * - Symmetric 'V' shapes (requires clear leg asymmetry & end higher than start)
 * - Rounded 'U' shapes (requires sharp local valley corner & tight 2-segment fit)
 * - Backwards / mirrored checkmarks (requires forward left-to-right orientation)
 * - Giant squiggles, circles, loops, zigzags, straight lines, radical signs (√)
 */
export function recognizeCheckmark(rawPoints: StrokePoint[]): CheckmarkResult {
  if (rawPoints.length < 4) {
    return { ok: false, score: 0, reason: 'too-few-points' }
  }

  let minX = Infinity
  let maxX = -Infinity
  let minY = Infinity
  let maxY = -Infinity
  for (const p of rawPoints) {
    if (p.x < minX) minX = p.x
    if (p.x > maxX) maxX = p.x
    if (p.y < minY) minY = p.y
    if (p.y > maxY) maxY = p.y
  }

  const bboxW = maxX - minX
  const bboxH = maxY - minY
  const diag = Math.hypot(bboxW, bboxH)
  if (diag < 28 || bboxW < 18 || bboxH < 14) {
    return { ok: false, score: 0, reason: 'too-small' }
  }

  const totalLen = pathLength(rawPoints)
  if (totalLen < 30) {
    return { ok: false, score: 0, reason: 'too-short' }
  }

  const N = 48
  const pts = resample(rawPoints, N)
  const S = pts[0]!
  const E = pts[N - 1]!

  // Find optimal valley vertex minimizing 2-segment piecewise-linear error among bottom candidates
  let bestIdx = -1
  let bestErr = Infinity
  let bestMaxDev = Infinity

  for (let i = 5; i <= N - 11; i++) {
    const V = pts[i]!
    // Vertex must be near the lowest point of the stroke
    if (V.y < maxY - 0.15 * bboxH) continue

    let sqSum = 0
    let maxDev = 0
    for (let j = 0; j <= i; j++) {
      const d = pointToSegmentDist(pts[j]!, S, V)
      sqSum += d * d
      if (d > maxDev) maxDev = d
    }
    for (let j = i; j < N; j++) {
      const d = pointToSegmentDist(pts[j]!, V, E)
      sqSum += d * d
      if (d > maxDev) maxDev = d
    }
    const rmse = Math.sqrt(sqSum / N) / diag
    if (rmse < bestErr) {
      bestErr = rmse
      bestMaxDev = maxDev / diag
      bestIdx = i
    }
  }

  if (bestIdx < 0) {
    return { ok: false, score: 0, reason: 'no-valley' }
  }

  const V = pts[bestIdx]!
  const v1x = V.x - S.x
  const v1y = V.y - S.y
  const len1 = Math.hypot(v1x, v1y)

  const v2x = E.x - V.x
  const v2y = E.y - V.y
  const len2 = Math.hypot(v2x, v2y)

  // Gate 1: Non-degenerate legs
  if (len1 < 0.14 * diag || len2 < 0.48 * diag) {
    return { ok: false, score: 0.1, reason: 'degenerate-legs', vertex: V }
  }

  // Gate 2: Forward left-to-right checkmark orientation (rejects backwards checks & carets)
  if (v1y <= 0 || v1y / len1 < 0.44) {
    return { ok: false, score: 0.15, reason: 'leg1-not-downward', vertex: V }
  }
  if (v1x < -0.22 * len1) {
    return { ok: false, score: 0.15, reason: 'leg1-backwards', vertex: V }
  }
  if (v2x <= 0 || v2y >= 0) {
    return { ok: false, score: 0.15, reason: 'leg2-not-up-right', vertex: V }
  }
  if (v2x / len2 < 0.24 || -v2y / len2 < 0.34) {
    return { ok: false, score: 0.2, reason: 'leg2-angle-out-of-range', vertex: V }
  }
  if (E.x - S.x < 0.28 * bboxW) {
    return { ok: false, score: 0.2, reason: 'not-forward-sweep', vertex: V }
  }

  // Gate 3: Unmistakable checkmark asymmetry (kills symmetric V and U!)
  const legRatio = len2 / len1
  if (legRatio < 1.38) {
    return { ok: false, score: 0.25, reason: 'too-symmetric-like-V', vertex: V }
  }
  const endAboveStart = (S.y - E.y) / bboxH
  if (endAboveStart < 0.24) {
    return { ok: false, score: 0.25, reason: 'end-not-above-start', vertex: V }
  }

  // Gate 4: Path efficiency (kills squiggles, loops, zigzags, circles)
  const efficiency = totalLen / (len1 + len2)
  if (efficiency > 1.24) {
    return { ok: false, score: 0.2, reason: 'excess-path-squiggle', vertex: V }
  }

  // Gate 5: Two-segment straightness fit (kills U curves, circles, arcs, wobbly squiggles)
  if (bestErr > 0.072 || bestMaxDev > 0.155) {
    return { ok: false, score: 0.25, reason: 'too-curved-or-wobbly', vertex: V }
  }

  // Gate 6: Sharp corner at the valley (kills rounded U and smooth J)
  // Chord interior angle between (-v1) and v2
  const chordAngle = angleBetweenDeg(-v1x, -v1y, v2x, v2y)
  if (chordAngle < 24 || chordAngle > 125) {
    return { ok: false, score: 0.3, reason: 'chord-angle-invalid', vertex: V }
  }

  // Local tangent angle right around V (window ~10% of points on each side)
  const kBefore = Math.max(2, Math.min(bestIdx, Math.round(N * 0.1)))
  const kAfter = Math.max(2, Math.min(N - 1 - bestIdx, Math.round(N * 0.1)))
  const pBefore = pts[bestIdx - kBefore]!
  const pAfter = pts[bestIdx + kAfter]!
  const localAngle = angleBetweenDeg(pBefore.x - V.x, pBefore.y - V.y, pAfter.x - V.x, pAfter.y - V.y)
  if (localAngle < 22 || localAngle > 134) {
    return { ok: false, score: 0.3, reason: 'rounded-corner-like-U', vertex: V }
  }

  // Gate 7: Per-leg monotonicity (kills backtracking hooks, loops, radical bars)
  let leg1Down = 0
  let leg1AbsY = 0
  for (let i = 1; i <= bestIdx; i++) {
    const dy = pts[i]!.y - pts[i - 1]!.y
    leg1AbsY += Math.abs(dy)
    if (dy > 0) leg1Down += dy
  }
  if (leg1AbsY > 1e-4 && leg1Down / leg1AbsY < 0.85) {
    return { ok: false, score: 0.3, reason: 'leg1-non-monotonic', vertex: V }
  }

  let leg2Right = 0
  let leg2AbsX = 0
  let leg2Up = 0
  let leg2AbsY = 0
  for (let i = bestIdx + 1; i < N; i++) {
    const dx = pts[i]!.x - pts[i - 1]!.x
    const dy = pts[i]!.y - pts[i - 1]!.y
    leg2AbsX += Math.abs(dx)
    leg2AbsY += Math.abs(dy)
    if (dx > 0) leg2Right += dx
    if (dy < 0) leg2Up += -dy
  }
  if (leg2AbsX > 1e-4 && leg2Right / leg2AbsX < 0.88) {
    return { ok: false, score: 0.3, reason: 'leg2-not-monotonic-right', vertex: V }
  }
  if (leg2AbsY > 1e-4 && leg2Up / leg2AbsY < 0.88) {
    return { ok: false, score: 0.3, reason: 'leg2-not-monotonic-up', vertex: V }
  }

  // Reject radical sign (√) horizontal top bar at end of stroke
  const tailStart = pts[Math.max(bestIdx + 1, N - 9)]!
  const tailDx = E.x - tailStart.x
  const tailDy = E.y - tailStart.y
  const tailLen = Math.hypot(tailDx, tailDy)
  if (tailLen > 1e-4 && -tailDy / tailLen < 0.24) {
    return { ok: false, score: 0.3, reason: 'flat-tail-like-radical', vertex: V }
  }

  // Compute confidence score (0.7..1.0)
  const fitScore = Math.max(0, 1 - bestErr / 0.08)
  const effScore = Math.max(0, 1 - (efficiency - 1) / 0.28)
  const score = Math.round((0.5 * fitScore + 0.5 * effScore) * 100) / 100

  return { ok: true, score, vertex: V }
}
