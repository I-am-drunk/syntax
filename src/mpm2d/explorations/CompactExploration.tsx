import { useState } from 'react'
import { BrilliantGraph } from '../graph'
import type { DraggablePointSpec } from '../graph'
import type { GeoScene } from '../types'
import type { ExplorationKind } from '../pageTypes'

type SoundFn = (cue: 'drag-started' | 'drag-released' | 'grid-snap') => void

function gcd(a: number, b: number): number {
  let x = Math.abs(Math.round(a))
  let y = Math.abs(Math.round(b))
  while (y) {
    const t = x % y
    x = y
    y = t
  }
  return x || 1
}

function fmtFrac(num: number, den: number, forceFraction = false): string {
  const qn = Math.round(num * 2)
  const qd = Math.round(den * 2)
  if (qd === 0) return 'undefined'
  if (qn === 0) return '0'
  const sign = (qn < 0) !== (qd < 0) ? '−' : ''
  const an = Math.abs(qn)
  const ad = Math.abs(qd)
  const g = gcd(an, ad)
  const rn = an / g
  const rd = ad / g
  if (rd === 1) return forceFraction ? `${sign}${rn}/1` : `${sign}${rn}`
  return `${sign}${rn}/${rd}`
}

function fmtSignedSum(a: number, b: number): string {
  const sa = fmtCoord(a)
  if (b < 0) return `${sa} − ${fmtCoord(Math.abs(b))}`
  return `${sa} + ${fmtCoord(b)}`
}

function fmtCoord(n: number): string {
  const s = Math.abs(n - Math.round(n)) < 1e-6 ? String(Math.round(n)) : n.toFixed(1)
  return s.replace('-', '−')
}

function lineFromPoints(p1: [number, number], p2: [number, number]) {
  const a = p1[1] - p2[1]
  const b = p2[0] - p1[0]
  const c = -(a * p1[0] + b * p1[1])
  return { a, b, c }
}

function perpThrough(p: [number, number], dir: [number, number]) {
  const a = dir[0]
  const b = dir[1]
  const c = -(a * p[0] + b * p[1])
  return { a, b, c }
}

function intersect(
  l1: { a: number; b: number; c: number },
  l2: { a: number; b: number; c: number },
): [number, number] | null {
  const det = l1.a * l2.b - l2.a * l1.b
  if (Math.abs(det) < 1e-7) return null
  return [(l1.b * l2.c - l2.b * l1.c) / det, (l2.a * l1.c - l1.a * l2.c) / det]
}

export function CompactExploration({
  kind,
  onSound,
}: {
  kind: ExplorationKind
  onSound?: SoundFn
}) {
  switch (kind) {
    case 'slope-perp':
      return <SlopePerpCompact onSound={onSound} />
    case 'midpoint':
      return <MidpointCompact onSound={onSound} />
    case 'median':
      return <MedianCompact onSound={onSound} />
    case 'length-circle':
      return <LengthCircleCompact onSound={onSound} />
    case 'right-triangle':
      return <RightTriangleCompact onSound={onSound} />
    case 'shortest-distance':
      return <ShortestDistanceCompact onSound={onSound} />
    case 'three-lines':
      return <ThreeLinesCompact onSound={onSound} />
    case 'shape-properties':
      return <ShapePropertiesCompact />
  }
}

