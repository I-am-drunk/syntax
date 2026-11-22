import type { ChoicePage, GeoLesson, PlanOrderPage, ReadPlanPage } from '../pageTypes'
import type { GeoScene, MakePlanScenario, ReadPlanScenario } from '../types'
import { MAKE_PLAN_SCENARIOS, READ_PLAN_SCENARIOS } from './conferenceData'

function calmConferenceScene(scene: GeoScene): GeoScene {
  const hasOverlay = Boolean(
    (scene.lines && scene.lines.length > 0) ||
      (scene.segments && scene.segments.length > 0) ||
      (scene.circles && scene.circles.length > 0),
  )
  return {
    ...scene,
    showAxisNumbers: false,
    polygons: scene.polygons?.map(p => (hasOverlay ? { ...p, dim: true } : p)),
  }
}

// Enrich Make-a-Plan explanation graphs with the constructed target geometry
const CONSTRUCTED_SCENES: Record<string, GeoScene> = {
  'mp-1-median': {
    xMin: -5,
    xMax: 7,
    yMin: -4,
    yMax: 6,
    showAxisNumbers: false,
    polygons: [{ vertices: [[-2, 4], [-3, -2], [5, 0]], color: 'blue', dim: true }],
    segments: [{ from: [-2, 4], to: [1, -1], color: 'teal', label: 'Median' }],
    points: [
      { id: 'A', x: -2, y: 4, label: 'A', color: 'teal' },
      { id: 'B', x: -3, y: -2, label: 'B', dim: true },
      { id: 'C', x: 5, y: 0, label: 'C', dim: true },
      { id: 'M', x: 1, y: -1, label: 'M', color: 'amber', emphasis: true },
    ],
  },
  'mp-2-altitude': {
    xMin: -5,
    xMax: 7,
    yMin: -4,
    yMax: 6,
    showAxisNumbers: false,
    polygons: [{ vertices: [[0, 5], [-4, -1], [4, 1]], color: 'blue', dim: true }],
    segments: [{ from: [0, 5], to: [1.18, 0.29], color: 'amber', label: 'Altitude' }],
    rightAngles: [
      { vertex: [1.18, 0.29], dir1: [4, 1], dir2: [-1, 4], color: 'amber' },
    ],
    points: [
      { id: 'A', x: 0, y: 5, label: 'A', color: 'amber', emphasis: true },
      { id: 'B', x: -4, y: -1, label: 'B', dim: true },
      { id: 'C', x: 4, y: 1, label: 'C', dim: true },
    ],
  },
  'mp-3-right-bisector': {
    xMin: -5,
    xMax: 7,
    yMin: -4,
    yMax: 6,
    showAxisNumbers: false,
    segments: [{ from: [-2, -1], to: [4, 3], color: 'blue', ticks: 1 }],
    lines: [{ a: 3, b: 2, c: -5, color: 'violet', dashed: true, label: 'Right Bisector' }],
    rightAngles: [{ vertex: [1, 1], dir1: [3, 2], dir2: [-2, 3], color: 'violet' }],
    points: [
      { id: 'A', x: -2, y: -1, label: 'A', dim: true },
      { id: 'B', x: 4, y: 3, label: 'B', dim: true },
      { id: 'M', x: 1, y: 1, label: 'M', color: 'violet', emphasis: true },
    ],
  },
  'mp-4-shortest-dist': {
    xMin: -4,
    xMax: 7,
    yMin: -3,
    yMax: 7,
    showAxisNumbers: false,
    lines: [{ a: 1, b: -2, c: 2, color: 'blue', label: 'Line' }],
    segments: [{ from: [1, 5], to: [2.6, 2.3], color: 'green', label: 'd' }],
    rightAngles: [{ vertex: [2.6, 2.3], dir1: [2, 1], dir2: [-1, 2], color: 'green' }],
    points: [
      { id: 'P', x: 1, y: 5, label: 'P', color: 'amber', emphasis: true },
      { id: 'H', x: 2.6, y: 2.3, label: 'POI', color: 'green', emphasis: true },
    ],
  },
  'mp-8-circumcentre': {
    xMin: -2,
    xMax: 10,
    yMin: -3,
    yMax: 7,
    showAxisNumbers: false,
    polygons: [{ vertices: [[0, 0], [8, 0], [4, 4]], color: 'blue', dim: true }],
    lines: [
      { a: 1, b: 0, c: -4, color: 'violet', dashed: true },
      { a: 1, b: 1, c: -4, color: 'teal', dashed: true },
    ],
    circles: [{ cx: 4, cy: 0, r: 4, color: 'green', dashed: true }],
    points: [
      { id: 'A', x: 0, y: 0, label: 'A', dim: true },
      { id: 'B', x: 8, y: 0, label: 'B', dim: true },
      { id: 'C', x: 4, y: 4, label: 'C', dim: true },
      { id: 'O', x: 4, y: 0, label: 'Circumcentre', color: 'green', emphasis: true },
    ],
  },
}

const makeById = new Map<string, MakePlanScenario>(MAKE_PLAN_SCENARIOS.map(s => [s.id, s]))
const readById = new Map<string, ReadPlanScenario>(READ_PLAN_SCENARIOS.map(s => [s.id, s]))

