import { BrilliantGraph } from '../graph/BrilliantGraph'
import { MathText } from '../components/MathText'
import {
  GRAPH_COLORS,
  easeInOut,
  easeOut,
  getStagePlugin,
  lerp,
  registerStagePlugin,
  seg,
  type AlgebraTimelineConfig,
  type GraphTimelineConfig,
  type GraphTrack,
} from './animationEngine'
import type { WalkthroughBeat } from './walkthroughData'

/* ============================================================================
   Built-in Plugin #1: 'graph-timeline' (Declarative Animation Graph System)
   ============================================================================ */

const SVG_W = 420
const SVG_H = 270
const PAD_L = 34
const PAD_R = 22
const PAD_T = 20
const PAD_B = 26

function createMapper(bounds: GraphTimelineConfig['bounds']) {
  const { xMin, xMax, yMin, yMax } = bounds
  const innerW = SVG_W - PAD_L - PAD_R
  const innerH = SVG_H - PAD_T - PAD_B
  const mx = (x: number) => PAD_L + ((x - xMin) / (xMax - xMin)) * innerW
  const my = (y: number) => PAD_T + ((yMax - y) / (yMax - yMin)) * innerH
  return { mx, my, xMin, xMax, yMin, yMax }
}

function GridBase({ bounds }: { bounds: GraphTimelineConfig['bounds'] }) {
  const { mx, my, xMin, xMax, yMin, yMax } = createMapper(bounds)
  const spanX = xMax - xMin
  const spanY = yMax - yMin
  const stepX = bounds.step ?? (spanX > 12 ? 2 : 1)
  const stepY = bounds.step ?? (spanY > 12 ? 2 : 1)

  const xs: number[] = []
  for (let x = Math.ceil(xMin / stepX) * stepX; x <= xMax; x += stepX) xs.push(x)
  const ys: number[] = []
  for (let y = Math.ceil(yMin / stepY) * stepY; y <= yMax; y += stepY) ys.push(y)

  const hasXAxis = yMin <= 0 && yMax >= 0
  const hasYAxis = xMin <= 0 && xMax >= 0
  const xAxisY = hasXAxis ? my(0) : SVG_H - PAD_B
  const yAxisX = hasYAxis ? mx(0) : PAD_L

  return (
    <g>
      {xs.map(x => (
        <line
          key={`gx-${x}`}
          x1={mx(x)}
          y1={PAD_T}
          x2={mx(x)}
          y2={SVG_H - PAD_B}
          className="wt-grid-line"
        />
      ))}
      {ys.map(y => (
        <line
          key={`gy-${y}`}
          x1={PAD_L}
          y1={my(y)}
          x2={SVG_W - PAD_R}
          y2={my(y)}
          className="wt-grid-line"
        />
      ))}
      {hasXAxis && (
        <line x1={PAD_L - 8} y1={xAxisY} x2={SVG_W - PAD_R + 8} y2={xAxisY} className="wt-axis-line" />
      )}
      {hasYAxis && (
        <line x1={yAxisX} y1={PAD_T - 8} x2={yAxisX} y2={SVG_H - PAD_B + 8} className="wt-axis-line" />
      )}
      {xs.map(x => {
        if (x === 0 && hasYAxis) return null
        if (spanX > 8 && Math.abs(x) % (stepX * 2) !== 0) return null
        return (
          <text
            key={`tx-${x}`}
            x={mx(x)}
            y={Math.min(SVG_H - 8, xAxisY + 14)}
            textAnchor="middle"
            className="wt-axis-tick"
          >
            {x}
          </text>
        )
      })}
      {ys.map(y => {
        if (y === 0 && hasXAxis) return null
        if (spanY > 8 && Math.abs(y) % (stepY * 2) !== 0) return null
        return (
          <text
            key={`ty-${y}`}
            x={Math.max(18, yAxisX - 8)}
            y={my(y) + 3.5}
            textAnchor="end"
            className="wt-axis-tick"
          >
            {y}
          </text>
        )
      })}
    </g>
  )
}