function SlopePerpCompact({ onSound }: { onSound?: SoundFn }) {
  const [a, setA] = useState<[number, number]>([-2, -1])
  const [b, setB] = useState<[number, number]>([2, 2])
  const [focusGroup, setFocusGroup] = useState<string | null>(null)

  const dx = b[0] - a[0]
  const dy = b[1] - a[1]
  const l1 = lineFromPoints(a, b)
  const lPerp = perpThrough(a, [dx, dy])
  const valid = Math.hypot(dx, dy) > 0.01

  const scene: GeoScene = {
    xMin: -6,
    xMax: 6,
    yMin: -6,
    yMax: 6,
    lines: valid
      ? [
          {
            ...l1,
            color: 'blue',
            group: 'base',
          },
          {
            ...lPerp,
            color: 'teal',
            dashed: true,
            group: 'perp',
          },
        ]
      : [],
    rightAngles: valid
      ? [{ vertex: a, dir1: [dx, dy], dir2: [-dy, dx], color: 'teal', group: 'perp' }]
      : [],
  }

  const draggables: DraggablePointSpec[] = [
    { id: 'A', x: a[0], y: a[1], label: 'A', color: 'blue' },
    { id: 'B', x: b[0], y: b[1], label: 'B', color: 'blue' },
  ]

  return (
    <div className="geo-explore-stack">
      <div className="geo-frame">
        <BrilliantGraph
          mode="interactive"
          scene={scene}
          draggablePoints={draggables}
          snapToGrid={1}
          mergeNearbyHandles
          onFocusGroupChange={setFocusGroup}
          onSound={onSound}
          onDragPoint={(id, x, y) => {
            if (id === 'A') setA([x, y])
            if (id === 'B') setB([x, y])
          }}
        />
      </div>
      <div className="geo-slope-readout" data-focus={focusGroup ?? 'none'}>
        {!valid ? (
          <div className="is-base">
            <span>Points overlap</span>
            <strong>Drag A or B apart to form a line</strong>
          </div>
        ) : Math.abs(dy) < 1e-6 ? (
          <>
            <div className="is-base">
              <span>Slope (horizontal)</span>
              <strong>m = 0 / {Math.abs(Math.round(dx))} = 0</strong>
            </div>
            <div className="is-perp">
              <span>90° slope (vertical)</span>
              <strong>undefined (flip 0/1 → ÷0)</strong>
            </div>
          </>
        ) : Math.abs(dx) < 1e-6 ? (
          <>
            <div className="is-base">
              <span>Slope (vertical)</span>
              <strong>m = {Math.abs(Math.round(dy))} / 0 = undefined</strong>
            </div>
            <div className="is-perp">
              <span>90° slope (horizontal)</span>
              <strong>0 (0 / {Math.abs(Math.round(dy))})</strong>
            </div>
          </>
        ) : (
          <>
            <div className="is-base">
              <span>Slope</span>
              <strong>
                m = {fmtFrac(dy, dx)}
                {!fmtFrac(dy, dx).includes('/') ? ` (${fmtFrac(dy, dx, true)})` : ''}
              </strong>
            </div>
            <div className="is-perp">
              <span>90° slope (flip &amp; negate)</span>
              <strong>
                m⊥ = {fmtFrac(-dx, dy)}
                {!fmtFrac(-dx, dy).includes('/') ? ` (${fmtFrac(-dx, dy, true)})` : ''}
              </strong>
            </div>
          </>
        )}
      </div>
    </div>
  )
}

