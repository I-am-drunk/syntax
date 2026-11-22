import { BrilliantGraph } from '../graph'
import { MathText } from '../components/MathText'
import type { WalkthroughBeat } from './walkthroughData'

function clamp(v: number, lo = 0, hi = 1): number {
  return v < lo ? lo : v > hi ? hi : v
}

function lerp(a: number, b: number, t: number): number {
  return a + (b - a) * t
}

function easeInOut(t: number): number {
  const x = clamp(t)
  return x < 0.5 ? 4 * x * x * x : 1 - Math.pow(-2 * x + 2, 3) / 2
}

function easeOut(t: number): number {
  const x = 1 - clamp(t)
  return 1 - x * x * x
}

function seg(progress: number, start: number, end: number): number {
  return clamp((progress - start) / Math.max(0.001, end - start))
}

// Coordinate mapper for custom live-animated Visual Lens SVG (viewBox 0 0 420 270)
// Math domain: x in [-5, 8] (span 13), y in [-5, 5] (span 10)
const GX0 = 26
const GY0 = 18
const GW = 368
const GH = 234
const X_MIN = -5
const X_MAX = 8
const Y_MIN = -5
const Y_MAX = 5

function mx(x: number): number {
  return GX0 + ((x - X_MIN) / (X_MAX - X_MIN)) * GW
}
function my(y: number): number {
  return GY0 + ((Y_MAX - y) / (Y_MAX - Y_MIN)) * GH
}

function GridBase() {
  const vLines: number[] = []
  for (let x = -4; x <= 7; x++) vLines.push(x)
  const hLines: number[] = []
  for (let y = -4; y <= 4; y++) hLines.push(y)

  return (
    <g className="wt-grid">
      {vLines.map(x => (
        <line
          key={`vx-${x}`}
          x1={mx(x)}
          y1={GY0}
          x2={mx(x)}
          y2={GY0 + GH}
          className={x === 0 ? 'wt-axis' : 'wt-grid-line'}
        />
      ))}
      {hLines.map(y => (
        <line
          key={`hy-${y}`}
          x1={GX0}
          y1={my(y)}
          x2={GX0 + GW}
          y2={my(y)}
          className={y === 0 ? 'wt-axis' : 'wt-grid-line'}
        />
      ))}
      {/* Crisp subtle axis numbers */}
      <text x={mx(6)} y={my(0) + 14} className="wt-axis-num" textAnchor="middle">6</text>
      <text x={mx(-3)} y={my(0) + 14} className="wt-axis-num" textAnchor="middle">−3</text>
      <text x={mx(0) - 8} y={my(-3) + 4} className="wt-axis-num" textAnchor="end">−3</text>
      <text x={mx(0) - 8} y={my(3) + 4} className="wt-axis-num" textAnchor="end">3</text>
    </g>
  )
}

