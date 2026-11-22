import { ARROWHEAD_PATH, STROKE } from '../tokens'
import { computeAxisCadence, fmtNum, type Viewport } from '../math'

export function AxesLayer({
  vp,
  showGrid,
  showAxisNumbers,
  snapDots,
  activeSnapPt,
}: {
  vp: Viewport
  showGrid: boolean
  showAxisNumbers: boolean
  snapDots: [number, number][] | null
  activeSnapPt: [number, number] | null
}) {
  const { gridStep, labelStep } = computeAxisCadence(vp)
  const { bounds, plotX, plotY, plotW, plotH, toPxX, toPxY } = vp

  const xTicks: number[] = []
  const xStart = Math.ceil((bounds.xMin + 1e-6) / gridStep) * gridStep
  for (let x = xStart; x <= bounds.xMax - 1e-6; x += gridStep) {
    const r = Math.round(x * 1000) / 1000
    if (Math.abs(r) > 1e-6) xTicks.push(r)
  }

  const yTicks: number[] = []
  const yStart = Math.ceil((bounds.yMin + 1e-6) / gridStep) * gridStep
  for (let y = yStart; y <= bounds.yMax - 1e-6; y += gridStep) {
    const r = Math.round(y * 1000) / 1000
    if (Math.abs(r) > 1e-6) yTicks.push(r)
  }

  const hasYAxis = bounds.xMin <= 0 && bounds.xMax >= 0
  const hasXAxis = bounds.yMin <= 0 && bounds.yMax >= 0
  const xAxisY = hasXAxis ? toPxY(0) : plotY + plotH
  const yAxisX = hasYAxis ? toPxX(0) : plotX

  // Keep axis numbers legible even when an axis sits near the bottom/left edge
  const xNumOffsetY = xAxisY > plotY + plotH - 18 ? -14 : 16
  const yNumOffsetX = yAxisX < plotX + 22 ? 12 : -11
  const yNumAnchor = yAxisX < plotX + 22 ? 'start' : 'end'

  return (
    <g
      data-layer="axes"
      data-scene-graph-name="axes"
      className="bg-axes-layer"
    >
      {/* Live snap lattice: crisp r=2 dots that appear ONLY while a drag handle is pressed */}
      {snapDots && snapDots.length > 0 && (
        <g className="bg-snap-lattice" aria-hidden="true">
          {snapDots.map(([sx, sy], i) => {
            const isTarget =
              activeSnapPt !== null &&
              Math.abs(activeSnapPt[0] - sx) < 1e-4 &&
              Math.abs(activeSnapPt[1] - sy) < 1e-4
            return (
              <circle
                key={i}
                cx={toPxX(sx)}
                cy={toPxY(sy)}
                r={isTarget ? 3.2 : 2}
                className={isTarget ? 'bg-snap-dot is-target' : 'bg-snap-dot'}
              />
            )
          })}
        </g>
      )}

      {/* Gridlines (skipping x=0 and y=0 exactly like Brilliant) */}
      {showGrid && (
        <g className="bg-grid-lines">
          {xTicks.map(x => {
            const px = toPxX(x)
            return (
              <line
                key={`gx-${x}`}
                x1={px}
                y1={plotY}
                x2={px}
                y2={plotY + plotH}
                className="bg-grid-line"
                strokeWidth={STROKE.grid}
                strokeLinecap="round"
              />
            )
          })}
          {yTicks.map(y => {
            const py = toPxY(y)
            return (
              <line
                key={`gy-${y}`}
                x1={plotX}
                y1={py}
                x2={plotX + plotW}
                y2={py}
                className="bg-grid-line"
                strokeWidth={STROKE.grid}
                strokeLinecap="round"
              />
            )
          })}
        </g>
      )}

      {/* X Axis: 10px centered cross-ticks, 1.5px stroke, exact Brilliant 12x10 arrowhead */}
      {hasXAxis && (
        <g data-scene-graph-name="x-axis">
          <g>
            {xTicks.map(x => {
              const px = toPxX(x)
              return (
                <line
                  key={`xt-${x}`}
                  x1={px}
                  y1={xAxisY - STROKE.tickHalf}
                  x2={px}
                  y2={xAxisY + STROKE.tickHalf}
                  className="bg-axis-stroke"
                  strokeWidth={STROKE.axis}
                  strokeLinecap="round"
                />
              )
            })}
          </g>
          <line
            x1={plotX}
            y1={xAxisY}
            x2={plotX + plotW}
            y2={xAxisY}
            className="bg-axis-stroke"
            strokeWidth={STROKE.axis}
            strokeLinecap="round"
          />
          <g transform={`translate(${plotX + plotW + 10.25} ${xAxisY}) rotate(90) translate(-6 0)`}>
            <svg width="12" height="10" viewBox="0 0 12 10" fill="none">
              <path d={ARROWHEAD_PATH} className="bg-axis-fill" />
            </svg>
          </g>
          <text
            x={plotX + plotW + 10}
            y={xAxisY + 12}
            textAnchor="end"
            dominantBaseline="hanging"
            className="bg-axis-name"
          >
            x
          </text>
        </g>
      )}

      {/* Y Axis: 10px centered cross-ticks, 1.5px stroke, exact Brilliant 12x10 arrowhead */}
      {hasYAxis && (
        <g data-scene-graph-name="y-axis">
          <g>
            {yTicks.map(y => {
              const py = toPxY(y)
              return (
                <line
                  key={`yt-${y}`}
                  x1={yAxisX - STROKE.tickHalf}
                  y1={py}
                  x2={yAxisX + STROKE.tickHalf}
                  y2={py}
                  className="bg-axis-stroke"
                  strokeWidth={STROKE.axis}
                  strokeLinecap="round"
                />
              )
            })}
          </g>
          <line
            x1={yAxisX}
            y1={plotY + plotH}
            x2={yAxisX}
            y2={plotY}
            className="bg-axis-stroke"
            strokeWidth={STROKE.axis}
            strokeLinecap="round"
          />
          <g transform={`translate(${yAxisX} ${plotY - 10}) translate(-6 0)`}>
            <svg width="12" height="10" viewBox="0 0 12 10" fill="none">
              <path d={ARROWHEAD_PATH} className="bg-axis-fill" />
            </svg>
          </g>
          <text
            x={yAxisX - 12}
            y={plotY - 10}
            textAnchor="end"
            dominantBaseline="hanging"
            className="bg-axis-name"
          >
            y
          </text>
        </g>
      )}

      {/* Clean auto-spaced tick numbers with Brilliant surface-knockout halo */}
      {showAxisNumbers && (
        <g className="bg-tick-labels">
          {hasXAxis &&
            xTicks
              .filter(x => Math.abs(Math.round(x / labelStep) * labelStep - x) < 1e-6)
              .map(x => {
                const px = toPxX(x)
                // Avoid colliding with the Y-axis arrow or plot edges
                if (px < plotX + 6 || px > plotX + plotW - 10) return null
                return (
                  <text
                    key={`xl-${x}`}
                    x={px}
                    y={xAxisY + xNumOffsetY}
                    textAnchor="middle"
                    dominantBaseline="central"
                    className="bg-tick-num"
                  >
                    {fmtNum(x)}
                  </text>
                )
              })}
          {hasYAxis &&
            yTicks
              .filter(y => Math.abs(Math.round(y / labelStep) * labelStep - y) < 1e-6)
              .map(y => {
                const py = toPxY(y)
                if (py < plotY + 8 || py > plotY + plotH - 8) return null
                return (
                  <text
                    key={`yl-${y}`}
                    x={yAxisX + yNumOffsetX}
                    y={py}
                    textAnchor={yNumAnchor}
                    dominantBaseline="central"
                    className="bg-tick-num"
                  >
                    {fmtNum(y)}
                  </text>
                )
              })}
        </g>
      )}
    </g>
  )
}