function MidpointCompact({ onSound }: { onSound?: SoundFn }) {
  const [mode, setMode] = useState<'forward' | 'reverse'>('forward')
  const [a, setA] = useState<[number, number]>([-4, -2])
  const [b, setB] = useState<[number, number]>([4, 4])
  const [mFixed, setMFixed] = useState<[number, number]>([0, 1])

  const e2: [number, number] = mode === 'forward' ? b : [2 * mFixed[0] - a[0], 2 * mFixed[1] - a[1]]
  const m: [number, number] = mode === 'forward' ? [(a[0] + b[0]) / 2, (a[1] + b[1]) / 2] : mFixed

  const pad = 2
  const maxExt = Math.max(
    7,
    Math.ceil(Math.abs(e2[0]) + pad),
    Math.ceil(Math.abs(e2[1]) + pad),
  )
  const scene: GeoScene = {
    xMin: -maxExt,
    xMax: maxExt,
    yMin: -maxExt,
    yMax: maxExt,
    segments: [
      { from: a, to: m, color: 'blue', ticks: 1 },
      { from: m, to: e2, color: 'teal', ticks: 1 },
    ],
    points:
      mode === 'forward'
        ? [{ id: 'M', x: m[0], y: m[1], label: 'M', showCoords: true, color: 'amber', emphasis: true }]
        : [{ id: 'B', x: e2[0], y: e2[1], label: 'B', showCoords: true, color: 'teal', emphasis: true }],
  }

  const draggables: DraggablePointSpec[] =
    mode === 'forward'
      ? [
          { id: 'A', x: a[0], y: a[1], label: 'A', color: 'blue' },
          { id: 'B', x: b[0], y: b[1], label: 'B', color: 'blue' },
        ]
      : [
          { id: 'A', x: a[0], y: a[1], label: 'A', color: 'blue' },
          { id: 'M', x: mFixed[0], y: mFixed[1], label: 'M', color: 'amber' },
        ]

  return (
    <div className="geo-explore-stack">
      <div className="geo-mini-tabs">
        <button
          type="button"
          className={mode === 'forward' ? 'is-active' : ''}
          onClick={() => {
            if (mode === 'reverse') setB(e2)
            setMode('forward')
          }}
        >
          Find midpoint
        </button>
        <button
          type="button"
          className={mode === 'reverse' ? 'is-active' : ''}
          onClick={() => {
            if (mode === 'forward') setMFixed(m)
            setMode('reverse')
          }}
        >
          Find missing endpoint
        </button>
      </div>
      <div className="geo-frame">
        <BrilliantGraph
          mode="interactive"
          scene={scene}
          draggablePoints={draggables}
          snapToGrid={1}
          onSound={onSound}
          onDragPoint={(id, x, y) => {
            if (id === 'A') setA([x, y])
            if (id === 'B') setB([x, y])
            if (id === 'M') setMFixed([x, y])
          }}
          caption={mode === 'forward' ? 'Drag A or B' : 'Drag endpoint A or midpoint M'}
        />
      </div>
      <div className="geo-chip-bar">
        {mode === 'forward' ? (
          <>
            <div className="geo-stat-chip is-amber">
              <span>Midpoint M</span>
              <strong>
                ({fmtCoord(m[0])}, {fmtCoord(m[1])})
              </strong>
            </div>
            <div className="geo-stat-chip">
              <span>Average</span>
              <strong>
                ({fmtSignedSum(a[0], b[0])})/2, ({fmtSignedSum(a[1], b[1])})/2
              </strong>
            </div>
          </>
        ) : (
          <>
            <div className="geo-stat-chip is-teal">
              <span>Missing B</span>
              <strong>
                ({fmtCoord(e2[0])}, {fmtCoord(e2[1])})
              </strong>
            </div>
            <div className="geo-stat-chip">
              <span>Same jump twice</span>
              <strong>
                Δx = {fmtCoord(m[0] - a[0])}, Δy = {fmtCoord(m[1] - a[1])}
              </strong>
            </div>
          </>
        )}
      </div>
    </div>
  )
}

function MedianCompact({ onSound }: { onSound?: SoundFn }) {
  const [a, setA] = useState<[number, number]>([-4, 3])
  const [b, setB] = useState<[number, number]>([2, -5])
  const [c, setC] = useState<[number, number]>([5, 2])

  const m: [number, number] = [(a[0] + b[0]) / 2, (a[1] + b[1]) / 2]
  const medLine = lineFromPoints(c, m)
  const dx = c[0] - m[0]
  const dy = c[1] - m[1]

  const scene: GeoScene = {
    xMin: -7,
    xMax: 7,
    yMin: -7,
    yMax: 7,
    polygons: [{ vertices: [a, b, c], dim: true }],
    segments: [
      { from: a, to: m, color: 'teal', ticks: 1 },
      { from: m, to: b, color: 'teal', ticks: 1 },
    ],
    lines: [{ ...medLine, color: 'amber', label: 'Median CM' }],
    points: [
      { id: 'M', x: m[0], y: m[1], label: 'M', showCoords: true, color: 'teal', emphasis: true },
    ],
  }

  return (
    <div className="geo-explore-stack">
      <div className="geo-frame">
        <BrilliantGraph
          mode="interactive"
          scene={scene}
          draggablePoints={[
            { id: 'A', x: a[0], y: a[1], label: 'A', color: 'blue' },
            { id: 'B', x: b[0], y: b[1], label: 'B', color: 'blue' },
            { id: 'C', x: c[0], y: c[1], label: 'C', color: 'amber' },
          ]}
          snapToGrid={1}
          onSound={onSound}
          onDragPoint={(id, x, y) => {
            if (id === 'A') setA([x, y])
            if (id === 'B') setB([x, y])
            if (id === 'C') setC([x, y])
          }}
          caption="Drag A, B, or corner C"
        />
      </div>
      <div className="geo-chip-bar">
        <div className="geo-stat-chip is-teal">
          <span>Midpoint M of AB</span>
          <strong>
            ({fmtCoord(m[0])}, {fmtCoord(m[1])})
          </strong>
        </div>
        <div className="geo-stat-chip is-amber">
          <span>Slope of median CM</span>
          <strong>{fmtFrac(dy, dx)}</strong>
        </div>
      </div>
    </div>
  )
}