function toPlanPage(
  s: MakePlanScenario,
  opts?: { defaultOralTest?: boolean },
): PlanOrderPage {
  const best = s.validPlans[0]
  const stepLines = best.steps
    .map((id, i) => {
      const b = s.pool.find(p => p.id === id)
      return b ? `${i + 1}. ${b.text}` : ''
    })
    .filter(Boolean)
  const solvedScene = CONSTRUCTED_SCENES[s.id] ?? calmConferenceScene(s.scene)

  return {
    id: s.id,
    kind: 'plan-order',
    source: `Part 1 · ${s.title}`,
    prompt: s.question,
    defaultOralTest: opts?.defaultOralTest,
    scene: calmConferenceScene(s.scene),
    pool: s.pool,
    validPlans: s.validPlans,
    missingFeedback: s.missingFeedback,
    orderFeedback: s.orderFeedback,
    explanation: {
      steps: [
        {
          text: best.explanation,
          math: stepLines.join('\n'),
          scene: solvedScene,
        },
        ...(s.validPlans.length > 1
          ? [
              {
                text: `Alternate valid plan (${s.validPlans[1].name}): ${s.validPlans[1].explanation}`,
                math: s.validPlans[1].steps
                  .map((id, i) => {
                    const b = s.pool.find(p => p.id === id)
                    return b ? `${i + 1}. ${b.text}` : ''
                  })
                  .filter(Boolean)
                  .join('\n'),
                scene: solvedScene,
              },
            ]
          : []),
      ],
    },
  }
}

function toReadPage(
  s: ReadPlanScenario,
  opts?: { blindScene?: boolean },
): ReadPlanPage {
  const finalScene = s.planSteps[s.planSteps.length - 1]?.scene ?? {
    xMin: -5,
    xMax: 5,
    yMin: -5,
    yMax: 5,
  }
  return {
    id: s.id,
    kind: 'read-plan',
    source: `Part 2 · ${s.title}`,
    prompt: `Given: ${s.given} What does this plan find or prove?`,
    blindScene: opts?.blindScene,
    planSteps: s.planSteps.map(st => ({ ...st, scene: calmConferenceScene(st.scene) })),
    options: s.options.map(o => ({
      id: o.id,
      label: o.label,
      hint: o.whyWrong,
    })),
    correctId: s.correctOptionId,
    explanation: {
      steps: [
        {
          text: s.explanation,
          scene: calmConferenceScene(finalScene),
        },
      ],
    },
  }
}

function mustMake(id: string, opts?: { defaultOralTest?: boolean }): PlanOrderPage {
  const s = makeById.get(id)
  if (!s) throw new Error(`Missing MakePlanScenario: ${id}`)
  return toPlanPage(s, opts)
}

function mustRead(id: string, opts?: { blindScene?: boolean }): ReadPlanPage {
  const s = readById.get(id)
  if (!s) throw new Error(`Missing ReadPlanScenario: ${id}`)
  return toReadPage(s, opts)
}

// ============================================================================
// NEW HIGH-YIELD ALEX IVEY CONFERENCE SCENARIOS (Closing Every Curriculum Gap)
// ============================================================================

const MP_CENTROID: PlanOrderPage = {
  id: 'mp-11-centroid',
  kind: 'plan-order',
  source: 'Part 1 · Centroid by Two Medians',
  prompt:
    'Given vertices A, B, and C of △ABC, build a full-marks plan to find the **centroid** using line equations.',
  scene: {
    xMin: -1,
    xMax: 9,
    yMin: -5,
    yMax: 6,
    showAxisNumbers: false,
    polygons: [{ vertices: [[0, 0], [4, 4], [8, -4]], color: 'blue' }],
    points: [
      { id: 'A', x: 0, y: 0, label: 'A', color: 'blue' },
      { id: 'B', x: 4, y: 4, label: 'B', color: 'blue' },
      { id: 'C', x: 8, y: -4, label: 'C', color: 'blue' },
    ],
  },
  pool: [
    { id: 'm1', text: 'Find midpoint M₁ of BC and write the equation of median AM₁', category: 'line' },
    { id: 'm2', text: 'Find midpoint M₂ of AC and write the equation of median BM₂', category: 'line' },
    { id: 'poi', text: 'Solve the linear system of the two medians to get their POI (centroid)', category: 'poi' },
    { id: 'perp', text: 'Take the negative reciprocal slope of BC', category: 'slope' },
    { id: 'len', text: 'Calculate all three side lengths AB, BC, AC', category: 'length' },
  ],
  validPlans: [
    {
      name: 'Two Medians POI',
      steps: ['m1', 'm2', 'poi'],
      explanation: 'The centroid is where the medians meet. Write two median equations and solve their POI.',
    },
    {
      name: 'Two Medians POI (swap order)',
      steps: ['m2', 'm1', 'poi'],
      explanation: 'Any two medians intersect at the exact same centroid.',
    },
  ],
  missingFeedback: [
    { missingId: 'poi', message: 'You wrote the medians, but you still need their Point of Intersection (POI).' },
  ],
  orderFeedback: [
    { before: 'm1', after: 'poi', message: 'Write both median equations before solving their linear system.' },
    { before: 'm2', after: 'poi', message: 'Write both median equations before solving their linear system.' },
  ],
  explanation: {
    steps: [
      {
        text: 'A centroid is the intersection of the medians (vertex to opposite midpoint, no 90° needed).',
        math: '1. Find midpoint M₁ of BC and write median AM₁\n2. Find midpoint M₂ of AC and write median BM₂\n3. Solve their linear system for the POI',
        scene: {
          xMin: -1,
          xMax: 9,
          yMin: -5,
          yMax: 6,
          showAxisNumbers: false,
          polygons: [{ vertices: [[0, 0], [4, 4], [8, -4]], color: 'blue', dim: true }],
          segments: [
            { from: [0, 0], to: [6, 0], color: 'teal', label: 'Median 1' },
            { from: [4, 4], to: [4, -2], color: 'amber', label: 'Median 2' },
          ],
          points: [
            { id: 'G', x: 4, y: 0, label: 'Centroid', color: 'green', emphasis: true },
          ],
        },
      },
    ],
  },
}