function renderGraphTrack(
  track: GraphTrack,
  progress: number,
  bounds: GraphTimelineConfig['bounds'],
) {
  const { mx, my, xMin, xMax } = createMapper(bounds)

  switch (track.type) {
    case 'polygon': {
      const t = easeOut(seg(progress, track.fromT, track.toT))
      if (t <= 0.01) return null
      const color = GRAPH_COLORS[track.color ?? 'blue']
      const pts = track.vertices.map(([x, y]) => `${mx(x).toFixed(1)},${my(y).toFixed(1)}`).join(' ')
      return (
        <polygon
          key={track.id}
          points={pts}
          fill={color}
          fillOpacity={(track.fillOpacity ?? 0.1) * t}
          stroke={color}
          strokeWidth="2.4"
          strokeLinejoin="round"
          opacity={t}
        />
      )
    }

    case 'line-draw': {
      const t = easeInOut(seg(progress, track.fromT, track.toT))
      if (t <= 0.005) return null
      const x1 = mx(track.from[0])
      const y1 = my(track.from[1])
      const x2 = lerp(x1, mx(track.to[0]), t)
      const y2 = lerp(y1, my(track.to[1]), t)
      const dimT = track.dimAfterT !== undefined ? easeOut(seg(progress, track.dimAfterT, track.dimAfterT + 0.18)) : 0
      const op = lerp(1, track.dimOpacity ?? 0.34, dimT)
      return (
        <line
          key={track.id}
          x1={x1}
          y1={y1}
          x2={x2}
          y2={y2}
          stroke={GRAPH_COLORS[track.color ?? 'blue']}
          strokeWidth={track.strokeWidth ?? 3.6}
          strokeDasharray={track.dashed ? '6 5' : undefined}
          strokeLinecap="round"
          opacity={op}
        />
      )
    }

    case 'segment-draw': {
      const t = easeInOut(seg(progress, track.fromT, track.toT))
      if (t <= 0.005) return null
      const x1 = mx(track.from[0])
      const y1 = my(track.from[1])
      const x2 = lerp(x1, mx(track.to[0]), t)
      const y2 = lerp(y1, my(track.to[1]), t)
      const color = GRAPH_COLORS[track.color ?? 'teal']
      const midX = (x1 + mx(track.to[0])) * 0.5
      const midY = (y1 + my(track.to[1])) * 0.5
      const dx = mx(track.to[0]) - x1
      const dy = my(track.to[1]) - y1
      const len = Math.hypot(dx, dy) || 1
      const nx = -dy / len
      const ny = dx / len
      return (
        <g key={track.id}>
          <line
            x1={x1}
            y1={y1}
            x2={x2}
            y2={y2}
            stroke={color}
            strokeWidth={track.strokeWidth ?? 3.4}
            strokeLinecap="round"
          />
          {track.ticks && t > 0.85 && (
            <line
              x1={midX - nx * 6}
              y1={midY - ny * 6}
              x2={midX + nx * 6}
              y2={midY + ny * 6}
              stroke={color}
              strokeWidth="2.4"
              strokeLinecap="round"
              opacity={(t - 0.85) / 0.15}
            />
          )}
          {track.label && t > 0.8 && (
            <text
              x={midX + nx * 14}
              y={midY + ny * 14 + 4}
              textAnchor="middle"
              className="wt-callout-teal"
              opacity={(t - 0.8) / 0.2}
            >
              {track.label}
            </text>
          )}
        </g>
      )
    }

    case 'slope-triangle': {
      const runT = easeOut(seg(progress, track.runFromT, track.runToT))
      const riseT = easeOut(seg(progress, track.riseFromT, track.riseToT))
      if (runT <= 0.01) return null
      const x0 = mx(track.from[0])
      const y0 = my(track.from[1])
      const x1 = mx(track.from[0] + track.dx)
      const y1 = my(track.from[1] + track.dy)
      const color = GRAPH_COLORS[track.color ?? 'amber']
      return (
        <g key={track.id}>
          <line
            x1={x0}
            y1={y0}
            x2={lerp(x0, x1, runT)}
            y2={y0}
            stroke={color}
            strokeWidth="3"
            strokeDasharray="5 4"
            strokeLinecap="round"
          />
          {runT > 0.45 && (
            <text
              x={(x0 + x1) * 0.5}
              y={track.dy < 0 ? y0 - 9 : y0 + 16}
              textAnchor="middle"
              className="wt-callout-amber"
              opacity={Math.min(1, (runT - 0.45) / 0.4)}
            >
              {track.runLabel}
            </text>
          )}
          {riseT > 0.01 && (
            <>
              <line
                x1={x1}
                y1={y0}
                x2={x1}
                y2={lerp(y0, y1, riseT)}
                stroke={color}
                strokeWidth="3"
                strokeDasharray="5 4"
                strokeLinecap="round"
              />
              {riseT > 0.45 && (
                <text
                  x={x1 + (track.dx >= 0 ? 10 : -10)}
                  y={(y0 + y1) * 0.5 + 4}
                  textAnchor={track.dx >= 0 ? 'start' : 'end'}
                  className="wt-callout-amber"
                  opacity={Math.min(1, (riseT - 0.45) / 0.4)}
                >
                  {track.riseLabel}
                </text>
              )}
            </>
          )}
        </g>
      )
    }

    case 'line-rotate': {
      const rotT = easeInOut(seg(progress, track.fromT, track.toT))
      const sqT =
        track.rightAngleFromT !== undefined && track.rightAngleToT !== undefined
          ? easeOut(seg(progress, track.rightAngleFromT, track.rightAngleToT))
          : easeOut(seg(progress, track.toT - 0.06, Math.min(1, track.toT + 0.14)))

      const px = mx(track.pivot[0])
      const py = my(track.pivot[1])
      const dxScreen = mx(track.pivot[0] + 1) - px
      const dyScreen = my(track.pivot[1] + track.baseSlope) - py
      const baseAngleRad = Math.atan2(dyScreen, dxScreen)
      const baseAngleDeg = (baseAngleRad * 180) / Math.PI
      const currentRotDeg = track.rotateDeg * rotT
      const arm = track.armLengthPx ?? 240
      const color = GRAPH_COLORS[track.color ?? 'teal']

      // Sweeping sector arc around pivot
      const arcR = 32
      const aStart = baseAngleRad - Math.PI
      const aEnd = aStart + ((track.rotateDeg * Math.PI) / 180) * rotT
      const sx = px + Math.cos(aStart) * arcR
      const sy = py + Math.sin(aStart) * arcR
      const ex = px + Math.cos(aEnd) * arcR
      const ey = py + Math.sin(aEnd) * arcR
      const sweepFlag = track.rotateDeg < 0 ? 0 : 1

      // Right-angle square aligned to rotated axes
      const signRad = track.rotateDeg < 0 ? -Math.PI / 2 : Math.PI / 2
      const u1x = Math.cos(baseAngleRad)
      const u1y = Math.sin(baseAngleRad)
      const u2x = Math.cos(baseAngleRad + signRad)
      const u2y = Math.sin(baseAngleRad + signRad)
      const sz = 14

      return (
        <g key={track.id}>
          {rotT > 0.04 && (
            <path
              d={`M ${px} ${py} L ${sx} ${sy} A ${arcR} ${arcR} 0 0 ${sweepFlag} ${ex} ${ey} Z`}
              fill={color}
              opacity={0.14 + 0.12 * rotT}
            />
          )}
          <g transform={`translate(${px}, ${py}) rotate(${baseAngleDeg + currentRotDeg})`}>
            <line
              x1={-arm}
              y1="0"
              x2={arm}
              y2="0"
              stroke={color}
              strokeWidth="3.8"
              strokeLinecap="round"
            />
          </g>
          {sqT > 0.02 && (
            <path
              d={`M ${px - u1x * sz} ${py - u1y * sz} L ${px - u1x * sz + u2x * sz} ${py - u1y * sz + u2y * sz} L ${px + u2x * sz} ${py + u2y * sz}`}
              fill="none"
              stroke="#29cc57"
              strokeWidth="2.6"
              strokeLinejoin="round"
              opacity={sqT}
            />
          )}
          <circle cx={px} cy={py} r="5.5" fill={color} />
        </g>
      )
    }

    case 'line-glide': {
      const slideT = easeInOut(seg(progress, track.fromT, track.toT))
      const lockT = easeOut(seg(progress, track.lockFromT, track.lockToT))
      const bVal = lerp(track.fromB, track.toB, slideT)
      const yLeft = track.slope * xMin + bVal
      const yRight = track.slope * xMax + bVal
      const bx = mx(0)
      const by = my(bVal)
      const px = mx(track.targetPoint[0])
      const py = my(track.targetPoint[1])
      const baseColor = GRAPH_COLORS[track.color ?? 'teal']
      const activeColor = lockT > 0.2 ? '#29cc57' : baseColor

      return (
        <g key={track.id}>
          {/* Elevator guide on y-axis */}
          <line
            x1={bx}
            y1={my(track.fromB)}
            x2={bx}
            y2={my(track.toB)}
            stroke={baseColor}
            strokeWidth="2"
            strokeDasharray="4 4"
            opacity="0.45"
          />
          <line
            x1={mx(xMin)}
            y1={my(yLeft)}
            x2={mx(xMax)}
            y2={my(yRight)}
            stroke={activeColor}
            strokeWidth="3.8"
            strokeLinecap="round"
          />
          <circle cx={bx} cy={by} r="6" fill={activeColor} />
          <text x={bx - 12} y={by + 4} textAnchor="end" className="wt-callout-teal">
            b = {bVal >= 0 ? bVal.toFixed(1) : `−${Math.abs(bVal).toFixed(1)}`}
          </text>
          {lockT > 0.02 && (
            <circle
              cx={px}
              cy={py}
              r={6 + lockT * 20}
              fill="none"
              stroke="#29cc57"
              strokeWidth="2.5"
              opacity={1 - lockT}
            />
          )}
          <circle cx={px} cy={py} r={6.5 + Math.sin(lockT * Math.PI) * 2.5} fill="#f59e0b" />
          <text x={px} y={py - 12} className="wt-point-label" textAnchor="middle">
            {track.targetLabel}
          </text>
        </g>
      )
    }

    case 'midpoint-sweep': {
      const t = easeInOut(seg(progress, track.fromT, track.toT))
      const lockT = easeOut(seg(progress, track.lockFromT, track.lockToT))
      const ax = mx(track.a[0])
      const ay = my(track.a[1])
      const bx = mx(track.b[0])
      const by = my(track.b[1])
      const midX = (ax + bx) * 0.5
      const midY = (ay + by) * 0.5
      const p1x = lerp(ax, midX, t)
      const p1y = lerp(ay, midY, t)
      const p2x = lerp(bx, midX, t)
      const p2y = lerp(by, midY, t)
      const color = GRAPH_COLORS[track.color ?? 'blue']

      return (
        <g key={track.id}>
          <line x1={ax} y1={ay} x2={bx} y2={by} stroke={color} strokeWidth="2.4" opacity="0.28" strokeDasharray="5 4" />
          <line x1={ax} y1={ay} x2={p1x} y2={p1y} stroke={color} strokeWidth="3.8" strokeLinecap="round" />
          <line x1={bx} y1={by} x2={p2x} y2={p2y} stroke={color} strokeWidth="3.8" strokeLinecap="round" />

          <circle cx={ax} cy={ay} r="5.5" fill={color} />
          <text x={ax} y={ay - 11} textAnchor="middle" className="wt-point-label">{track.labelA}</text>
          <circle cx={bx} cy={by} r="5.5" fill={color} />
          <text x={bx} y={by + 18} textAnchor="middle" className="wt-point-label">{track.labelB}</text>

          {/* Converging midpoint probes */}
          {t > 0.02 && t < 0.99 && (
            <>
              <circle cx={p1x} cy={p1y} r="5" fill="#f59e0b" />
              <circle cx={p2x} cy={p2y} r="5" fill="#f59e0b" />
            </>
          )}

          {/* Midpoint collision & lock-in */}
          {lockT > 0.02 && (
            <>
              <circle
                cx={midX}
                cy={midY}
                r={6 + lockT * 18}
                fill="none"
                stroke="#29cc57"
                strokeWidth="2.4"
                opacity={1 - lockT}
              />
              <circle cx={midX} cy={midY} r={6.5 * lockT} fill="#f59e0b" stroke="#ffffff" strokeWidth="2" />
              {track.labelM && (
                <text x={midX + 12} y={midY - 8} textAnchor="start" className="wt-callout-amber" opacity={lockT}>
                  {track.labelM}
                </text>
              )}
            </>
          )}
        </g>
      )
    }

    case 'distance-triangle': {
      const legT = easeInOut(seg(progress, track.fromT, track.toT))
      const hypT = easeOut(seg(progress, track.hypFromT, track.hypToT))
      const ax = mx(track.a[0])
      const ay = my(track.a[1])
      const bx = mx(track.b[0])
      const by = my(track.b[1])
      const color = GRAPH_COLORS[track.color ?? 'blue']

      return (
        <g key={track.id}>
          {legT > 0.02 && (
            <>
              <polygon
                points={`${ax},${ay} ${bx},${ay} ${bx},${by}`}
                fill="#f59e0b"
                fillOpacity={0.1 * legT}
              />
              <line
                x1={ax}
                y1={ay}
                x2={lerp(ax, bx, Math.min(1, legT * 1.4))}
                y2={ay}
                stroke="#f59e0b"
                strokeWidth="3"
                strokeDasharray="5 4"
                strokeLinecap="round"
              />
              <line
                x1={bx}
                y1={ay}
                x2={bx}
                y2={lerp(ay, by, seg(legT, 0.35, 1))}
                stroke="#f59e0b"
                strokeWidth="3"
                strokeDasharray="5 4"
                strokeLinecap="round"
              />
              {legT > 0.5 && (
                <text x={(ax + bx) * 0.5} y={ay + 17} textAnchor="middle" className="wt-callout-amber">
                  {track.dxLabel}
                </text>
              )}
              {legT > 0.75 && (
                <text x={bx + 10} y={(ay + by) * 0.5 + 4} textAnchor="start" className="wt-callout-amber">
                  {track.dyLabel}
                </text>
              )}
            </>
          )}

          {hypT > 0.01 && (
            <>
              <line
                x1={ax}
                y1={ay}
                x2={lerp(ax, bx, hypT)}
                y2={lerp(ay, by, hypT)}
                stroke={color}
                strokeWidth="4"
                strokeLinecap="round"
              />
              {hypT > 0.6 && (
                <text
                  x={(ax + bx) * 0.5 - 14}
                  y={(ay + by) * 0.5 - 8}
                  textAnchor="end"
                  className="wt-callout-teal"
                  opacity={(hypT - 0.6) / 0.4}
                >
                  {track.hypLabel}
                </text>
              )}
            </>
          )}
        </g>
      )
    }

    case 'point': {
      const t = easeOut(seg(progress, track.fromT, track.toT))
      if (t <= 0.01) return null
      const cx = mx(track.at[0])
      const cy = my(track.at[1])
      const r = (track.radius ?? 5.5) * t
      const pulseT = track.pulseAtT !== undefined ? easeOut(seg(progress, track.pulseAtT, track.pulseAtT + 0.2)) : 0
      const color = GRAPH_COLORS[track.color ?? 'blue']
      return (
        <g key={track.id} opacity={t}>
          {pulseT > 0.01 && pulseT < 0.99 && (
            <circle cx={cx} cy={cy} r={r + pulseT * 18} fill="none" stroke={color} strokeWidth="2.4" opacity={1 - pulseT} />
          )}
          <circle cx={cx} cy={cy} r={r} fill={color} />
          {track.label && (
            <text
              x={cx + (track.labelDx ?? 10)}
              y={cy + (track.labelDy ?? -8)}
              className="wt-point-label"
            >
              {track.label}
            </text>
          )}
        </g>
      )
    }

    case 'badge': {
      const t = easeOut(seg(progress, track.fromT, track.toT))
      if (t <= 0.01) return null
      const cx = mx(track.at[0])
      const cy = my(track.at[1])
      const w = track.width ?? 138
      const tone = track.tone ?? 'blue'
      let labelText = track.text
      if (track.phases && track.phases.length > 0) {
        for (const p of track.phases) {
          if (progress >= p.at) labelText = p.text
        }
      }
      const bgClass =
        tone === 'green'
          ? 'wt-badge-bg-green'
          : tone === 'teal'
            ? 'wt-badge-bg-teal'
            : 'wt-badge-bg'
      const textClass =
        tone === 'green'
          ? 'wt-badge-green'
          : tone === 'teal'
            ? 'wt-badge-teal'
            : 'wt-badge-blue'

      return (
        <g
          key={track.id}
          transform={`translate(${cx}, ${cy}) scale(${0.75 + 0.25 * t})`}
          opacity={t}
        >
          <rect x={-w / 2} y="-17" width={w} height="34" rx="10" className={bgClass} />
          <text x="0" y="5" textAnchor="middle" className={textClass}>
            {labelText}
          </text>
        </g>
      )
    }
  }
}

