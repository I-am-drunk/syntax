import type { GeoLesson } from '../pageTypes'

export type CatchupLesson = GeoLesson & {
  isCatchup: true
  supportsLessonId: string
  branchSide: 'left' | 'right'
  minutes: number
  skillTag: string
}

export const CATCHUP_LESSONS: CatchupLesson[] = [
  {
    id: 'rescue-read-line',
    isCatchup: true,
    supportsLessonId: 'u2-l1-slopes',
    branchSide: 'left',
    minutes: 2,
    skillTag: 'Reading y = mx + b',
    level: 1,
    number: 101,
    title: 'Catch-Up: Reading y = mx + b',
    shortTitle: 'Read y = mx + b',
    subtitle: '2 min · Spot slope m and y-intercept b cleanly, even when terms are hidden.',
    completionColor: '#456dff',
    completionRiveColor: 0,
    pages: [
      {
        id: 'rc-read-0',
        kind: 'explore',
        prompt: 'Drag the points on the graph below and watch how the **slope m** and **perpendicular line** react live.',
        exploration: 'slope-perp',
      },
      {
        id: 'rc-read-1',
        kind: 'worked',
        source: 'Catch-Up · Prerequisite',
        prompt: 'In **y = mx + b**, the number glued to **x** is the slope **m**, and the lone constant is **b**.',
        plan: [
          'Find the coefficient in front of x → that is m.',
          'Find the constant term with its sign → that is b.',
          'Missing constant means b = 0; missing number before x means m = 1 (or −1).',
        ],
        steps: [
          {
            heading: 'Read m and b directly',
            mathLines: [
              'y = 2x − 5  →  m = 2,  b = −5',
              'y = −x      →  m = −1, b = 0',
              'y = 4       →  m = 0,  b = 4 (horizontal)',
            ],
            scene: {
              xMin: -5,
              xMax: 5,
              yMin: -6,
              yMax: 6,
              lines: [
                { a: 2, b: -1, c: -5, color: 'blue', label: 'y = 2x − 5' },
                { a: 0, b: 1, c: -4, color: 'teal', dashed: true, label: 'y = 4' },
              ],
              points: [{ id: 'b1', x: 0, y: -5, label: '(0, −5)', color: 'amber' }],
            },
          },
        ],
      },
      {
        id: 'rc-read-2',
        kind: 'choice',
        prompt: 'What is the slope **m** of the line **y = 4 − 3x**?',
        scene: {
          xMin: -4,
          xMax: 5,
          yMin: -4,
          yMax: 6,
          lines: [{ a: 3, b: 1, c: -4, color: 'blue', label: 'y = 4 − 3x' }],
        },
        options: [
          { id: 'a', label: '4', hint: '4 is the lone constant (b). Slope m is always attached to x.' },
          { id: 'b', label: '3', hint: 'Keep the minus sign in front of 3x.' },
          { id: 'c', label: '−3' },
          { id: 'd', label: '−4', hint: 'Check which number is multiplied by x.' },
        ],
        correctId: 'c',
        explanation: {
          steps: [
            {
              text: 'Order does not change slope: −3 is multiplied by x, so m = −3 and b = 4.',
              math: 'y = 4 − 3x = −3x + 4  →  m = −3',
              scene: {
                xMin: -4,
                xMax: 5,
                yMin: -4,
                yMax: 6,
                lines: [{ a: 3, b: 1, c: -4, color: 'blue', label: 'm = −3' }],
                points: [{ id: 'b', x: 0, y: 4, label: 'b = 4', color: 'amber' }],
              },
            },
          ],
        },
      },
    ],
    checks: [
      {
        id: 'rc-read-chk',
        kind: 'math-input',
        prompt: 'What is the slope **m** of **y = −x + 6**?',
        placeholder: 'e.g. -1',
        scene: {
          xMin: -3,
          xMax: 7,
          yMin: -2,
          yMax: 8,
          lines: [{ a: 1, b: 1, c: -6, color: 'blue', label: 'y = −x + 6' }],
        },
        answer: {
          kind: 'number',
          expected: -1,
          display: '−1',
          commonMistakes: [{ value: 1, message: 'The minus sign in front of x means −1.' }],
        },
        explanation: {
          steps: [
            {
              text: '−x is short for (−1)x, so the slope m is −1.',
              math: 'y = −1x + 6  →  m = −1',
              scene: {
                xMin: -3, xMax: 7, yMin: -2, yMax: 8,
                lines: [{ a: 1, b: 1, c: -6, color: 'blue', label: 'm = −1' }],
              },
            },
          ],
        },
      },
    ],
  },

  {
    id: 'rescue-isolate-y',
    isCatchup: true,
    supportsLessonId: 'u2-l1-slopes',
    branchSide: 'right',
    minutes: 3,
    skillTag: 'Isolating y',
    level: 1,
    number: 102,
    title: 'Catch-Up: Isolating y from Ax + By = C',
    shortTitle: 'Isolate y',
    subtitle: '3 min · Move the x-term across, then divide every single term by y’s coefficient.',
    completionColor: '#456dff',
    completionRiveColor: 0,
    pages: [
      {
        id: 'rc-iso-1',
        kind: 'worked',
        source: 'Catch-Up · Prerequisite',
        prompt: 'Rearrange **2x − 3y = 12** into **y = mx + b** without dropping a sign.',
        plan: [
          'Subtract 2x from both sides to isolate the y-term.',
          'Divide EVERY term by −3 (including the constant!).',
          'Simplify the double negative (−2)/(−3) = +2/3.',
        ],
        steps: [
          {
            heading: 'Move 2x, then divide every term by −3',
            mathLines: [
              '2x − 3y = 12',
              '−3y = −2x + 12',
              'y = (−2/−3)x + (12/−3)',
              'y = 2/3 x − 4   →   m = 2/3',
            ],
            scene: {
              xMin: -4,
              xMax: 8,
              yMin: -6,
              yMax: 4,
              lines: [{ a: 2, b: -3, c: -12, color: 'teal', label: 'y = 2/3 x − 4' }],
              points: [{ id: 'yint', x: 0, y: -4, label: '(0, −4)', color: 'amber' }],
            },
          },
        ],
      },
      {
        id: 'rc-iso-2',
        kind: 'choice',
        prompt: 'Isolate **y** in **3x + y = −3**. Which equation is right?',
        scene: {
          xMin: -5,
          xMax: 5,
          yMin: -6,
          yMax: 4,
          lines: [{ a: 3, b: 1, c: 3, color: 'blue', label: '3x + y = −3' }],
        },
        options: [
          { id: 'a', label: 'y = 3x − 3', hint: 'To cancel +3x on the left, subtract 3x on the right.' },
          { id: 'b', label: 'y = −3x − 3' },
          { id: 'c', label: 'y = −3x + 3', hint: 'Only 3x moved across =; −3 stayed on the right.' },
          { id: 'd', label: 'y = 3x + 3', hint: 'Check both signs carefully.' },
        ],
        correctId: 'b',
        explanation: {
          steps: [
            {
              text: 'Subtract 3x from both sides so +3x moves across as −3x.',
              math: '3x + y = −3  →  y = −3x − 3',
              scene: {
                xMin: -5, xMax: 5, yMin: -6, yMax: 4,
                lines: [{ a: 3, b: 1, c: 3, color: 'blue', label: 'y = −3x − 3' }],
              },
            },
          ],
        },
      },
    ],
    checks: [
      {
        id: 'rc-iso-chk',
        kind: 'math-input',
        prompt: 'Rearrange **4x + 2y = 10** into **y = mx + b** form.',
        placeholder: 'y = ...',
        scene: {
          xMin: -3,
          xMax: 6,
          yMin: -3,
          yMax: 7,
          lines: [{ a: 4, b: 2, c: -10, color: 'blue', label: '4x + 2y = 10' }],
        },
        answer: {
          kind: 'line',
          expected: { a: 2, b: 1, c: -5 },
          requireSlopeIntercept: true,
          display: 'y = −2x + 5',
        },
        explanation: {
          steps: [
            {
              text: 'Subtract 4x from both sides, then divide every term by 2.',
              math: '2y = −4x + 10  →  y = −2x + 5',
              scene: {
                xMin: -3, xMax: 6, yMin: -3, yMax: 7,
                lines: [{ a: 4, b: 2, c: -10, color: 'teal', label: 'y = −2x + 5' }],
              },
            },
          ],
        },
      },
    ],
  },

  {
    id: 'rescue-slope-signs',
    isCatchup: true,
    supportsLessonId: 'u2-l2-midpoint',
    branchSide: 'left',
    minutes: 3,
    skillTag: 'Slope & negative reciprocals',
    level: 1,
    number: 103,
    title: 'Catch-Up: Slope Signs & Negative Reciprocals',
    shortTitle: 'Slope & signs',
    subtitle: '3 min · Stop losing marks to double negatives and half-flipped perpendicular slopes.',
    completionColor: '#456dff',
    completionRiveColor: 0,
    pages: [
      {
        id: 'rc-slp-0',
        kind: 'explore',
        prompt: 'Drag the line to test positive, negative, and perpendicular slopes — watch the product **m₁ · m₂ = −1** hold.',
        exploration: 'slope-perp',
      },
      {
        id: 'rc-slp-1',
        kind: 'worked',
        source: 'Catch-Up · Prerequisite',
        prompt: 'Two rules: wrap negative coordinates in **parentheses**, and for **m⊥**, do BOTH **flip** and **sign switch**.',
        plan: [
          'm = (y₂ − y₁) / (x₂ − x₁) with brackets around negatives.',
          'Write whole numbers over 1 before flipping (e.g. −3 = −3/1 → +1/3).',
        ],
        steps: [
          {
            heading: 'Check the double negative and the flip',
            mathLines: [
              'A(−2, 1) to B(2, 4):  m = (4 − 1) / (2 − (−2)) = 3 / 4',
              'm = 3/4  →  flip to 4/3  →  negate to  m⊥ = −4/3',
              'm = −3   →  write −3/1  →  flip & negate  →  m⊥ = +1/3',
            ],
            scene: {
              xMin: -4,
              xMax: 5,
              yMin: -2,
              yMax: 6,
              riseRuns: [{ from: [-2, 1], to: [2, 4], color: 'blue', showLabels: true }],
              segments: [{ from: [-2, 1], to: [2, 4], color: 'blue' }],
              points: [
                { id: 'a', x: -2, y: 1, label: 'A', showCoords: true, color: 'blue' },
                { id: 'b', x: 2, y: 4, label: 'B', showCoords: true, color: 'blue' },
              ],
            },
          },
        ],
      },
    ],
    checks: [
      {
        id: 'rc-slp-chk',
        kind: 'math-input',
        prompt: 'What is the **perpendicular** slope **m⊥** to a line with slope **m = −5/2**?',
        placeholder: 'e.g. 2/5',
        scene: {
          xMin: -5,
          xMax: 5,
          yMin: -5,
          yMax: 5,
          lines: [{ a: 5, b: 2, c: 0, color: 'blue', label: 'm = −5/2' }],
        },
        answer: {
          kind: 'number',
          expected: 0.4,
          display: '2/5',
          commonMistakes: [
            { value: -0.4, message: 'You flipped it, now also switch negative to positive.' },
            { value: 2.5, message: 'You switched the sign, now also flip 5/2 upside down.' },
          ],
        },
        explanation: {
          steps: [
            {
              text: 'Flip 5/2 upside down to 2/5, and switch negative to positive.',
              math: 'm = −5/2  →  m⊥ = +2/5',
              scene: {
                xMin: -5, xMax: 5, yMin: -5, yMax: 5,
                lines: [
                  { a: 5, b: 2, c: 0, color: 'blue', dim: true, label: 'm = −5/2' },
                  { a: 2, b: -5, c: 0, color: 'teal', label: 'm⊥ = 2/5' },
                ],
              },
            },
          ],
        },
      },
    ],
  },

  {
    id: 'rescue-solve-b',
    isCatchup: true,
    supportsLessonId: 'u2-l3-medians',
    branchSide: 'right',
    minutes: 3,
    skillTag: 'Solving for b',
    level: 1,
    number: 104,
    title: 'Catch-Up: Subbing (x, y) to Solve for b',
    shortTitle: 'Solve for b',
    subtitle: '3 min · Multiply fraction slopes cleanly without decimal rounding.',
    completionColor: '#456dff',
    completionRiveColor: 0,
    pages: [
      {
        id: 'rc-b-0',
        kind: 'choice',
        prompt: 'A line with slope **m = 2** passes through **(3, 1)**. Which equation plugs these values into **y = mx + b** correctly?',
        scene: {
          xMin: -2,
          xMax: 6,
          yMin: -6,
          yMax: 4,
          points: [{ id: 'p0', x: 3, y: 1, label: '(3, 1)', color: 'amber' }],
        },
        options: [
          { id: 'a', label: '3 = 2(1) + b', hint: 'Watch the order: in (3, 1), x = 3 and y = 1.' },
          { id: 'b', label: '1 = 2(3) + b' },
          { id: 'c', label: '1 = 3(2) − b', hint: 'y = mx + b always adds b.' },
          { id: 'd', label: '2 = 1(3) + b', hint: '2 is the slope m, not y.' },
        ],
        correctId: 'b',
        explanation: {
          steps: [
            {
              text: 'Replace y with 1, m with 2, and x with 3: 1 = 2(3) + b → 1 = 6 + b → b = −5.',
              math: '1 = 2(3) + b  →  b = −5',
              scene: {
                xMin: -2, xMax: 6, yMin: -6, yMax: 4,
                lines: [{ a: 2, b: -1, c: -5, color: 'teal', label: 'y = 2x − 5' }],
                points: [{ id: 'p0', x: 3, y: 1, label: '(3, 1)', color: 'amber' }],
              },
            },
          ],
        },
      },
      {
        id: 'rc-b-1',
        kind: 'worked',
        source: 'Catch-Up · Prerequisite',
        prompt: 'Find **b** when **m = 1/3** and the line passes through **P(6, 1)**.',
        plan: [
          'Start from y = mx + b.',
          'Drop y = 1, m = 1/3, and x = 6 into their slots.',
          'Multiply (1/3)(6) = 2 first, then subtract 2 from both sides.',
        ],
        steps: [
          {
            heading: 'Plug in, multiply, isolate b',
            mathLines: [
              '1 = (1/3)(6) + b',
              '1 = 2 + b',
              '1 − 2 = b   →   b = −1',
            ],
            scene: {
              xMin: -3,
              xMax: 8,
              yMin: -3,
              yMax: 4,
              lines: [{ a: 1, b: -3, c: -3, color: 'teal', label: 'y = 1/3 x − 1' }],
              points: [
                { id: 'p', x: 6, y: 1, label: 'P(6, 1)', color: 'amber' },
                { id: 'b', x: 0, y: -1, label: 'b = −1', color: 'green' },
              ],
            },
          },
        ],
      },
    ],
    checks: [
      {
        id: 'rc-b-chk',
        kind: 'math-input',
        prompt: 'A line has slope **m = −1/2** and passes through **(4, 3)**. What is **b**?',
        placeholder: 'e.g. 5',
        scene: {
          xMin: -2,
          xMax: 8,
          yMin: -1,
          yMax: 7,
          points: [{ id: 'p', x: 4, y: 3, label: '(4, 3)', color: 'amber' }],
        },
        answer: {
          kind: 'number',
          expected: 5,
          display: '5',
          commonMistakes: [{ value: 1, message: '3 = −2 + b, so ADD 2 to both sides to get 5.' }],
        },
        explanation: {
          steps: [
            {
              text: 'Plug x = 4, y = 3, and m = −1/2 into y = mx + b.',
              math: '3 = (−1/2)(4) + b  →  3 = −2 + b  →  b = 5',
              scene: {
                xMin: -2, xMax: 8, yMin: -1, yMax: 7,
                lines: [{ a: 1, b: 2, c: -10, color: 'teal', label: 'y = −1/2 x + 5' }],
                points: [{ id: 'p', x: 4, y: 3, label: '(4, 3)', color: 'amber' }],
              },
            },
          ],
        },
      },
    ],
  },

  {
    id: 'rescue-squares-radicals',
    isCatchup: true,
    supportsLessonId: 'u2-l4-length-circles',
    branchSide: 'left',
    minutes: 3,
    skillTag: 'Squares & radicals',
    level: 1,
    number: 105,
    title: 'Catch-Up: Negative Squares & Exact Radicals',
    shortTitle: 'Squares & √',
    subtitle: '3 min · Why (−5)² is always +25 and how to keep exact radical lengths.',
    completionColor: '#456dff',
    completionRiveColor: 0,
    pages: [
      {
        id: 'rc-rad-0',
        kind: 'explore',
        prompt: 'Drag the point on the circle and watch **x² + y² = r²** stay locked as Δx and Δy trade off.',
        exploration: 'length-circle',
      },
      {
        id: 'rc-rad-1',
        kind: 'worked',
        source: 'Catch-Up · Prerequisite',
        prompt: 'Distance formula squares every difference, so both squared terms are **always positive**.',
        plan: [
          'Always put brackets around negative differences: (−4)² = +16.',
          'Add the two positive squares BEFORE taking the square root.',
        ],
        steps: [
          {
            heading: 'Compute d = √((Δx)² + (Δy)²)',
            mathLines: [
              'Δx = −3,  Δy = 4',
              'd = √((−3)² + 4²) = √(9 + 16) = √25 = 5',
            ],
            scene: {
              xMin: -5,
              xMax: 3,
              yMin: -1,
              yMax: 6,
              riseRuns: [{ from: [0, 0], to: [-3, 4], color: 'teal', showLabels: true }],
              segments: [{ from: [0, 0], to: [-3, 4], color: 'blue', label: 'd = 5' }],
              points: [
                { id: 'o', x: 0, y: 0, label: '(0, 0)', color: 'blue' },
                { id: 'p', x: -3, y: 4, label: '(−3, 4)', color: 'amber' },
              ],
            },
          },
        ],
      },
    ],
    checks: [
      {
        id: 'rc-rad-chk',
        kind: 'math-input',
        prompt: 'Evaluate **√((−6)² + 8²)**.',
        placeholder: 'e.g. 10',
        scene: {
          xMin: -8,
          xMax: 2,
          yMin: -1,
          yMax: 10,
          segments: [{ from: [0, 0], to: [-6, 8], color: 'blue', label: 'd = ?' }],
          points: [
            { id: 'a', x: 0, y: 0, label: '(0,0)', color: 'blue' },
            { id: 'b', x: -6, y: 8, label: '(−6,8)', color: 'amber' },
          ],
        },
        answer: {
          kind: 'number',
          expected: 10,
          display: '10',
          commonMistakes: [{ value: 14, message: 'You cannot take √ of each term separately: √(36 + 64) = √100 = 10.' }],
        },
        explanation: {
          steps: [
            {
              text: 'Square each number first: (−6)² = +36 and 8² = 64, then add before taking √.',
              math: '√(36 + 64) = √100 = 10',
              scene: {
                xMin: -8, xMax: 2, yMin: -1, yMax: 10,
                segments: [{ from: [0, 0], to: [-6, 8], color: 'teal', label: 'd = 10' }],
              },
            },
          ],
        },
      },
    ],
  },

  {
    id: 'rescue-linear-systems',
    isCatchup: true,
    supportsLessonId: 'u2-l6-distance',
    branchSide: 'right',
    minutes: 4,
    skillTag: 'Linear systems (POI)',
    level: 2,
    number: 106,
    title: 'Catch-Up: Finding the Point of Intersection (POI)',
    shortTitle: 'Linear POI',
    subtitle: '4 min · Set two lines equal, clear fractions cleanly, and check both equations.',
    completionColor: '#456dff',
    completionRiveColor: 0,
    pages: [
      {
        id: 'rc-poi-1',
        kind: 'worked',
        source: 'Catch-Up · Prerequisite',
        prompt: 'Find where **y = 2x − 1** meets **y = −x + 5**.',
        plan: [
          'Set the right-hand sides equal: 2x − 1 = −x + 5.',
          'Collect x-terms on one side and constants on the other.',
          'Plug x back into either equation to get y.',
        ],
        steps: [
          {
            heading: 'Solve for x, then substitute for y',
            mathLines: [
              '2x − 1 = −x + 5',
              '3x = 6   →   x = 2',
              'y = 2(2) − 1 = 3   →   POI (2, 3)',
            ],
            scene: {
              xMin: -2,
              xMax: 6,
              yMin: -2,
              yMax: 6,
              lines: [
                { a: 2, b: -1, c: -1, color: 'blue', label: 'y = 2x − 1' },
                { a: 1, b: 1, c: -5, color: 'teal', label: 'y = −x + 5' },
              ],
              points: [{ id: 'poi', x: 2, y: 3, label: 'POI(2, 3)', color: 'green', emphasis: true }],
            },
          },
        ],
      },
    ],
    checks: [
      {
        id: 'rc-poi-chk',
        kind: 'math-input',
        prompt: 'Find the **point of intersection** of **y = x + 1** and **y = −x + 5**.',
        placeholder: '(x, y)',
        scene: {
          xMin: -1,
          xMax: 6,
          yMin: -1,
          yMax: 6,
          lines: [
            { a: 1, b: -1, c: 1, color: 'blue', label: 'y = x + 1' },
            { a: 1, b: 1, c: -5, color: 'teal', label: 'y = −x + 5' },
          ],
        },
        answer: {
          kind: 'point',
          expected: [2, 3],
          display: '(2, 3)',
        },
        explanation: {
          steps: [
            {
              text: 'Set x + 1 = −x + 5 to get 2x = 4, so x = 2 and y = 2 + 1 = 3.',
              math: 'POI = (2, 3)',
              scene: {
                xMin: -1, xMax: 6, yMin: -1, yMax: 6,
                lines: [
                  { a: 1, b: -1, c: 1, color: 'blue', label: 'y = x + 1' },
                  { a: 1, b: 1, c: -5, color: 'teal', label: 'y = −x + 5' },
                ],
                points: [{ id: 'poi', x: 2, y: 3, label: '(2, 3)', color: 'green' }],
              },
            },
          ],
        },
      },
    ],
  },

  {
    id: 'rescue-geo-vocab',
    isCatchup: true,
    supportsLessonId: 'u2-l7-lines',
    branchSide: 'left',
    minutes: 3,
    skillTag: 'Triangle lines & centres',
    level: 2,
    number: 107,
    title: 'Catch-Up: Median vs Altitude vs Right Bisector',
    shortTitle: 'Triangle lines',
    subtitle: '3 min · One clean mental model so you never mix up the three triangle lines.',
    completionColor: '#456dff',
    completionRiveColor: 0,
    pages: [
      {
        id: 'rc-voc-0',
        kind: 'explore',
        prompt: 'Drag any corner of the triangle and watch how the **midpoint** and **median** track the opposite side automatically.',
        exploration: 'median',
      },
      {
        id: 'rc-voc-1',
        kind: 'worked',
        source: 'Catch-Up · Prerequisite',
        prompt: 'Every special triangle line is defined by **two ingredients**: where it starts and what angle it hits.',
        plan: [
          'Median = Vertex → Opposite Midpoint (no 90° needed).',
          'Altitude = Vertex → 90° to opposite side (no midpoint needed).',
          'Right Bisector = Midpoint → 90° (usually misses the opposite vertex!).',
        ],
        steps: [
          {
            heading: 'Check the two ingredients',
            mathLines: [
              'Median:          Vertex + Midpoint   → meet at Centroid',
              'Altitude:        Vertex + 90° (m⊥)   → meet at Orthocentre',
              'Right Bisector:  Midpoint + 90° (m⊥) → meet at Circumcentre',
            ],
            scene: {
              xMin: -1,
              xMax: 7,
              yMin: -1,
              yMax: 6,
              segments: [
                { from: [0, 0], to: [6, 0], color: 'blue' },
                { from: [6, 0], to: [2, 5], color: 'blue' },
                { from: [2, 5], to: [0, 0], color: 'blue' },
                { from: [2, 5], to: [3, 0], color: 'violet', dashed: true, label: 'Median' },
                { from: [2, 5], to: [2, 0], color: 'teal', label: 'Altitude' },
              ],
              rightAngles: [{ vertex: [2, 0], dir1: [1, 0], dir2: [0, 1], color: 'green' }],
              points: [
                { id: 'a', x: 2, y: 5, label: 'A', color: 'blue' },
                { id: 'm', x: 3, y: 0, label: 'M', color: 'violet' },
              ],
            },
          },
        ],
      },
    ],
    checks: [
      {
        id: 'rc-voc-chk',
        kind: 'choice',
        prompt: 'Which line uses BOTH the **midpoint** of a side AND the **negative reciprocal slope m⊥**?',
        options: [
          { id: 'a', label: 'Median', hint: 'A median uses the midpoint and the opposite vertex (no m⊥).' },
          { id: 'b', label: 'Altitude', hint: 'An altitude uses m⊥ and the opposite vertex (no midpoint).' },
          { id: 'c', label: 'Right Bisector' },
        ],
        correctId: 'c',
        explanation: {
          steps: [
            {
              text: 'A right bisector passes through the midpoint of a side at 90° (using m⊥).',
              math: 'Right Bisector = Midpoint + m⊥',
              scene: {
                xMin: -1, xMax: 7, yMin: -1, yMax: 6,
                segments: [{ from: [0, 0], to: [6, 0], color: 'blue' }],
                lines: [{ a: 1, b: 0, c: -3, color: 'teal', label: 'Right Bisector' }],
                points: [{ id: 'm', x: 3, y: 0, label: 'M(3, 0)', color: 'violet' }],
              },
            },
          ],
        },
      },
    ],
  },
]