function LengthCircleCompact({ onSound }: { onSound?: SoundFn }) {
  const [tab, setTab] = useState<'length' | 'circle'>('length')
  const [a, setA] = useState<[number, number]>([-2, -1])
  const [b, setB] = useState<[number, number]>([4, 3])
  const [p, setP] = useState<[number, number]>([3, 4])

  const dx = b[0] - a[0]
  const dy = b[1] - a[1]
  const dSq = Math.round(dx * dx + dy * dy)
  const rSq = Math.round(p[0] * p[0] + p[1] * p[1])

  const scene: GeoScene =
    tab === 'length'
      ? {
          xMin: -6,
          xMax: 6,
          yMin: -6,
          yMax: 6,
          riseRuns: [{ from: a, to: b, color: 'amber', showLabels: true }],
          segments: [{ from: a, to: b, color: 'blue', label: `√${dSq}` }],
        }
      : {
          xMin: -7,
          xMax: 7,
          yMin: -7,
          yMax: 7,
          circles: [{ cx: 0, cy: 0, r: Math.sqrt(rSq), color: 'blue' }],
          riseRuns: [{ from: [0, 0], to: p, dim: true, showLabels: false }],
          segments: [{ from: [0, 0], to: p, color: 'teal', label: `r = √${rSq}` }],
          points: [{ id: 'O', x: 0, y: 0, label: 'O', color: 'ink' }],
        }

  const draggables: DraggablePointSpec[] =
    tab === 'length'
      ? [
          { id: 'A', x: a[0], y: a[1], label: 'A', color: 'blue' },
          { id: 'B', x: b[0], y: b[1], label: 'B', color: 'blue' },
        ]
      : [{ id: 'P', x: p[0], y: p[1], label: 'P', color: 'teal' }]

  return (
    <div className="geo-explore-stack">
      <div className="geo-mini-tabs">
        <button
          type="button"
          className={tab === 'length' ? 'is-active' : ''}
          onClick={() => setTab('length')}
        >
          Length formula
        </button>
        <button
          type="button"
          className={tab === 'circle' ? 'is-active' : ''}
          onClick={() => setTab('circle')}
        >
          Circle x² + y² = r²
        </button>
      </div>
      <div className="geo-frame">
        <BrilliantGraph
          mode="interactive"
          scene={scene}
          draggablePoints={draggables}
          snapToGrid={1}
          onSound={onSound}
          onDragPoint={(id, x, y) => {
            if (id === 'A') setA([x, y])
            if (id === 'B') setB([x, y])
            if (id === 'P') setP([x, y])
          }}
          caption={tab === 'length' ? 'Drag A or B' : 'Drag P to resize the circle'}
        />
      </div>
      <div className="geo-chip-bar">
        {tab === 'length' ? (
          <>
            <div className="geo-stat-chip is-amber">
              <span>Δx² + Δy²</span>
              <strong>
                {Math.round(dx * dx)} + {Math.round(dy * dy)} = {dSq}
              </strong>
            </div>
            <div className="geo-stat-chip is-blue">
              <span>Length d</span>
              <strong>
                √{dSq} ≈ {Math.sqrt(dSq).toFixed(2)}
              </strong>
            </div>
          </>
        ) : (
          <>
            <div className="geo-stat-chip is-blue">
              <span>Equation</span>
              <strong>x² + y² = {rSq}</strong>
            </div>
            <div className="geo-stat-chip is-teal">
              <span>Radius r</span>
              <strong>
                √{rSq} ≈ {Math.sqrt(rSq).toFixed(2)}
              </strong>
            </div>
          </>
        )}
      </div>
    </div>
  )
}

