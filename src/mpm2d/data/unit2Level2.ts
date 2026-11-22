import type { GeoLesson } from '../pageTypes'
import type { GeoColor, GeoLine, GeoRightAngle } from '../types'

/** y = m*x + b  <=>  m*x - y + b = 0 */
function lineEq(
  m: number,
  b: number,
  opts?: { color?: GeoColor; dashed?: boolean; label?: string; width?: number },
): GeoLine {
  return { a: m, b: -1, c: b, ...opts }
}

/** x = k  <=>  x - k = 0 */
function vLine(
  k: number,
  opts?: { color?: GeoColor; dashed?: boolean; label?: string; width?: number },
): GeoLine {
  return { a: 1, b: 0, c: -k, ...opts }
}

/** 90-degree square marker at vertex pointing toward p1 and p2 */
function rightAngleAt(
  vertex: [number, number],
  p1: [number, number],
  p2: [number, number],
  color: GeoColor = 'green',
): GeoRightAngle {
  return {
    vertex,
    dir1: [p1[0] - vertex[0], p1[1] - vertex[1]],
    dir2: [p2[0] - vertex[0], p2[1] - vertex[1]],
    color,
  }
}

export const UNIT2_LEVEL2: GeoLesson[] = [
  // =========================================================================
  // LESSON 5: RIGHT TRIANGLES
  // =========================================================================
  {
    id: 'u2-l5-right-tri',
    level: 2,
    number: 5,
    title: 'Right Triangles',
    shortTitle: 'Right Triangles',
    subtitle: 'Prove 90° with slopes or Pythagoras',
    completionColor: '#ff7043',
    completionRiveColor: 3,
    pages: [
      {
        id: 'l5-p1-explore',
        kind: 'explore',
        prompt: 'Drag vertex C until two sides meet at 90° and watch both tests light up.',
        exploration: 'right-triangle',
      },
      {
        id: 'l5-p2-worked',
        kind: 'worked',
        source: 'Alex Notes · Oct 28',
        prompt: 'Prove △ABC with A(5, 5), B(−3, −1), C(1, −3) is a right triangle.',
        plan: [
          'Find slopes of the sides meeting at the suspected 90° corner C.',
          'Check if m₁ · m₂ = −1 (negative reciprocals).',
          'Or verify with Pythagoras: AC² + BC² = AB².',
        ],
        steps: [
          {
            heading: 'Check the slopes at C(1, −3)',
            mathLines: [
              'm_AC = (5 − (−3)) / (5 − 1) = 8 / 4 = 2',
              'm_BC = (−1 − (−3)) / (−3 − 1) = 2 / (−4) = −1/2',
              '2 × (−1/2) = −1  ⇒  AC ⊥ BC (90° at C)',
            ],
            scene: {
              xMin: -5,
              xMax: 7,
              yMin: -5,
              yMax: 7,
              polygons: [{ vertices: [[5, 5], [-3, -1], [1, -3]], color: 'blue', fillOpacity: 0.08 }],
              rightAngles: [rightAngleAt([1, -3], [5, 5], [-3, -1], 'green')],
              points: [
                { id: 'a', x: 5, y: 5, label: 'A(5, 5)', color: 'blue' },
                { id: 'b', x: -3, y: -1, label: 'B(−3, −1)', color: 'blue' },
                { id: 'c', x: 1, y: -3, label: 'C(1, −3)', color: 'green', emphasis: true },
              ],
            },
          },
          {
            heading: 'Confirm with Pythagoras (second method)',
            mathLines: [
              'AC² = 4² + 8² = 80   and   BC² = (−4)² + 2² = 20',
              'AB² = 8² + 6² = 100',
              '80 + 20 = 100  ✓  Right triangle at C.',
            ],
            scene: {
              xMin: -5,
              xMax: 7,
              yMin: -5,
              yMax: 7,
              polygons: [{ vertices: [[5, 5], [-3, -1], [1, -3]], color: 'green', fillOpacity: 0.1 }],
              segments: [
                { from: [5, 5], to: [1, -3], color: 'green', label: '√80' },
                { from: [-3, -1], to: [1, -3], color: 'green', label: '√20' },
                { from: [5, 5], to: [-3, -1], color: 'amber', label: '10' },
              ],
              rightAngles: [rightAngleAt([1, -3], [5, 5], [-3, -1], 'green')],
              points: [
                { id: 'a', x: 5, y: 5, label: 'A', color: 'blue' },
                { id: 'b', x: -3, y: -1, label: 'B', color: 'blue' },
                { id: 'c', x: 1, y: -3, label: 'C', color: 'green', emphasis: true },
              ],
            },
          },
        ],
      },
      {
        id: 'l5-p3-cd',
        kind: 'math-input',
        source: 'Handout W4 #1',
        prompt: '△CDE has C(1, 4), D(−2, 2), and E(3, 1). Find the slope of side CD.',
        placeholder: 'e.g. 2/3',
        scene: {
          xMin: -4,
          xMax: 5,
          yMin: -1,
          yMax: 6,
          polygons: [{ vertices: [[1, 4], [-2, 2], [3, 1]], color: 'blue', fillOpacity: 0.08 }],
          segments: [{ from: [-2, 2], to: [1, 4], color: 'amber', width: 2.6 }],
          points: [
            { id: 'c', x: 1, y: 4, label: 'C', showCoords: true, color: 'blue' },
            { id: 'd', x: -2, y: 2, label: 'D', showCoords: true, color: 'amber' },
            { id: 'e', x: 3, y: 1, label: 'E', showCoords: true, color: 'blue' },
          ],
        },
        answer: { kind: 'number', expected: 2 / 3, display: '2/3' },
        explanation: {
          steps: [
            {
              text: 'Use rise over run from D(−2, 2) to C(1, 4).',
              math: 'm_CD = (4 − 2) / (1 − (−2)) = 2/3',
              scene: {
                xMin: -4,
                xMax: 5,
                yMin: -1,
                yMax: 6,
                polygons: [{ vertices: [[1, 4], [-2, 2], [3, 1]], color: 'blue', fillOpacity: 0.08 }],
                riseRuns: [{ from: [-2, 2], to: [1, 4], color: 'amber', showLabels: true }],
                points: [
                  { id: 'c', x: 1, y: 4, label: 'C', showCoords: true, color: 'blue' },
                  { id: 'd', x: -2, y: 2, label: 'D', showCoords: true, color: 'amber' },
                  { id: 'e', x: 3, y: 1, label: 'E', showCoords: true, color: 'blue' },
                ],
              },
            },
          ],
        },
      },
      {
        id: 'l5-p4-ce',
        kind: 'math-input',
        source: 'Handout W4 #1',
        prompt: 'Now find the slope of side CE between C(1, 4) and E(3, 1).',
        placeholder: 'e.g. -3/2',
        scene: {
          xMin: -4,
          xMax: 5,
          yMin: -1,
          yMax: 6,
          polygons: [{ vertices: [[1, 4], [-2, 2], [3, 1]], color: 'blue', fillOpacity: 0.08 }],
          segments: [
            { from: [-2, 2], to: [1, 4], color: 'blue', label: 'm = 2/3' },
            { from: [1, 4], to: [3, 1], color: 'amber', width: 2.6 },
          ],
          points: [
            { id: 'c', x: 1, y: 4, label: 'C', showCoords: true, color: 'blue' },
            { id: 'd', x: -2, y: 2, label: 'D', color: 'blue' },
            { id: 'e', x: 3, y: 1, label: 'E', showCoords: true, color: 'amber' },
          ],
        },
        answer: { kind: 'number', expected: -3 / 2, display: '−3/2' },
        explanation: {
          steps: [
            {
              text: 'Going from C(1, 4) to E(3, 1), y drops by 3 while x rises by 2.',
              math: 'm_CE = (1 − 4) / (3 − 1) = −3/2',
              scene: {
                xMin: -4,
                xMax: 5,
                yMin: -1,
                yMax: 6,
                polygons: [{ vertices: [[1, 4], [-2, 2], [3, 1]], color: 'green', fillOpacity: 0.1 }],
                rightAngles: [rightAngleAt([1, 4], [-2, 2], [3, 1], 'green')],
                points: [
                  { id: 'c', x: 1, y: 4, label: 'C', color: 'green', emphasis: true },
                  { id: 'd', x: -2, y: 2, label: 'D', color: 'blue' },
                  { id: 'e', x: 3, y: 1, label: 'E', color: 'blue' },
                ],
              },
            },
          ],
        },
      },
      {
        id: 'l5-p5-conclude',
        kind: 'choice',
        source: 'Handout W4 #1',
        prompt: 'Since m_CD = 2/3 and m_CE = −3/2, what can you conclude about △CDE?',
        scene: {
          xMin: -4,
          xMax: 5,
          yMin: -1,
          yMax: 6,
          polygons: [{ vertices: [[1, 4], [-2, 2], [3, 1]], color: 'blue', fillOpacity: 0.08 }],
          segments: [
            { from: [-2, 2], to: [1, 4], color: 'blue', label: '2/3' },
            { from: [1, 4], to: [3, 1], color: 'amber', label: '−3/2' },
          ],
          points: [
            { id: 'c', x: 1, y: 4, label: 'C', color: 'blue' },
            { id: 'd', x: -2, y: 2, label: 'D', color: 'blue' },
            { id: 'e', x: 3, y: 1, label: 'E', color: 'blue' },
          ],
        },
        options: [
          { id: 'a', label: 'Right angle at vertex C' },
          { id: 'b', label: 'Right angle at vertex D', hint: 'Both perpendicular sides meet at C.' },
          { id: 'c', label: 'Right angle at vertex E', hint: 'Which vertex is shared by CD and CE?' },
          { id: 'd', label: 'Not a right triangle', hint: 'Check (2/3) × (−3/2) = −1.' },
        ],
        correctId: 'a',
        explanation: {
          steps: [
            {
              text: 'CD and CE share vertex C, and their slopes multiply to −1.',
              math: '(2/3)(−3/2) = −1  ⇒  ∠C = 90°',
              scene: {
                xMin: -4,
                xMax: 5,
                yMin: -1,
                yMax: 6,
                polygons: [{ vertices: [[1, 4], [-2, 2], [3, 1]], color: 'green', fillOpacity: 0.1 }],
                rightAngles: [rightAngleAt([1, 4], [-2, 2], [3, 1], 'green')],
                points: [
                  { id: 'c', x: 1, y: 4, label: 'C (90°)', color: 'green', emphasis: true },
                  { id: 'd', x: -2, y: 2, label: 'D', color: 'blue' },
                  { id: 'e', x: 3, y: 1, label: 'E', color: 'blue' },
                ],
              },
            },
          ],
        },
      },
    ],
    checks: [
      {
        id: 'l5-c1-multi',
        kind: 'multi-choice',
        prompt: 'Select every valid way to prove △ABC is a right triangle.',
        options: [
          { id: 'a', label: 'Two sides have negative reciprocal slopes' },
          { id: 'b', label: 'The three side lengths satisfy a² + b² = c²' },
          { id: 'c', label: 'Two sides have equal length', hint: 'Equal sides make it isosceles, not necessarily 90°.' },
          { id: 'd', label: 'All three slopes are positive', hint: 'Slopes being positive says nothing about 90°.' },
        ],
        correctIds: ['a', 'b'],
        explanation: {
          steps: [
            {
              text: 'Both negative reciprocal slopes (m₁ · m₂ = −1) and the Pythagorean theorem (a² + b² = c²) prove a 90° angle.',
              scene: {
                xMin: -1,
                xMax: 5,
                yMin: -1,
                yMax: 5,
                polygons: [{ vertices: [[0, 0], [4, 0], [0, 3]], color: 'green', fillOpacity: 0.1 }],
                rightAngles: [rightAngleAt([0, 0], [4, 0], [0, 3], 'green')],
                segments: [
                  { from: [0, 0], to: [4, 0], color: 'blue', label: '4' },
                  { from: [0, 0], to: [0, 3], color: 'blue', label: '3' },
                  { from: [4, 0], to: [0, 3], color: 'amber', label: '5' },
                ],
              },
            },
          ],
        },
      },
      {
        id: 'l5-c2-board',
        kind: 'choice',
        source: 'Oct 28 Board Q',
        prompt: '△DEF has side lengths √104, √136, and √160. Is it a right triangle?',
        scene: {
          xMin: -5,
          xMax: 9,
          yMin: -3,
          yMax: 13,
          polygons: [{ vertices: [[-3, 11], [1, -1], [7, 9]], color: 'blue', fillOpacity: 0.08 }],
          segments: [
            { from: [-3, 11], to: [7, 9], color: 'blue', label: '√104' },
            { from: [1, -1], to: [7, 9], color: 'blue', label: '√136' },
            { from: [-3, 11], to: [1, -1], color: 'amber', label: '√160' },
          ],
          points: [
            { id: 'd', x: -3, y: 11, label: 'D', color: 'blue' },
            { id: 'e', x: 1, y: -1, label: 'E', color: 'blue' },
            { id: 'f', x: 7, y: 9, label: 'F', color: 'blue' },
          ],
        },
        options: [
          { id: 'a', label: 'No: 104 + 136 ≠ 160' },
          { id: 'b', label: 'Yes: all three lengths are square roots', hint: 'Square the two shorter sides and add them.' },
          { id: 'c', label: 'Yes: √160 is the longest side', hint: 'Every scalene triangle has a longest side; test a² + b² = c².' },
        ],
        correctId: 'a',
        explanation: {
          steps: [
            {
              text: 'Square each length and compare the two shorter sides against the longest side.',
              math: '104 + 136 = 240 ≠ 160  ⇒  Not a right triangle.',
              scene: {
                xMin: -5,
                xMax: 9,
                yMin: -3,
                yMax: 13,
                polygons: [{ vertices: [[-3, 11], [1, -1], [7, 9]], color: 'amber', fillOpacity: 0.1 }],
                points: [
                  { id: 'd', x: -3, y: 11, label: 'D', color: 'blue' },
                  { id: 'e', x: 1, y: -1, label: 'E', color: 'blue' },
                  { id: 'f', x: 7, y: 9, label: 'F', color: 'blue' },
                ],
              },
            },
          ],
        },
      },
      {
        id: 'l5-c3-hyp-mid',
        kind: 'math-input',
        source: 'Handout W4 #5',
        prompt: '△KLM has K(−2, 2), L(1, 5), M(3, −3), with 90° at K. Find the midpoint of hypotenuse LM.',
        placeholder: '(x, y)',
        scene: {
          xMin: -4,
          xMax: 5,
          yMin: -4,
          yMax: 6,
          polygons: [{ vertices: [[-2, 2], [1, 5], [3, -3]], color: 'blue', fillOpacity: 0.08 }],
          rightAngles: [rightAngleAt([-2, 2], [1, 5], [3, -3], 'green')],
          segments: [{ from: [1, 5], to: [3, -3], color: 'amber', width: 2.5 }],
          points: [
            { id: 'k', x: -2, y: 2, label: 'K', color: 'green' },
            { id: 'l', x: 1, y: 5, label: 'L', showCoords: true, color: 'amber' },
            { id: 'm', x: 3, y: -3, label: 'M', showCoords: true, color: 'amber' },
          ],
        },
        answer: { kind: 'point', expected: [2, 1], display: '(2, 1)' },
        explanation: {
          steps: [
            {
              text: 'Average the endpoints L(1, 5) and M(3, −3). Notice this midpoint is equidistant (√17) from K, L, and M!',
              math: 'N = ((1 + 3)/2, (5 + (−3))/2) = (2, 1)',
              scene: {
                xMin: -4,
                xMax: 5,
                yMin: -4,
                yMax: 6,
                polygons: [{ vertices: [[-2, 2], [1, 5], [3, -3]], color: 'blue', fillOpacity: 0.08 }],
                segments: [{ from: [-2, 2], to: [2, 1], color: 'green', dashed: true, label: '√17' }],
                points: [
                  { id: 'k', x: -2, y: 2, label: 'K', color: 'blue' },
                  { id: 'l', x: 1, y: 5, label: 'L', color: 'blue' },
                  { id: 'm', x: 3, y: -3, label: 'M', color: 'blue' },
                  { id: 'n', x: 2, y: 1, label: 'N(2, 1)', color: 'green', emphasis: true },
                ],
              },
            },
          ],
        },
      },
    ],
  },

  // =========================================================================
  // LESSON 6: SHORTEST DISTANCE
  // =========================================================================
  {
    id: 'u2-l6-distance',
    level: 2,
    number: 6,
    title: 'Shortest Distance',
    shortTitle: 'Shortest Distance',
    subtitle: 'Perpendicular line, POI, then length',
    completionColor: '#00a896',
    completionRiveColor: 1,
    pages: [
      {
        id: 'l6-p1-explore',
        kind: 'explore',
        prompt: 'Slide point P along the line to find where distance OP is smallest.',
        exploration: 'shortest-distance',
      },
      {
        id: 'l6-p2-worked',
        kind: 'worked',
        source: 'Alex Notes · Nov 3',
        prompt: 'Find the shortest distance from O(0, 0) to the line y = 2x − 10.',
        plan: [
          'Find the perpendicular slope: flip and switch sign.',
          'Write the perpendicular line through the given point.',
          'Solve the system of two lines for the POI.',
          'Use the length formula from the point to the POI.',
        ],
        steps: [
          {
            heading: 'Write the perpendicular line through (0, 0)',
            mathLines: [
              'Given slope: m = 2  ⇒  m_⊥ = −1/2',
              'Passes through (0, 0)  ⇒  y = −1/2 x',
            ],
            scene: {
              xMin: -2,
              xMax: 8,
              yMin: -8,
              yMax: 3,
              lines: [
                lineEq(2, -10, { color: 'blue', label: 'y = 2x − 10' }),
                lineEq(-0.5, 0, { color: 'amber', dashed: true, label: 'y = −1/2 x' }),
              ],
              points: [{ id: 'o', x: 0, y: 0, label: 'O(0, 0)', color: 'amber', emphasis: true }],
            },
          },
          {
            heading: 'Find the Point of Intersection (POI)',
            mathLines: [
              '2x − 10 = −1/2 x',
              '2.5x = 10  ⇒  x = 4',
              'y = −1/2 (4) = −2  ⇒  POI (4, −2)',
            ],
            scene: {
              xMin: -2,
              xMax: 8,
              yMin: -8,
              yMax: 3,
              lines: [
                lineEq(2, -10, { color: 'blue' }),
                lineEq(-0.5, 0, { color: 'amber', dashed: true }),
              ],
              rightAngles: [rightAngleAt([4, -2], [0, 0], [5, 0], 'green')],
              points: [
                { id: 'o', x: 0, y: 0, label: 'O', color: 'amber' },
                { id: 'p', x: 4, y: -2, label: 'POI (4, −2)', color: 'green', emphasis: true },
              ],
            },
          },
          {
            heading: 'Calculate length from O(0, 0) to (4, −2)',
            mathLines: [
              'd = √((4 − 0)² + (−2 − 0)²)',
              'd = √(16 + 4) = √20 ≈ 4.5',
            ],
            scene: {
              xMin: -2,
              xMax: 8,
              yMin: -8,
              yMax: 3,
              lines: [lineEq(2, -10, { color: 'blue' })],
              segments: [{ from: [0, 0], to: [4, -2], color: 'green', width: 3, label: '√20 ≈ 4.5' }],
              rightAngles: [rightAngleAt([4, -2], [0, 0], [5, 0], 'green')],
              points: [
                { id: 'o', x: 0, y: 0, label: 'O', color: 'amber' },
                { id: 'p', x: 4, y: -2, label: '(4, −2)', color: 'green' },
              ],
            },
          },
        ],
      },
      {
        id: 'l6-p3-plan',
        kind: 'plan-order',
        source: 'Conference Core Plan',
        prompt: 'Order the steps to find the shortest distance from point P to line L.',
        scene: {
          xMin: -2,
          xMax: 7,
          yMin: -3,
          yMax: 5,
          lines: [lineEq(0.5, -1, { color: 'blue', label: 'L' })],
          segments: [{ from: [1, 4], to: [2.8, 0.4], color: 'amber', dashed: true, label: '?' }],
          points: [{ id: 'p', x: 1, y: 4, label: 'P', color: 'amber', emphasis: true }],
        },
        pool: [
          { id: 'perp-slope', text: 'Take the negative reciprocal of line L’s slope.', category: 'slope' },
          { id: 'perp-eq', text: 'Sub m_⊥ and point P into y = mx + b to write the perpendicular line.', category: 'line' },
          { id: 'poi', text: 'Solve the system of line L and the perpendicular line to get the POI.', category: 'poi' },
          { id: 'dist', text: 'Use the length formula between P and the POI.', category: 'length' },
          { id: 'mid', text: 'Find the midpoint of line L.', category: 'midpoint' },
        ],
        validPlans: [
          {
            name: '4-step shortest distance plan',
            steps: ['perp-slope', 'perp-eq', 'poi', 'dist'],
            explanation: 'Perpendicular slope → perpendicular line through P → POI with L → distance from P to POI.',
          },
        ],
        missingFeedback: [
          { missingId: 'poi', message: 'You need the Point of Intersection (POI) where the perpendicular hits line L.' },
        ],
        orderFeedback: [
          { before: 'perp-slope', after: 'perp-eq', message: 'Find the perpendicular slope before writing the line equation.' },
          { before: 'poi', after: 'dist', message: 'Find the POI before calculating the distance to it.' },
        ],
        explanation: {
          steps: [
            {
              text: 'Every shortest-distance problem follows the same 4-step backbone: m_⊥ → line through P → POI → length.',
              scene: {
                xMin: -2,
                xMax: 7,
                yMin: -3,
                yMax: 5,
                lines: [
                  lineEq(0.5, -1, { color: 'blue', label: 'L' }),
                  lineEq(-2, 6, { color: 'green', dashed: true, label: '⊥' }),
                ],
                points: [
                  { id: 'p', x: 1, y: 4, label: 'P', color: 'amber' },
                  { id: 'poi', x: 2.8, y: 0.4, label: 'POI', color: 'green', emphasis: true },
                ],
              },
            },
          ],
        },
      },
      {
        id: 'l6-p4-perp-eq',
        kind: 'math-input',
        source: 'Alex Notes · Nov 3',
        prompt: 'Find the perpendicular line through P(−1, 3) to the line x + y − 5 = 0.',
        placeholder: 'y = mx + b',
        scene: {
          xMin: -3,
          xMax: 7,
          yMin: -1,
          yMax: 7,
          lines: [lineEq(-1, 5, { color: 'blue', label: 'y = −x + 5' })],
          points: [{ id: 'p', x: -1, y: 3, label: 'P', showCoords: true, color: 'amber', emphasis: true }],
        },
        solvedScene: {
          xMin: -3,
          xMax: 7,
          yMin: -1,
          yMax: 7,
          lines: [
            lineEq(-1, 5, { color: 'blue', label: 'y = −x + 5' }),
            lineEq(1, 4, { color: 'green', label: 'y = x + 4' }),
          ],
          rightAngles: [rightAngleAt([0.5, 4.5], [-1, 3], [2, 3], 'green')],
          points: [
            { id: 'p', x: -1, y: 3, label: 'P', color: 'amber' },
            { id: 'q', x: 0.5, y: 4.5, label: 'POI', color: 'green' },
          ],
        },
        answer: { kind: 'line', expected: { a: 1, b: -1, c: 4 }, display: 'y = x + 4' },
        explanation: {
          steps: [
            {
              text: 'Isolate y first: y = −x + 5 has slope −1, so m_⊥ = 1.',
              math: '3 = 1(−1) + b  ⇒  b = 4  ⇒  y = x + 4',
              scene: {
                xMin: -3,
                xMax: 7,
                yMin: -1,
                yMax: 7,
                lines: [
                  lineEq(-1, 5, { color: 'blue' }),
                  lineEq(1, 4, { color: 'green', label: 'y = x + 4' }),
                ],
                points: [{ id: 'p', x: -1, y: 3, label: 'P(−1, 3)', color: 'amber' }],
              },
            },
          ],
        },
      },
      {
        id: 'l6-p5-poi',
        kind: 'math-input',
        source: 'Alex Notes · Nov 3',
        prompt: 'Find the POI of y = −x + 5 and y = x + 4.',
        placeholder: '(x, y)',
        scene: {
          xMin: -3,
          xMax: 7,
          yMin: -1,
          yMax: 7,
          lines: [
            lineEq(-1, 5, { color: 'blue', label: 'y = −x + 5' }),
            lineEq(1, 4, { color: 'amber', label: 'y = x + 4' }),
          ],
          points: [{ id: 'p', x: -1, y: 3, label: 'P', color: 'amber' }],
        },
        answer: { kind: 'point', expected: [0.5, 4.5], display: '(0.5, 4.5)' },
        explanation: {
          steps: [
            {
              text: 'Set both expressions for y equal to each other.',
              math: 'x + 4 = −x + 5  ⇒  2x = 1  ⇒  x = 0.5',
              scene: {
                xMin: -3,
                xMax: 7,
                yMin: -1,
                yMax: 7,
                lines: [
                  lineEq(-1, 5, { color: 'blue' }),
                  lineEq(1, 4, { color: 'amber' }),
                ],
                points: [{ id: 'q', x: 0.5, y: 4.5, label: '(0.5, 4.5)', color: 'green', emphasis: true }],
              },
            },
            {
              text: 'Sub x = 0.5 into y = x + 4 to get y = 4.5.',
              math: 'POI = (0.5, 4.5)',
              scene: {
                xMin: -3,
                xMax: 7,
                yMin: -1,
                yMax: 7,
                lines: [lineEq(-1, 5, { color: 'blue' })],
                segments: [{ from: [-1, 3], to: [0.5, 4.5], color: 'green', width: 3, label: '√4.5' }],
                points: [
                  { id: 'p', x: -1, y: 3, label: 'P', color: 'amber' },
                  { id: 'q', x: 0.5, y: 4.5, label: '(0.5, 4.5)', color: 'green', emphasis: true },
                ],
              },
            },
          ],
        },
      },
    ],
    checks: [
      {
        id: 'l6-c1-poi',
        kind: 'math-input',
        source: 'Handout W4 #11',
        prompt: 'Line EF is y = x + 2 and the perpendicular through D(4, −2) is y = −x + 2. Find their POI.',
        placeholder: '(x, y)',
        scene: {
          xMin: -5,
          xMax: 6,
          yMin: -4,
          yMax: 5,
          lines: [
            lineEq(1, 2, { color: 'blue', label: 'y = x + 2' }),
            lineEq(-1, 2, { color: 'amber', dashed: true, label: 'y = −x + 2' }),
          ],
          points: [{ id: 'd', x: 4, y: -2, label: 'D(4, −2)', color: 'amber' }],
        },
        answer: { kind: 'point', expected: [0, 2], display: '(0, 2)' },
        explanation: {
          steps: [
            {
              text: 'Set x + 2 = −x + 2, so 2x = 0 and x = 0. Both lines have y-intercept 2.',
              math: 'POI = (0, 2)',
              scene: {
                xMin: -5,
                xMax: 6,
                yMin: -4,
                yMax: 5,
                lines: [
                  lineEq(1, 2, { color: 'blue' }),
                  lineEq(-1, 2, { color: 'amber', dashed: true }),
                ],
                points: [
                  { id: 'd', x: 4, y: -2, label: 'D', color: 'amber' },
                  { id: 'q', x: 0, y: 2, label: '(0, 2)', color: 'green', emphasis: true },
                ],
              },
            },
          ],
        },
      },
      {
        id: 'l6-c2-dist',
        kind: 'math-input',
        source: 'Handout W4 #11',
        prompt: 'Find the shortest distance from D(4, −2) to the POI (0, 2).',
        placeholder: 'e.g. √32 or 5.7',
        scene: {
          xMin: -3,
          xMax: 6,
          yMin: -4,
          yMax: 5,
          lines: [lineEq(1, 2, { color: 'blue' })],
          segments: [{ from: [4, -2], to: [0, 2], color: 'amber', width: 2.8 }],
          rightAngles: [rightAngleAt([0, 2], [4, -2], [2, 4], 'green')],
          points: [
            { id: 'd', x: 4, y: -2, label: 'D', showCoords: true, color: 'amber' },
            { id: 'q', x: 0, y: 2, label: 'POI', showCoords: true, color: 'green' },
          ],
        },
        answer: { kind: 'number', expected: Math.sqrt(32), tolerance: 0.1, display: '√32 ≈ 5.7' },
        explanation: {
          steps: [
            {
              text: 'Apply the length formula between D(4, −2) and (0, 2).',
              math: 'd = √((4 − 0)² + (−2 − 2)²) = √(16 + 16) = √32 ≈ 5.7',
              scene: {
                xMin: -3,
                xMax: 6,
                yMin: -4,
                yMax: 5,
                lines: [lineEq(1, 2, { color: 'blue' })],
                segments: [{ from: [4, -2], to: [0, 2], color: 'green', width: 3, label: '√32' }],
                points: [
                  { id: 'd', x: 4, y: -2, label: 'D', color: 'amber' },
                  { id: 'q', x: 0, y: 2, label: '(0, 2)', color: 'green' },
                ],
              },
            },
          ],
        },
      },
      {
        id: 'l6-c3-test16',
        kind: 'math-input',
        source: 'Ch. 2 Test #16',
        prompt: 'Write the perpendicular line through (3, 1) to 3x + y = −2.',
        placeholder: 'y = mx + b',
        scene: {
          xMin: -4,
          xMax: 6,
          yMin: -5,
          yMax: 5,
          lines: [lineEq(-3, -2, { color: 'blue', label: '3x + y = −2' })],
          points: [{ id: 'p', x: 3, y: 1, label: 'P', showCoords: true, color: 'amber', emphasis: true }],
        },
        solvedScene: {
          xMin: -4,
          xMax: 6,
          yMin: -5,
          yMax: 5,
          lines: [
            lineEq(-3, -2, { color: 'blue' }),
            lineEq(1 / 3, 0, { color: 'green', label: 'y = 1/3 x' }),
          ],
          points: [{ id: 'p', x: 3, y: 1, label: '(3, 1)', color: 'amber' }],
        },
        answer: { kind: 'line', expected: { a: 1 / 3, b: -1, c: 0 }, display: 'y = 1/3 x' },
        explanation: {
          steps: [
            {
              text: 'Rewrite 3x + y = −2 as y = −3x − 2. Its slope is −3, so m_⊥ = 1/3.',
              math: '1 = (1/3)(3) + b  ⇒  b = 0  ⇒  y = 1/3 x',
              scene: {
                xMin: -4,
                xMax: 6,
                yMin: -5,
                yMax: 5,
                lines: [
                  lineEq(-3, -2, { color: 'blue' }),
                  lineEq(1 / 3, 0, { color: 'green', label: 'y = 1/3 x' }),
                ],
                points: [{ id: 'p', x: 3, y: 1, label: '(3, 1)', color: 'amber' }],
              },
            },
          ],
        },
      },
    ],
  },

  // =========================================================================
  // LESSON 7: 3 TRIANGLE LINES
  // =========================================================================
  {
    id: 'u2-l7-lines',
    level: 2,
    number: 7,
    title: '3 Triangle Lines',
    shortTitle: '3 Triangle Lines',
    subtitle: 'Median, altitude, and right bisector',
    completionColor: '#5c6bc0',
    completionRiveColor: 0,
    pages: [
      {
        id: 'l7-p1-explore',
        kind: 'explore',
        prompt: 'Pick a triangle line to focus on, then drag **A** to see what moves and what stays locked.',
        exploration: 'three-lines',
      },
      {
        id: 'l7-p2-multi',
        kind: 'multi-choice',
        prompt: 'Which triangle lines MUST pass through the midpoint of the opposite side?',
        options: [
          { id: 'med', label: 'Median' },
          { id: 'alt', label: 'Altitude', hint: 'An altitude hits at 90°, not necessarily the midpoint.' },
          { id: 'rb', label: 'Right bisector' },
        ],
        correctIds: ['med', 'rb'],
        explanation: {
          steps: [
            {
              text: 'Both the median and the right bisector cut the opposite side in half at its midpoint M.',
              scene: {
                xMin: -2,
                xMax: 10,
                yMin: -1,
                yMax: 8,
                polygons: [{ vertices: [[2, 7], [0, 0], [8, 2]], color: 'blue', fillOpacity: 0.06 }],
                segments: [
                  { from: [2, 7], to: [4, 1], color: 'teal', label: 'Median' },
                  { from: [4, 1], to: [2.5, 7], color: 'violet', dashed: true, label: 'Right bisector' },
                ],
                points: [{ id: 'm', x: 4, y: 1, label: 'M', color: 'green', emphasis: true }],
              },
            },
          ],
        },
      },
      {
        id: 'l7-p3-worked',
        kind: 'worked',
        source: 'Alex Notes · Nov 5',
        prompt: 'Find the equation of the right bisector of segment AB with A(−3, 4) and B(5, 0).',
        plan: [
          'Find midpoint M of AB.',
          'Find slope of AB and take its negative reciprocal m_⊥.',
          'Sub m_⊥ and midpoint M into y = mx + b.',
        ],
        steps: [
          {
            heading: 'Find midpoint M of AB',
            mathLines: [
              'M = ((−3 + 5)/2, (4 + 0)/2) = (1, 2)',
            ],
            scene: {
              xMin: -5,
              xMax: 7,
              yMin: -2,
              yMax: 6,
              segments: [{ from: [-3, 4], to: [5, 0], color: 'blue' }],
              points: [
                { id: 'a', x: -3, y: 4, label: 'A(−3, 4)', color: 'blue' },
                { id: 'b', x: 5, y: 0, label: 'B(5, 0)', color: 'blue' },
                { id: 'm', x: 1, y: 2, label: 'M(1, 2)', color: 'green', emphasis: true },
              ],
            },
          },
          {
            heading: 'Perpendicular slope and equation through M(1, 2)',
            mathLines: [
              'm_AB = (0 − 4)/(5 − (−3)) = −4/8 = −1/2',
              'm_⊥ = 2',
              '2 = 2(1) + b  ⇒  b = 0  ⇒  y = 2x',
            ],
            scene: {
              xMin: -5,
              xMax: 7,
              yMin: -2,
              yMax: 6,
              segments: [{ from: [-3, 4], to: [5, 0], color: 'blue', ticks: 1 }],
              lines: [lineEq(2, 0, { color: 'violet', label: 'y = 2x' })],
              rightAngles: [rightAngleAt([1, 2], [5, 0], [2, 4], 'violet')],
              points: [
                { id: 'a', x: -3, y: 4, label: 'A', color: 'blue' },
                { id: 'b', x: 5, y: 0, label: 'B', color: 'blue' },
                { id: 'm', x: 1, y: 2, label: 'M(1, 2)', color: 'green' },
              ],
            },
          },
        ],
      },
      {
        id: 'l7-p4-alt',
        kind: 'math-input',
        source: 'Handout W2 #1b',
        prompt: '△ABC has A(3, 4), B(−5, 2), C(1, −4). Write the altitude from A to BC.',
        placeholder: 'y = mx + b',
        scene: {
          xMin: -6,
          xMax: 5,
          yMin: -5,
          yMax: 6,
          polygons: [{ vertices: [[3, 4], [-5, 2], [1, -4]], color: 'blue', fillOpacity: 0.08 }],
          points: [
            { id: 'a', x: 3, y: 4, label: 'A', showCoords: true, color: 'amber', emphasis: true },
            { id: 'b', x: -5, y: 2, label: 'B', showCoords: true, color: 'blue' },
            { id: 'c', x: 1, y: -4, label: 'C', showCoords: true, color: 'blue' },
          ],
        },
        solvedScene: {
          xMin: -6,
          xMax: 5,
          yMin: -5,
          yMax: 6,
          polygons: [{ vertices: [[3, 4], [-5, 2], [1, -4]], color: 'blue', fillOpacity: 0.08 }],
          lines: [lineEq(1, 1, { color: 'green', label: 'y = x + 1' })],
          points: [
            { id: 'a', x: 3, y: 4, label: 'A', color: 'amber' },
            { id: 'b', x: -5, y: 2, label: 'B', color: 'blue' },
            { id: 'c', x: 1, y: -4, label: 'C', color: 'blue' },
          ],
        },
        answer: { kind: 'line', expected: { a: 1, b: -1, c: 1 }, display: 'y = x + 1' },
        explanation: {
          steps: [
            {
              text: 'Find slope of BC, then take its negative reciprocal.',
              math: 'm_BC = (−4 − 2)/(1 − (−5)) = −6/6 = −1  ⇒  m_⊥ = 1',
              scene: {
                xMin: -6,
                xMax: 5,
                yMin: -5,
                yMax: 6,
                polygons: [{ vertices: [[3, 4], [-5, 2], [1, -4]], color: 'blue', fillOpacity: 0.08 }],
                segments: [{ from: [-5, 2], to: [1, -4], color: 'amber', label: 'm = −1' }],
                points: [{ id: 'a', x: 3, y: 4, label: 'A(3, 4)', color: 'amber' }],
              },
            },
            {
              text: 'Sub m = 1 and vertex A(3, 4) into y = mx + b.',
              math: '4 = 1(3) + b  ⇒  b = 1  ⇒  y = x + 1',
              scene: {
                xMin: -6,
                xMax: 5,
                yMin: -5,
                yMax: 6,
                polygons: [{ vertices: [[3, 4], [-5, 2], [1, -4]], color: 'blue', fillOpacity: 0.08 }],
                lines: [lineEq(1, 1, { color: 'green', label: 'y = x + 1' })],
                points: [{ id: 'a', x: 3, y: 4, label: 'A', color: 'amber' }],
              },
            },
          ],
        },
      },
      {
        id: 'l7-p5-rb',
        kind: 'math-input',
        source: 'Handout W2 #5',
        prompt: 'D(−3, 5) and M(7, −9) have midpoint (2, −2) and slope −7/5. Write their right bisector.',
        placeholder: 'y = mx + b',
        scene: {
          xMin: -5,
          xMax: 9,
          yMin: -10,
          yMax: 7,
          segments: [{ from: [-3, 5], to: [7, -9], color: 'blue', label: 'm = −7/5' }],
          points: [
            { id: 'd', x: -3, y: 5, label: 'D', color: 'blue' },
            { id: 'm', x: 7, y: -9, label: 'M', color: 'blue' },
            { id: 'mid', x: 2, y: -2, label: '(2, −2)', color: 'green', emphasis: true },
          ],
        },
        solvedScene: {
          xMin: -5,
          xMax: 9,
          yMin: -10,
          yMax: 7,
          segments: [{ from: [-3, 5], to: [7, -9], dim: true }],
          lines: [lineEq(5 / 7, -24 / 7, { color: 'green', label: 'y = 5/7 x − 24/7' })],
          points: [{ id: 'mid', x: 2, y: -2, label: '(2, −2)', color: 'green' }],
        },
        answer: { kind: 'line', expected: { a: 5 / 7, b: -1, c: -24 / 7 }, display: 'y = 5/7 x − 24/7' },
        explanation: {
          steps: [
            {
              text: 'Flip −7/5 and switch sign to get m_⊥ = 5/7, then sub midpoint (2, −2).',
              math: '−2 = (5/7)(2) + b  ⇒  b = −14/7 − 10/7 = −24/7',
              scene: {
                xMin: -5,
                xMax: 9,
                yMin: -10,
                yMax: 7,
                segments: [{ from: [-3, 5], to: [7, -9], dim: true }],
                lines: [lineEq(5 / 7, -24 / 7, { color: 'green', label: 'y = 5/7 x − 24/7' })],
                points: [{ id: 'mid', x: 2, y: -2, label: '(2, −2)', color: 'green' }],
              },
            },
          ],
        },
      },
    ],
    checks: [
      {
        id: 'l7-c1-multi',
        kind: 'multi-choice',
        prompt: 'Which triangle lines MUST meet the opposite side at 90°?',
        options: [
          { id: 'med', label: 'Median', hint: 'A median aims for the midpoint, not 90°.' },
          { id: 'alt', label: 'Altitude' },
          { id: 'rb', label: 'Right bisector' },
        ],
        correctIds: ['alt', 'rb'],
        explanation: {
          steps: [
            {
              text: 'Both an altitude and a right bisector use the negative reciprocal slope of the opposite side.',
              scene: {
                xMin: -1,
                xMax: 9,
                yMin: -1,
                yMax: 7,
                polygons: [{ vertices: [[2, 6], [0, 0], [8, 0]], dim: true }],
                segments: [
                  { from: [2, 6], to: [2, 0], color: 'amber', label: 'Altitude' },
                  { from: [4, 6], to: [4, 0], color: 'violet', dashed: true, label: 'Right bisector' },
                ],
                rightAngles: [
                  rightAngleAt([2, 0], [2, 6], [8, 0], 'amber'),
                  rightAngleAt([4, 0], [4, 6], [8, 0], 'violet'),
                ],
              },
            },
          ],
        },
      },
      {
        id: 'l7-c2-alt',
        kind: 'math-input',
        source: 'Handout W2 #3c',
        prompt: '△KLM has K(2, 2), L(0, −2), M(4, 0). Write the altitude from K to LM.',
        placeholder: 'y = mx + b',
        scene: {
          xMin: -2,
          xMax: 6,
          yMin: -3,
          yMax: 5,
          polygons: [{ vertices: [[2, 2], [0, -2], [4, 0]], color: 'blue', fillOpacity: 0.08 }],
          points: [
            { id: 'k', x: 2, y: 2, label: 'K', showCoords: true, color: 'amber', emphasis: true },
            { id: 'l', x: 0, y: -2, label: 'L', showCoords: true, color: 'blue' },
            { id: 'm', x: 4, y: 0, label: 'M', showCoords: true, color: 'blue' },
          ],
        },
        solvedScene: {
          xMin: -2,
          xMax: 6,
          yMin: -3,
          yMax: 5,
          polygons: [{ vertices: [[2, 2], [0, -2], [4, 0]], dim: true }],
          lines: [lineEq(-2, 6, { color: 'green', label: 'y = −2x + 6' })],
          points: [{ id: 'k', x: 2, y: 2, label: 'K', color: 'amber' }],
        },
        answer: { kind: 'line', expected: { a: -2, b: -1, c: 6 }, display: 'y = −2x + 6' },
        explanation: {
          steps: [
            {
              text: 'Slope of LM is (0 − (−2))/(4 − 0) = 1/2, so m_⊥ = −2.',
              math: '2 = −2(2) + b  ⇒  b = 6  ⇒  y = −2x + 6',
              scene: {
                xMin: -2,
                xMax: 6,
                yMin: -3,
                yMax: 5,
                polygons: [{ vertices: [[2, 2], [0, -2], [4, 0]], dim: true }],
                lines: [lineEq(-2, 6, { color: 'green', label: 'y = −2x + 6' })],
                points: [{ id: 'k', x: 2, y: 2, label: 'K', color: 'amber' }],
              },
            },
          ],
        },
      },
      {
        id: 'l7-c3-circumcentre',
        kind: 'math-input',
        source: 'Handout W4 #10',
        prompt: 'The right bisectors of △OAB are x = 4 and y = −x + 4. Find the circumcentre.',
        placeholder: '(x, y)',
        scene: {
          xMin: -1,
          xMax: 9,
          yMin: -2,
          yMax: 6,
          polygons: [{ vertices: [[0, 0], [4, 4], [8, 0]], dim: true }],
          lines: [
            vLine(4, { color: 'violet', dashed: true, label: 'x = 4' }),
            lineEq(-1, 4, { color: 'teal', dashed: true, label: 'y = −x + 4' }),
          ],
          points: [
            { id: 'o', x: 0, y: 0, label: 'O', color: 'blue' },
            { id: 'a', x: 4, y: 4, label: 'A', color: 'blue' },
            { id: 'b', x: 8, y: 0, label: 'B', color: 'blue' },
          ],
        },
        answer: { kind: 'point', expected: [4, 0], display: '(4, 0)' },
        explanation: {
          steps: [
            {
              text: 'Sub x = 4 into y = −x + 4 to get y = 0. Notice (4, 0) is distance 4 from O, A, and B.',
              math: 'Circumcentre = (4, 0)',
              scene: {
                xMin: -1,
                xMax: 9,
                yMin: -2,
                yMax: 6,
                polygons: [{ vertices: [[0, 0], [4, 4], [8, 0]], dim: true }],
                circles: [{ cx: 4, cy: 0, r: 4, color: 'green', dashed: true }],
                points: [{ id: 'cc', x: 4, y: 0, label: '(4, 0)', color: 'green', emphasis: true }],
              },
            },
          ],
        },
      },
    ],
  },

  // =========================================================================
  // LESSON 8: VERIFYING SHAPES
  // =========================================================================
  // =========================================================================
  // LESSON 8 · Quadrilateral Proofs
  // =========================================================================
  {
    id: 'u2-l8-quads',
    level: 2,
    number: 8,
    title: 'Quadrilateral Proofs',
    shortTitle: 'Quad Proofs',
    subtitle: 'Parallelograms, rectangles, rhombuses, squares, and trapezoids',
    completionColor: '#29cc57',
    completionRiveColor: 2,
    pages: [
      {
        id: 'l8-p1-explore',
        kind: 'explore',
        prompt: 'Switch between shapes and compare what slopes, lengths, and diagonals prove.',
        exploration: 'shape-properties',
      },
      {
        id: 'l8-p2-worked',
        kind: 'worked',
        source: 'Nov 12 Board Q · Test #11',
        prompt: 'Verify that R(3, 2), S(0, 4), T(−2, 1), U(1, −1) is a square.',
        plan: [
          'Check all 4 side lengths: equal lengths prove a rhombus.',
          'Check 1 corner with slopes: 90° upgrades a rhombus to a square.',
        ],
        steps: [
          {
            heading: 'Check all 4 side lengths',
            mathLines: [
              'RS = √((−3)² + 2²) = √13     ST = √((−2)² + (−3)²) = √13',
              'TU = √(3² + (−2)²) = √13     UR = √(2² + 3²) = √13',
              'All 4 sides equal √13  ⇒  RSTU is a rhombus.',
            ],
            scene: {
              xMin: -4,
              xMax: 5,
              yMin: -3,
              yMax: 6,
              polygons: [{ vertices: [[3, 2], [0, 4], [-2, 1], [1, -1]], color: 'blue', fillOpacity: 0.09 }],
              segments: [
                { from: [3, 2], to: [0, 4], color: 'blue', ticks: 1, label: '√13' },
                { from: [0, 4], to: [-2, 1], color: 'blue', ticks: 1 },
                { from: [-2, 1], to: [1, -1], color: 'blue', ticks: 1 },
                { from: [1, -1], to: [3, 2], color: 'blue', ticks: 1 },
              ],
              points: [
                { id: 'r', x: 3, y: 2, label: 'R', color: 'blue' },
                { id: 's', x: 0, y: 4, label: 'S', color: 'blue' },
                { id: 't', x: -2, y: 1, label: 'T', color: 'blue' },
                { id: 'u', x: 1, y: -1, label: 'U', color: 'blue' },
              ],
            },
          },
          {
            heading: 'Verify one 90° angle at S',
            mathLines: [
              'm_RS = (4 − 2)/(0 − 3) = −2/3',
              'm_ST = (1 − 4)/(−2 − 0) = 3/2',
              '(−2/3)(3/2) = −1  ⇒  ∠S = 90°  ⇒  RSTU is a square!',
            ],
            scene: {
              xMin: -4,
              xMax: 5,
              yMin: -3,
              yMax: 6,
              polygons: [{ vertices: [[3, 2], [0, 4], [-2, 1], [1, -1]], color: 'green', fillOpacity: 0.12 }],
              rightAngles: [rightAngleAt([0, 4], [3, 2], [-2, 1], 'green')],
              points: [
                { id: 'r', x: 3, y: 2, label: 'R', color: 'green' },
                { id: 's', x: 0, y: 4, label: 'S (90°)', color: 'green', emphasis: true },
                { id: 't', x: -2, y: 1, label: 'T', color: 'green' },
                { id: 'u', x: 1, y: -1, label: 'U', color: 'green' },
              ],
            },
          },
        ],
      },
      {
        id: 'l8-p3-multi',
        kind: 'multi-choice',
        prompt: 'You already proved all 4 sides of quad ABCD are equal. Which extra facts upgrade it to a square?',
        options: [
          { id: 'a', label: 'Two adjacent sides have negative reciprocal slopes' },
          { id: 'b', label: 'Both diagonals have equal length' },
          { id: 'c', label: 'Opposite sides are parallel', hint: 'Every rhombus already has parallel opposite sides.' },
          { id: 'd', label: 'Diagonals bisect each other', hint: 'Every parallelogram/rhombus already has bisecting diagonals.' },
        ],
        correctIds: ['a', 'b'],
        explanation: {
          steps: [
            {
              text: 'A rhombus already has parallel sides and perpendicular bisecting diagonals. Adding one 90° corner OR equal diagonals locks it into a square.',
              scene: {
                xMin: -3,
                xMax: 4,
                yMin: -2,
                yMax: 5,
                polygons: [{ vertices: [[3, 2], [0, 4], [-2, 1], [1, -1]], color: 'green', fillOpacity: 0.1 }],
                segments: [
                  { from: [3, 2], to: [-2, 1], color: 'amber', dashed: true, label: '√26' },
                  { from: [0, 4], to: [1, -1], color: 'amber', dashed: true, label: '√26' },
                ],
                rightAngles: [rightAngleAt([0, 4], [3, 2], [-2, 1], 'green')],
              },
            },
          ],
        },
      },
      {
        id: 'l8-p4-trap',
        kind: 'math-input',
        source: 'Ch. 2 Test #10',
        prompt: 'Quad ABCD has A(−6, 1), B(2, −5), C(6, 1), D(2, 4). Find the slope of AB to test if AB ∥ DC.',
        placeholder: 'e.g. -3/4',
        scene: {
          xMin: -7,
          xMax: 7,
          yMin: -6,
          yMax: 6,
          polygons: [{ vertices: [[-6, 1], [2, -5], [6, 1], [2, 4]], color: 'blue', fillOpacity: 0.08 }],
          segments: [
            { from: [-6, 1], to: [2, -5], color: 'amber', width: 2.8 },
            { from: [2, 4], to: [6, 1], color: 'blue', label: 'm_DC = −3/4' },
          ],
          points: [
            { id: 'a', x: -6, y: 1, label: 'A', showCoords: true, color: 'amber' },
            { id: 'b', x: 2, y: -5, label: 'B', showCoords: true, color: 'amber' },
            { id: 'c', x: 6, y: 1, label: 'C', color: 'blue' },
            { id: 'd', x: 2, y: 4, label: 'D', color: 'blue' },
          ],
        },
        answer: {
          kind: 'number',
          expected: -3 / 4,
          display: '−3/4',
          commonMistakes: [
            { value: 3 / 4, message: 'Watch the sign: (−5 − 1) = −6 over (2 − (−6)) = +8 gives −3/4.' },
            { value: -4 / 3, message: 'Slope is rise/run (Δy/Δx), not Δx/Δy!' },
          ],
        },
        explanation: {
          steps: [
            {
              text: 'm_AB = (−5 − 1)/(2 − (−6)) = −6/8 = −3/4, matching m_DC = −3/4. Since AD and BC have different slopes, ABCD is a trapezoid.',
              math: 'm_AB = m_DC = −3/4  ⇒  AB ∥ DC',
              scene: {
                xMin: -7,
                xMax: 7,
                yMin: -6,
                yMax: 6,
                polygons: [{ vertices: [[-6, 1], [2, -5], [6, 1], [2, 4]], color: 'green', fillOpacity: 0.1 }],
                segments: [
                  { from: [-6, 1], to: [2, -5], color: 'green', label: '−3/4' },
                  { from: [2, 4], to: [6, 1], color: 'green', label: '−3/4' },
                ],
              },
            },
          ],
        },
      },
    ],
    checks: [
      {
        id: 'l8-c1-diag-mid',
        kind: 'math-input',
        source: 'Handout W4 · Diagonals',
        prompt: 'Rhombus PQRS has vertices P(1, 3), Q(5, 0), R(1, −3), S(−3, 0). Find the common midpoint where diagonals PR and QS bisect each other.',
        placeholder: '(x, y)',
        scene: {
          xMin: -4,
          xMax: 6,
          yMin: -4,
          yMax: 4,
          polygons: [{ vertices: [[1, 3], [5, 0], [1, -3], [-3, 0]], color: 'violet', fillOpacity: 0.08 }],
          segments: [
            { from: [1, 3], to: [1, -3], color: 'teal', dashed: true },
            { from: [-3, 0], to: [5, 0], color: 'amber', dashed: true },
          ],
          points: [
            { id: 'p', x: 1, y: 3, label: 'P', showCoords: true, color: 'blue' },
            { id: 'q', x: 5, y: 0, label: 'Q', showCoords: true, color: 'blue' },
            { id: 'r', x: 1, y: -3, label: 'R', showCoords: true, color: 'blue' },
            { id: 's', x: -3, y: 0, label: 'S', showCoords: true, color: 'blue' },
          ],
        },
        solvedScene: {
          xMin: -4,
          xMax: 6,
          yMin: -4,
          yMax: 4,
          polygons: [{ vertices: [[1, 3], [5, 0], [1, -3], [-3, 0]], color: 'violet', fillOpacity: 0.08 }],
          segments: [
            { from: [1, 3], to: [1, -3], color: 'teal' },
            { from: [-3, 0], to: [5, 0], color: 'amber' },
          ],
          points: [{ id: 'm', x: 1, y: 0, label: 'M(1, 0)', color: 'green', emphasis: true }],
        },
        answer: { kind: 'point', expected: [1, 0], display: '(1, 0)' },
        explanation: {
          steps: [
            {
              text: 'Midpoint of PR = ((1 + 1)/2, (3 − 3)/2) = (1, 0), and Midpoint of QS = ((5 − 3)/2, (0 + 0)/2) = (1, 0). Same midpoint proves bisection!',
              math: 'M(PR) = M(QS) = (1, 0)',
              scene: {
                xMin: -4,
                xMax: 6,
                yMin: -4,
                yMax: 4,
                polygons: [{ vertices: [[1, 3], [5, 0], [1, -3], [-3, 0]], color: 'violet', fillOpacity: 0.08 }],
                points: [{ id: 'm', x: 1, y: 0, label: 'M(1, 0)', color: 'green', emphasis: true }],
              },
            },
          ],
        },
      },
      {
        id: 'l8-c2-trap-rule',
        kind: 'choice',
        source: 'Trapezoid Watch-Out',
        prompt: 'You showed m(AB) = m(CD) = 2/3 in quad ABCD. What else MUST you show to prove ABCD is a trapezoid (and not a parallelogram)?',
        options: [
          { id: 'a', label: 'Show m(BC) ≠ m(AD) so the other pair is NOT parallel.' },
          { id: 'b', label: 'Show AB = CD using the length formula.', hint: 'Equal lengths do not rule out a parallelogram.' },
          { id: 'c', label: 'Show ∠A = 90° using negative reciprocal slopes.', hint: 'A trapezoid does not need a 90° angle.' },
        ],
        correctId: 'a',
        explanation: {
          steps: [
            {
              text: 'A trapezoid has EXACTLY one pair of parallel sides. Always compute all 4 slopes so you prove one pair matches and the other pair differs.',
              scene: {
                xMin: -5,
                xMax: 5,
                yMin: -4,
                yMax: 4,
                polygons: [{ vertices: [[-4, -1], [2, -3], [4, 1], [0, 3]], color: 'amber', fillOpacity: 0.1 }],
              },
            },
          ],
        },
      },
      {
        id: 'l8-c3-area',
        kind: 'math-input',
        source: 'Ch. 2 Test #11',
        prompt: 'Square RSTU has side length √13. What is its exact area?',
        placeholder: 'e.g. 13',
        scene: {
          xMin: -4,
          xMax: 5,
          yMin: -3,
          yMax: 6,
          polygons: [{ vertices: [[3, 2], [0, 4], [-2, 1], [1, -1]], color: 'green', fillOpacity: 0.12 }],
          segments: [{ from: [3, 2], to: [0, 4], color: 'green', label: '√13' }],
          rightAngles: [rightAngleAt([0, 4], [3, 2], [-2, 1], 'green')],
        },
        answer: { kind: 'number', expected: 13, display: '13' },
        explanation: {
          steps: [
            {
              text: 'Keep √13 exact instead of rounding so squaring cancels the radical cleanly.',
              math: 'Area = (√13)² = 13',
              scene: {
                xMin: -4,
                xMax: 5,
                yMin: -3,
                yMax: 6,
                polygons: [{ vertices: [[3, 2], [0, 4], [-2, 1], [1, -1]], color: 'green', fillOpacity: 0.18 }],
                segments: [{ from: [3, 2], to: [0, 4], color: 'green', label: '√13' }],
              },
            },
          ],
        },
      },
    ],
  },

  // =========================================================================
  // LESSON 9 · Chords, Midsegments & Centres
  // =========================================================================
  {
    id: 'u2-l9-properties',
    level: 2,
    number: 9,
    title: 'Chords, Midsegments & Centres',
    shortTitle: 'Chords & Centres',
    subtitle: 'Chord right bisectors, triangle midsegments, and centroids',
    completionColor: '#00a896',
    completionRiveColor: 1,
    pages: [
      {
        id: 'l9-p1-chord-ms',
        kind: 'multi-step',
        source: 'Handout W4 #3 · Pen Practice',
        prompt:
          'Chord **CD** on circle **x² + y² = 10** joins **C(3, 1)** and **D(1, −3)**. Work step-by-step (try Pen Mode **P**!) to verify its right bisector hits the centre **(0, 0)**.',
        plan: [
          'Find midpoint M of chord CD',
          'Find slope of CD, then flip & negate for m⊥',
          'Write right bisector y = mx + b using M (verify b = 0)',
        ],
        steps: [
          {
            id: 'mid',
            label: 'Midpoint M of chord CD',
            prompt: 'Step 1: Find midpoint **M** of **C(3, 1)** and **D(1, −3)**.',
            placeholder: '(x, y)',
            ledgerResult: 'M = (2, −1)',
            scene: {
              xMin: -4,
              xMax: 4,
              yMin: -4,
              yMax: 4,
              circles: [{ cx: 0, cy: 0, r: Math.sqrt(10), color: 'blue' }],
              segments: [{ from: [3, 1], to: [1, -3], color: 'amber', width: 2.5 }],
              points: [
                { id: 'o', x: 0, y: 0, label: 'O', color: 'muted' },
                { id: 'c', x: 3, y: 1, label: 'C', showCoords: true, color: 'amber' },
                { id: 'd', x: 1, y: -3, label: 'D', showCoords: true, color: 'amber' },
              ],
            },
            solvedScene: {
              xMin: -4,
              xMax: 4,
              yMin: -4,
              yMax: 4,
              circles: [{ cx: 0, cy: 0, r: Math.sqrt(10), color: 'blue' }],
              segments: [{ from: [3, 1], to: [1, -3], color: 'amber', width: 2.5 }],
              points: [
                { id: 'o', x: 0, y: 0, label: 'O', color: 'muted' },
                { id: 'm', x: 2, y: -1, label: 'M(2, −1)', color: 'violet', emphasis: true },
              ],
            },
            answer: { kind: 'point', expected: [2, -1], display: '(2, −1)' },
          },
          {
            id: 'mperp',
            label: 'Perpendicular slope m⊥',
            prompt: 'Step 2: Slope of CD is **2**. What is the **perpendicular slope m⊥**?',
            placeholder: 'e.g. -1/2',
            ledgerResult: 'm⊥ = −1/2',
            scene: {
              xMin: -4,
              xMax: 4,
              yMin: -4,
              yMax: 4,
              circles: [{ cx: 0, cy: 0, r: Math.sqrt(10), color: 'blue' }],
              segments: [{ from: [3, 1], to: [1, -3], color: 'amber', width: 2.5 }],
              points: [
                { id: 'o', x: 0, y: 0, label: 'O', color: 'muted' },
                { id: 'm', x: 2, y: -1, label: 'M(2, −1)', color: 'violet', emphasis: true },
              ],
            },
            solvedScene: {
              xMin: -4,
              xMax: 4,
              yMin: -4,
              yMax: 4,
              circles: [{ cx: 0, cy: 0, r: Math.sqrt(10), color: 'blue' }],
              segments: [{ from: [3, 1], to: [1, -3], color: 'amber' }],
              lines: [lineEq(-0.5, 0, { color: 'violet', dashed: true })],
              points: [{ id: 'm', x: 2, y: -1, label: 'M(2, −1)', color: 'violet', emphasis: true }],
            },
            answer: {
              kind: 'number',
              expected: -0.5,
              display: '−1/2',
              commonMistakes: [
                { value: 0.5, message: 'Don’t forget to switch the sign from + to −!' },
                { value: -2, message: 'Don’t forget to flip 2/1 into 1/2!' },
              ],
            },
          },
          {
            id: 'eq',
            label: 'Right bisector equation',
            prompt: 'Step 3: Write the **right bisector** through **M(2, −1)** with **m⊥ = −1/2**.',
            placeholder: 'y = mx + b',
            ledgerResult: 'y = −1/2 x (hits (0, 0)!)',
            scene: {
              xMin: -4,
              xMax: 4,
              yMin: -4,
              yMax: 4,
              circles: [{ cx: 0, cy: 0, r: Math.sqrt(10), color: 'blue' }],
              segments: [{ from: [3, 1], to: [1, -3], color: 'amber' }],
              points: [
                { id: 'o', x: 0, y: 0, label: 'O(0, 0)', color: 'green' },
                { id: 'm', x: 2, y: -1, label: 'M(2, −1)', color: 'violet', emphasis: true },
              ],
            },
            solvedScene: {
              xMin: -4,
              xMax: 4,
              yMin: -4,
              yMax: 4,
              circles: [{ cx: 0, cy: 0, r: Math.sqrt(10), color: 'blue' }],
              segments: [{ from: [3, 1], to: [1, -3], color: 'amber' }],
              lines: [lineEq(-0.5, 0, { color: 'green', label: 'y = −1/2 x' })],
              points: [
                { id: 'o', x: 0, y: 0, label: 'O(0, 0)', color: 'green', emphasis: true },
                { id: 'm', x: 2, y: -1, label: 'M(2, −1)', color: 'green' },
              ],
            },
            answer: { kind: 'line', expected: { a: -0.5, b: -1, c: 0 }, display: 'y = −1/2 x' },
          },
        ],
        explanation: {
          steps: [
            {
              text: 'Midpoint of CD is M(2, −1) and m⊥ = −1/2. Solving −1 = (−1/2)(2) + b gives b = 0, so y = −1/2 x passes straight through (0, 0)!',
              math: '−1 = (−1/2)(2) + b  ⇒  b = 0  ⇒  y = −1/2 x',
              scene: {
                xMin: -4,
                xMax: 4,
                yMin: -4,
                yMax: 4,
                circles: [{ cx: 0, cy: 0, r: Math.sqrt(10), color: 'blue' }],
                segments: [{ from: [3, 1], to: [1, -3], color: 'amber' }],
                lines: [lineEq(-0.5, 0, { color: 'green', label: 'y = −1/2 x' })],
                points: [{ id: 'o', x: 0, y: 0, label: 'O(0, 0)', color: 'green', emphasis: true }],
              },
            },
          ],
        },
      },
      {
        id: 'l9-p2-midseg',
        kind: 'choice',
        source: 'Handout W4 #2',
        prompt: 'Midsegment PQ joins the midpoints of KL and ML in △KLM. Base KM has slope −4/3 and length 10. What are the slope and length of PQ?',
        scene: {
          xMin: -1,
          xMax: 11,
          yMin: -1,
          yMax: 11,
          polygons: [{ vertices: [[2, 10], [4, 6], [8, 2]], color: 'blue', fillOpacity: 0.06 }],
          segments: [
            { from: [2, 10], to: [8, 2], color: 'blue', label: 'KM = 10' },
            { from: [3, 8], to: [6, 4], color: 'amber', width: 2.8, label: 'PQ' },
          ],
          points: [
            { id: 'p', x: 3, y: 8, label: 'P', color: 'amber' },
            { id: 'q', x: 6, y: 4, label: 'Q', color: 'amber' },
          ],
        },
        options: [
          { id: 'a', label: 'Slope −4/3, length 5' },
          { id: 'b', label: 'Slope 3/4, length 5', hint: 'A midsegment is parallel to the base, not perpendicular.' },
          { id: 'c', label: 'Slope −4/3, length 10', hint: 'A midsegment is half as long as the third side.' },
        ],
        correctId: 'a',
        explanation: {
          steps: [
            {
              text: 'Every triangle midsegment is parallel to the third side (same slope −4/3) and exactly half its length (10 ÷ 2 = 5).',
              scene: {
                xMin: -1,
                xMax: 11,
                yMin: -1,
                yMax: 11,
                segments: [
                  { from: [2, 10], to: [8, 2], color: 'blue', label: '10' },
                  { from: [3, 8], to: [6, 4], color: 'green', width: 3, label: '5' },
                ],
              },
            },
          ],
        },
      },
      {
        id: 'l9-p3-hyp-mid',
        kind: 'choice',
        source: 'Nov 11 Notes · Right Triangle Midpoint',
        prompt: 'In right triangle △KLM with ∠K = 90°, point N is the midpoint of hypotenuse LM. Which distances are ALL equal?',
        scene: {
          xMin: -4,
          xMax: 5,
          yMin: -4,
          yMax: 6,
          polygons: [{ vertices: [[-2, 2], [1, 5], [3, -3]], color: 'blue', fillOpacity: 0.08 }],
          segments: [
            { from: [-2, 2], to: [2, 1], color: 'amber', dashed: true },
          ],
          points: [
            { id: 'k', x: -2, y: 2, label: 'K (90°)', color: 'blue' },
            { id: 'l', x: 1, y: 5, label: 'L', color: 'blue' },
            { id: 'm', x: 3, y: -3, label: 'M', color: 'blue' },
            { id: 'n', x: 2, y: 1, label: 'N', color: 'amber', emphasis: true },
          ],
        },
        options: [
          { id: 'a', label: 'KN = LN = MN (N is equidistant from all three vertices)' },
          { id: 'b', label: 'KL = KM = LM (all three sides are equal)', hint: 'A right triangle can never be equilateral!' },
          { id: 'c', label: 'KN = LM (the median equals the entire hypotenuse)', hint: 'KN is HALF the hypotenuse, not the full hypotenuse.' },
        ],
        correctId: 'a',
        explanation: {
          steps: [
            {
              text: 'In any right triangle, the midpoint of the hypotenuse is the circumcentre, so it is the exact same distance from all three corners!',
              math: 'KN = LN = MN = 1/2 · LM',
              scene: {
                xMin: -4,
                xMax: 5,
                yMin: -4,
                yMax: 6,
                polygons: [{ vertices: [[-2, 2], [1, 5], [3, -3]], color: 'blue', fillOpacity: 0.08 }],
                circles: [{ cx: 2, cy: 1, r: Math.sqrt(17), color: 'green', dashed: true }],
                points: [{ id: 'n', x: 2, y: 1, label: 'N', color: 'green', emphasis: true }],
              },
            },
          ],
        },
      },
    ],
    checks: [
      {
        id: 'l9-c1-centroid',
        kind: 'math-input',
        source: 'Handout W4 #6',
        prompt: 'Find the centroid (balance point) of △XYZ with X(0, 0), Y(4, 4), Z(8, −4).',
        placeholder: '(x, y)',
        scene: {
          xMin: -1,
          xMax: 9,
          yMin: -5,
          yMax: 5,
          polygons: [{ vertices: [[0, 0], [4, 4], [8, -4]], color: 'blue', fillOpacity: 0.08 }],
          points: [
            { id: 'x', x: 0, y: 0, label: 'X', showCoords: true, color: 'blue' },
            { id: 'y', x: 4, y: 4, label: 'Y', showCoords: true, color: 'blue' },
            { id: 'z', x: 8, y: -4, label: 'Z', showCoords: true, color: 'blue' },
          ],
        },
        answer: { kind: 'point', expected: [4, 0], display: '(4, 0)' },
        explanation: {
          steps: [
            {
              text: 'Two medians meet at (4, 0), which you can verify quickly with the 3-vertex average.',
              math: 'G = ((0 + 4 + 8)/3, (0 + 4 − 4)/3) = (4, 0)',
              scene: {
                xMin: -1,
                xMax: 9,
                yMin: -5,
                yMax: 5,
                polygons: [{ vertices: [[0, 0], [4, 4], [8, -4]], color: 'blue', fillOpacity: 0.08 }],
                segments: [
                  { from: [0, 0], to: [6, 0], color: 'teal', dashed: true },
                  { from: [4, 4], to: [4, -2], color: 'teal', dashed: true },
                ],
                points: [{ id: 'g', x: 4, y: 0, label: 'G(4, 0)', color: 'green', emphasis: true }],
              },
            },
          ],
        },
      },
      {
        id: 'l9-c2-midseg-len',
        kind: 'math-input',
        source: 'Nov 11 Notes · Midsegment',
        prompt: 'In △DEF, base DF joins D(0, 0) to F(6, 8). What is the exact length of the midsegment parallel to DF?',
        placeholder: 'e.g. 5',
        scene: {
          xMin: -1,
          xMax: 8,
          yMin: -1,
          yMax: 10,
          polygons: [{ vertices: [[0, 0], [2, 8], [6, 8]], color: 'blue', fillOpacity: 0.07 }],
          segments: [
            { from: [0, 0], to: [6, 8], color: 'blue', label: 'DF' },
            { from: [1, 4], to: [4, 8], color: 'amber', width: 2.6, label: '?' },
          ],
          points: [
            { id: 'd', x: 0, y: 0, label: 'D(0,0)', color: 'blue' },
            { id: 'f', x: 6, y: 8, label: 'F(6,8)', color: 'blue' },
          ],
        },
        answer: {
          kind: 'number',
          expected: 5,
          display: '5',
          commonMistakes: [
            { value: 10, message: '10 is the full length of DF! A midsegment is HALF the third side.' },
          ],
        },
        explanation: {
          steps: [
            {
              text: 'DF = √(6² + 8²) = √100 = 10, so the midsegment parallel to DF has length 10 ÷ 2 = 5.',
              math: 'DF = 10  ⇒  midsegment = 5',
              scene: {
                xMin: -1,
                xMax: 8,
                yMin: -1,
                yMax: 10,
                segments: [
                  { from: [0, 0], to: [6, 8], color: 'blue', label: '10' },
                  { from: [1, 4], to: [4, 8], color: 'green', width: 3, label: '5' },
                ],
              },
            },
          ],
        },
      },
      {
        id: 'l9-c3-chord-b0',
        kind: 'choice',
        source: 'Circle Property Check',
        prompt: 'You found the right bisector of a chord on x² + y² = 25 is **y = −3/4 x + b**. What value of **b** proves it passes through the circle’s centre (0, 0)?',
        options: [
          { id: 'a', label: 'b = 0' },
          { id: 'b', label: 'b = 5', hint: 'y = −3/4 x + 5 hits (0, 5), not the centre (0, 0).' },
          { id: 'c', label: 'b = 25', hint: '25 is r², not the y-intercept.' },
        ],
        correctId: 'a',
        explanation: {
          steps: [
            {
              text: 'A line passes through the origin (0, 0) if and only if its y-intercept is b = 0.',
              math: '0 = (−3/4)(0) + b  ⇒  b = 0',
              scene: {
                xMin: -6,
                xMax: 6,
                yMin: -6,
                yMax: 6,
                circles: [{ cx: 0, cy: 0, r: 5, color: 'blue' }],
                lines: [lineEq(-0.75, 0, { color: 'green', label: 'b = 0' })],
                points: [{ id: 'o', x: 0, y: 0, label: 'O(0,0)', color: 'green', emphasis: true }],
              },
            },
          ],
        },
      },
    ],
  },
]