export const CATCHUP_BY_ID = new Map(CATCHUP_LESSONS.map(l => [l.id, l]))

/** Map any Unit 2 lesson or page to its best matching Catch-Up rescue lesson */
export function resolveRescueLessonId(lessonId: string, pageId?: string): string {
  if (pageId) {
    if (pageId.includes('worked') || pageId.includes('isolate') || pageId === 'l1-p3-worked') {
      return 'rescue-isolate-y'
    }
    if (pageId.includes('slope') || pageId.includes('perp')) return 'rescue-slope-signs'
    if (pageId.includes('poi') || pageId.includes('circumcentre') || pageId.includes('centroid')) {
      return 'rescue-linear-systems'
    }
    if (pageId.includes('dist') || pageId.includes('len') || pageId.includes('circle')) {
      return 'rescue-squares-radicals'
    }
  }
  switch (lessonId) {
    case 'u2-l1-slopes':
      return 'rescue-isolate-y'
    case 'u2-l2-midpoint':
      return 'rescue-slope-signs'
    case 'u2-l3-medians':
      return 'rescue-solve-b'
    case 'u2-l4-length-circles':
      return 'rescue-squares-radicals'
    case 'u2-l5-right-tri':
      return 'rescue-squares-radicals'
    case 'u2-l6-distance':
      return 'rescue-linear-systems'
    case 'u2-l7-lines':
    case 'u2-l8-quads':
    case 'u2-l9-properties':
    case 'u2-c1-triangle-lines':
    case 'u2-c3-shapes-proofs':
      return 'rescue-geo-vocab'
    default:
      return 'rescue-isolate-y'
  }
}