function GraphTimelineStage({ config, progress }: { config: GraphTimelineConfig; progress: number }) {
  return (
    <svg className="wt-graph-svg" viewBox={`0 0 ${SVG_W} ${SVG_H}`} aria-label={config.ariaLabel}>
      <GridBase bounds={config.bounds} />
      {config.tracks.map(track => renderGraphTrack(track, progress, config.bounds))}
    </svg>
  )
}

/* ============================================================================
   Built-in Plugin #2: 'algebra-timeline' (Declarative Equation Choreography)
   ============================================================================ */

function AlgebraTimelineStage({
  config,
  progress,
}: {
  config: AlgebraTimelineConfig
  progress: number
}) {
  let activeHint = config.hints[0]?.text ?? ''
  for (const h of config.hints) {
    if (progress >= h.at) activeHint = h.text
  }

  const resT = config.resultPill
    ? easeOut(seg(progress, config.resultPill.fromT, config.resultPill.toT))
    : 0

  return (
    <div className="wt-alg-stage" aria-label={config.ariaLabel}>
      {activeHint && <div className="wt-alg-hint">{activeHint}</div>}

      {/* 2D Choreographed Math Token Stage (parabolic arcs, orbital flips, smooth glides) */}
      {config.tokens && config.tokens.length > 0 && (
        <div className="wt-alg-canvas">
          {config.fracBars?.map(bar => {
            const bt = easeOut(seg(progress, bar.fromT, bar.toT))
            return (
              <span
                key={bar.id}
                className="wt-frac-bar"
                style={{
                  transform: `translate(${bar.x}px, ${bar.y}px) scaleX(${bt})`,
                  opacity: bt,
                }}
              />
            )
          })}

          {config.tokens.map(tok => {
            const moveT = easeInOut(seg(progress, tok.fromT, tok.toT))
            let x = tok.to ? lerp(tok.from[0], tok.to[0], moveT) : tok.from[0]
            let y = tok.to ? lerp(tok.from[1], tok.to[1], moveT) : tok.from[1]
            if (tok.arcHeight) {
              y -= Math.sin(moveT * Math.PI) * tok.arcHeight
            }

            if (tok.orbit) {
              const ot = easeInOut(seg(progress, tok.orbit.fromT, tok.orbit.toT))
              const rad = (lerp(tok.orbit.fromDeg, tok.orbit.toDeg, ot) * Math.PI) / 180
              const fadeScale = tok.fadeIn ? easeOut(seg(progress, tok.fadeIn[0], tok.fadeIn[1])) : 1
              x = tok.orbit.cx + Math.sin(rad) * tok.orbit.rx
              y = lerp(tok.from[1], tok.orbit.cy - Math.cos(rad) * tok.orbit.ry, fadeScale)
            }

            let opacity = 1
            if (tok.fadeIn) {
              opacity *= easeOut(seg(progress, tok.fadeIn[0], tok.fadeIn[1]))
            }
            if (tok.fadeOut) {
              opacity *= 1 - easeOut(seg(progress, tok.fadeOut[0], tok.fadeOut[1]))
            }

            let rotateDeg = 0
            let scale = 1
            if (tok.spin) {
              const st = easeInOut(seg(progress, tok.spin.fromT, tok.spin.toT))
              rotateDeg = lerp(tok.spin.fromDeg, tok.spin.toDeg, st)
              if (tok.spin.scalePulse) {
                scale = 1 + Math.sin(st * Math.PI) * tok.spin.scalePulse
              }
            }

            const flipped = tok.flipAt !== undefined && progress >= tok.flipAt
            const label = flipped && tok.altText ? tok.altText : tok.text
            const tone = flipped && tok.altTone ? tok.altTone : tok.tone
            const isSpot =
              tok.spotAt !== undefined &&
              progress >= tok.spotAt[0] &&
              progress <= tok.spotAt[1]

            return (
              <span
                key={tok.id}
                className={`wt-tok is-${tone}${isSpot ? ' is-spot' : ''}`}
                style={{
                  transform: `translate(${x.toFixed(1)}px, ${y.toFixed(1)}px) rotate(${rotateDeg.toFixed(1)}deg) scale(${scale.toFixed(3)})`,
                  opacity: Number(opacity.toFixed(3)),
                }}
              >
                {label}
              </span>
            )
          })}
        </div>
      )}

      {/* Multi-row animated algebra derivation stack */}
      {config.rows && config.rows.length > 0 && (
        <div className="wt-alg-stack">
          {config.rows.map(row => {
            const t = easeOut(seg(progress, row.fromT, row.toT))
            return (
              <div
                key={row.id}
                className={`wt-alg-row${row.isFinal ? ' is-final' : ''}`}
                style={{
                  opacity: row.isFinal ? t : lerp(0.18, 1, t),
                  transform: row.isFinal
                    ? `scale(${0.92 + 0.08 * t})`
                    : `translateY(${(1 - t) * 10}px)`,
                }}
              >
                {row.chips.map((c, idx) => {
                  if (c.kind === 'result') {
                    return (
                      <span key={idx} className={`wt-result-pill is-${c.tone ?? 'green'}`}>
                        {c.text}
                      </span>
                    )
                  }
                  if (c.kind === 'sym') {
                    return (
                      <span key={idx} className="wt-sym">
                        {c.text}
                      </span>
                    )
                  }
                  const pulsing =
                    c.pulseWindow &&
                    progress >= c.pulseWindow[0] &&
                    progress <= c.pulseWindow[1]
                  return (
                    <span
                      key={idx}
                      className={`wt-chip is-${c.tone ?? 'blue'}${pulsing ? ' is-pulse' : ''}`}
                    >
                      {c.text}
                    </span>
                  )
                })}
              </div>
            )
          })}
        </div>
      )}

      {config.resultPill && (
        <div
          className="wt-alg-result"
          style={{
            opacity: resT,
            transform: `translateY(${(1 - resT) * 10}px)`,
          }}
        >
          <span className={`wt-result-pill is-${config.resultPill.tone}`}>
            {config.resultPill.text}
          </span>
        </div>
      )}
    </div>
  )
}