function Vis1PlotSlope({ progress }: { progress: number }) {
  const lineDraw = easeOut(seg(progress, 0.04, 0.34))
  const triRun = easeOut(seg(progress, 0.34, 0.54))
  const triRise = easeOut(seg(progress, 0.52, 0.74))
  const badgePop = easeOut(seg(progress, 0.72, 0.88))

  // Line y = -3x - 3 from (-2.67, 5) to (0.67, -5)
  const x1 = mx(-2.67)
  const y1 = my(5)
  const x2 = mx(0.67)
  const y2 = my(-5)

  // Rise/run triangle: (-1, 0) -> (0, 0) -> (0, -3)
  const tx0 = mx(-1)
  const ty0 = my(0)
  const tx1 = mx(0)
  const ty1 = my(0)
  const ty2 = my(-3)

  return (
    <svg className="wt-graph-svg" viewBox="0 0 420 270" aria-label="Plotting y = -3x - 3">
      <GridBase />

      {/* Given line drawing in */}
      <line
        x1={x1}
        y1={y1}
        x2={x2}
        y2={y2}
        stroke="#456dff"
        strokeWidth="3.5"
        strokeLinecap="round"
        pathLength={100}
        strokeDasharray="100"
        strokeDashoffset={100 * (1 - lineDraw)}
      />

      {/* Shaded slope triangle */}
      {triRise > 0.05 && (
        <polygon
          points={`${tx0},${ty0} ${tx1},${ty1} ${tx1},${ty2}`}
          fill="rgba(69, 109, 255, 0.14)"
          opacity={triRise}
        />
      )}

      {/* Run +1 */}
      {triRun > 0.01 && (
        <g>
          <line
            x1={tx0}
            y1={ty0}
            x2={lerp(tx0, tx1, triRun)}
            y2={ty1}
            stroke="#f59e0b"
            strokeWidth="3"
            strokeDasharray="5 3"
          />
          <text x={(tx0 + tx1) * 0.5} y={ty0 - 8} className="wt-callout-amber" textAnchor="middle" opacity={triRun}>
            run +1
          </text>
        </g>
      )}

      {/* Rise -3 */}
      {triRise > 0.01 && (
        <g>
          <line
            x1={tx1}
            y1={ty1}
            x2={tx1}
            y2={lerp(ty1, ty2, triRise)}
            stroke="#ef4444"
            strokeWidth="3"
            strokeDasharray="5 3"
          />
          <text x={tx1 + 10} y={(ty1 + ty2) * 0.5 + 4} className="wt-callout-red" opacity={triRise}>
            rise −3
          </text>
        </g>
      )}

      {/* Key points */}
      <circle cx={mx(-1)} cy={my(0)} r={5 * lineDraw} fill="#456dff" />
      <circle cx={mx(0)} cy={my(-3)} r={5.5 * lineDraw} fill="#456dff" />
      <circle cx={mx(6)} cy={my(1)} r={6 * lineDraw} fill="#f59e0b" />
      <text x={mx(6)} y={my(1) - 11} className="wt-point-label" textAnchor="middle" opacity={lineDraw}>
        P(6, 1)
      </text>

      {/* Slope badge */}
      <g
        transform={`translate(${mx(2.8)}, ${my(-2.6)}) scale(${0.7 + 0.3 * badgePop})`}
        opacity={badgePop}
      >
        <rect x="-46" y="-16" width="92" height="32" rx="10" className="wt-badge-bg" />
        <text x="0" y="5" textAnchor="middle" className="wt-badge-blue">m = −3</text>
      </g>
    </svg>
  )
}

