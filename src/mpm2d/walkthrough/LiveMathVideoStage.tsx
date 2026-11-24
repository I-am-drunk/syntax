import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import type { GeoColor, GeoLine, GeoScene } from '../types'
import { MathText } from '../components/MathText'
import type { SemaShapeName, SemaTailName } from '../mascot/Sema'
import { SemaStageRuntime } from './SemaStageRuntime'
import type { SemaPromptDisplayMode } from './semaTrackTypes'
import { buildSemaTrackForBeat } from './lessonVideoDirector'
import type {
  LiveAlgebraStep,
  LiveLensId,
  LiveMathBeat,
  LiveVisualEffect,
} from './liveMathTypes'

const SPEEDS = [0.5, 0.75, 1, 1.25, 1.5] as const

const COLOR_MAP: Record<GeoColor, string> = {
  blue: '#2563eb',
  teal: '#0d9488',
  amber: '#d97706',
  violet: '#7c3aed',
  green: '#16a34a',
  red: '#dc2626',
  muted: '#64748b',
  ink: '#1f2937',
}

const DARK_COLOR_MAP: Record<GeoColor, string> = {
  blue: '#60a5fa',
  teal: '#2dd4bf',
  amber: '#fbbf24',
  violet: '#a78bfa',
  green: '#4ade80',
  red: '#f87171',
  muted: '#9ca3af',
  ink: '#f3f4f6',
}

function clamp01(v: number): number {
  return Math.max(0, Math.min(1, v))
}

function easeOutCubic(t: number): number {
  const u = clamp01(t)
  return 1 - Math.pow(1 - u, 3)
}

function easeInOutCubic(t: number): number {
  const u = clamp01(t)
  return u < 0.5 ? 4 * u * u * u : 1 - Math.pow(-2 * u + 2, 3) / 2
}

function easeOutBack(t: number): number {
  const u = clamp01(t)
  const c1 = 1.70158
  const c3 = c1 + 1
  return 1 + c3 * Math.pow(u - 1, 3) + c1 * Math.pow(u - 1, 2)
}

function windowProgress(frac: number, startFrac = 0.08, endFrac = 0.85): number {
  if (endFrac <= startFrac) return frac >= startFrac ? 1 : 0
  return clamp01((frac - startFrac) / (endFrac - startFrac))
}

function formatClock(sec: number): string {
  const s = Math.max(0, Math.floor(sec))
  const m = Math.floor(s / 60)
  const r = s % 60
  return `${m}:${r.toString().padStart(2, '0')}`
}

/** Clip line ax + by + c = 0 to box [xMin, xMax] x [yMin, yMax] */
function clipLine(
  a: number,
  b: number,
  c: number,
  xMin: number,
  xMax: number,
  yMin: number,
  yMax: number,
): [[number, number], [number, number]] | null {
  const pts: [number, number][] = []
  const eps = 1e-6
  if (Math.abs(b) > eps) {
    for (const x of [xMin, xMax]) {
      const y = -(a * x + c) / b
      if (y >= yMin - eps && y <= yMax + eps) pts.push([x, Math.max(yMin, Math.min(yMax, y))])
    }
  }
  if (Math.abs(a) > eps) {
    for (const y of [yMin, yMax]) {
      const x = -(b * y + c) / a
      if (x >= xMin - eps && x <= xMax + eps) pts.push([Math.max(xMin, Math.min(xMax, x)), y])
    }
  }
  // Deduplicate corners
  const uniq: [number, number][] = []
  for (const p of pts) {
    if (!uniq.some(u => Math.hypot(u[0] - p[0], u[1] - p[1]) < 1e-3)) uniq.push(p)
  }
  if (uniq.length < 2) return null
  return [uniq[0]!, uniq[1]!]
}

function computeSceneBounds(scene?: GeoScene, revealScene?: GeoScene) {
  const s = revealScene ?? scene
  let xMin = s?.xMin ?? scene?.xMin ?? -6
  let xMax = s?.xMax ?? scene?.xMax ?? 8
  let yMin = s?.yMin ?? scene?.yMin ?? -5
  let yMax = s?.yMax ?? scene?.yMax ?? 7

  const allPts = [...(scene?.points ?? []), ...(revealScene?.points ?? [])]
  for (const pt of allPts) {
    if (pt.x < xMin + 1) xMin = Math.floor(pt.x - 2)
    if (pt.x > xMax - 1) xMax = Math.ceil(pt.x + 2)
    if (pt.y < yMin + 1) yMin = Math.floor(pt.y - 2)
    if (pt.y > yMax - 1) yMax = Math.ceil(pt.y + 2)
  }
  return { xMin, xMax, yMin, yMax }
}