const MP_DIAMETER_CIRCLE: PlanOrderPage = {
  id: 'mp-12-diameter-circle',
  kind: 'plan-order',
  source: 'Part 1 · Circle from Diameter Endpoints',
  prompt:
    'Points A(−3, 4) and B(3, −4) are the endpoints of a **diameter** of a circle centred at the origin. Build a plan to write the circle equation.',
  scene: {
    xMin: -6,
    xMax: 6,
    yMin: -6,
    yMax: 6,
    showAxisNumbers: false,
    segments: [{ from: [-3, 4], to: [3, -4], color: 'blue', dashed: true }],
    points: [
      { id: 'A', x: -3, y: 4, label: 'A', color: 'blue' },
      { id: 'B', x: 3, y: -4, label: 'B', color: 'blue' },
      { id: 'O', x: 0, y: 0, label: 'O(0,0)', color: 'amber' },
    ],
  },
  pool: [
    { id: 'mid', text: 'Verify the midpoint of AB is (0, 0)', category: 'midpoint' },
    { id: 'rad', text: 'Find radius r = length from (0, 0) to A (or half the length of AB)', category: 'length' },
    { id: 'eq', text: 'Substitute r² into x² + y² = r²', category: 'line' },
    { id: 'slope', text: 'Find the negative reciprocal slope of AB', category: 'slope' },
    { id: 'sub', text: 'Plug A(−3, 4) directly into x² + y² = r² to get r²', category: 'line' },
  ],
  validPlans: [
    {
      name: 'Midpoint + Radius Length',
      steps: ['mid', 'rad', 'eq'],
      explanation: 'Confirm the centre is (0, 0), find the radius r, then plug r² into x² + y² = r².',
    },
    {
      name: 'Direct Substitution',
      steps: ['mid', 'sub', 'eq'],
      explanation: 'Since A lies on the circle centred at (0, 0), plugging A into x² + y² gives r² directly.',
    },
    {
      name: 'Fast Radius + Equation',
      steps: ['rad', 'eq'],
      explanation: 'Find the radius from origin to endpoint A, then write x² + y² = r².',
    },
  ],
  orderFeedback: [
    { before: 'rad', after: 'eq', message: 'Find r (or r²) before writing x² + y² = r².' },
  ],
  explanation: {
    steps: [
      {
        text: 'Half of the diameter is the radius r. Square it to write x² + y² = r².',
        math: '1. Verify midpoint of AB is (0, 0)\n2. Find radius r from (0, 0) to A\n3. Write x² + y² = r²',
        scene: {
          xMin: -6,
          xMax: 6,
          yMin: -6,
          yMax: 6,
          showAxisNumbers: false,
          circles: [{ cx: 0, cy: 0, r: 5, color: 'violet' }],
          segments: [{ from: [0, 0], to: [-3, 4], color: 'amber', label: 'r' }],
          points: [
            { id: 'A', x: -3, y: 4, label: 'A', color: 'blue' },
            { id: 'B', x: 3, y: -4, label: 'B', color: 'blue' },
            { id: 'O', x: 0, y: 0, label: 'O', color: 'amber', emphasis: true },
          ],
        },
      },
    ],
  },
}

const MP_TRAPEZOID: PlanOrderPage = {
  id: 'mp-13-trapezoid',
  kind: 'plan-order',
  source: 'Part 1 · Trapezoid Proof (Watch the Second Pair!)',
  prompt:
    'Given vertices A, B, C, and D in order around quadrilateral ABCD, build a complete plan to prove ABCD is a **trapezoid**.',
  scene: {
    xMin: -5,
    xMax: 5,
    yMin: -4,
    yMax: 4,
    showAxisNumbers: false,
    polygons: [{ vertices: [[-4, -1], [2, -3], [4, 1], [0, 3]], color: 'amber' }],
    points: [
      { id: 'A', x: -4, y: -1, label: 'A', color: 'blue' },
      { id: 'B', x: 2, y: -3, label: 'B', color: 'blue' },
      { id: 'C', x: 4, y: 1, label: 'C', color: 'blue' },
      { id: 'D', x: 0, y: 3, label: 'D', color: 'blue' },
    ],
  },
  pool: [
    { id: 's1', text: 'Find the slopes of all four sides AB, BC, CD, and DA', category: 'slope' },
    { id: 'par', text: 'Show one pair of opposite sides has EQUAL slopes (parallel)', category: 'compare' },
    { id: 'nonpar', text: 'Show the OTHER pair of opposite sides has DIFFERENT slopes (not parallel)', category: 'compare' },
    { id: 'len', text: 'Find the lengths of all four sides', category: 'length' },
    { id: 'perp', text: 'Show two adjacent slopes multiply to −1', category: 'slope' },
  ],
  validPlans: [
    {
      name: 'Complete Trapezoid Proof',
      steps: ['s1', 'par', 'nonpar'],
      explanation:
        'A trapezoid has EXACTLY one pair of parallel sides. You MUST check both pairs of slopes so it is not a parallelogram.',
    },
  ],
  missingFeedback: [
    {
      missingId: 'nonpar',
      message: 'Watch out! Checking only 1 parallel pair is not enough; you must also prove the other pair is NOT parallel.',
    },
  ],
  orderFeedback: [
    { before: 's1', after: 'par', message: 'Compute the four side slopes first before comparing them.' },
    { before: 's1', after: 'nonpar', message: 'Compute the four side slopes first before comparing them.' },
  ],
  explanation: {
    steps: [
      {
        text: 'Classic Alex Ivey trap: a parallelogram also has one pair of parallel sides, so a trapezoid proof MUST confirm the second pair is NOT parallel.',
        math: '1. Find slopes of all 4 sides\n2. Show 1 opposite pair has equal slopes (∥)\n3. Show the other opposite pair has unequal slopes (∦)',
        scene: {
          xMin: -5,
          xMax: 5,
          yMin: -4,
          yMax: 4,
          showAxisNumbers: false,
          polygons: [{ vertices: [[-4, -1], [2, -3], [4, 1], [0, 3]], color: 'amber', dim: true }],
          segments: [
            { from: [-4, -1], to: [2, -3], color: 'green', label: '∥' },
            { from: [0, 3], to: [4, 1], color: 'green', label: '∥' },
          ],
          points: [
            { id: 'A', x: -4, y: -1, label: 'A', color: 'blue' },
            { id: 'B', x: 2, y: -3, label: 'B', color: 'blue' },
            { id: 'C', x: 4, y: 1, label: 'C', color: 'blue' },
            { id: 'D', x: 0, y: 3, label: 'D', color: 'blue' },
          ],
        },
      },
    ],
  },
}