function Vis2Rotate90({ progress }: { progress: number }) {
  const rotT = easeInOut(seg(progress, 0.08, 0.54))
  const sqPop = easeOut(seg(progress, 0.52, 0.72))
  const triPop = easeOut(seg(progress, 0.64, 0.88))

  // Pivot intersection of y = -3x - 3 and y = 1/3 x - 1 is (-0.6, -1.2)
  const px = mx(-0.6)
  const py = my(-1.2)

  // Original line direction in SVG coords (note y is flipped in SVG!)
  // Math vector (1, -3) -> SVG vector (+dx, +dy) = (scaleX*1, scaleY*3)
  const scaleX = GW / (X_MAX - X_MIN)
  const scaleY = GH / (Y_MAX - Y_MIN)
  const baseAngleRad = Math.atan2(3 * scaleY, 1 * scaleX) // ~+71.5 deg in SVG
  const baseAngleDeg = (baseAngleRad * 180) / Math.PI
  // Rotating counterclockwise by 90 deg in math = subtracting 90 deg in SVG screen coords!
  const currentRotDeg = -90 * rotT

  // Sweeping 90-degree green sector arc around pivot
  const arcR = 32
  const aStart = baseAngleRad - Math.PI // pointing up-left along blue line
  const aEnd = aStart - (Math.PI / 2) * rotT
  const sx = px + Math.cos(aStart) * arcR
  const sy = py + Math.sin(aStart) * arcR
  const ex = px + Math.cos(aEnd) * arcR
  const ey = py + Math.sin(aEnd) * arcR

  // Right-angle square aligned to rotated axes
  const u1x = Math.cos(baseAngleRad)
  const u1y = Math.sin(baseAngleRad)
  const u2x = Math.cos(baseAngleRad - Math.PI / 2)
  const u2y = Math.sin(baseAngleRad - Math.PI / 2)
  const sz = 14

  return (
    <svg className="wt-graph-svg" viewBox="0 0 420 270" aria-label="Rotating line 90 degrees">
      <GridBase />

      {/* Original blue line dimmed slightly as rotation proceeds */}
      <line
        x1={mx(-2.67)}
        y1={my(5)}
        x2={mx(0.67)}
        y2={my(-5)}
        stroke="#456dff"
        strokeWidth="3"
        opacity={lerp(0.95, 0.35, rotT)}
      />

      {/* Sweeping green 90° sector */}
      {rotT > 0.02 && (
        <path
          d={`M ${px} ${py} L ${sx} ${sy} A ${arcR} ${arcR} 0 0 0 ${ex} ${ey} Z`}
          fill="rgba(41, 204, 87, 0.22)"
          stroke="#29cc57"
          strokeWidth="1.8"
        />
      )}

      {/* Live rotating teal line around pivot! */}
      <g transform={`translate(${px} ${py}) rotate(${baseAngleDeg + currentRotDeg})`}>
        <line x1="-260" y1="0" x2="260" y2="0" stroke="#0d9488" strokeWidth="3.6" strokeLinecap="round" />
      </g>

      {/* Crisp 90° right-angle corner snapping in */}
      {sqPop > 0.05 && (
        <polyline
          points={`${px + u1x * sz},${py + u1y * sz} ${px + (u1x + u2x) * sz},${py + (u1y + u2y) * sz} ${px + u2x * sz},${py + u2y * sz}`}
          fill="none"
          stroke="#29cc57"
          strokeWidth="2.6"
          opacity={sqPop}
        />
      )}

      {/* Perpendicular rise +1, run +3 triangle on the teal line */}
      {triPop > 0.05 && (
        <g opacity={triPop}>
          <line x1={mx(0)} y1={my(-1)} x2={mx(3)} y2={my(-1)} stroke="#f59e0b" strokeWidth="2.6" strokeDasharray="5 3" />
          <line x1={mx(3)} y1={my(-1)} x2={mx(3)} y2={my(0)} stroke="#29cc57" strokeWidth="2.6" strokeDasharray="5 3" />
          <text x={mx(1.5)} y={my(-1) + 16} className="wt-callout-amber" textAnchor="middle">run +3</text>
          <text x={mx(3) + 8} y={my(-0.5) + 4} className="wt-callout-green">rise +1</text>
        </g>
      )}

      {/* Pivot dot & P(6, 1) */}
      <circle cx={px} cy={py} r="5.5" fill="#29cc57" />
      <circle cx={mx(6)} cy={my(1)} r="5.5" fill="#f59e0b" opacity="0.6" />

      {/* Live angle / slope badge */}
      <g transform={`translate(${mx(4.2)}, ${my(2.8)})`}>
        <rect x="-58" y="-17" width="116" height="34" rx="10" className="wt-badge-bg" />
        <text x="0" y="5" textAnchor="middle" className="wt-badge-teal">
          {rotT < 0.8 ? `Rotating ${Math.round(rotT * 90)}°` : 'm⊥ = +1/3'}
        </text>
      </g>
    </svg>
  )
}

function Vis3SlideToP({ progress }: { progress: number }) {
  const slideT = easeInOut(seg(progress, 0.12, 0.66))
  const lockT = easeOut(seg(progress, 0.66, 0.92))

  // Glide b smoothly from +2.4 down to -1.0 (locks right onto P(6, 1) since 1/3(6) - 1 = 1!)
  const bVal = lerp(2.4, -1.0, slideT)
  const yLeft = (1 / 3) * X_MIN + bVal
  const yRight = (1 / 3) * X_MAX + bVal

  const px = mx(6)
  const py = my(1)
  const bx = mx(0)
  const by = my(bVal)

  return (
    <svg className="wt-graph-svg" viewBox="0 0 420 270" aria-label="Sliding perpendicular line onto P(6, 1)">
      <GridBase />

      {/* Dim reference line y = -3x - 3 */}
      <line
        x1={mx(-2.67)}
        y1={my(5)}
        x2={mx(0.67)}
        y2={my(-5)}
        stroke="#456dff"
        strokeWidth="2.5"
        opacity="0.28"
      />

      {/* Vertical elevator guide on y-axis */}
      <line
        x1={bx}
        y1={my(2.4)}
        x2={bx}
        y2={my(-1)}
        stroke="#0d9488"
        strokeWidth="2"
        strokeDasharray="4 4"
        opacity="0.45"
      />

      {/* Gliding perpendicular teal line */}
      <line
        x1={mx(X_MIN)}
        y1={my(yLeft)}
        x2={mx(X_MAX)}
        y2={my(yRight)}
        stroke={lockT > 0.2 ? '#29cc57' : '#0d9488'}
        strokeWidth="3.8"
        strokeLinecap="round"
      />

      {/* Moving y-intercept bead */}
      <circle cx={bx} cy={by} r="6" fill={lockT > 0.2 ? '#29cc57' : '#0d9488'} />
      <text x={bx - 12} y={by + 4} textAnchor="end" className="wt-callout-teal">
        b = {bVal >= 0 ? bVal.toFixed(1) : `−${Math.abs(bVal).toFixed(1)}`}
      </text>

      {/* Target point P(6, 1) with celebratory lock-on ripple */}
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
      <text x={px} y={py - 12} className="wt-point-label" textAnchor="middle">P(6, 1)</text>

      {/* Final locked equation badge */}
      <g
        transform={`translate(${mx(2.4)}, ${my(-3.4)}) scale(${0.75 + 0.25 * lockT})`}
        opacity={lockT}
      >
        <rect x="-76" y="-18" width="152" height="36" rx="11" className="wt-badge-bg-green" />
        <text x="0" y="5" textAnchor="middle" className="wt-badge-green">y = 1/3 x − 1</text>
      </g>
    </svg>
  )
}