// Register built-in course animation plugins once on module load
registerStagePlugin<GraphTimelineConfig>({
  id: 'graph-timeline',
  label: 'Animation Graph System',
  description: 'Declarative coordinate-plane animation engine (lines, rotations, glides, midpoints, triangles)',
  render: (config, progress) => <GraphTimelineStage config={config} progress={progress} />,
})

registerStagePlugin<AlgebraTimelineConfig>({
  id: 'algebra-timeline',
  label: 'Animation Algebra System',
  description: 'Declarative 2D equation token choreography (parabolic arcs, orbital flips, step stacks)',
  render: (config, progress) => <AlgebraTimelineStage config={config} progress={progress} />,
})

/* ============================================================================
   Universal Generic Stage (for dynamically generated page walkthroughs)
   ============================================================================ */

function GenericStepStage({ beat, progress }: { beat: WalkthroughBeat; progress: number }) {
  const lines = beat.mathLines ?? []
  const revealCount =
    lines.length <= 1
      ? 1
      : Math.min(lines.length, Math.max(1, Math.floor(progress * lines.length) + 1))

  return (
    <div className="wt-generic-stage">
      <div className="wt-generic-banner">
        <span className="wt-generic-pill">{beat.title}</span>
      </div>
      {beat.scene && (
        <div className="wt-generic-graph">
          <BrilliantGraph mode="display" scene={beat.scene} animateDrawIn />
        </div>
      )}
      {lines.length > 0 && (
        <div className="wt-generic-lines">
          {lines.map((line, i) => {
            const visible = i < revealCount
            const active = i === revealCount - 1
            return (
              <div
                key={i}
                className={`wt-generic-line${visible ? ' is-shown' : ''}${active ? ' is-active' : ''}`}
                style={{
                  opacity: visible ? (active ? 1 : 0.72) : 0.14,
                  transform: visible ? 'translateY(0)' : 'translateY(6px)',
                }}
              >
                <span className="wt-generic-step-dot" aria-hidden="true">
                  {i + 1}
                </span>
                <span className="wt-generic-step-text">
                  <MathText text={line} />
                </span>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}

export function WalkthroughStage({
  beat,
  progress,
}: {
  beat: WalkthroughBeat
  progress: number
}) {
  if (beat.stage) {
    const plugin = getStagePlugin(beat.stage.plugin)
    if (plugin) {
      return <>{plugin.render(beat.stage.config, progress)}</>
    }
  }
  return <GenericStepStage beat={beat} progress={progress} />
}