/** Real-time animated SVG Cartesian Plane */
function LiveVisualCanvas({
  beat,
  progress,
  isDark,
}: {
  beat: LiveMathBeat
  progress: number
  isDark: boolean
}) {
  const W = 800
  const H = 450
  const padL = 56
  const padR = 40
  const padT = 36
  const padB = 56

  const palette = isDark ? DARK_COLOR_MAP : COLOR_MAP
  const col = (c?: GeoColor) => palette[c ?? 'blue']

  const bounds = useMemo(
    () => computeSceneBounds(beat.scene, beat.revealScene),
    [beat.scene, beat.revealScene],
  )

  // Maintain square grid aspect ratio inside the viewport with zero dead-space distortion
  const spanX = Math.max(2, bounds.xMax - bounds.xMin)
  const spanY = Math.max(2, bounds.yMax - bounds.yMin)
  const plotW = W - padL - padR
  const plotH = H - padT - padB
  const unitPx = Math.min(plotW / spanX, plotH / spanY)
  const usedW = unitPx * spanX
  const usedH = unitPx * spanY
  const ox = padL + (plotW - usedW) / 2
  const oy = padT + (plotH - usedH) / 2

  const toX = (x: number) => ox + (x - bounds.xMin) * unitPx
  const toY = (y: number) => oy + (bounds.yMax - y) * unitPx

  const xStep = spanX > 18 ? 2 : 1
  const yStep = spanY > 14 ? 2 : 1
  const xTicks: number[] = []
  for (let x = Math.ceil(bounds.xMin / xStep) * xStep; x <= bounds.xMax; x += xStep) xTicks.push(x)
  const yTicks: number[] = []
  for (let y = Math.ceil(bounds.yMin / yStep) * yStep; y <= bounds.yMax; y += yStep) yTicks.push(y)

  const baseScene = beat.scene
  const revealScene = beat.revealScene
  const revealEase = easeInOutCubic(windowProgress(progress, 0.22, 0.8))

  const gridStroke = isDark ? 'rgba(255,255,255,0.08)' : 'rgba(15,23,42,0.08)'
  const axisStroke = isDark ? 'rgba(255,255,255,0.42)' : 'rgba(15,23,42,0.45)'
  const tickText = isDark ? 'rgba(255,255,255,0.52)' : 'rgba(15,23,42,0.55)'
  const labelBg = isDark ? 'rgba(23,23,23,0.92)' : 'rgba(255,255,255,0.94)'

  const renderLine = (line: GeoLine, key: string, drawFrac: number) => {
    const seg = clipLine(
      line.a,
      line.b,
      line.c,
      bounds.xMin,
      bounds.xMax,
      bounds.yMin,
      bounds.yMax,
    )
    if (!seg) return null
    const [p1, p2] = seg
    const x1 = toX(p1[0])
    const y1 = toY(p1[1])
    const x2 = toX(p2[0])
    const y2 = toY(p2[1])
    const stroke = col(line.color)
    const offset = (1 - clamp01(drawFrac)) * 100
    const mx = (x1 + x2) / 2
    const my = (y1 + y2) / 2

    return (
      <g key={key} opacity={line.dim ? 0.35 : 1}>
        <line
          x1={x1}
          y1={y1}
          x2={x2}
          y2={y2}
          stroke={stroke}
          strokeWidth={line.width ?? 3}
          strokeDasharray={line.dashed ? '8 6' : '100'}
          strokeDashoffset={line.dashed ? 0 : offset}
          pathLength={100}
          strokeLinecap="round"
          opacity={line.dashed ? clamp01(drawFrac) : 1}
        />
        {line.label && drawFrac > 0.65 && (
          <g
            transform={`translate(${Math.max(85, Math.min(W - 110, mx))}, ${Math.max(30, Math.min(H - 60, my - 16))})`}
            opacity={easeOutCubic((drawFrac - 0.65) / 0.35)}
          >
            <rect
              x={-line.label.length * 4.2 - 10}
              y={-13}
              width={line.label.length * 8.4 + 20}
              height={24}
              rx={12}
              fill={labelBg}
              stroke={stroke}
              strokeWidth={1.5}
            />
            <text
              textAnchor="middle"
              dominantBaseline="central"
              fontSize={12.5}
              fontWeight={700}
              fill={stroke}
            >
              {line.label}
            </text>
          </g>
        )}
      </g>
    )
  }

  const renderEffect = (eff: LiveVisualEffect, idx: number) => {
    const rawP = windowProgress(progress, eff.startFrac ?? 0.12, eff.endFrac ?? 0.82)
    if (rawP <= 0) return null
    const p = easeInOutCubic(rawP)
    const stroke = col(eff.color ?? 'green')

    if (eff.kind === 'rise-run') {
      const fx = toX(eff.from[0])
      const fy = toY(eff.from[1])
      const tx = toX(eff.to[0])
      const ty = toY(eff.to[1])
      const pRun = easeOutCubic(clamp01(rawP / 0.48))
      const pRise = easeOutCubic(clamp01((rawP - 0.44) / 0.52))
      const curRunX = fx + (tx - fx) * pRun
      const curRiseY = fy + (ty - fy) * pRise
      const runMidX = (fx + tx) / 2
      const riseMidY = (fy + ty) / 2
      return (
        <g key={`eff-${idx}`}>
          <line
            x1={fx}
            y1={fy}
            x2={curRunX}
            y2={fy}
            stroke={stroke}
            strokeWidth={3.5}
            strokeDasharray="7 5"
            strokeLinecap="round"
          />
          {pRun > 0.5 && eff.runLabel && (
            <g transform={`translate(${runMidX}, ${fy + (ty > fy ? -18 : 20)})`} opacity={clamp01((pRun - 0.5) * 2)}>
              <rect x={-44} y={-12} width={88} height={22} rx={11} fill={labelBg} stroke={stroke} strokeWidth={1.5} />
              <text textAnchor="middle" dominantBaseline="central" fontSize={12} fontWeight={800} fill={stroke}>
                {eff.runLabel}
              </text>
            </g>
          )}
          {pRise > 0 && (
            <line
              x1={tx}
              y1={fy}
              x2={tx}
              y2={curRiseY}
              stroke={col('red')}
              strokeWidth={3.5}
              strokeDasharray="7 5"
              strokeLinecap="round"
            />
          )}
          {pRise > 0.5 && eff.riseLabel && (
            <g transform={`translate(${tx + (tx >= fx ? 48 : -48)}, ${riseMidY})`} opacity={clamp01((pRise - 0.5) * 2)}>
              <rect x={-42} y={-12} width={84} height={22} rx={11} fill={labelBg} stroke={col('red')} strokeWidth={1.5} />
              <text textAnchor="middle" dominantBaseline="central" fontSize={12} fontWeight={800} fill={col('red')}>
                {eff.riseLabel}
              </text>
            </g>
          )}
          <circle cx={fx} cy={fy} r={5.5} fill={stroke} />
          {pRise > 0.92 && <circle cx={tx} cy={ty} r={6} fill={col('red')} />}
        </g>
      )
    }

    if (eff.kind === 'rotate-90') {
      const px = toX(eff.pivot[0])
      const py = toY(eff.pivot[1])
      // In SVG screen coords, y is inverted!
      const baseAngleRad = Math.atan2(-eff.fromDir[1], eff.fromDir[0])
      const deltaRad = (-eff.angleDeg * Math.PI) / 180
      const curAngle = baseAngleRad + deltaRad * p
      const lenPx = (eff.length ?? 4.2) * unitPx

      const ghostX1 = px - Math.cos(baseAngleRad) * lenPx * 0.6
      const ghostY1 = py - Math.sin(baseAngleRad) * lenPx * 0.6
      const ghostX2 = px + Math.cos(baseAngleRad) * lenPx * 0.9
      const ghostY2 = py + Math.sin(baseAngleRad) * lenPx * 0.9

      const rotX1 = px - Math.cos(curAngle) * lenPx * 0.65
      const rotY1 = py - Math.sin(curAngle) * lenPx * 0.65
      const rotX2 = px + Math.cos(curAngle) * lenPx * 0.95
      const rotY2 = py + Math.sin(curAngle) * lenPx * 0.95

      // Arc path for sweeping 0 -> 90 deg indicator
      const arcR = Math.min(46, Math.max(28, unitPx * 0.85))
      const aStartX = px + Math.cos(baseAngleRad) * arcR
      const aStartY = py + Math.sin(baseAngleRad) * arcR
      const aEndX = px + Math.cos(curAngle) * arcR
      const aEndY = py + Math.sin(curAngle) * arcR
      const sweepFlag = deltaRad < 0 ? 0 : 1
      const degNow = Math.round(Math.abs(eff.angleDeg) * p)

      return (
        <g key={`eff-${idx}`}>
          {/* Original reference ray */}
          <line
            x1={ghostX1}
            y1={ghostY1}
            x2={ghostX2}
            y2={ghostY2}
            stroke={col('blue')}
            strokeWidth={2.5}
            strokeDasharray="6 5"
            opacity={0.55}
          />
          {/* Sweeping 90-degree wedge */}
          {p > 0.04 && (
            <path
              d={`M ${px} ${py} L ${aStartX} ${aStartY} A ${arcR} ${arcR} 0 0 ${sweepFlag} ${aEndX} ${aEndY} Z`}
              fill={stroke}
              fillOpacity={0.18}
              stroke={stroke}
              strokeWidth={2}
            />
          )}
          {/* Actively rotating perpendicular line */}
          <line
            x1={rotX1}
            y1={rotY1}
            x2={rotX2}
            y2={rotY2}
            stroke={stroke}
            strokeWidth={4}
            strokeLinecap="round"
          />
          <circle cx={px} cy={py} r={6} fill={stroke} stroke={labelBg} strokeWidth={2} />
          {/* Live angle readout pill */}
          <g transform={`translate(${px + Math.cos(baseAngleRad + deltaRad * 0.5) * (arcR + 28)}, ${py + Math.sin(baseAngleRad + deltaRad * 0.5) * (arcR + 28)})`}>
            <rect x={-30} y={-12} width={60} height={23} rx={11} fill={labelBg} stroke={stroke} strokeWidth={1.7} />
            <text textAnchor="middle" dominantBaseline="central" fontSize={12.5} fontWeight={800} fill={stroke}>
              {degNow}°
            </text>
          </g>
          {eff.toLabel && p > 0.72 && (
            <g transform={`translate(${rotX2}, ${Math.max(28, rotY2 - 18)})`} opacity={clamp01((p - 0.72) / 0.28)}>
              <rect x={-48} y={-13} width={96} height={24} rx={12} fill={stroke} />
              <text textAnchor="middle" dominantBaseline="central" fontSize={12.5} fontWeight={800} fill="#ffffff">
                {eff.toLabel}
              </text>
            </g>
          )}
        </g>
      )
    }

    if (eff.kind === 'slide-line') {
      const cCur = eff.cFrom + (eff.cTo - eff.cFrom) * p
      const startSeg = clipLine(eff.a, eff.b, eff.cFrom, bounds.xMin, bounds.xMax, bounds.yMin, bounds.yMax)
      const curSeg = clipLine(eff.a, eff.b, cCur, bounds.xMin, bounds.xMax, bounds.yMin, bounds.yMax)
      const tx = toX(eff.targetPoint[0])
      const ty = toY(eff.targetPoint[1])
      const locked = p > 0.92
      return (
        <g key={`eff-${idx}`}>
          {startSeg && (
            <line
              x1={toX(startSeg[0][0])}
              y1={toY(startSeg[0][1])}
              x2={toX(startSeg[1][0])}
              y2={toY(startSeg[1][1])}
              stroke={stroke}
              strokeWidth={2}
              strokeDasharray="6 6"
              opacity={0.32}
            />
          )}
          {curSeg && (
            <line
              x1={toX(curSeg[0][0])}
              y1={toY(curSeg[0][1])}
              x2={toX(curSeg[1][0])}
              y2={toY(curSeg[1][1])}
              stroke={stroke}
              strokeWidth={4}
              strokeLinecap="round"
            />
          )}
          {locked && (
            <circle
              cx={tx}
              cy={ty}
              r={10 + easeOutCubic((p - 0.92) / 0.08) * 16}
              fill="none"
              stroke={stroke}
              strokeWidth={2.5}
              opacity={1 - ((p - 0.92) / 0.08) * 0.7}
            />
          )}
          <circle cx={tx} cy={ty} r={7} fill={col('teal')} stroke={labelBg} strokeWidth={2.2} />
        </g>
      )
    }

    if (eff.kind === 'midpoint-converge') {
      const ax = toX(eff.a[0])
      const ay = toY(eff.a[1])
      const bx = toX(eff.b[0])
      const by = toY(eff.b[1])
      const mx = (ax + bx) / 2
      const my = (ay + by) / 2
      const p1x = ax + (mx - ax) * p
      const p1y = ay + (my - ay) * p
      const p2x = bx + (mx - bx) * p
      const p2y = by + (my - by) * p
      const midXVal = Number(((eff.a[0] + eff.b[0]) / 2).toFixed(2))
      const midYVal = Number(((eff.a[1] + eff.b[1]) / 2).toFixed(2))
      const label = eff.hideAnswer ? 'M = (?, ?)' : (eff.label ?? `M(${midXVal}, ${midYVal})`)
      return (
        <g key={`eff-${idx}`}>
          <line x1={ax} y1={ay} x2={bx} y2={by} stroke={stroke} strokeWidth={2.5} strokeDasharray="6 5" opacity={0.5} />
          <line x1={ax} y1={ay} x2={p1x} y2={p1y} stroke={stroke} strokeWidth={4} strokeLinecap="round" />
          <line x1={bx} y1={by} x2={p2x} y2={p2y} stroke={stroke} strokeWidth={4} strokeLinecap="round" />
          <circle cx={p1x} cy={p1y} r={6} fill={stroke} />
          <circle cx={p2x} cy={p2y} r={6} fill={stroke} />
          {p > 0.84 && (
            <g transform={`translate(${mx}, ${my - 22})`} opacity={easeOutCubic((p - 0.84) / 0.16)}>
              <rect x={-48} y={-13} width={96} height={24} rx={12} fill={stroke} />
              <text textAnchor="middle" dominantBaseline="central" fontSize={12.5} fontWeight={800} fill="#ffffff">
                {label}
              </text>
            </g>
          )}
        </g>
      )
    }

    if (eff.kind === 'pythagoras-legs') {
      const ax = toX(eff.a[0])
      const ay = toY(eff.a[1])
      const bx = toX(eff.b[0])
      const by = toY(eff.b[1])
      const p1 = easeOutCubic(clamp01(rawP / 0.36))
      const p2 = easeOutCubic(clamp01((rawP - 0.32) / 0.34))
      const p3 = easeOutCubic(clamp01((rawP - 0.64) / 0.36))
      return (
        <g key={`eff-${idx}`}>
          <line x1={ax} y1={ay} x2={ax + (bx - ax) * p1} y2={ay} stroke={stroke} strokeWidth={3.5} strokeLinecap="round" />
          {p2 > 0 && (
            <line x1={bx} y1={ay} x2={bx} y2={ay + (by - ay) * p2} stroke={col('violet')} strokeWidth={3.5} strokeLinecap="round" />
          )}
          {p3 > 0 && (
            <line
              x1={ax}
              y1={ay}
              x2={ax + (bx - ax) * p3}
              y2={ay + (by - ay) * p3}
              stroke={col('green')}
              strokeWidth={4}
              strokeLinecap="round"
            />
          )}
          {eff.dxLabel && p1 > 0.6 && (
            <g transform={`translate(${(ax + bx) / 2}, ${ay + (by > ay ? -16 : 18)})`}>
              <rect x={-34} y={-11} width={68} height={21} rx={10} fill={labelBg} stroke={stroke} strokeWidth={1.4} />
              <text textAnchor="middle" dominantBaseline="central" fontSize={11.5} fontWeight={800} fill={stroke}>
                {eff.dxLabel}
              </text>
            </g>
          )}
          {eff.dyLabel && p2 > 0.6 && (
            <g transform={`translate(${bx + (bx >= ax ? 40 : -40)}, ${(ay + by) / 2})`}>
              <rect x={-34} y={-11} width={68} height={21} rx={10} fill={labelBg} stroke={col('violet')} strokeWidth={1.4} />
              <text textAnchor="middle" dominantBaseline="central" fontSize={11.5} fontWeight={800} fill={col('violet')}>
                {eff.dyLabel}
              </text>
            </g>
          )}
          {eff.hypLabel && p3 > 0.72 && (
            <g transform={`translate(${(ax + bx) / 2}, ${(ay + by) / 2 - 16})`}>
              <rect x={-40} y={-12} width={80} height={22} rx={11} fill={col('green')} />
              <text textAnchor="middle" dominantBaseline="central" fontSize={12} fontWeight={800} fill="#ffffff">
                {eff.hypLabel}
              </text>
            </g>
          )}
        </g>
      )
    }

    if (eff.kind === 'circle-sweep') {
      const cx = toX(eff.cx)
      const cy = toY(eff.cy)
      const rPx = eff.r * unitPx
      const circum = 2 * Math.PI * rPx
      const ang = -p * Math.PI * 2
      const rx = cx + Math.cos(ang) * rPx
      const ry = cy + Math.sin(ang) * rPx
      return (
        <g key={`eff-${idx}`}>
          <circle
            cx={cx}
            cy={cy}
            r={rPx}
            fill={stroke}
            fillOpacity={0.07 * p}
            stroke={stroke}
            strokeWidth={3.5}
            strokeDasharray={circum}
            strokeDashoffset={circum * (1 - p)}
          />
          <line x1={cx} y1={cy} x2={rx} y2={ry} stroke={col('amber')} strokeWidth={2.8} strokeLinecap="round" />
          <circle cx={cx} cy={cy} r={5} fill={col('amber')} />
          <circle cx={rx} cy={ry} r={5.5} fill={stroke} />
          {eff.radiusLabel && p > 0.35 && (
            <g transform={`translate(${(cx + rx) / 2}, ${(cy + ry) / 2 - 14})`}>
              <rect x={-34} y={-11} width={68} height={21} rx={10} fill={labelBg} stroke={col('amber')} strokeWidth={1.4} />
              <text textAnchor="middle" dominantBaseline="central" fontSize={11.5} fontWeight={800} fill={col('amber')}>
                {eff.radiusLabel}
              </text>
            </g>
          )}
        </g>
      )
    }

    if (eff.kind === 'poi-pulse' || eff.kind === 'highlight-point') {
      const px = toX(eff.point[0])
      const py = toY(eff.point[1])
      const pulse = (rawP * 2.2) % 1
      return (
        <g key={`eff-${idx}`}>
          <circle
            cx={px}
            cy={py}
            r={8 + pulse * 22}
            fill="none"
            stroke={stroke}
            strokeWidth={2.5}
            opacity={(1 - pulse) * 0.85}
          />
          <circle cx={px} cy={py} r={6.5} fill={stroke} stroke={labelBg} strokeWidth={2} />
          {eff.label && (
            <g transform={`translate(${px}, ${py - 22})`} opacity={easeOutCubic(clamp01(rawP * 2))}>
              <rect
                x={-eff.label.length * 4 - 10}
                y={-12}
                width={eff.label.length * 8 + 20}
                height={22}
                rx={11}
                fill={stroke}
              />
              <text textAnchor="middle" dominantBaseline="central" fontSize={12} fontWeight={800} fill="#ffffff">
                {eff.label}
              </text>
            </g>
          )}
        </g>
      )
    }

    return null
  }

  const xAxisY = toY(0)
  const yAxisX = toX(0)
  const showXAxis = bounds.yMin <= 0 && bounds.yMax >= 0
  const showYAxis = bounds.xMin <= 0 && bounds.xMax >= 0

  return (
    <svg
      className="lm-visual-svg"
      viewBox={`0 0 ${W} ${H}`}
      preserveAspectRatio="xMidYMid meet"
      role="img"
      aria-label={beat.title}
    >
      {/* Clean Cartesian grid */}
      <g>
        {xTicks.map(x => {
          const px = toX(x)
          return (
            <g key={`gx-${x}`}>
              <line x1={px} y1={oy} x2={px} y2={oy + usedH} stroke={gridStroke} strokeWidth={1} />
              {x !== 0 && (
                <text
                  x={px}
                  y={showXAxis ? Math.min(H - 18, xAxisY + 15) : oy + usedH + 16}
                  textAnchor="middle"
                  fontSize={11}
                  fill={tickText}
                >
                  {x}
                </text>
              )}
            </g>
          )
        })}
        {yTicks.map(y => {
          const py = toY(y)
          return (
            <g key={`gy-${y}`}>
              <line x1={ox} y1={py} x2={ox + usedW} y2={py} stroke={gridStroke} strokeWidth={1} />
              {y !== 0 && (
                <text
                  x={showYAxis ? Math.max(18, yAxisX - 10) : ox - 10}
                  y={py + 4}
                  textAnchor="end"
                  fontSize={11}
                  fill={tickText}
                >
                  {y}
                </text>
              )}
            </g>
          )
        })}
      </g>

      {/* Main x and y axes */}
      {showXAxis && (
        <line x1={ox - 10} y1={xAxisY} x2={ox + usedW + 10} y2={xAxisY} stroke={axisStroke} strokeWidth={1.8} />
      )}
      {showYAxis && (
        <line x1={yAxisX} y1={oy - 10} x2={yAxisX} y2={oy + usedH + 10} stroke={axisStroke} strokeWidth={1.8} />
      )}

      {/* Polygons */}
      {(baseScene?.polygons ?? []).map((poly, i) => (
        <polygon
          key={`bp-${i}`}
          points={poly.vertices.map(v => `${toX(v[0])},${toY(v[1])}`).join(' ')}
          fill={col(poly.color)}
          fillOpacity={poly.fillOpacity ?? 0.12}
          stroke={col(poly.color)}
          strokeWidth={2}
        />
      ))}
      {(revealScene?.polygons ?? []).map((poly, i) => (
        <polygon
          key={`rp-${i}`}
          points={poly.vertices.map(v => `${toX(v[0])},${toY(v[1])}`).join(' ')}
          fill={col(poly.color)}
          fillOpacity={(poly.fillOpacity ?? 0.14) * revealEase}
          stroke={col(poly.color)}
          strokeWidth={2.2}
          opacity={revealEase}
        />
      ))}

      {/* Base circles */}
      {(baseScene?.circles ?? []).map((c, i) => (
        <circle
          key={`bc-${i}`}
          cx={toX(c.cx)}
          cy={toY(c.cy)}
          r={c.r * unitPx}
          fill={col(c.color)}
          fillOpacity={0.05}
          stroke={col(c.color)}
          strokeWidth={2.5}
          strokeDasharray={c.dashed ? '7 5' : undefined}
        />
      ))}

      {/* Base lines & revealed lines */}
      {(baseScene?.lines ?? []).map((l, i) => renderLine(l, `bl-${i}`, easeOutCubic(clamp01(progress / 0.25))))}
      {(revealScene?.lines ?? [])
        .filter(
          rl =>
            !(baseScene?.lines ?? []).some(
              bl => bl.a === rl.a && bl.b === rl.b && bl.c === rl.c,
            ),
        )
        .map((l, i) => renderLine(l, `rl-${i}`, revealEase))}

      {/* Base segments & revealed segments */}
      {(baseScene?.segments ?? []).map((seg, i) => (
        <line
          key={`bs-${i}`}
          x1={toX(seg.from[0])}
          y1={toY(seg.from[1])}
          x2={toX(seg.to[0])}
          y2={toY(seg.to[1])}
          stroke={col(seg.color)}
          strokeWidth={seg.width ?? 3}
          strokeDasharray={seg.dashed ? '7 5' : undefined}
          strokeLinecap="round"
        />
      ))}
      {(revealScene?.segments ?? [])
        .filter(
          rs =>
            !(baseScene?.segments ?? []).some(
              bs =>
                bs.from[0] === rs.from[0] &&
                bs.from[1] === rs.from[1] &&
                bs.to[0] === rs.to[0] &&
                bs.to[1] === rs.to[1],
            ),
        )
        .map((seg, i) => {
          const x1 = toX(seg.from[0])
          const y1 = toY(seg.from[1])
          const x2 = toX(seg.to[0])
          const y2 = toY(seg.to[1])
          return (
            <line
              key={`rs-${i}`}
              x1={x1}
              y1={y1}
              x2={x1 + (x2 - x1) * revealEase}
              y2={y1 + (y2 - y1) * revealEase}
              stroke={col(seg.color)}
              strokeWidth={seg.width ?? 3.4}
              strokeDasharray={seg.dashed ? '7 5' : undefined}
              strokeLinecap="round"
              opacity={revealEase > 0.02 ? 1 : 0}
            />
          )
        })}

      {/* Live Choreographed Visual Effects */}
      {(beat.visualEffects ?? []).map((eff, idx) => renderEffect(eff, idx))}

      {/* Base & Revealed Points */}
      {[...(baseScene?.points ?? []), ...(revealScene?.points ?? [])]
        .filter((pt, idx, arr) => arr.findIndex(o => o.id === pt.id) === idx)
        .map((pt, i) => {
          const isRevealOnly = !(baseScene?.points ?? []).some(bp => bp.id === pt.id)
          const ptScale = isRevealOnly
            ? easeOutBack(revealEase)
            : easeOutBack(clamp01((progress - i * 0.04) / 0.22))
          if (ptScale <= 0.02) return null
          const px = toX(pt.x)
          const py = toY(pt.y)
          const c = col(pt.color ?? 'blue')
          const lbl = pt.label ?? (pt.showCoords ? `(${pt.x}, ${pt.y})` : '')
          return (
            <g key={`pt-${pt.id}`} transform={`translate(${px}, ${py}) scale(${ptScale})`}>
              <circle r={pt.emphasis ? 7 : 5.5} fill={c} stroke={labelBg} strokeWidth={2.2} />
              {lbl && (
                <g transform="translate(0, -19)">
                  <rect
                    x={-lbl.length * 3.8 - 8}
                    y={-11}
                    width={lbl.length * 7.6 + 16}
                    height={20}
                    rx={10}
                    fill={labelBg}
                    stroke={c}
                    strokeWidth={1.3}
                  />
                  <text textAnchor="middle" dominantBaseline="central" fontSize={11.5} fontWeight={800} fill={c}>
                    {lbl}
                  </text>
                </g>
              )}
            </g>
          )
        })}
    </svg>
  )
}