function Alg1IsolateY({ progress }: { progress: number }) {
  const moveT = easeInOut(seg(progress, 0.22, 0.62))
  const spotT = easeOut(seg(progress, 0.66, 0.88))

  // +3x lifts on a clean parabolic arc over the '=' sign and flips sign to -3x!
  const arcX = lerp(-105, 34, moveT)
  const arcY = -Math.sin(moveT * Math.PI) * 58
  const yX = lerp(-24, -84, moveT)
  const constX = lerp(64, 114, moveT)
  const flipped = moveT > 0.52

  return (
    <div className="wt-alg-stage" aria-label="Isolating y from 3x + y = -3">
      <div className="wt-alg-hint">
        {moveT < 0.15
          ? 'Start in standard form'
          : moveT < 0.85
            ? 'Subtract 3x from both sides'
            : 'Read slope m right in front of x'}
      </div>

      <div className="wt-alg-canvas">
        {/* Moving 3x -> -3x token */}
        <span
          className={`wt-tok ${flipped ? 'is-teal' : 'is-blue'} ${spotT > 0.2 ? 'is-spot' : ''}`}
          style={{ transform: `translate(${arcX}px, ${arcY}px)` }}
        >
          {flipped ? '−3x' : '3x'}
        </span>

        {/* Fading '+' operator */}
        <span
          className="wt-tok is-op"
          style={{
            transform: `translate(-62px, 0px)`,
            opacity: Math.max(0, 1 - moveT * 2.2),
          }}
        >
          +
        </span>

        {/* y glides left */}
        <span className="wt-tok is-ink" style={{ transform: `translate(${yX}px, 0px)` }}>
          y
        </span>

        {/* Anchor '=' sign */}
        <span className="wt-tok is-op" style={{ transform: `translate(-34px, 0px)` }}>
          =
        </span>

        {/* -3 shifts right cleanly to make room */}
        <span className="wt-tok is-ink" style={{ transform: `translate(${constX}px, 0px)` }}>
          −3
        </span>
      </div>

      <div
        className="wt-alg-result"
        style={{
          opacity: spotT,
          transform: `translateY(${(1 - spotT) * 10}px)`,
        }}
      >
        <span className="wt-result-pill is-blue">Slope m = −3</span>
      </div>
    </div>
  )
}