function RightTriangleCompact({ onSound }: { onSound?: SoundFn }) {
  const a: [number, number] = [5, 5]
  const b: [number, number] = [-3, -1]
  const [c, setC] = useState<[number, number]>([1, -2])

  const acSq = (a[0] - c[0]) ** 2 + (a[1] - c[1]) ** 2
  const bcSq = (b[0] - c[0]) ** 2 + (b[1] - c[1]) ** 2
  const degenerate = acSq < 1e-4 || bcSq < 1e-4
  const dot = (a[0] - c[0]) * (b[0] - c[0]) + (a[1] - c[1]) * (b[1] - c[1])
  const isRight = !degenerate && Math.abs(dot) < 1e-4
  const axisPerp =
    isRight &&
    ((Math.abs(a[0] - c[0]) < 1e-6 && Math.abs(b[1] - c[1]) < 1e-6) ||
      (Math.abs(b[0] - c[0]) < 1e-6 && Math.abs(a[1] - c[1]) < 1e-6))

  const scene: GeoScene = {
    xMin: -5,
    xMax: 7,
    yMin: -5,
    yMax: 7,
    polygons: [{ vertices: [a, b, c], color: isRight ? 'green' : 'blue', fillOpacity: 0.1 }],
    rightAngles: isRight
      ? [{ vertex: c, dir1: [a[0] - c[0], a[1] - c[1]], dir2: [b[0] - c[0], b[1] - c[1]], color: 'green' }]
      : [],
    points: [
      { id: 'A', x: a[0], y: a[1], label: 'A', showCoords: true, color: 'blue' },
      { id: 'B', x: b[0], y: b[1], label: 'B', showCoords: true, color: 'blue' },
    ],
  }

  return (
    <div className="geo-explore-stack">
      <div className="geo-frame">
        <BrilliantGraph
          mode="interactive"
          scene={scene}
          draggablePoints={[{ id: 'C', x: c[0], y: c[1], label: 'C', color: isRight ? 'green' : 'amber' }]}
          snapToGrid={1}
          onSound={onSound}
          onDragPoint={(_, x, y) => setC([x, y])}
          caption="Drag C until both tests turn green (90° at C)"
        />
      </div>
      <div className="geo-chip-bar">
        <div className={`geo-stat-chip ${isRight ? 'is-green' : ''}`}>
          <span>Slopes at C</span>
          <strong>
            {degenerate
              ? 'C overlaps A or B (move C apart)'
              : axisPerp
                ? 'Horizontal ⊥ Vertical ✓'
                : `${fmtFrac(a[1] - c[1], a[0] - c[0])} · ${fmtFrac(b[1] - c[1], b[0] - c[0])} ${isRight ? '= −1 ✓' : '≠ −1'}`}
          </strong>
        </div>
        <div className={`geo-stat-chip ${isRight ? 'is-green' : ''}`}>
          <span>AC² + BC² vs AB²</span>
          <strong>
            {Math.round(acSq + bcSq)} {isRight ? '= 100 ✓' : '≠ 100'}
          </strong>
        </div>
      </div>
    </div>
  )
}

function ShortestDistanceCompact({ onSound }: { onSound?: SoundFn }) {
  const [qx, setQx] = useState(2)
  const qy = 2 * qx - 10
  const dist = Math.hypot(qx, qy)
  const isPerp = Math.abs(qx - 4) < 0.05

  // Exact valid half-step snap points along y = 2x - 10
  const lineSnapSamples: [number, number][] = []
  for (let x = 0.5; x <= 6.01; x += 0.5) {
    lineSnapSamples.push([x, 2 * x - 10])
  }

  const scene: GeoScene = {
    xMin: -2,
    xMax: 8,
    yMin: -10,
    yMax: 2,
    lines: [{ a: 2, b: -1, c: -10, color: 'blue', dim: true, label: 'y = 2x − 10' }],
    segments: [
      {
        from: [0, 0],
        to: [qx, qy],
        color: isPerp ? 'green' : 'amber',
        label: `d ≈ ${dist.toFixed(2)}`,
      },
    ],
    rightAngles: isPerp ? [{ vertex: [4, -2], dir1: [1, 2], dir2: [-2, 1], color: 'green' }] : [],
    points: [{ id: 'O', x: 0, y: 0, label: 'O', showCoords: true, color: 'ink' }],
  }

  return (
    <div className="geo-explore-stack">
      <div className="geo-frame">
        <BrilliantGraph
          mode="interactive"
          scene={scene}
          draggablePoints={[
            {
              id: 'Q',
              x: qx,
              y: qy,
              label: 'Q',
              color: isPerp ? 'green' : 'amber',
              direction: 'line',
              lineAngleDeg: (Math.atan2(2, 1) * 180) / Math.PI,
              snapSamples: lineSnapSamples,
              constrain: (x, y) => {
                const t = Math.max(0.5, Math.min(6, (x + 2 * (y + 10)) / 5))
                const snapped = Math.round(t * 2) / 2
                return [snapped, 2 * snapped - 10]
              },
            },
          ]}
          snapToGrid={null}
          onSound={onSound}
          onDragPoint={(_, x) => setQx(x)}
          caption="Slide Q along y = 2x − 10 to find the shortest path from O"
        />
      </div>
      <div className="geo-chip-bar">
        <div className={`geo-stat-chip ${isPerp ? 'is-green' : 'is-amber'}`}>
          <span>Distance OQ</span>
          <strong>
            {dist.toFixed(2)} {isPerp ? '(minimum! √20)' : ''}
          </strong>
        </div>
        <div className={`geo-stat-chip ${isPerp ? 'is-green' : ''}`}>
          <span>Slope of OQ</span>
          <strong>
            {fmtFrac(qy, qx)} {isPerp ? '⊥ 2 ✓' : '(need −1/2)'}
          </strong>
        </div>
      </div>
    </div>
  )
}