const MP_DIAG_PERP_BISECT: PlanOrderPage = {
  id: 'mp-14-diag-perp-bisect',
  kind: 'plan-order',
  source: 'Part 1 · Diagonals Perpendicularly Bisect',
  prompt:
    'Given quadrilateral PQRS, build a plan to verify that its **diagonals PR and QS perpendicularly bisect each other**.',
  scene: {
    xMin: -4,
    xMax: 6,
    yMin: -4,
    yMax: 4,
    showAxisNumbers: false,
    polygons: [{ vertices: [[1, 3], [5, 0], [1, -3], [-3, 0]], color: 'violet', dim: true }],
    segments: [
      { from: [1, 3], to: [1, -3], color: 'teal', dashed: true },
      { from: [-3, 0], to: [5, 0], color: 'amber', dashed: true },
    ],
    points: [
      { id: 'P', x: 1, y: 3, label: 'P', color: 'blue' },
      { id: 'Q', x: 5, y: 0, label: 'Q', color: 'blue' },
      { id: 'R', x: 1, y: -3, label: 'R', color: 'blue' },
      { id: 'S', x: -3, y: 0, label: 'S', color: 'blue' },
    ],
  },
  pool: [
    { id: 'mids', text: 'Find the midpoints of diagonal PR and diagonal QS and show they are equal', category: 'midpoint' },
    { id: 'slopes', text: 'Find the slopes of PR and QS and show they are perpendicular (m₁·m₂ = −1 or horiz ⊥ vert)', category: 'slope' },
    { id: 'sides', text: 'Calculate all four side lengths PQ, QR, RS, SP', category: 'length' },
    { id: 'area', text: 'Multiply base times height to get the area', category: 'length' },
  ],
  validPlans: [
    {
      name: 'Midpoints + Slopes of Diagonals',
      steps: ['mids', 'slopes'],
      explanation: 'Same midpoint proves they bisect each other; perpendicular slopes prove they meet at 90°.',
    },
    {
      name: 'Slopes + Midpoints of Diagonals',
      steps: ['slopes', 'mids'],
      explanation: 'Order does not matter: prove 90° with diagonal slopes and bisection with diagonal midpoints.',
    },
  ],
  missingFeedback: [
    { missingId: 'mids', message: 'You checked 90°, but you still need equal midpoints to prove they BISECT each other.' },
    { missingId: 'slopes', message: 'You checked bisection, but you still need perpendicular slopes to prove 90°.' },
  ],
  explanation: {
    steps: [
      {
        text: 'Break the phrase in two: "bisect" = same midpoint, "perpendicularly" = 90° slopes.',
        math: '1. Midpoint(PR) = Midpoint(QS)  →  bisect\n2. Slope(PR) ⊥ Slope(QS)  →  90°',
        scene: {
          xMin: -4,
          xMax: 6,
          yMin: -4,
          yMax: 4,
          showAxisNumbers: false,
          polygons: [{ vertices: [[1, 3], [5, 0], [1, -3], [-3, 0]], color: 'violet', dim: true }],
          segments: [
            { from: [1, 3], to: [1, -3], color: 'teal' },
            { from: [-3, 0], to: [5, 0], color: 'amber' },
          ],
          rightAngles: [{ vertex: [1, 0], dir1: [1, 0], dir2: [0, 1], color: 'green' }],
          points: [{ id: 'M', x: 1, y: 0, label: 'M', color: 'green', emphasis: true }],
        },
      },
    ],
  },
}