function Alg2FlipNegate({ progress }: { progress: number }) {
  const fracT = easeOut(seg(progress, 0.06, 0.28))
  const orbitT = easeInOut(seg(progress, 0.30, 0.68))
  const signT = easeInOut(seg(progress, 0.70, 0.90))

  // True 180° circular orbital swap around the fraction bar!
  const theta = orbitT * Math.PI
  const orbitR = 26
  const numX = Math.sin(theta) * orbitR * 1.1
  const numY = -Math.cos(theta) * orbitR
  const denX = -Math.sin(theta) * orbitR * 1.1
  const denY = Math.cos(theta) * orbitR

  const signFlipped = signT > 0.5
  const signSpin = signT * 180

  return (
    <div className="wt-alg-stage" aria-label="Taking the negative reciprocal of -3">
      <div className="wt-alg-hint">
        {orbitT < 0.08
          ? 'Write −3 as a fraction over 1'
          : signT < 0.1
            ? 'Flip numerator and denominator 180°'
            : 'Switch the sign from negative to positive'}
      </div>

      <div className="wt-alg-canvas">
        <span className="wt-tok is-ink" style={{ transform: 'translate(-108px, 0px)' }}>
          {signT > 0.3 ? 'm⊥ =' : 'm ='}
        </span>

        {/* Animated sign token (- spins into +) */}
        <span
          className={`wt-tok ${signFlipped ? 'is-green' : 'is-amber'}`}
          style={{
            transform: `translate(-28px, 0px) rotate(${signSpin}deg) scale(${1 + Math.sin(signT * Math.PI) * 0.28})`,
          }}
        >
          {signFlipped ? '+' : '−'}
        </span>

        {/* Fraction bar */}
        <span
          className="wt-frac-bar"
          style={{
            transform: `translate(32px, 0px) scaleX(${fracT})`,
            opacity: fracT,
          }}
        />

        {/* Orbiting '3' (starts on top, swings to bottom) */}
        <span
          className="wt-tok is-blue"
          style={{
            transform: `translate(${32 + numX}px, ${lerp(0, numY, fracT)}px)`,
          }}
        >
          3
        </span>

        {/* Orbiting '1' (appears underneath, swings to top!) */}
        <span
          className="wt-tok is-teal"
          style={{
            transform: `translate(${32 + denX}px, ${denY}px)`,
            opacity: fracT,
          }}
        >
          1
        </span>
      </div>

      <div
        className="wt-alg-result"
        style={{
          opacity: easeOut(seg(progress, 0.78, 0.95)),
          transform: `translateY(${(1 - easeOut(seg(progress, 0.78, 0.95))) * 10}px)`,
        }}
      >
        <span className="wt-result-pill is-green">m⊥ = +1/3</span>
      </div>
    </div>
  )
}

function Alg3SolveB({ progress }: { progress: number }) {
  const subT = easeOut(seg(progress, 0.08, 0.34))
  const multT = easeInOut(seg(progress, 0.38, 0.64))
  const solveT = easeOut(seg(progress, 0.68, 0.90))

  return (
    <div className="wt-alg-stage" aria-label="Substituting P(6, 1) into y = mx + b">
      <div className="wt-alg-hint">
        {multT < 0.1
          ? 'Drop P(6, 1) and m⊥ = 1/3 into y = mx + b'
          : solveT < 0.1
            ? 'Multiply (1/3)(6) = 2'
            : 'Subtract 2 from both sides → b = −1'}
      </div>

      <div className="wt-alg-stack">
        {/* Line 1: Substitution */}
        <div className="wt-alg-row" style={{ opacity: lerp(0.35, 1, subT), transform: `translateY(${(1 - subT) * 8}px)` }}>
          <span className="wt-chip is-amber">1</span>
          <span className="wt-sym">=</span>
          <span className={`wt-chip is-teal ${multT > 0.1 && multT < 0.85 ? 'is-pulse' : ''}`}>(1/3)(6)</span>
          <span className="wt-sym">+ b</span>
        </div>

        {/* Line 2: Simplified multiplication */}
        <div
          className="wt-alg-row"
          style={{
            opacity: multT,
            transform: `translateY(${(1 - multT) * 10}px)`,
          }}
        >
          <span className="wt-chip is-amber">1</span>
          <span className="wt-sym">=</span>
          <span className="wt-chip is-blue">2</span>
          <span className="wt-sym">+ b</span>
        </div>

        {/* Line 3: Solved b and final equation */}
        <div
          className="wt-alg-row is-final"
          style={{
            opacity: solveT,
            transform: `scale(${0.92 + 0.08 * solveT})`,
          }}
        >
          <span className="wt-result-pill is-green">b = −1 &nbsp;→&nbsp; y = 1/3 x − 1</span>
        </div>
      </div>
    </div>
  )
}

function GenericStepStage({ beat, progress }: { beat: WalkthroughBeat; progress: number }) {
  const lines = beat.mathLines ?? []
  const revealCount = Math.max(1, Math.ceil(progress * lines.length))

  return (
    <div className="wt-generic-stage">
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
              >
                <MathText text={line} />
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
  switch (beat.mode) {
    case 'l1p3-vis-1':
      return <Vis1PlotSlope progress={progress} />
    case 'l1p3-vis-2':
      return <Vis2Rotate90 progress={progress} />
    case 'l1p3-vis-3':
      return <Vis3SlideToP progress={progress} />
    case 'l1p3-alg-1':
      return <Alg1IsolateY progress={progress} />
    case 'l1p3-alg-2':
      return <Alg2FlipNegate progress={progress} />
    case 'l1p3-alg-3':
      return <Alg3SolveB progress={progress} />
    default:
      return <GenericStepStage beat={beat} progress={progress} />
  }
}