function ThreeLinesCompact({ onSound }: { onSound?: SoundFn }) {
  const [a, setA] = useState<[number, number]>([3, 4])
  const [chipFocus, setChipFocus] = useState<string | null>(null)
  const b: [number, number] = [-5, 0]
  const c: [number, number] = [3, -4]

  const m: [number, number] = [(b[0] + c[0]) / 2, (b[1] + c[1]) / 2]
  const bcDir: [number, number] = [c[0] - b[0], c[1] - b[1]]
  const bcLine = lineFromPoints(b, c)
  const medLine = lineFromPoints(a, m)
  const altLine = perpThrough(a, bcDir)
  const rbLine = perpThrough(m, bcDir)
  const altFoot = intersect(altLine, bcLine)

  // Detect collinearity (area ~ 0) and isosceles (A on right bisector of BC)
  const twiceArea = Math.abs((b[0] - a[0]) * (c[1] - a[1]) - (b[1] - a[1]) * (c[0] - a[0]))
  const isCollinear = twiceArea < 0.1
  const abDist = Math.hypot(a[0] - b[0], a[1] - b[1])
  const acDist = Math.hypot(a[0] - c[0], a[1] - c[1])
  const isIsosceles = !isCollinear && Math.abs(abDist - acDist) < 0.08

  const scene: GeoScene = {
    xMin: -7,
    xMax: 7,
    yMin: -6,
    yMax: 6,
    showAxisNumbers: false,
    polygons: [{ vertices: [a, b, c], dim: true }],
    segments: [
      { from: b, to: m, color: 'teal', ticks: 1, dim: true, group: 'median' },
      { from: m, to: c, color: 'teal', ticks: 1, dim: true, group: 'median' },
    ],
    lines: [
      { ...medLine, color: 'teal', label: 'Median', group: 'median' },
      { ...altLine, color: 'amber', label: 'Altitude', group: 'altitude' },
      { ...rbLine, color: 'violet', dashed: true, label: 'Right Bisector', group: 'rb' },
    ],
    rightAngles: [
      ...(altFoot
        ? [
            {
              vertex: altFoot,
              dir1: bcDir,
              dir2: [a[0] - altFoot[0], a[1] - altFoot[1]] as [number, number],
              color: 'amber' as const,
              group: 'altitude',
            },
          ]
        : []),
      {
        vertex: m,
        dir1: bcDir,
        dir2: [-bcDir[1], bcDir[0]],
        color: 'violet',
        group: 'rb',
      },
    ],
    points: [
      { id: 'B', x: b[0], y: b[1], label: 'B', dim: true },
      { id: 'C', x: c[0], y: c[1], label: 'C', dim: true },
      { id: 'M', x: m[0], y: m[1], label: 'M', color: 'teal', emphasis: true, group: 'median' },
      ...(altFoot && !isIsosceles
        ? [{ id: 'H', x: altFoot[0], y: altFoot[1], label: 'H', color: 'amber' as const, group: 'altitude' }]
        : []),
    ],
  }

  return (
    <div className="geo-explore-stack">
      <div className="geo-frame">
        <BrilliantGraph
          mode="interactive"
          scene={scene}
          draggablePoints={[{ id: 'A', x: a[0], y: a[1], label: 'A', color: isIsosceles ? 'green' : 'blue' }]}
          snapToGrid={1}
          externalFocusGroup={chipFocus}
          onSound={onSound}
          onDragPoint={(_, x, y) => setA([x, y])}
          caption={
            isCollinear
              ? 'A lies on line BC: drag A off BC to form a triangle'
              : isIsosceles
                ? 'Isosceles! Median, Altitude, and Right Bisector all overlap'
                : 'Drag A · Hover any line or chip below to spotlight it'
          }
        />
      </div>
      <div className="geo-chip-bar">
        <div
          className="geo-stat-chip is-teal"
          onPointerEnter={() => setChipFocus('median')}
          onPointerLeave={() => setChipFocus(null)}
        >
          <span>Median</span>
          <strong>A to midpoint M</strong>
        </div>
        <div
          className="geo-stat-chip is-amber"
          onPointerEnter={() => setChipFocus('altitude')}
          onPointerLeave={() => setChipFocus(null)}
        >
          <span>Altitude</span>
          <strong>A at 90° to BC</strong>
        </div>
        <div
          className="geo-stat-chip is-violet"
          onPointerEnter={() => setChipFocus('rb')}
          onPointerLeave={() => setChipFocus(null)}
        >
          <span>Right Bisector</span>
          <strong>M at 90° (ignores A)</strong>
        </div>
      </div>
    </div>
  )
}