const MP_VARIGNON: PlanOrderPage = {
  id: 'mp-15-varignon',
  kind: 'plan-order',
  source: 'Part 1 · Midpoints of Any Quad (Varignon)',
  prompt:
    'Given quadrilateral ABCD, build a plan to verify that **joining the midpoints of all four sides forms a parallelogram**.',
  scene: {
    xMin: -5,
    xMax: 6,
    yMin: -4,
    yMax: 5,
    showAxisNumbers: false,
    polygons: [{ vertices: [[-4, -1], [0, 4], [5, 2], [2, -3]], color: 'blue', dim: true }],
    points: [
      { id: 'A', x: -4, y: -1, label: 'A', color: 'blue' },
      { id: 'B', x: 0, y: 4, label: 'B', color: 'blue' },
      { id: 'C', x: 5, y: 2, label: 'C', color: 'blue' },
      { id: 'D', x: 2, y: -3, label: 'D', color: 'blue' },
    ],
  },
  pool: [
    { id: 'mids', text: 'Find all four side midpoints P, Q, R, and S of AB, BC, CD, and DA', category: 'midpoint' },
    { id: 'slopes', text: 'Find the slopes of the four new sides PQ, QR, RS, and SP', category: 'slope' },
    { id: 'compare', text: 'Show both opposite pairs have equal slopes (PQ ∥ RS and QR ∥ SP)', category: 'compare' },
    { id: 'rb', text: 'Write the equations of all four right bisectors', category: 'line' },
  ],
  validPlans: [
    {
      name: 'Midpoints + Opposite Slopes',
      steps: ['mids', 'slopes', 'compare'],
      explanation: 'Find the 4 midpoints first, then show both pairs of opposite sides of PQRS are parallel.',
    },
  ],
  orderFeedback: [
    { before: 'mids', after: 'slopes', message: 'You need the midpoint coordinates P, Q, R, S before computing slopes between them.' },
  ],
  explanation: {
    steps: [
      {
        text: 'Joining the midpoints of ANY quadrilateral ALWAYS forms a parallelogram (Varignon’s theorem).',
        math: '1. Find midpoints P, Q, R, S\n2. Find slopes of PQ, QR, RS, SP\n3. Show m(PQ) = m(RS) and m(QR) = m(SP)',
        scene: {
          xMin: -5,
          xMax: 6,
          yMin: -4,
          yMax: 5,
          showAxisNumbers: false,
          polygons: [
            { vertices: [[-4, -1], [0, 4], [5, 2], [2, -3]], color: 'blue', dim: true },
            { vertices: [[-2, 1.5], [2.5, 3], [3.5, -0.5], [-1, -2]], color: 'green' },
          ],
          points: [
            { id: 'P', x: -2, y: 1.5, label: 'P', color: 'green' },
            { id: 'Q', x: 2.5, y: 3, label: 'Q', color: 'green' },
            { id: 'R', x: 3.5, y: -0.5, label: 'R', color: 'green' },
            { id: 'S', x: -1, y: -2, label: 'S', color: 'green' },
          ],
        },
      },
    ],
  },
}

const MP_CLASSIFY_TRIANGLE: PlanOrderPage = {
  id: 'mp-16-classify-triangle',
  kind: 'plan-order',
  source: 'Part 1 · Full Triangle Classification',
  prompt:
    'Given vertices A, B, and C, build a plan to **classify △ABC by BOTH side lengths and angles** (e.g., right isosceles).',
  defaultOralTest: true,
  scene: {
    xMin: -4,
    xMax: 5,
    yMin: -3,
    yMax: 5,
    showAxisNumbers: false,
    polygons: [{ vertices: [[-2, -1], [3, -1], [-2, 4]], color: 'blue' }],
    points: [
      { id: 'A', x: -2, y: -1, label: 'A', color: 'blue' },
      { id: 'B', x: 3, y: -1, label: 'B', color: 'blue' },
      { id: 'C', x: -2, y: 4, label: 'C', color: 'blue' },
    ],
  },
  pool: [
    { id: 'len', text: 'Find all three side lengths AB, BC, and AC to classify as scalene, isosceles, or equilateral', category: 'length' },
    { id: 'ang', text: 'Check slopes for a 90° corner (or test a² + b² = c²) to see if it is a right triangle', category: 'slope' },
    { id: 'mid', text: 'Find the midpoint of all three sides', category: 'midpoint' },
    { id: 'concl', text: 'Combine both results in a concluding statement', category: 'compare' },
  ],
  validPlans: [
    {
      name: 'Lengths then Angles',
      steps: ['len', 'ang', 'concl'],
      explanation: 'Side lengths give scalene/isosceles/equilateral; slopes or Pythagoras test for a 90° angle.',
    },
    {
      name: 'Angles then Lengths',
      steps: ['ang', 'len', 'concl'],
      explanation: 'Either order works as long as you test BOTH side lengths and angles.',
    },
  ],
  missingFeedback: [
    { missingId: 'len', message: 'You checked for 90°, but you also need side lengths to check isosceles vs scalene.' },
    { missingId: 'ang', message: 'You checked side lengths, but you also need slopes or Pythagoras to check for a 90° angle.' },
  ],
  explanation: {
    steps: [
      {
        text: 'A complete classification tests BOTH sides (length formula) and angles (negative reciprocal slopes or Pythagoras).',
        math: '1. Lengths AB, BC, AC → scalene / isosceles / equilateral\n2. Slopes or a² + b² = c² → right or non-right\n3. State both in your conclusion',
        scene: {
          xMin: -4,
          xMax: 5,
          yMin: -3,
          yMax: 5,
          showAxisNumbers: false,
          polygons: [{ vertices: [[-2, -1], [3, -1], [-2, 4]], color: 'green' }],
          rightAngles: [{ vertex: [-2, -1], dir1: [1, 0], dir2: [0, 1], color: 'green' }],
          points: [
            { id: 'A', x: -2, y: -1, label: 'A', color: 'green' },
            { id: 'B', x: 3, y: -1, label: 'B', color: 'blue' },
            { id: 'C', x: -2, y: 4, label: 'C', color: 'blue' },
          ],
        },
      },
    ],
  },
}