/** Real-time Kinetic Manim-style Algebra Board */
function LiveAlgebraCanvas({
  beat,
  progress,
}: {
  beat: LiveMathBeat
  progress: number
}) {
  const steps = beat.algebraSteps ?? []

  const renderStep = (step: LiveAlgebraStep, idx: number) => {
    const rawP = windowProgress(progress, step.startFrac ?? 0.08, step.endFrac ?? 0.9)
    const visible = rawP > 0.01
    const enterEase = easeOutCubic(clamp01(rawP / 0.25))
    const accent = step.kind === 'orbital-flip' || step.kind === 'substitute-drop' ? 'green' : (step.accent ?? 'blue')

    if (!visible) {
      return (
        <div key={`alg-ph-${idx}`} className="lm-alg-card is-pending" aria-hidden="true" />
      )
    }

    if (step.kind === 'parabolic-jump') {
      // Phase 0..0.22: settle; 0.22..0.78: parabolic arc flight + mid-air sign flip; 0.78..1: landed
      const flyP = easeInOutCubic(clamp01((rawP - 0.18) / 0.58))
      const arcY = -Math.sin(Math.PI * flyP) * 44
      const shiftX = flyP * 145
      const flipped = flyP > 0.5
      const tilt = Math.sin(Math.PI * flyP) * (flipped ? -10 : 10)
      return (
        <div
          key={`alg-${idx}`}
          className={`lm-alg-card accent-${accent}`}
          style={{ opacity: enterEase, transform: `translateY(${(1 - enterEase) * 10}px)` }}
        >
          {step.tag && <div className="lm-alg-tag">{step.tag}</div>}
          <div className="lm-jump-stage">
            <span className="lm-jump-term">{step.leftFixed}</span>
            <span
              className={`lm-jump-flyer${flipped ? ' is-flipped' : ''}`}
              style={{
                transform: `translate3d(${shiftX.toFixed(1)}px, ${arcY.toFixed(1)}px, 0) rotate(${tilt.toFixed(1)}deg) scale(${(1 + Math.sin(Math.PI * flyP) * 0.14).toFixed(3)})`,
              }}
            >
              {flipped ? step.landedTerm : step.movingTerm}
            </span>
            <span className="lm-jump-eq">=</span>
            <span
              className="lm-jump-term"
              style={{ transform: `translateX(${(flyP * 54).toFixed(1)}px)` }}
            >
              {step.rightFixed}
            </span>
          </div>
          {step.note && <div className="lm-alg-note">{step.note}</div>}
        </div>
      )
    }

    if (step.kind === 'orbital-flip') {
      // Phase 0..0.2: hold start; 0.2..0.78: 180 deg circular orbital swap + spinning sign!
      const orbitP = easeInOutCubic(clamp01((rawP - 0.18) / 0.6))
      const theta = orbitP * Math.PI
      const rY = 21
      const rX = 32
      // Top orbits right-and-down; Bottom orbits left-and-up
      const numX = Math.sin(theta) * rX
      const numY = -Math.cos(theta) * rY
      const denX = -Math.sin(theta) * rX
      const denY = Math.cos(theta) * rY
      const signFlipped = orbitP > 0.5
      const signRot = orbitP * 180
      const activeSign = signFlipped ? step.toSign : step.fromSign

      return (
        <div
          key={`alg-${idx}`}
          className="lm-alg-card accent-green"
          style={{ opacity: enterEase, transform: `translateY(${(1 - enterEase) * 10}px)` }}
        >
          {step.tag && <div className="lm-alg-tag">{step.tag}</div>}
          <div className="lm-orbital-row">
            <div className="lm-orbital-label">
              {signFlipped ? (step.rightLabel ?? 'm⊥') : (step.leftLabel ?? 'm₁')} =
            </div>
            <div
              className={`lm-orbital-sign${signFlipped ? ' is-flipped' : ''}`}
              style={{
                transform: `rotate(${signRot.toFixed(1)}deg) scale(${(1 + Math.sin(theta) * 0.35).toFixed(3)})`,
              }}
            >
              {activeSign === '-' ? '−' : activeSign === '+' ? '+' : ''}
            </div>
            <div className="lm-orbital-frac">
              <span
                className="lm-orbital-token is-num"
                style={{
                  transform: `translate3d(${numX.toFixed(1)}px, ${numY.toFixed(1)}px, 0)`,
                }}
              >
                {step.fromNum}
              </span>
              <span className="lm-orbital-bar" />
              <span
                className="lm-orbital-token is-den"
                style={{
                  transform: `translate3d(${denX.toFixed(1)}px, ${denY.toFixed(1)}px, 0)`,
                }}
              >
                {step.fromDen}
              </span>
            </div>
          </div>
          {step.note && <div className="lm-alg-note">{step.note}</div>}
        </div>
      )
    }

    if (step.kind === 'substitute-drop') {
      const subP = easeOutCubic(clamp01((rawP - 0.25) / 0.35))
      const simpP = easeOutCubic(clamp01((rawP - 0.62) / 0.32))
      return (
        <div
          key={`alg-${idx}`}
          className="lm-alg-card accent-teal"
          style={{ opacity: enterEase, transform: `translateY(${(1 - enterEase) * 10}px)` }}
        >
          {step.tag && <div className="lm-alg-tag">{step.tag}</div>}
          <div className="lm-sub-chips">
            {step.givens.map((g, gi) => (
              <span key={gi} className={`lm-given-chip color-${g.color}`}>
                {g.label} = <MathText text={g.value} />
              </span>
            ))}
          </div>
          <div className="lm-alg-math is-muted">
            <MathText text={step.template} />
          </div>
          {subP > 0.02 && (
            <div
              className="lm-alg-math is-sub"
              style={{ opacity: subP, transform: `translateY(${(1 - subP) * -10}px)` }}
            >
              <MathText text={step.substituted} />
            </div>
          )}
          {step.simplified && simpP > 0.02 && (
            <div
              className="lm-alg-math is-strong"
              style={{ opacity: simpP, transform: `translateY(${(1 - simpP) * 8}px)` }}
            >
              <MathText text={step.simplified} />
            </div>
          )}
          {step.note && <div className="lm-alg-note">{step.note}</div>}
        </div>
      )
    }

    if (step.kind === 'divide-all') {
      const divP = easeOutCubic(clamp01((rawP - 0.36) / 0.45))
      return (
        <div
          key={`alg-${idx}`}
          className={`lm-alg-card accent-${accent}`}
          style={{ opacity: enterEase, transform: `translateY(${(1 - enterEase) * 10}px)` }}
        >
          {step.tag && <div className="lm-alg-tag">{step.tag}</div>}
          <div className="lm-divide-row">
            <span className="lm-alg-math is-muted">
              <MathText text={step.before} />
            </span>
            <span className="lm-divide-badge" style={{ opacity: clamp01(rawP * 2.5) }}>
              ÷ {step.divisor}
            </span>
            <span
              className="lm-alg-math is-strong"
              style={{ opacity: divP, transform: `translateX(${(1 - divP) * -12}px)` }}
            >
              <MathText text={step.after} />
            </span>
          </div>
          {step.note && <div className="lm-alg-note">{step.note}</div>}
        </div>
      )
    }

    if (step.kind === 'result-pill') {
      const pop = easeOutBack(clamp01(rawP / 0.4))
      return (
        <div
          key={`alg-${idx}`}
          className={`lm-result-pill accent-${accent}`}
          style={{ opacity: clamp01(rawP * 3), transform: `scale(${(0.92 + pop * 0.08).toFixed(3)})` }}
        >
          {step.tag && <span className="lm-result-tag">{step.tag}</span>}
          <div className="lm-result-math">
            <MathText text={step.math} />
          </div>
          {step.note && <div className="lm-result-note">{step.note}</div>}
        </div>
      )
    }

    // Default: 'write'
    return (
      <div
        key={`alg-${idx}`}
        className={`lm-alg-card accent-${accent}`}
        style={{ opacity: enterEase, transform: `translateY(${(1 - enterEase) * 10}px)` }}
      >
        {step.tag && <div className="lm-alg-tag">{step.tag}</div>}
        <div className="lm-alg-math">
          <MathText text={step.math} />
        </div>
        {step.note && <div className="lm-alg-note">{step.note}</div>}
      </div>
    )
  }

  return (
    <div className="lm-algebra-board">
      {beat.givenChips && beat.givenChips.length > 0 && (
        <div className="lm-given-strip">
          {beat.givenChips.map((chip, ci) => (
            <span key={ci} className={`lm-given-chip color-${chip.color}`}>
              <MathText text={chip.label} />
            </span>
          ))}
        </div>
      )}
      <div className="lm-alg-stack">{steps.map((s, idx) => renderStep(s, idx))}</div>
    </div>
  )
}