function ShapePropertiesCompact() {
  type QuadKey = 'square' | 'rhombus' | 'rectangle' | 'parallelogram' | 'trapezoid'
  const [quad, setQuad] = useState<QuadKey>('square')

  const shapes: Record<QuadKey, { verts: [number, number][]; proof: string; diag: string; showDiag: boolean }> = {
    square: {
      verts: [[3, 2], [0, 4], [-2, 1], [1, -1]],
      proof: 'All 4 sides √13  ·  Adjacent slopes −2/3 & 3/2 (90°)',
      diag: 'Diagonals equal (√26), bisect each other, and meet at 90°',
      showDiag: true,
    },
    rhombus: {
      verts: [[1, 3], [5, 0], [1, -3], [-3, 0]],
      proof: 'All 4 sides = 5  ·  Corners NOT 90°',
      diag: 'Diagonals meet at 90° and bisect each other, different lengths',
      showDiag: true,
    },
    rectangle: {
      verts: [[-3, 1], [3, 4], [5, 0], [-1, -3]],
      proof: 'Opposite slopes match (1/2 & −2)  ·  Adjacent 90°',
      diag: 'Diagonals equal length and bisect each other (not 90°)',
      showDiag: true,
    },
    parallelogram: {
      verts: [[-3, 2], [2, 2], [4, -2], [-1, -2]],
      proof: 'Both pairs of opposite sides parallel (m = 0 and m = −2)',
      diag: 'Diagonals bisect each other (same midpoint)',
      showDiag: true,
    },
    trapezoid: {
      verts: [[-4, 0], [2, -3], [4, 1], [0, 3]],
      proof: 'Exactly ONE pair of opposite sides parallel (m = −1/2)',
      diag: 'Other two sides have different slopes',
      showDiag: false,
    },
  }

  const info = shapes[quad]
  const v = info.verts
  const scene: GeoScene = {
    xMin: -5,
    xMax: 6,
    yMin: -4,
    yMax: 5,
    showAxisNumbers: false,
    polygons: [{ vertices: v, color: 'blue', fillOpacity: 0.14 }],
    segments: info.showDiag
      ? [
          { from: v[0], to: v[2], color: 'teal', dashed: true, dim: true },
          { from: v[1], to: v[3], color: 'amber', dashed: true, dim: true },
        ]
      : [],
    points: v.map((pt, i) => ({
      id: `v${i}`,
      x: pt[0],
      y: pt[1],
      label: ['A', 'B', 'C', 'D'][i],
      color: 'blue',
    })),
  }

  return (
    <div className="geo-explore-stack">
      <div className="geo-mini-tabs">
        {(['square', 'rhombus', 'rectangle', 'parallelogram', 'trapezoid'] as QuadKey[]).map(k => (
          <button key={k} type="button" className={quad === k ? 'is-active' : ''} onClick={() => setQuad(k)}>
            {k[0].toUpperCase() + k.slice(1)}
          </button>
        ))}
      </div>
      <div className="geo-frame">
        <BrilliantGraph mode="display" scene={scene} caption={info.diag} />
      </div>
      <div className="geo-chip-bar">
        <div className="geo-stat-chip is-blue">
          <span>What proves it</span>
          <strong>{info.proof}</strong>
        </div>
      </div>
    </div>
  )
}