// ============================================================================
// C4: SPOT THE FLAWED PLAN & TEACHER FOLLOW-UP ("WHY?")
// ============================================================================

const FLAW_RB: ChoicePage = {
  id: 'c4-flaw-rb',
  kind: 'choice',
  layout: 'steps',
  source: 'Flawed Plan Trap · Right Bisector',
  prompt:
    'A student wrote this plan to find the **right bisector of side BC** in △ABC. Tap the step that is **wrong**.',
  scene: {
    xMin: -5,
    xMax: 6,
    yMin: -3,
    yMax: 6,
    showAxisNumbers: false,
    polygons: [{ vertices: [[-1, 5], [-4, -1], [4, 1]], color: 'blue', dim: true }],
    points: [
      { id: 'A', x: -1, y: 5, label: 'A', color: 'blue' },
      { id: 'B', x: -4, y: -1, label: 'B', color: 'blue' },
      { id: 'C', x: 4, y: 1, label: 'C', color: 'blue' },
      { id: 'M', x: 0, y: 0, label: 'M', color: 'violet', emphasis: true },
    ],
  },
  options: [
    { id: 's1', label: 'Find the midpoint M of side BC.', hint: 'Step 1 is correct: a right bisector MUST pass through midpoint M.' },
    { id: 's2', label: 'Find the slope of BC and take its negative reciprocal m⊥.', hint: 'Step 2 is correct: a right bisector meets BC at 90°.' },
    { id: 's3', label: 'Substitute m⊥ and opposite vertex A into y = mx + b to solve for b.' },
    { id: 's4', label: 'Write the final line equation y = m⊥x + b.', hint: 'Step 4 is fine once b is solved with the right point.' },
  ],
  correctId: 's3',
  explanation: {
    steps: [
      {
        text: 'Step 3 makes an ALTITUDE instead of a right bisector! A right bisector ignores vertex A and passes through midpoint M.',
        math: 'Right Bisector = m⊥ + midpoint M\nAltitude = m⊥ + opposite vertex A',
        scene: {
          xMin: -5,
          xMax: 6,
          yMin: -3,
          yMax: 6,
          showAxisNumbers: false,
          polygons: [{ vertices: [[-1, 5], [-4, -1], [4, 1]], color: 'blue', dim: true }],
          lines: [{ a: 4, b: 1, c: 0, color: 'violet', dashed: true, label: 'Right Bisector (uses M!)' }],
          rightAngles: [{ vertex: [0, 0], dir1: [4, 1], dir2: [-1, 4], color: 'violet' }],
          points: [{ id: 'M', x: 0, y: 0, label: 'M', color: 'violet', emphasis: true }],
        },
      },
    ],
  },
}

const FLAW_TRAPEZOID: ChoicePage = {
  id: 'c4-flaw-trap',
  kind: 'choice',
  layout: 'steps',
  source: 'Flawed Plan Trap · Trapezoid Proof',
  prompt:
    'A student tries to prove quadrilateral ABCD is a **trapezoid** using this plan. Tap the step that leaves the proof **incomplete**.',
  options: [
    { id: 's1', label: 'Find the slope of AB and the slope of CD.', hint: 'Finding one opposite pair of slopes is a great start.' },
    { id: 's2', label: 'Observe that m(AB) = m(CD), so AB ∥ CD.', hint: 'That correctly proves one pair of opposite sides is parallel.' },
    { id: 's3', label: 'Conclude immediately that ABCD is a trapezoid without checking BC and AD.' },
  ],
  correctId: 's3',
  explanation: {
    steps: [
      {
        text: 'If BC ∥ AD as well, then ABCD is a parallelogram! You must compute m(BC) and m(AD) and verify they are NOT equal.',
        math: 'Trapezoid requires: 1 pair ∥  AND  1 pair ∦',
        scene: {
          xMin: -5,
          xMax: 5,
          yMin: -4,
          yMax: 4,
          showAxisNumbers: false,
          polygons: [{ vertices: [[-4, -1], [2, -3], [4, 1], [0, 3]], color: 'amber' }],
          points: [
            { id: 'A', x: -4, y: -1, label: 'A', color: 'blue' },
            { id: 'B', x: 2, y: -3, label: 'B', color: 'blue' },
            { id: 'C', x: 4, y: 1, label: 'C', color: 'blue' },
            { id: 'D', x: 0, y: 3, label: 'D', color: 'blue' },
          ],
        },
      },
    ],
  },
}

const FLAW_SQUARE: ChoicePage = {
  id: 'c4-flaw-square',
  kind: 'choice',
  layout: 'steps',
  source: 'Flawed Plan Trap · Rhombus vs Square',
  prompt:
    'A student wants to prove quadrilateral PQRS is a **square**. Tap the step where their logic breaks.',
  options: [
    { id: 's1', label: 'Use the length formula to calculate PQ, QR, RS, and SP.', hint: 'Checking all 4 side lengths is valid for a square.' },
    { id: 's2', label: 'Show all four lengths are equal (√13).', hint: 'Good, all 4 sides are equal, so it is at least a rhombus.' },
    { id: 's3', label: 'Conclude PQRS is a square because all four sides are equal.' },
  ],
  correctId: 's3',
  explanation: {
    steps: [
      {
        text: 'Four equal sides only proves a RHOMBUS! You must also prove at least one 90° corner (adjacent slopes multiply to −1, or diagonals have equal length).',
        math: '4 equal sides = Rhombus\n4 equal sides + one 90° corner = Square',
        scene: {
          xMin: -4,
          xMax: 6,
          yMin: -4,
          yMax: 4,
          showAxisNumbers: false,
          polygons: [{ vertices: [[1, 3], [5, 0], [1, -3], [-3, 0]], color: 'violet' }],
          points: [
            { id: 'P', x: 1, y: 3, label: 'P', color: 'violet' },
            { id: 'Q', x: 5, y: 0, label: 'Q', color: 'violet' },
            { id: 'R', x: 1, y: -3, label: 'R', color: 'violet' },
            { id: 'S', x: -3, y: 0, label: 'S', color: 'violet' },
          ],
        },
      },
    ],
  },
}

