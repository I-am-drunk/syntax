import type { GeoLesson } from '../pageTypes'
import type { GeoLine } from '../types'

function lineEq(
  m: number,
  b: number,
  opts?: Partial<Omit<GeoLine, 'a' | 'b' | 'c'>>,
): GeoLine {
  return { a: m, b: -1, c: b, ...opts }
}

export const UNIT2_MOCK: GeoLesson[] = [
  // =========================================================================
  // MOCK PART A · Open-Notes Execution Capstones (Lines, Area & Centres)
  // =========================================================================
  {
    id: 'u2-m1-mock-a',
    level: 4,
    number: 15,
    title: 'Open-Notes Mock A: Lines & Centres',
    shortTitle: 'Mock A · Lines',
    subtitle: '3 unseen full-solution capstones: open Pen Studio (P) and work each step',
    isReview: true,
    completionColor: '#246bfd',
    completionRiveColor: 0,
    pages: [
      {
        id: 'm1-p1-median-ms',
        kind: 'multi-step',
        source: 'Open-Notes Capstone 1 · Median & Length',
        prompt:
          'Triangle **PQR** has vertices **P(−2, 7)**, **Q(−4, −1)**, and **R(6, 3)**. Open your pen canvas (P) to find the equation and exact length of **median PM**.',
        plan: [
          'Find midpoint M of opposite side QR',
          'Find slope of PM and solve y = mx + b using P or M',
          'Use length formula for exact length PM',
        ],
        steps: [
          {
            id: 'mid',
            label: 'Midpoint M of QR',
            prompt: 'Step 1: Find the midpoint **M** of side **QR**, where Q(−4, −1) and R(6, 3).',
            placeholder: '(x, y)',
            nudge: 'Midpoint ADDS coordinates then divides by 2.',
            ledgerResult: 'M = (1, 1)',
            scene: {
              xMin: -6,
              xMax: 8,
              yMin: -3,
              yMax: 9,
              polygons: [{ vertices: [[-2, 7], [-4, -1], [6, 3]], color: 'blue', fillOpacity: 0.08 }],
              points: [
                { id: 'P', x: -2, y: 7, label: 'P', showCoords: true, color: 'blue' },
                { id: 'Q', x: -4, y: -1, label: 'Q', showCoords: true, color: 'blue' },
                { id: 'R', x: 6, y: 3, label: 'R', showCoords: true, color: 'blue' },
              ],
            },
            solvedScene: {
              xMin: -6,
              xMax: 8,
              yMin: -3,
              yMax: 9,
              polygons: [{ vertices: [[-2, 7], [-4, -1], [6, 3]], color: 'blue', fillOpacity: 0.06 }],
              points: [
                { id: 'P', x: -2, y: 7, label: 'P', showCoords: true, color: 'blue' },
                { id: 'Q', x: -4, y: -1, label: 'Q', color: 'blue' },
                { id: 'R', x: 6, y: 3, label: 'R', color: 'blue' },
                { id: 'M', x: 1, y: 1, label: 'M(1, 1)', color: 'amber', emphasis: true },
              ],
            },
            answer: {
              kind: 'point',
              expected: [1, 1],
              display: '(1, 1)',
              commonMistakes: [
                {
                  value: [-5, -2],
                  message: 'You subtracted Q − R instead of adding! Midpoint adds: (−4 + 6)/2 and (−1 + 3)/2.',
                },
                {
                  value: [2, 2],
                  message: 'Don’t forget to divide both sums by 2!',
                },
              ],
            },
          },
          {
            id: 'eq',
            label: 'Equation of median PM',
            prompt: 'Step 2: Write the equation of **median PM** joining **P(−2, 7)** and **M(1, 1)**.',
            placeholder: 'y = mx + b',
            nudge: 'Find m = (1 − 7)/(1 − (−2)), then plug M(1, 1) into y = mx + b.',
            ledgerResult: 'y = −2x + 3',
            scene: {
              xMin: -6,
              xMax: 8,
              yMin: -3,
              yMax: 9,
              polygons: [{ vertices: [[-2, 7], [-4, -1], [6, 3]], color: 'blue', fillOpacity: 0.06 }],
              points: [
                { id: 'P', x: -2, y: 7, label: 'P(−2, 7)', color: 'blue' },
                { id: 'Q', x: -4, y: -1, label: 'Q', dim: true },
                { id: 'R', x: 6, y: 3, label: 'R', dim: true },
                { id: 'M', x: 1, y: 1, label: 'M(1, 1)', color: 'amber', emphasis: true },
              ],
            },
            solvedScene: {
              xMin: -6,
              xMax: 8,
              yMin: -3,
              yMax: 9,
              polygons: [{ vertices: [[-2, 7], [-4, -1], [6, 3]], color: 'blue', fillOpacity: 0.06 }],
              segments: [{ from: [-2, 7], to: [1, 1], color: 'teal', width: 2.8, label: 'y = −2x + 3' }],
              points: [
                { id: 'P', x: -2, y: 7, label: 'P', color: 'teal' },
                { id: 'M', x: 1, y: 1, label: 'M(1, 1)', color: 'amber', emphasis: true },
              ],
            },
            answer: {
              kind: 'line',
              expected: { a: -2, b: -1, c: 3 },
              display: 'y = −2x + 3',
            },
          },
          {
            id: 'len',
            label: 'Exact length of PM',
            prompt: 'Step 3: Find the **exact length** of median **PM** from P(−2, 7) to M(1, 1).',
            placeholder: 'e.g. √45 or 3√5',
            nudge: 'Compute √((1 − (−2))² + (1 − 7)²) and leave it as an exact radical.',
            ledgerResult: 'PM = √45 = 3√5',
            scene: {
              xMin: -6,
              xMax: 8,
              yMin: -3,
              yMax: 9,
              polygons: [{ vertices: [[-2, 7], [-4, -1], [6, 3]], color: 'blue', fillOpacity: 0.06 }],
              segments: [{ from: [-2, 7], to: [1, 1], color: 'teal', width: 2.8 }],
              points: [
                { id: 'P', x: -2, y: 7, label: 'P(−2, 7)', color: 'teal' },
                { id: 'M', x: 1, y: 1, label: 'M(1, 1)', color: 'amber', emphasis: true },
              ],
            },
            solvedScene: {
              xMin: -6,
              xMax: 8,
              yMin: -3,
              yMax: 9,
              polygons: [{ vertices: [[-2, 7], [-4, -1], [6, 3]], color: 'blue', fillOpacity: 0.06 }],
              segments: [{ from: [-2, 7], to: [1, 1], color: 'green', width: 3, label: '√45' }],
              points: [
                { id: 'P', x: -2, y: 7, label: 'P', color: 'green' },
                { id: 'M', x: 1, y: 1, label: 'M', color: 'green' },
              ],
            },
            answer: {
              kind: 'number',
              expected: Math.sqrt(45),
              exactRequired: true,
              display: '√45 (or 3√5)',
              commonMistakes: [
                {
                  value: 45,
                  message: '45 is PM². Take the square root to get √45 (or 3√5)!',
                },
                {
                  value: Math.sqrt(37),
                  message: 'Check Δx = 1 − (−2) = 3, so Δx² = 9 (not 1).',
                },
              ],
            },
          },
        ],
        explanation: {
          steps: [
            {
              text: 'Midpoint of QR is M((−4 + 6)/2, (−1 + 3)/2) = (1, 1). Slope of PM is (1 − 7)/(1 + 2) = −2, giving y = −2x + 3.',
              math: 'M = (1, 1)  ·  y = −2x + 3  ·  PM = √(3² + (−6)²) = √45 = 3√5',
              scene: {
                xMin: -6,
                xMax: 8,
                yMin: -3,
                yMax: 9,
                polygons: [{ vertices: [[-2, 7], [-4, -1], [6, 3]], color: 'blue', fillOpacity: 0.06 }],
                segments: [{ from: [-2, 7], to: [1, 1], color: 'green', width: 3, label: '3√5' }],
                points: [
                  { id: 'P', x: -2, y: 7, label: 'P', color: 'green' },
                  { id: 'M', x: 1, y: 1, label: 'M(1, 1)', color: 'green' },
                ],
              },
            },
          ],
        },
      },
      {
        id: 'm1-p2-altitude-area-ms',
        kind: 'multi-step',
        source: 'Open-Notes Capstone 2 · Altitude & Exact Area',
        prompt:
          'Triangle **ABC** has vertices **A(0, 0)**, **B(4, 2)**, and **C(0, 5)**. Find the exact **area** of △ABC by dropping an altitude from **C** to base **AB**.',
        plan: [
          'Find slope of base AB (line y = 1/2 x)',
          'Write altitude equation from C(0, 5) using m⊥',
          'Solve system of base AB & altitude for foot H (POI)',
          'Compute exact Area = 1/2 · base(AB) · height(CH)',
        ],
        steps: [
          {
            id: 'alt',
            label: 'Altitude from C to AB',
            prompt:
              'Step 1: Base **AB** joins A(0, 0) to B(4, 2) (line **y = 1/2 x**). Write the equation of the **altitude** from **C(0, 5)**.',
            placeholder: 'y = mx + b',
            nudge: 'Flip and negate m = 1/2 to get m⊥ = −2, and C(0, 5) gives b = 5 directly!',
            ledgerResult: 'y = −2x + 5',
            scene: {
              xMin: -1,
              xMax: 6,
              yMin: -1,
              yMax: 6,
              polygons: [{ vertices: [[0, 0], [4, 2], [0, 5]], color: 'blue', fillOpacity: 0.08 }],
              points: [
                { id: 'A', x: 0, y: 0, label: 'A(0,0)', color: 'blue' },
                { id: 'B', x: 4, y: 2, label: 'B(4,2)', color: 'blue' },
                { id: 'C', x: 0, y: 5, label: 'C(0,5)', color: 'amber', emphasis: true },
              ],
            },
            solvedScene: {
              xMin: -1,
              xMax: 6,
              yMin: -1,
              yMax: 6,
              polygons: [{ vertices: [[0, 0], [4, 2], [0, 5]], color: 'blue', fillOpacity: 0.06 }],
              lines: [lineEq(-2, 5, { color: 'amber', dashed: true, label: 'y = −2x + 5' })],
              points: [
                { id: 'A', x: 0, y: 0, label: 'A', color: 'blue' },
                { id: 'B', x: 4, y: 2, label: 'B', color: 'blue' },
                { id: 'C', x: 0, y: 5, label: 'C(0,5)', color: 'amber', emphasis: true },
              ],
            },
            answer: {
              kind: 'line',
              expected: { a: -2, b: -1, c: 5 },
              display: 'y = −2x + 5',
            },
          },
          {
            id: 'poi',
            label: 'Foot of altitude H (POI)',
            prompt: 'Step 2: Solve the system **y = 1/2 x** and **y = −2x + 5** to find the foot **H**.',
            placeholder: '(x, y)',
            nudge: 'Set 1/2 x = −2x + 5, multiply everything by 2 to kill the fraction!',
            ledgerResult: 'H = (2, 1)',
            scene: {
              xMin: -1,
              xMax: 6,
              yMin: -1,
              yMax: 6,
              polygons: [{ vertices: [[0, 0], [4, 2], [0, 5]], color: 'blue', fillOpacity: 0.06 }],
              lines: [
                lineEq(0.5, 0, { color: 'blue', dim: true }),
                lineEq(-2, 5, { color: 'amber', dashed: true }),
              ],
              points: [
                { id: 'C', x: 0, y: 5, label: 'C(0,5)', color: 'amber' },
              ],
            },
            solvedScene: {
              xMin: -1,
              xMax: 6,
              yMin: -1,
              yMax: 6,
              polygons: [{ vertices: [[0, 0], [4, 2], [0, 5]], color: 'blue', fillOpacity: 0.06 }],
              segments: [{ from: [0, 5], to: [2, 1], color: 'amber', width: 2.6, label: 'h' }],
              rightAngles: [{ vertex: [2, 1], dir1: [2, 1], dir2: [-1, 2], color: 'amber' }],
              points: [
                { id: 'C', x: 0, y: 5, label: 'C', color: 'amber' },
                { id: 'H', x: 2, y: 1, label: 'H(2, 1)', color: 'green', emphasis: true },
              ],
            },
            answer: {
              kind: 'point',
              expected: [2, 1],
              display: '(2, 1)',
              commonMistakes: [
                {
                  value: [1, 2],
                  message: 'Swapped x and y! x = 2, then y = 1/2 (2) = 1.',
                },
              ],
            },
          },
          {
            id: 'area',
            label: 'Exact area of △ABC',
            prompt:
              'Step 3: Keep lengths **AB** and **CH** as exact radicals and compute **Area = 1/2 · AB · CH**.',
            placeholder: 'e.g. 10',
            nudge: 'AB = √20 and CH = √20, so √20 · √20 = 20!',
            ledgerResult: 'Area = 10',
            scene: {
              xMin: -1,
              xMax: 6,
              yMin: -1,
              yMax: 6,
              polygons: [{ vertices: [[0, 0], [4, 2], [0, 5]], color: 'blue', fillOpacity: 0.08 }],
              segments: [
                { from: [0, 0], to: [4, 2], color: 'blue', width: 2.6, label: 'base AB' },
                { from: [0, 5], to: [2, 1], color: 'amber', width: 2.6, label: 'height CH' },
              ],
              rightAngles: [{ vertex: [2, 1], dir1: [2, 1], dir2: [-1, 2], color: 'amber' }],
              points: [
                { id: 'H', x: 2, y: 1, label: 'H(2, 1)', color: 'green' },
              ],
            },
            solvedScene: {
              xMin: -1,
              xMax: 6,
              yMin: -1,
              yMax: 6,
              polygons: [{ vertices: [[0, 0], [4, 2], [0, 5]], color: 'green', fillOpacity: 0.16 }],
              segments: [
                { from: [0, 0], to: [4, 2], color: 'green', label: '√20' },
                { from: [0, 5], to: [2, 1], color: 'green', label: '√20' },
              ],
              rightAngles: [{ vertex: [2, 1], dir1: [2, 1], dir2: [-1, 2], color: 'green' }],
            },
            answer: {
              kind: 'number',
              expected: 10,
              display: '10',
              commonMistakes: [
                {
                  value: 20,
                  message: 'You computed base · height = 20, don’t forget the 1/2 in triangle area!',
                },
              ],
            },
          },
        ],
        explanation: {
          steps: [
            {
              text: 'Notice how keeping radicals exact turns √20 · √20 straight into 20 with zero rounding error!',
              math: 'AB = √20, CH = √20  ⇒  Area = 1/2 · √20 · √20 = 10',
              scene: {
                xMin: -1,
                xMax: 6,
                yMin: -1,
                yMax: 6,
                polygons: [{ vertices: [[0, 0], [4, 2], [0, 5]], color: 'green', fillOpacity: 0.16 }],
                segments: [{ from: [0, 5], to: [2, 1], color: 'green', label: '√20' }],
                rightAngles: [{ vertex: [2, 1], dir1: [2, 1], dir2: [-1, 2], color: 'green' }],
              },
            },
          ],
        },
      },
    ],
    checks: [
      {
        id: 'm1-chk-circumcentre-ms',
        kind: 'multi-step',
        source: 'Open-Notes Capstone 3 · Circumcentre (3-Tower Relay)',
        prompt:
          'Three cell towers stand at **A(0, 0)**, **B(6, 0)**, and **C(0, 8)**. Find the **circumcentre** (equidistant from all three towers) using two right bisectors.',
        plan: [
          'Write right bisector of horizontal side AB',
          'Write right bisector of vertical side AC',
          'Intersect the two right bisectors for the circumcentre POI',
        ],
        steps: [
          {
            id: 'rb1',
            label: 'Right bisector of AB',
            prompt:
              'Step 1: Side **AB** joins A(0, 0) to B(6, 0) (horizontal). Write the equation of the **right bisector** of AB.',
            placeholder: 'x = ...',
            nudge: 'A vertical line through midpoint (3, 0) has equation x = 3.',
            ledgerResult: 'x = 3',
            scene: {
              xMin: -1,
              xMax: 8,
              yMin: -1,
              yMax: 9,
              polygons: [{ vertices: [[0, 0], [6, 0], [0, 8]], color: 'blue', fillOpacity: 0.08 }],
              points: [
                { id: 'A', x: 0, y: 0, label: 'A(0,0)', color: 'blue' },
                { id: 'B', x: 6, y: 0, label: 'B(6,0)', color: 'blue' },
                { id: 'C', x: 0, y: 8, label: 'C(0,8)', color: 'blue' },
              ],
            },
            solvedScene: {
              xMin: -1,
              xMax: 8,
              yMin: -1,
              yMax: 9,
              polygons: [{ vertices: [[0, 0], [6, 0], [0, 8]], color: 'blue', fillOpacity: 0.06 }],
              lines: [{ a: 1, b: 0, c: -3, color: 'violet', dashed: true, label: 'x = 3' }],
              points: [{ id: 'M1', x: 3, y: 0, label: 'M₁(3,0)', color: 'violet' }],
            },
            answer: {
              kind: 'line',
              expected: { a: 1, b: 0, c: -3 },
              display: 'x = 3',
            },
          },
          {
            id: 'rb2',
            label: 'Right bisector of AC',
            prompt:
              'Step 2: Side **AC** joins A(0, 0) to C(0, 8) (vertical). Write the equation of the **right bisector** of AC.',
            placeholder: 'y = ...',
            nudge: 'A horizontal line through midpoint (0, 4) has equation y = 4.',
            ledgerResult: 'y = 4',
            scene: {
              xMin: -1,
              xMax: 8,
              yMin: -1,
              yMax: 9,
              polygons: [{ vertices: [[0, 0], [6, 0], [0, 8]], color: 'blue', fillOpacity: 0.06 }],
              lines: [{ a: 1, b: 0, c: -3, color: 'violet', dashed: true, label: 'x = 3' }],
              points: [
                { id: 'A', x: 0, y: 0, label: 'A(0,0)', color: 'blue' },
                { id: 'C', x: 0, y: 8, label: 'C(0,8)', color: 'blue' },
              ],
            },
            solvedScene: {
              xMin: -1,
              xMax: 8,
              yMin: -1,
              yMax: 9,
              polygons: [{ vertices: [[0, 0], [6, 0], [0, 8]], color: 'blue', fillOpacity: 0.06 }],
              lines: [
                { a: 1, b: 0, c: -3, color: 'violet', dashed: true, label: 'x = 3' },
                { a: 0, b: 1, c: -4, color: 'teal', dashed: true, label: 'y = 4' },
              ],
            },
            answer: {
              kind: 'line',
              expected: { a: 0, b: 1, c: -4 },
              display: 'y = 4',
            },
          },
          {
            id: 'poi',
            label: 'Circumcentre POI',
            prompt: 'Step 3: What is the **circumcentre** (intersection of x = 3 and y = 4)?',
            placeholder: '(x, y)',
            ledgerResult: '(3, 4)',
            scene: {
              xMin: -1,
              xMax: 8,
              yMin: -1,
              yMax: 9,
              polygons: [{ vertices: [[0, 0], [6, 0], [0, 8]], color: 'blue', fillOpacity: 0.06 }],
              lines: [
                { a: 1, b: 0, c: -3, color: 'violet', dashed: true, label: 'x = 3' },
                { a: 0, b: 1, c: -4, color: 'teal', dashed: true, label: 'y = 4' },
              ],
            },
            solvedScene: {
              xMin: -2,
              xMax: 9,
              yMin: -2,
              yMax: 10,
              polygons: [{ vertices: [[0, 0], [6, 0], [0, 8]], color: 'blue', fillOpacity: 0.06 }],
              circles: [{ cx: 3, cy: 4, r: 5, color: 'green', dashed: true }],
              points: [
                { id: 'A', x: 0, y: 0, label: 'A', color: 'blue' },
                { id: 'B', x: 6, y: 0, label: 'B', color: 'blue' },
                { id: 'C', x: 0, y: 8, label: 'C', color: 'blue' },
                { id: 'O', x: 3, y: 4, label: 'O(3, 4)', color: 'green', emphasis: true },
              ],
            },
            answer: {
              kind: 'point',
              expected: [3, 4],
              display: '(3, 4)',
            },
          },
        ],
        explanation: {
          steps: [
            {
              text: 'Because △ABC is a right triangle, its circumcentre (3, 4) lands right on the midpoint of hypotenuse BC! Every tower is exactly 5 units away.',
              math: 'x = 3  ∩  y = 4  ⇒  (3, 4),  radius = √(3² + 4²) = 5',
              scene: {
                xMin: -2,
                xMax: 9,
                yMin: -2,
                yMax: 10,
                polygons: [{ vertices: [[0, 0], [6, 0], [0, 8]], color: 'blue', fillOpacity: 0.06 }],
                circles: [{ cx: 3, cy: 4, r: 5, color: 'green', dashed: true }],
                points: [{ id: 'O', x: 3, y: 4, label: 'O(3, 4)', color: 'green', emphasis: true }],
              },
            },
          ],
        },
      },
    ],
  },

  // =========================================================================
  // MOCK PART B · Proofs, Chords & Crude-Oil Pipeline Boss (Achievement Check)
  // =========================================================================
  {
    id: 'u2-m2-mock-b',
    level: 4,
    number: 16,
    title: 'Open-Notes Mock B: Proofs & Pipeline Boss',
    shortTitle: 'Mock B · Boss',
    subtitle: 'Quad proof, chord right bisector, and the Edmonton–Buffalo Pipeline Boss',
    isReview: true,
    completionColor: '#16a34a',
    completionRiveColor: 1,
    pages: [
      {
        id: 'm2-p1-quad-ms',
        kind: 'multi-step',
        source: 'Open-Notes Capstone 4 · Quadrilateral Proof',
        prompt:
          'Quadrilateral **PQRS** has vertices **P(−1, 2)**, **Q(3, 4)**, **R(5, 0)**, and **S(1, −2)**. Test slopes and exact side lengths to prove its exact shape.',
        plan: [
          'Find slope of PQ (and compare with RS)',
          'Find slope of QR (check 90° with PQ)',
          'Find exact lengths of PQ and QR to tell Rectangle vs Square',
        ],
        steps: [
          {
            id: 'mpq',
            label: 'Slope of PQ',
            prompt: 'Step 1: Find the slope of side **PQ** from P(−1, 2) to Q(3, 4).',
            placeholder: 'e.g. 1/2',
            ledgerResult: 'm(PQ) = 1/2',
            scene: {
              xMin: -3,
              xMax: 7,
              yMin: -4,
              yMax: 6,
              polygons: [{ vertices: [[-1, 2], [3, 4], [5, 0], [1, -2]], color: 'blue', fillOpacity: 0.08 }],
              points: [
                { id: 'P', x: -1, y: 2, label: 'P', showCoords: true, color: 'blue' },
                { id: 'Q', x: 3, y: 4, label: 'Q', showCoords: true, color: 'blue' },
                { id: 'R', x: 5, y: 0, label: 'R', showCoords: true, color: 'blue' },
                { id: 'S', x: 1, y: -2, label: 'S', showCoords: true, color: 'blue' },
              ],
            },
            solvedScene: {
              xMin: -3,
              xMax: 7,
              yMin: -4,
              yMax: 6,
              polygons: [{ vertices: [[-1, 2], [3, 4], [5, 0], [1, -2]], color: 'blue', fillOpacity: 0.08 }],
              segments: [
                { from: [-1, 2], to: [3, 4], color: 'teal', width: 2.8, label: 'm = 1/2' },
                { from: [1, -2], to: [5, 0], color: 'teal', width: 2.2 },
              ],
            },
            answer: { kind: 'number', expected: 0.5, display: '1/2' },
          },
          {
            id: 'mqr',
            label: 'Slope of QR',
            prompt: 'Step 2: Find the slope of adjacent side **QR** from Q(3, 4) to R(5, 0).',
            placeholder: 'e.g. -2',
            ledgerResult: 'm(QR) = −2 (90°!)',
            scene: {
              xMin: -3,
              xMax: 7,
              yMin: -4,
              yMax: 6,
              polygons: [{ vertices: [[-1, 2], [3, 4], [5, 0], [1, -2]], color: 'blue', fillOpacity: 0.08 }],
              segments: [{ from: [-1, 2], to: [3, 4], color: 'teal', width: 2.6, label: '1/2' }],
              points: [
                { id: 'Q', x: 3, y: 4, label: 'Q(3,4)', color: 'blue' },
                { id: 'R', x: 5, y: 0, label: 'R(5,0)', color: 'blue' },
              ],
            },
            solvedScene: {
              xMin: -3,
              xMax: 7,
              yMin: -4,
              yMax: 6,
              polygons: [{ vertices: [[-1, 2], [3, 4], [5, 0], [1, -2]], color: 'blue', fillOpacity: 0.08 }],
              segments: [
                { from: [-1, 2], to: [3, 4], color: 'teal', width: 2.6, label: '1/2' },
                { from: [3, 4], to: [5, 0], color: 'amber', width: 2.6, label: '−2' },
              ],
              rightAngles: [{ vertex: [3, 4], dir1: [-2, -1], dir2: [1, -2], color: 'green' }],
            },
            answer: { kind: 'number', expected: -2, display: '−2' },
          },
          {
            id: 'lenpq',
            label: 'Exact length of PQ',
            prompt:
              'Step 3: Both opposite pairs are parallel and adjacent sides meet at 90°. Find the **exact length of PQ** (note QR is also √20!).',
            placeholder: 'e.g. √20 or 2√5',
            ledgerResult: 'PQ = QR = √20 → Square',
            scene: {
              xMin: -3,
              xMax: 7,
              yMin: -4,
              yMax: 6,
              polygons: [{ vertices: [[-1, 2], [3, 4], [5, 0], [1, -2]], color: 'blue', fillOpacity: 0.08 }],
              rightAngles: [{ vertex: [3, 4], dir1: [-2, -1], dir2: [1, -2], color: 'green' }],
              points: [
                { id: 'P', x: -1, y: 2, label: 'P(−1,2)', color: 'blue' },
                { id: 'Q', x: 3, y: 4, label: 'Q(3,4)', color: 'blue' },
              ],
            },
            solvedScene: {
              xMin: -3,
              xMax: 7,
              yMin: -4,
              yMax: 6,
              polygons: [{ vertices: [[-1, 2], [3, 4], [5, 0], [1, -2]], color: 'green', fillOpacity: 0.16 }],
              segments: [
                { from: [-1, 2], to: [3, 4], color: 'green', label: '√20' },
                { from: [3, 4], to: [5, 0], color: 'green', label: '√20' },
              ],
              rightAngles: [{ vertex: [3, 4], dir1: [-2, -1], dir2: [1, -2], color: 'green' }],
            },
            answer: {
              kind: 'number',
              expected: Math.sqrt(20),
              exactRequired: true,
              display: '√20 (or 2√5)',
              commonMistakes: [
                {
                  value: 20,
                  message: '20 is PQ². Don’t forget the square root: √20 (or 2√5).',
                },
              ],
            },
          },
        ],
        explanation: {
          steps: [
            {
              text: 'All 4 sides have exact length √20 and adjacent slopes (1/2 and −2) multiply to −1, proving PQRS is a square.',
              math: 'm(PQ) = m(RS) = 1/2, m(QR) = m(PS) = −2, all sides = √20  ⇒  Square',
              scene: {
                xMin: -3,
                xMax: 7,
                yMin: -4,
                yMax: 6,
                polygons: [{ vertices: [[-1, 2], [3, 4], [5, 0], [1, -2]], color: 'green', fillOpacity: 0.16 }],
                rightAngles: [{ vertex: [3, 4], dir1: [-2, -1], dir2: [1, -2], color: 'green' }],
              },
            },
          ],
        },
      },
      {
        id: 'm2-p2-chord-ms',
        kind: 'multi-step',
        source: 'Open-Notes Capstone 5 · Chord Right Bisector',
        prompt:
          'Points **E(−3, 4)** and **F(5, 0)** lie on circle **x² + y² = 25**. Write the right bisector of chord **EF** to verify it passes through centre **(0, 0)**.',
        plan: [
          'Find midpoint M of chord EF',
          'Find slope of EF, then flip & negate for m⊥',
          'Sub m⊥ and M into y = mx + b (confirm b = 0)',
        ],
        steps: [
          {
            id: 'mid',
            label: 'Midpoint M of chord EF',
            prompt: 'Step 1: Find midpoint **M** of chord **EF**, where E(−3, 4) and F(5, 0).',
            placeholder: '(x, y)',
            ledgerResult: 'M = (1, 2)',
            scene: {
              xMin: -6,
              xMax: 6,
              yMin: -6,
              yMax: 6,
              circles: [{ cx: 0, cy: 0, r: 5, color: 'blue' }],
              segments: [{ from: [-3, 4], to: [5, 0], color: 'amber', width: 2.5 }],
              points: [
                { id: 'O', x: 0, y: 0, label: 'O', dim: true },
                { id: 'E', x: -3, y: 4, label: 'E(−3,4)', color: 'amber' },
                { id: 'F', x: 5, y: 0, label: 'F(5,0)', color: 'amber' },
              ],
            },
            solvedScene: {
              xMin: -6,
              xMax: 6,
              yMin: -6,
              yMax: 6,
              circles: [{ cx: 0, cy: 0, r: 5, color: 'blue' }],
              segments: [{ from: [-3, 4], to: [5, 0], color: 'amber', width: 2.5 }],
              points: [
                { id: 'M', x: 1, y: 2, label: 'M(1, 2)', color: 'violet', emphasis: true },
              ],
            },
            answer: { kind: 'point', expected: [1, 2], display: '(1, 2)' },
          },
          {
            id: 'mperp',
            label: 'Perpendicular slope m⊥',
            prompt: 'Step 2: Find the slope of chord **EF**, then flip and negate it for **m⊥**.',
            placeholder: 'e.g. 2',
            nudge: 'm(EF) = (0 − 4)/(5 − (−3)) = −4/8 = −1/2. Now flip & negate!',
            ledgerResult: 'm⊥ = 2',
            scene: {
              xMin: -6,
              xMax: 6,
              yMin: -6,
              yMax: 6,
              circles: [{ cx: 0, cy: 0, r: 5, color: 'blue' }],
              segments: [{ from: [-3, 4], to: [5, 0], color: 'amber', width: 2.5 }],
              points: [
                { id: 'E', x: -3, y: 4, label: 'E(−3,4)', color: 'amber' },
                { id: 'F', x: 5, y: 0, label: 'F(5,0)', color: 'amber' },
                { id: 'M', x: 1, y: 2, label: 'M(1,2)', color: 'violet', emphasis: true },
              ],
            },
            solvedScene: {
              xMin: -6,
              xMax: 6,
              yMin: -6,
              yMax: 6,
              circles: [{ cx: 0, cy: 0, r: 5, color: 'blue' }],
              segments: [{ from: [-3, 4], to: [5, 0], color: 'amber' }],
              lines: [lineEq(2, 0, { color: 'violet', dashed: true })],
              rightAngles: [{ vertex: [1, 2], dir1: [2, -1], dir2: [1, 2], color: 'violet' }],
              points: [{ id: 'M', x: 1, y: 2, label: 'M(1,2)', color: 'violet', emphasis: true }],
            },
            answer: {
              kind: 'number',
              expected: 2,
              display: '2',
              commonMistakes: [
                { value: -0.5, message: '−1/2 is the slope of EF itself. Flip and negate for m⊥!' },
                { value: -2, message: 'You flipped −1/2 to −2, don’t forget to switch the sign to +2!' },
              ],
            },
          },
          {
            id: 'rb',
            label: 'Right bisector equation',
            prompt: 'Step 3: Write the equation of the **right bisector** through **M(1, 2)** with **m⊥ = 2**.',
            placeholder: 'y = mx + b',
            ledgerResult: 'y = 2x (hits (0, 0)!)',
            scene: {
              xMin: -6,
              xMax: 6,
              yMin: -6,
              yMax: 6,
              circles: [{ cx: 0, cy: 0, r: 5, color: 'blue' }],
              segments: [{ from: [-3, 4], to: [5, 0], color: 'amber' }],
              points: [
                { id: 'O', x: 0, y: 0, label: 'O(0,0)', color: 'green' },
                { id: 'M', x: 1, y: 2, label: 'M(1,2)', color: 'violet', emphasis: true },
              ],
            },
            solvedScene: {
              xMin: -6,
              xMax: 6,
              yMin: -6,
              yMax: 6,
              circles: [{ cx: 0, cy: 0, r: 5, color: 'blue' }],
              segments: [{ from: [-3, 4], to: [5, 0], color: 'amber' }],
              lines: [lineEq(2, 0, { color: 'green', label: 'y = 2x' })],
              rightAngles: [{ vertex: [1, 2], dir1: [2, -1], dir2: [1, 2], color: 'green' }],
              points: [
                { id: 'O', x: 0, y: 0, label: 'O(0,0)', color: 'green', emphasis: true },
                { id: 'M', x: 1, y: 2, label: 'M(1,2)', color: 'green' },
              ],
            },
            answer: {
              kind: 'line',
              expected: { a: 2, b: -1, c: 0 },
              display: 'y = 2x',
            },
          },
        ],
        explanation: {
          steps: [
            {
              text: 'Plugging M(1, 2) into y = 2x + b gives b = 0, so y = 2x passes straight through the circle’s centre (0, 0).',
              math: 'M = (1, 2), m⊥ = 2  ⇒  y = 2x  (since 0 = 2(0), centre (0, 0) lies on the line!)',
              scene: {
                xMin: -6,
                xMax: 6,
                yMin: -6,
                yMax: 6,
                circles: [{ cx: 0, cy: 0, r: 5, color: 'blue' }],
                segments: [{ from: [-3, 4], to: [5, 0], color: 'amber' }],
                lines: [lineEq(2, 0, { color: 'green', label: 'y = 2x' })],
                points: [{ id: 'O', x: 0, y: 0, label: 'O(0,0)', color: 'green', emphasis: true }],
              },
            },
          ],
        },
      },
    ],
    checks: [
      {
        id: 'm2-chk-pipeline-boss',
        kind: 'multi-step',
        source: 'Achievement Check Boss · Nelson Ch. 2 Test p. 117',
        prompt:
          'A crude-oil pipeline follows **y = 2x + 20** (1 unit = 1 km). A town is centred at **T(50, 5)** with **radius 5 km**. By-laws forbid the pipeline within **50 km** of the urban edge. Work this out on your pen canvas!',
        plan: [
          'Write ⊥ line from town centre T(50, 5) to pipeline y = 2x + 20',
          'Solve linear system for closest pipeline point P (POI)',
          'Find distance from T(50, 5) to P',
          'Subtract the 5 km town radius and compare to 50 km by-law',
        ],
        steps: [
          {
            id: 'perp',
            label: 'Perpendicular line through T(50, 5)',
            prompt:
              'Step 1: Pipeline is **y = 2x + 20**. Write the equation of the **perpendicular line** through town centre **T(50, 5)**.',
            placeholder: 'y = mx + b',
            nudge: 'm⊥ = −1/2. Plug (50, 5) into y = −1/2 x + b to find b.',
            ledgerResult: 'y = −1/2 x + 30',
            scene: {
              xMin: -10,
              xMax: 65,
              yMin: -10,
              yMax: 55,
              showAxisNumbers: false,
              lines: [lineEq(2, 20, { color: 'blue', label: 'y = 2x + 20' })],
              circles: [{ cx: 50, cy: 5, r: 5, color: 'amber' }],
              points: [{ id: 'T', x: 50, y: 5, label: 'T(50, 5)', color: 'amber', emphasis: true }],
            },
            solvedScene: {
              xMin: -10,
              xMax: 65,
              yMin: -10,
              yMax: 55,
              showAxisNumbers: false,
              lines: [
                lineEq(2, 20, { color: 'blue', label: 'Pipeline' }),
                lineEq(-0.5, 30, { color: 'teal', dashed: true, label: 'y = −1/2 x + 30' }),
              ],
              circles: [{ cx: 50, cy: 5, r: 5, color: 'amber' }],
              points: [{ id: 'T', x: 50, y: 5, label: 'T(50, 5)', color: 'amber' }],
            },
            answer: {
              kind: 'line',
              expected: { a: -0.5, b: -1, c: 30 },
              display: 'y = −1/2 x + 30',
            },
          },
          {
            id: 'poi',
            label: 'Closest point P on pipeline (POI)',
            prompt:
              'Step 2: Solve **y = 2x + 20** and **y = −1/2 x + 30** to find the closest pipeline point **P**.',
            placeholder: '(x, y)',
            nudge: 'Multiply 2x + 20 = −1/2 x + 30 by 2: 4x + 40 = −x + 60.',
            ledgerResult: 'P = (4, 28)',
            scene: {
              xMin: -10,
              xMax: 65,
              yMin: -10,
              yMax: 55,
              showAxisNumbers: false,
              lines: [
                lineEq(2, 20, { color: 'blue', label: 'Pipeline' }),
                lineEq(-0.5, 30, { color: 'teal', dashed: true }),
              ],
              circles: [{ cx: 50, cy: 5, r: 5, color: 'amber' }],
              points: [{ id: 'T', x: 50, y: 5, label: 'T(50, 5)', color: 'amber' }],
            },
            solvedScene: {
              xMin: -10,
              xMax: 65,
              yMin: -10,
              yMax: 55,
              showAxisNumbers: false,
              lines: [lineEq(2, 20, { color: 'blue', label: 'Pipeline' })],
              segments: [{ from: [50, 5], to: [4, 28], color: 'teal', width: 2.6 }],
              circles: [{ cx: 50, cy: 5, r: 5, color: 'amber' }],
              points: [
                { id: 'T', x: 50, y: 5, label: 'T(50, 5)', color: 'amber' },
                { id: 'P', x: 4, y: 28, label: 'P(4, 28)', color: 'green', emphasis: true },
              ],
            },
            answer: {
              kind: 'point',
              expected: [4, 28],
              display: '(4, 28)',
            },
          },
          {
            id: 'dist-centre',
            label: 'Distance from town centre T to P',
            prompt:
              'Step 3: Find the distance from town centre **T(50, 5)** to **P(4, 28)** (exact radical or to 1 decimal place).',
            placeholder: 'e.g. √2645 or 51.4',
            nudge: 'Compute √((50 − 4)² + (5 − 28)²) = √(46² + 23²).',
            ledgerResult: '√2645 ≈ 51.4 km',
            scene: {
              xMin: -10,
              xMax: 65,
              yMin: -10,
              yMax: 55,
              showAxisNumbers: false,
              lines: [lineEq(2, 20, { color: 'blue' })],
              segments: [{ from: [50, 5], to: [4, 28], color: 'teal', width: 2.6, label: 'd = ?' }],
              circles: [{ cx: 50, cy: 5, r: 5, color: 'amber' }],
              points: [
                { id: 'T', x: 50, y: 5, label: 'T(50, 5)', color: 'amber' },
                { id: 'P', x: 4, y: 28, label: 'P(4, 28)', color: 'green' },
              ],
            },
            solvedScene: {
              xMin: -10,
              xMax: 65,
              yMin: -10,
              yMax: 55,
              showAxisNumbers: false,
              lines: [lineEq(2, 20, { color: 'blue' })],
              segments: [{ from: [50, 5], to: [4, 28], color: 'teal', width: 2.6, label: '51.4 km' }],
              circles: [{ cx: 50, cy: 5, r: 5, color: 'amber' }],
              points: [
                { id: 'T', x: 50, y: 5, label: 'T', color: 'amber' },
                { id: 'P', x: 4, y: 28, label: 'P(4, 28)', color: 'green' },
              ],
            },
            answer: {
              kind: 'number',
              expected: Math.sqrt(2645),
              tolerance: 0.15,
              display: '√2645 ≈ 51.4 km',
              commonMistakes: [
                {
                  value: 2645,
                  message: '2645 is d². Take the square root to get √2645 ≈ 51.4 km!',
                },
              ],
            },
          },
          {
            id: 'dist-edge',
            label: 'Distance to town boundary (r = 5 km)',
            prompt:
              'Step 4 (The Boss Twist!): The town has **radius 5 km**. How close does the pipeline get to the **edge of the town** (to 1 decimal place)?',
            placeholder: 'e.g. 46.4',
            nudge: 'Subtract the 5 km town radius from 51.4 km!',
            ledgerResult: '46.4 km < 50 km → Reroute!',
            scene: {
              xMin: -10,
              xMax: 65,
              yMin: -10,
              yMax: 55,
              showAxisNumbers: false,
              lines: [lineEq(2, 20, { color: 'blue' })],
              segments: [{ from: [50, 5], to: [4, 28], color: 'teal', width: 2.6, label: '51.4 − 5' }],
              circles: [{ cx: 50, cy: 5, r: 5, color: 'amber' }],
              points: [
                { id: 'T', x: 50, y: 5, label: 'r = 5 km', color: 'amber' },
                { id: 'P', x: 4, y: 28, label: 'P(4, 28)', color: 'green' },
              ],
            },
            solvedScene: {
              xMin: -10,
              xMax: 65,
              yMin: -10,
              yMax: 55,
              showAxisNumbers: false,
              lines: [lineEq(2, 20, { color: 'blue' })],
              segments: [{ from: [45.5, 7.2], to: [4, 28], color: 'green', width: 3, label: '46.4 km' }],
              circles: [{ cx: 50, cy: 5, r: 5, color: 'amber' }],
              points: [{ id: 'P', x: 4, y: 28, label: 'P(4, 28)', color: 'green' }],
            },
            answer: {
              kind: 'number',
              expected: Math.sqrt(2645) - 5,
              tolerance: 0.15,
              display: '46.4 km',
              commonMistakes: [
                {
                  value: Math.sqrt(2645) + 5,
                  message: 'The town edge is CLOSER to the pipeline than the centre, so subtract 5 km instead of adding!',
                },
              ],
            },
          },
        ],
        explanation: {
          steps: [
            {
              text: 'Because the town has radius 5 km, the urban edge is 51.4 − 5 = 46.4 km from the pipeline. Since 46.4 km < 50 km, YES, the pipeline MUST be rerouted!',
              math: 'd_centre = √2645 ≈ 51.4 km  ⇒  d_edge = 51.4 − 5 = 46.4 km < 50 km  ⇒  Reroute!',
              scene: {
                xMin: -10,
                xMax: 65,
                yMin: -10,
                yMax: 55,
                showAxisNumbers: false,
                lines: [lineEq(2, 20, { color: 'blue', label: 'Pipeline' })],
                segments: [{ from: [45.5, 7.2], to: [4, 28], color: 'green', width: 3, label: '46.4 km' }],
                circles: [{ cx: 50, cy: 5, r: 5, color: 'amber' }],
                points: [{ id: 'P', x: 4, y: 28, label: 'P(4, 28)', color: 'green' }],
              },
            },
          ],
        },
      },
    ],
  },
]