export function LiveMathVideoStage({
  beats,
  lensId,
  beatIndex,
  onBeatIndexChange,
  voiceOn,
  onToggleVoice,
  promptMode,
  semaShape,
  semaTail,
  isDark,
  autoPlay = true,
  compact = false,
  onPlayingChange,
}: {
  beats: LiveMathBeat[]
  lensId: LiveLensId
  beatIndex: number
  onBeatIndexChange: (nextIndex: number) => void
  voiceOn: boolean
  onToggleVoice: () => void
  promptMode: SemaPromptDisplayMode
  semaShape: SemaShapeName
  semaTail: SemaTailName
  isDark: boolean
  autoPlay?: boolean
  compact?: boolean
  onPlayingChange?: (playing: boolean) => void
}) {
  const safeIdx = Math.max(0, Math.min(beatIndex, Math.max(0, beats.length - 1)))
  const beat = beats[safeIdx] ?? beats[0]!

  const [playing, setPlaying] = useState(autoPlay)
  const [speedIdx, setSpeedIdx] = useState(2) // 1x
  const speed = SPEEDS[speedIdx] ?? 1
  const [timeInBeat, setTimeInBeat] = useState(0)
  const timeInBeatRef = useRef(0)
  const playingRef = useRef(playing)
  playingRef.current = playing

  // Precompute chapter start times across the full lens timeline
  const timeline = useMemo(() => {
    let acc = 0
    const chapters = beats.map(b => {
      const start = acc
      acc += b.durationSec
      return { id: b.id, start, end: acc, duration: b.durationSec }
    })
    return { chapters, totalDuration: Math.max(1, acc) }
  }, [beats])

  const semaTrack = useMemo(
    () => buildSemaTrackForBeat(beat, beat.scene ? 'visual' : lensId),
    [beat, lensId],
  )

  // Reset beat clock whenever beat changes
  useEffect(() => {
    timeInBeatRef.current = 0
    setTimeInBeat(0)
  }, [beat.id, lensId])

  useEffect(() => {
    onPlayingChange?.(playing)
  }, [playing, onPlayingChange])

  // Optional synced Web Speech synthesis when Voice is ON
  useEffect(() => {
    if (typeof window === 'undefined' || !('speechSynthesis' in window)) return
    const synth = window.speechSynthesis
    synth.cancel()
    if (!voiceOn || !playing) return

    const utt = new SpeechSynthesisUtterance(
      beat.narration.replace(/\*\*/g, '').replace(/`([^`]+)`/g, '$1'),
    )
    utt.rate = Math.max(0.75, Math.min(1.45, speed * 0.98))
    utt.pitch = 1.02
    try {
      synth.speak(utt)
    } catch {
      // ignore autoplay speech blocks
    }
    return () => {
      try {
        synth.cancel()
      } catch {
        // ignore
      }
    }
  }, [beat.id, beat.narration, voiceOn, playing, speed])

  // 144Hz real-time procedural clock loop
  useEffect(() => {
    if (!playing) return
    let rafId = 0
    let lastMs = 0

    const tick = (nowMs: number) => {
      if (lastMs === 0) lastMs = nowMs
      const dt = Math.min(0.05, (nowMs - lastMs) / 1000) * speed
      lastMs = nowMs

      const nextT = timeInBeatRef.current + dt
      if (nextT >= beat.durationSec) {
        if (safeIdx < beats.length - 1) {
          timeInBeatRef.current = 0
          setTimeInBeat(0)
          onBeatIndexChange(safeIdx + 1)
          return
        } else {
          timeInBeatRef.current = beat.durationSec
          setTimeInBeat(beat.durationSec)
          setPlaying(false)
          return
        }
      }

      timeInBeatRef.current = nextT
      setTimeInBeat(nextT)
      rafId = window.requestAnimationFrame(tick)
    }

    rafId = window.requestAnimationFrame(tick)
    return () => window.cancelAnimationFrame(rafId)
  }, [playing, speed, beat.durationSec, safeIdx, beats.length, onBeatIndexChange])

  const getCurrentTime = useCallback(() => timeInBeatRef.current, [])

  const togglePlay = () => {
    if (!playing && safeIdx === beats.length - 1 && timeInBeatRef.current >= beat.durationSec - 0.05) {
      timeInBeatRef.current = 0
      setTimeInBeat(0)
      onBeatIndexChange(0)
      setPlaying(true)
      return
    }
    setPlaying(p => !p)
  }

  const handleReplay = () => {
    timeInBeatRef.current = 0
    setTimeInBeat(0)
    setPlaying(true)
  }

  const currentGlobalTime = (timeline.chapters[safeIdx]?.start ?? 0) + timeInBeat
  const globalFrac = clamp01(currentGlobalTime / timeline.totalDuration)
  const beatProgress = clamp01(timeInBeat / Math.max(0.5, beat.durationSec))

  const handleScrub = (e: React.PointerEvent<HTMLDivElement>) => {
    const rect = e.currentTarget.getBoundingClientRect()
    const frac = clamp01((e.clientX - rect.left) / Math.max(1, rect.width))
    const targetGlobal = frac * timeline.totalDuration
    let targetIdx = timeline.chapters.length - 1
    for (let i = 0; i < timeline.chapters.length; i++) {
      if (targetGlobal < timeline.chapters[i]!.end) {
        targetIdx = i
        break
      }
    }
    const localT = Math.max(0, targetGlobal - (timeline.chapters[targetIdx]?.start ?? 0))
    timeInBeatRef.current = localT
    setTimeInBeat(localT)
    if (targetIdx !== safeIdx) onBeatIndexChange(targetIdx)
  }

  const showVisual = Boolean(beat.scene || beat.revealScene)

  return (
    <div className={`lm-stage-root${compact ? ' is-compact' : ''}`}>
      {/* Full-bleed responsive live math canvas (0 letterboxing, 0 stretching!) */}
      <div
        className="lm-canvas-viewport"
        onClick={togglePlay}
        role="region"
        aria-label={`Animated math video: ${beat.title}`}
      >
        {/* Subtle floating beat title badge */}
        <div className="lm-stage-badge-row" onClick={e => e.stopPropagation()}>
          {beat.badge && <span className="lm-beat-pill">{beat.badge}</span>}
          <span className="lm-beat-title">{beat.title}</span>
          {beat.summaryMath && (
            <span className="lm-beat-summary">
              <MathText text={beat.summaryMath} />
            </span>
          )}
        </div>

        {/* Procedural 144Hz Visual or Kinetic Algebra Surface */}
        <div className="lm-surface-body">
          {showVisual ? (
            <LiveVisualCanvas beat={beat} progress={beatProgress} isDark={isDark} />
          ) : (
            <LiveAlgebraCanvas beat={beat} progress={beatProgress} />
          )}
        </div>

        {/* Interactive Sema + Prioritized Always-Visible Synced Subtitles */}
        <SemaStageRuntime
          track={semaTrack}
          getCurrentTime={getCurrentTime}
          playing={playing}
          voiceOn={voiceOn}
          displayMode={promptMode}
          userShape={semaShape}
          userTail={semaTail}
          fallbackCaption={beat.narration}
        />

        {/* Big subtle play emblem only when paused */}
        {!playing && (
          <button
            type="button"
            className="lm-center-play-btn"
            aria-label="Play math animation"
            onClick={e => {
              e.stopPropagation()
              togglePlay()
            }}
          >
            <svg width="26" height="26" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
              <polygon points="6,4 20,12 6,20" />
            </svg>
          </button>
        )}
      </div>

      {/* Dedicated non-overlapping video transport bar */}
      <div className="lm-transport-bar" onClick={e => e.stopPropagation()}>
        <button
          type="button"
          className="lm-ctrl-btn is-play"
          aria-label={playing ? 'Pause animation' : 'Play animation'}
          title={playing ? 'Pause' : 'Play'}
          onClick={togglePlay}
        >
          {playing ? (
            <svg width="15" height="15" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
              <rect x="6" y="4" width="4.5" height="16" rx="1.2" />
              <rect x="13.5" y="4" width="4.5" height="16" rx="1.2" />
            </svg>
          ) : (
            <svg width="15" height="15" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
              <polygon points="6,4 20,12 6,20" />
            </svg>
          )}
        </button>

        <button
          type="button"
          className="lm-ctrl-btn"
          aria-label="Replay step"
          title="Replay current step"
          onClick={handleReplay}
        >
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.3" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
            <path d="M3 12a9 9 0 1 0 3-6.7L3 8" />
            <polyline points="3 3 3 8 8 8" />
          </svg>
        </button>

        {/* Interactive chaptered scrubber */}
        <div
          className="lm-scrubber"
          role="slider"
          tabIndex={0}
          aria-label="Video timeline"
          aria-valuemin={0}
          aria-valuemax={Math.round(timeline.totalDuration)}
          aria-valuenow={Math.round(currentGlobalTime)}
          onPointerDown={e => {
            e.currentTarget.setPointerCapture(e.pointerId)
            handleScrub(e)
          }}
          onPointerMove={e => {
            if (e.buttons === 1) handleScrub(e)
          }}
        >
          <div className="lm-scrubber-track">
            <div className="lm-scrubber-fill" style={{ width: `${(globalFrac * 100).toFixed(2)}%` }} />
            {timeline.chapters.slice(1).map(ch => (
              <span
                key={ch.id}
                className="lm-scrubber-marker"
                style={{ left: `${((ch.start / timeline.totalDuration) * 100).toFixed(2)}%` }}
              />
            ))}
          </div>
          <span className="lm-scrubber-thumb" style={{ left: `${(globalFrac * 100).toFixed(2)}%` }} />
        </div>

        <span className="lm-time-readout">
          {formatClock(currentGlobalTime)} / {formatClock(timeline.totalDuration)}
        </span>

        <button
          type="button"
          className="lm-ctrl-pill"
          title="Change playback speed"
          onClick={() => setSpeedIdx(i => (i + 1) % SPEEDS.length)}
        >
          {speed}×
        </button>

        <button
          type="button"
          className={`lm-ctrl-btn${voiceOn ? ' is-active' : ''}`}
          aria-label={voiceOn ? 'Mute narration voice' : 'Turn on narration voice'}
          title={voiceOn ? 'Voice narration ON' : 'Voice narration OFF'}
          onClick={onToggleVoice}
        >
          {voiceOn ? (
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
              <polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5" />
              <path d="M15.5 8.5a5 5 0 0 1 0 7" />
              <path d="M19 5a9 9 0 0 1 0 14" />
            </svg>
          ) : (
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
              <polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5" />
              <line x1="23" y1="9" x2="17" y2="15" />
              <line x1="17" y1="9" x2="23" y2="15" />
            </svg>
          )}
        </button>
      </div>
    </div>
  )
}