const FLAW_SHORTEST: ChoicePage = {
  id: 'c4-flaw-shortest',
  kind: 'choice',
  layout: 'steps',
  source: 'Flawed Plan Trap · Shortest Distance',
  prompt:
    'A student wants the **shortest distance** from point P to line L: 2x − y + 3 = 0. Tap the broken step.',
  options: [
    { id: 's1', label: 'Isolate y in line L to read its slope m = 2.', hint: 'Step 1 is right: y = 2x + 3 has slope 2.' },
    { id: 's2', label: 'Write a new line through P using the SAME slope m = 2.' },
    { id: 's3', label: 'Solve the linear system of the two lines to get the POI.', hint: 'You DO solve the system once the second line is perpendicular.' },
    { id: 's4', label: 'Use the length formula between P and the POI.', hint: 'Step 4 is right once you have the perpendicular foot.' },
  ],
  correctId: 's2',
  explanation: {
    steps: [
      {
        text: 'Same slope makes a PARALLEL line that never intersects line L! Shortest distance must drop at 90°, so use the negative reciprocal m⊥ = −1/2.',
        math: 'm = 2  →  m⊥ = −1/2 (not 2!)',
        scene: CONSTRUCTED_SCENES['mp-4-shortest-dist'],
      },
    ],
  },
}

const FLAW_CIRCUMCENTRE_CHECK: ChoicePage = {
  id: 'c4-chk-circumcentre',
  kind: 'choice',
  layout: 'steps',
  source: 'Check · Flawed Centre Plan',
  prompt:
    'A student wants to find a hospital location **equidistant from three towns A, B, and C**. Tap the broken step.',
  options: [
    { id: 's1', label: 'Find the midpoint M₁ of AB and midpoint M₂ of BC.', hint: 'You DO need two side midpoints for right bisectors.' },
    { id: 's2', label: 'Write the equations of medians CM₁ and AM₂.' },
    { id: 's3', label: 'Solve the linear system of the two lines to find their POI.', hint: 'Intersecting the two lines IS the final step once you use the right lines.' },
  ],
  correctId: 's2',
  explanation: {
    steps: [
      {
        text: 'Medians meet at the CENTROID (balance point), NOT the point equidistant from A, B, and C! Equidistant from vertices = CIRCUMCENTRE = intersection of two RIGHT BISECTORS.',
        math: 'Equidistant from vertices → 2 Right Bisectors → Circumcentre',
        scene: CONSTRUCTED_SCENES['mp-8-circumcentre'],
      },
    ],
  },
}

const WHY_FOLLOWUP_SQUARE: ChoicePage = {
  id: 'c4-chk-why-square',
  kind: 'choice',
  source: 'Check · Teacher Follow-Up ("Why?")',
  prompt:
    'Alex asks you live: *"You only checked 4 equal side lengths. Why is that NOT enough to prove ABCD is a square?"* Pick the sharpest oral answer.',
  options: [
    {
      id: 'a',
      label: 'A rhombus also has 4 equal sides, so I must also prove a 90° angle (e.g., adjacent slopes multiply to −1).',
    },
    {
      id: 'b',
      label: 'Because a rectangle has 4 equal sides too.',
      hint: 'A rectangle only has opposite sides equal, not necessarily all 4.',
    },
    {
      id: 'c',
      label: 'Because I forgot to find the midpoints of all 4 sides.',
      hint: 'Side midpoints are not needed to prove a square.',
    },
    {
      id: 'd',
      label: 'Because I also need to find the area of the square.',
      hint: 'Area does not prove 90° corners.',
    },
  ],
  correctId: 'a',
  explanation: {
    steps: [
      {
        text: 'Every square is a rhombus, but a slanted rhombus has 4 equal sides with NO 90° corners. Adding ONE 90° corner locks all four corners to 90°.',
        scene: {
          xMin: -4,
          xMax: 6,
          yMin: -4,
          yMax: 4,
          showAxisNumbers: false,
          polygons: [{ vertices: [[1, 3], [5, 0], [1, -3], [-3, 0]], color: 'violet' }],
          points: [],
        },
      },
    ],
  },
}

const WHY_FOLLOWUP_VERT_HORIZ: ChoicePage = {
  id: 'c4-chk-why-vh',
  kind: 'choice',
  source: 'Check · Teacher Follow-Up ("Why?")',
  prompt:
    'Alex asks: *"Side AB has slope 0 and side BC has undefined slope. You cannot multiply 0 · undefined = −1. How do you still prove ∠B = 90°?"*',
  options: [
    {
      id: 'a',
      label: 'Slope 0 means AB is horizontal and undefined slope means BC is vertical, and every horizontal line is perpendicular to every vertical line.',
    },
    {
      id: 'b',
      label: 'You cannot prove ∠B = 90° unless both slopes are fractions.',
      hint: 'Horizontal and vertical lines meet at 90° even though vertical slope is undefined!',
    },
    {
      id: 'c',
      label: 'Flip 0 to get 1/0 = 0, so both slopes are equal.',
      hint: '1/0 is undefined, not 0, and equal slopes mean parallel, not 90°.',
    },
    {
      id: 'd',
      label: 'Use the midpoint formula on AB and BC.',
      hint: 'Midpoints do not prove a 90° angle.',
    },
  ],
  correctId: 'a',
  explanation: {
    steps: [
      {
        text: 'State it out loud cleanly: m(AB) = 0 (horizontal) and m(BC) = undefined (vertical), therefore AB ⊥ BC and ∠B = 90°.',
        math: 'm = 0 (horizontal)  ⊥  m = undefined (vertical)',
        scene: {
          xMin: -4,
          xMax: 5,
          yMin: -3,
          yMax: 5,
          showAxisNumbers: false,
          segments: [
            { from: [-2, -1], to: [3, -1], color: 'blue', label: 'm = 0' },
            { from: [-2, -1], to: [-2, 4], color: 'teal', label: 'm = undef' },
          ],
          rightAngles: [{ vertex: [-2, -1], dir1: [1, 0], dir2: [0, 1], color: 'green' }],
          points: [{ id: 'B', x: -2, y: -1, label: 'B', color: 'green' }],
        },
      },
    ],
  },
}

// ============================================================================
// LEVEL 3: 5 BITE-SIZED 4-MINUTE ORAL CONFERENCE SPRINTS (TUE NOV 24)
// ============================================================================

export const UNIT2_CONFERENCE: GeoLesson[] = [
  {
    id: 'u2-c1-triangle-lines',
    level: 3,
    number: 10,
    title: 'Sprint 1: Triangle Lines & Centres',
    shortTitle: 'C1 · Lines & Centres',
    subtitle: 'Median, altitude, right bisector, centroid & circumcentre plans',
    isReview: true,
    completionColor: '#764dff',
    completionRiveColor: 0,
    pages: [
      mustMake('mp-1-median'),
      mustMake('mp-2-altitude'),
      mustMake('mp-3-right-bisector'),
      MP_CENTROID,
    ],
    checks: [
      mustMake('mp-8-circumcentre'),
      mustRead('rp-1-median', { blindScene: true }),
      mustRead('rp-5-circumcentre', { blindScene: true }),
    ],
  },
  {
    id: 'u2-c2-distance-circles',
    level: 3,
    number: 11,
    title: 'Sprint 2: Distance, Circles & Area',
    shortTitle: 'C2 · Dist & Circles',
    subtitle: 'Shortest distance, diameter → circle, chord RB, and triangle area',
    isReview: true,
    completionColor: '#00a896',
    completionRiveColor: 1,
    pages: [
      mustMake('mp-4-shortest-dist'),
      MP_DIAMETER_CIRCLE,
      mustMake('mp-10-chord'),
      mustMake('mp-9-area'),
    ],
    checks: [
      mustRead('rp-3-shortest-dist', { blindScene: true }),
      mustRead('rp-7-chord', { blindScene: true }),
      mustRead('rp-8-area', { blindScene: true }),
    ],
  },
  {
    id: 'u2-c3-shapes-proofs',
    level: 3,
    number: 12,
    title: 'Sprint 3: Triangles & Quad Proofs',
    shortTitle: 'C3 · Shape Proofs',
    subtitle: 'Right triangles, trapezoids, rectangles, squares, and diagonals',
    isReview: true,
    completionColor: '#246bfd',
    completionRiveColor: 2,
    pages: [
      mustMake('mp-5-right-triangle'),
      MP_TRAPEZOID,
      mustMake('mp-6-rectangle'),
      MP_DIAG_PERP_BISECT,
    ],
    checks: [
      mustMake('mp-7-square'),
      mustRead('rp-4-midsegment', { blindScene: true }),
      mustRead('rp-10-rhombus-trap', { blindScene: true }),
    ],
  },
  {
    id: 'u2-c4-flawed-plans',
    level: 3,
    number: 13,
    title: 'Sprint 4: Spot the Flaw & "Why?"',
    shortTitle: 'C4 · Flaws & Why?',
    subtitle: 'Catch broken plans fast and nail Alex’s live follow-up questions',
    isReview: true,
    completionColor: '#f59e0b',
    completionRiveColor: 0,
    pages: [FLAW_RB, FLAW_TRAPEZOID, FLAW_SQUARE, FLAW_SHORTEST],
    checks: [FLAW_CIRCUMCENTRE_CHECK, WHY_FOLLOWUP_SQUARE, WHY_FOLLOWUP_VERT_HORIZ],
  },
  {
    id: 'u2-c5-oral-sim',
    level: 3,
    number: 14,
    title: 'Sprint 5: Live Oral Conference Sim',
    shortTitle: 'C5 · Oral Sim',
    subtitle: 'Cold recall with hidden tiles & blind plans (just like Tuesday!)',
    isReview: true,
    completionColor: '#16a34a',
    completionRiveColor: 1,
    pages: [
      MP_VARIGNON,
      mustRead('rp-2-altitude', { blindScene: true }),
      mustRead('rp-6-centroid', { blindScene: true }),
      mustRead('rp-9-hyp-mid', { blindScene: true }),
    ],
    checks: [
      { ...MP_CLASSIFY_TRIANGLE, id: 'c5-chk-classify' },
      { ...mustMake('mp-4-shortest-dist', { defaultOralTest: true }), id: 'c5-chk-shortest-oral' },
      { ...mustRead('rp-10-rhombus-trap', { blindScene: true }), id: 'c5-chk-rhombus-oral' },
    ],
  },
]
