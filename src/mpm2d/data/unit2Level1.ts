import type { GeoLesson } from '../pageTypes'

export const UNIT2_LEVEL_1: GeoLesson[] = [
  // =========================================================================
  // LESSON 1 · Slopes & Lines
  // =========================================================================
  {
    id: 'u2-l1-slopes',
    level: 1,
    number: 1,
    title: 'Slopes & Lines',
    shortTitle: 'Slopes & Lines',
    subtitle: 'Rise over run, isolating y, and perpendicular slopes',
    completionColor: '#9d62ff',
    completionRiveColor: 0,
    pages: [
      {
        id: 'l1-p1-explore',
        kind: 'explore',
        prompt:
          'Drag **A** or **B**. Watch how the **90° slope** always flips the fraction and switches the sign.',
        exploration: 'slope-perp',
      },
      {
        id: 'l1-p2-choice',
        kind: 'choice',
        source: "Alex's Notes · Oct 20",
        prompt: 'A line has slope **3/4**. What is the slope of a line **perpendicular** to it?',
        scene: {
          xMin: -5,
          xMax: 5,
          yMin: -4,
          yMax: 5,
          lines: [{ a: 3, b: -4, c: 0, color: 'blue', label: 'm = 3/4' }],
          riseRuns: [{ from: [0, 0], to: [4, 3], color: 'blue', showLabels: true }],
        },
        solvedScene: {
          xMin: -5,
          xMax: 5,
          yMin: -4,
          yMax: 5,
          lines: [
            { a: 3, b: -4, c: 0, color: 'blue', dim: true, label: 'm = 3/4' },
            { a: 4, b: 3, c: 0, color: 'teal', label: 'm⊥ = −4/3' },
          ],
          rightAngles: [{ vertex: [0, 0], dir1: [4, 3], dir2: [-3, 4], color: 'green' }],
        },
        options: [
          { id: 'a', label: '4/3', hint: 'You flipped the fraction, now also switch the sign.' },
          { id: 'b', label: '−3/4', hint: 'You switched the sign, now also flip 3/4 upside down.' },
          { id: 'c', label: '−4/3' },
          { id: 'd', label: '3/4', hint: 'Equal slopes are parallel, not perpendicular.' },
        ],
        correctId: 'c',
        explanation: {
          steps: [
            {
              text: 'Flip 3/4 upside down to 4/3, then switch positive to negative.',
              math: 'm⊥ = −4/3   (check: 3/4 · (−4/3) = −1)',
              scene: {
                xMin: -5,
                xMax: 5,
                yMin: -4,
                yMax: 5,
                lines: [
                  { a: 3, b: -4, c: 0, color: 'blue', dim: true, label: 'm = 3/4' },
                  { a: 4, b: 3, c: 0, color: 'teal', label: 'm⊥ = −4/3' },
                ],
                rightAngles: [{ vertex: [0, 0], dir1: [4, 3], dir2: [-3, 4], color: 'green' }],
              },
            },
          ],
        },
      },
      {
        id: 'l1-p3-worked',
        kind: 'worked',
        checkChoice: {
          prompt: 'Which equation did you get on your worksheet?',
          options: [
            { id: 'a', label: 'y = 1/3 x − 1' },
            { id: 'b', label: 'y = −1/3 x + 3', hint: 'Remember to negate AND flip: m = −3 becomes m⊥ = +1/3.' },
            { id: 'c', label: 'y = 1/3 x + 1', hint: 'Check b: 1 = (1/3)(6) + b gives 1 = 2 + b, so b = −1.' },
          ],
          correctId: 'a',
        },
        source: "Alex's Notes · Oct 20",
        prompt:
          'Find the line **perpendicular** to **3x + y = −3** that passes through **P(6, 1)**.',
        plan: [
          'Isolate y to read the slope m.',
          'Take the negative reciprocal m⊥.',
          'Sub m⊥ and P(6, 1) into y = mx + b to solve for b.',
        ],
        preScene: {
          xMin: -6,
          xMax: 8,
          yMin: -6,
          yMax: 5,
          lines: [{ a: 3, b: 1, c: 3, color: 'blue', label: '3x + y = −3' }],
          points: [{ id: 'p', x: 6, y: 1, label: 'P', showCoords: true, color: 'amber' }],
        },
        steps: [
          {
            heading: 'Isolate y to read m',
            mathLines: ['3x + y = −3', 'y = −3x − 3  →  m = −3'],
            scene: {
              xMin: -6,
              xMax: 8,
              yMin: -6,
              yMax: 5,
              lines: [{ a: 3, b: 1, c: 3, color: 'blue', label: 'y = −3x − 3' }],
              points: [{ id: 'p', x: 6, y: 1, label: 'P', showCoords: true, color: 'amber' }],
            },
          },
          {
            heading: 'Flip & negate to find m⊥',
            mathLines: [
              'm = −3 = −3/1',
              'Flip & negate  →  m⊥ = +1/3',
            ],
            scene: {
              xMin: -6,
              xMax: 8,
              yMin: -6,
              yMax: 5,
              lines: [
                { a: 3, b: 1, c: 3, color: 'blue', dim: true, label: 'm = −3' },
                { a: 1, b: -3, c: -3, color: 'teal', dashed: true, label: 'm⊥ = 1/3' },
              ],
              rightAngles: [{ vertex: [-0.6, -1.2], dir1: [1, -3], dir2: [3, 1], color: 'green' }],
              points: [{ id: 'p', x: 6, y: 1, label: 'P', showCoords: true, color: 'amber' }],
            },
          },
          {
            heading: 'Solve for b using P(6, 1)',
            mathLines: [
              '1 = (1/3)(6) + b  →  1 = 2 + b  →  b = −1',
              'y = 1/3 x − 1',
            ],
            scene: {
              xMin: -6,
              xMax: 8,
              yMin: -6,
              yMax: 5,
              lines: [
                { a: 3, b: 1, c: 3, color: 'blue', dim: true, label: 'y = −3x − 3' },
                { a: 1, b: -3, c: -3, color: 'teal', label: 'y = 1/3 x − 1' },
              ],
              rightAngles: [{ vertex: [-0.6, -1.2], dir1: [1, -3], dir2: [3, 1], color: 'green' }],
              points: [{ id: 'p', x: 6, y: 1, label: 'P', showCoords: true, color: 'amber' }],
            },
          },
        ],
      },
      {
        id: 'l1-p4-slope',
        kind: 'math-input',
        source: "Alex's Notes · Oct 20",
        prompt: 'Find the slope of segment **AB** from **A(−2, 1)** to **B(2, 4)**.',
        placeholder: 'e.g. 3/4',
        scene: {
          xMin: -5,
          xMax: 5,
          yMin: -2,
          yMax: 6,
          segments: [{ from: [-2, 1], to: [2, 4], color: 'blue' }],
          points: [
            { id: 'a', x: -2, y: 1, label: 'A', showCoords: true, color: 'blue' },
            { id: 'b', x: 2, y: 4, label: 'B', showCoords: true, color: 'blue' },
          ],
        },
        solvedScene: {
          xMin: -5,
          xMax: 5,
          yMin: -2,
          yMax: 6,
          riseRuns: [{ from: [-2, 1], to: [2, 4], color: 'blue', showLabels: true }],
          segments: [{ from: [-2, 1], to: [2, 4], color: 'blue', label: 'm = 3/4' }],
          points: [
            { id: 'a', x: -2, y: 1, label: 'A', showCoords: true, color: 'blue' },
            { id: 'b', x: 2, y: 4, label: 'B', showCoords: true, color: 'blue' },
          ],
        },
        answer: {
          kind: 'number',
          expected: 0.75,
          display: '3/4',
          commonMistakes: [
            { value: 4 / 3, message: 'Put the y-difference on top: (4 − 1) / (2 − (−2)).' },
            { value: -0.75, message: 'Watch the double negative: 2 − (−2) = +4.' },
          ],
        },
        explanation: {
          steps: [
            {
              text: 'Subtract y-values on top and x-values on the bottom.',
              math: 'm = (4 − 1) / (2 − (−2)) = 3 / 4',
              scene: {
                xMin: -5,
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
      },
      {
        id: 'l1-p5-perp',
        kind: 'math-input',
        source: "Alex's Notes · Oct 20",
        prompt:
          'Write the line **perpendicular** to **AB** (slope 3/4) passing through **C(3, −1)** in **y = mx + b** form.',
        placeholder: 'y = ...',
        scene: {
          xMin: -5,
          xMax: 7,
          yMin: -4,
          yMax: 6,
          lines: [{ a: 3, b: -4, c: 10, color: 'blue', dashed: true }],
          segments: [{ from: [-2, 1], to: [2, 4], color: 'blue' }],
          points: [
            { id: 'a', x: -2, y: 1, label: 'A', color: 'blue' },
            { id: 'b', x: 2, y: 4, label: 'B', color: 'blue' },
            { id: 'c', x: 3, y: -1, label: 'C', showCoords: true, color: 'amber', emphasis: true },
          ],
        },
        solvedScene: {
          xMin: -5,
          xMax: 7,
          yMin: -4,
          yMax: 6,
          lines: [
            { a: 3, b: -4, c: 10, color: 'blue', dashed: true },
            { a: 4, b: 3, c: -9, color: 'teal', label: 'y = −4/3 x + 3' },
          ],
          segments: [{ from: [-2, 1], to: [2, 4], color: 'blue' }],
          points: [{ id: 'c', x: 3, y: -1, label: 'C', showCoords: true, color: 'amber' }],
        },
        answer: {
          kind: 'line',
          expected: { a: 4, b: 3, c: -9 },
          requireSlopeIntercept: true,
          display: 'y = −4/3 x + 3',
        },
        explanation: {
          steps: [
            {
              text: 'Flip and negate 3/4 to get m⊥ = −4/3, then plug in C(3, −1).',
              math: '−1 = (−4/3)(3) + b  →  −1 = −4 + b  →  b = 3',
              scene: {
                xMin: -5,
                xMax: 7,
                yMin: -4,
                yMax: 6,
                lines: [
                  { a: 3, b: -4, c: 10, color: 'blue', dashed: true },
                  { a: 4, b: 3, c: -9, color: 'teal', label: 'y = −4/3 x + 3' },
                ],
                points: [{ id: 'c', x: 3, y: -1, label: 'C', showCoords: true, color: 'amber' }],
              },
            },
          ],
        },
      },
    ],
    checks: [
      {
        id: 'l1-c1-multi',
        kind: 'multi-choice',
        prompt: 'Which equations represent lines **perpendicular** to **y = 2x + 7**?',
        scene: {
          xMin: -6,
          xMax: 6,
          yMin: -3,
          yMax: 9,
          lines: [{ a: 2, b: -1, c: 7, color: 'blue', label: 'y = 2x + 7' }],
        },
        options: [
          { id: 'a', label: 'y = −1/2 x' },
          { id: 'b', label: 'y = −2x + 7', hint: '−2 is only negated, not flipped.' },
          { id: 'c', label: 'x + 2y = 6' },
          { id: 'd', label: 'y = 1/2 x − 4', hint: '1/2 is positive; you also need the opposite sign.' },
        ],
        correctIds: ['a', 'c'],
        explanation: {
          steps: [
            {
              text: 'Any line perpendicular to m = 2 must have slope m⊥ = −1/2. Isolating y in x + 2y = 6 gives y = −1/2 x + 3.',
              math: 'y = −1/2 x  and  y = −1/2 x + 3',
              scene: {
                xMin: -6,
                xMax: 6,
                yMin: -3,
                yMax: 9,
                lines: [
                  { a: 2, b: -1, c: 7, color: 'blue', label: 'y = 2x + 7' },
                  { a: 1, b: 2, c: 0, color: 'teal', label: 'y = −1/2 x' },
                  { a: 1, b: 2, c: -6, color: 'amber', label: 'x + 2y = 6' },
                ],
              },
            },
          ],
        },
      },
      {
        id: 'l1-c2-std',
        kind: 'math-input',
        source: 'Ch. 2 Test · #15b',
        prompt: 'Rearrange **2x − y + 7 = 0** into **y = mx + b** form.',
        placeholder: 'y = ...',
        scene: {
          xMin: -6,
          xMax: 4,
          yMin: -2,
          yMax: 9,
          lines: [{ a: 2, b: -1, c: 7, color: 'blue', label: '2x − y + 7 = 0' }],
        },
        solvedScene: {
          xMin: -6,
          xMax: 4,
          yMin: -2,
          yMax: 9,
          lines: [{ a: 2, b: -1, c: 7, color: 'teal', label: 'y = 2x + 7' }],
          points: [{ id: 'b', x: 0, y: 7, label: '(0, 7)', color: 'amber', emphasis: true }],
        },
        answer: {
          kind: 'line',
          expected: { a: 2, b: -1, c: 7 },
          requireSlopeIntercept: true,
          display: 'y = 2x + 7',
        },
        explanation: {
          steps: [
            {
              text: 'Add y to both sides so y is positive and alone.',
              math: '2x + 7 = y  →  y = 2x + 7',
              scene: {
                xMin: -6,
                xMax: 4,
                yMin: -2,
                yMax: 9,
                lines: [{ a: 2, b: -1, c: 7, color: 'blue', label: 'y = 2x + 7' }],
              },
            },
          ],
        },
      },
      {
        id: 'l1-c3-perp-origin',
        kind: 'math-input',
        source: 'Ch. 2 Test · #15b',
        prompt: 'Write the line **perpendicular** to **y = 2x + 7** passing through **(0, 0)**.',
        placeholder: 'y = ...',
        scene: {
          xMin: -6,
          xMax: 4,
          yMin: -2,
          yMax: 9,
          lines: [{ a: 2, b: -1, c: 7, color: 'blue', label: 'y = 2x + 7' }],
          points: [{ id: 'o', x: 0, y: 0, label: 'O', showCoords: true, color: 'amber' }],
        },
        solvedScene: {
          xMin: -6,
          xMax: 4,
          yMin: -2,
          yMax: 9,
          lines: [
            { a: 2, b: -1, c: 7, color: 'blue', label: 'y = 2x + 7' },
            { a: 1, b: 2, c: 0, color: 'teal', label: 'y = −1/2 x' },
          ],
          rightAngles: [{ vertex: [-2.8, 1.4], dir1: [1, 2], dir2: [2, -1], color: 'green' }],
        },
        answer: {
          kind: 'line',
          expected: { a: 1, b: 2, c: 0 },
          requireSlopeIntercept: true,
          display: 'y = −1/2 x',
        },
        explanation: {
          steps: [
            {
              text: 'The perpendicular slope is −1/2, and passing through (0, 0) means b = 0.',
              math: 'y = −1/2 x',
              scene: {
                xMin: -6,
                xMax: 4,
                yMin: -2,
                yMax: 9,
                lines: [
                  { a: 2, b: -1, c: 7, color: 'blue' },
                  { a: 1, b: 2, c: 0, color: 'teal', label: 'y = −1/2 x' },
                ],
                rightAngles: [{ vertex: [-2.8, 1.4], dir1: [1, 2], dir2: [2, -1], color: 'green' }],
              },
            },
          ],
        },
      },
    ],
  },

  // =========================================================================
  // LESSON 2 · Midpoint
  // =========================================================================
  {
    id: 'u2-l2-midpoint',
    level: 1,
    number: 2,
    title: 'Midpoint',
    shortTitle: 'Midpoint',
    subtitle: 'Averaging endpoints and working backwards from a midpoint',
    completionColor: '#9d62ff',
    completionRiveColor: 0,
    pages: [
      {
        id: 'l2-p1-explore',
        kind: 'explore',
        prompt:
          'Drag the endpoints to see **midpoint = average**. Switch tabs to see how finding a **missing endpoint** repeats the same jump twice.',
        exploration: 'midpoint',
      },
      {
        id: 'l2-p2-worked',
        kind: 'worked',
        checkChoice: {
          prompt: 'Which midpoint did you get for P(−4, −8) and Q(−3, −1)?',
          options: [
            { id: 'a', label: '(−3.5, −4.5)' },
            { id: 'b', label: '(−0.5, −3.5)', hint: 'Add the coordinates instead of subtracting: (−4 + (−3))/2 = −7/2.' },
            { id: 'c', label: '(−7, −9)', hint: 'Don’t forget to divide both sums by 2.' },
          ],
          correctId: 'a',
        },
        source: "Alex's Notes · Oct 20",
        prompt:
          'Find the midpoint of **A(11, 14), B(3, 5)** and **P(−4, −8), Q(−3, −1)**.',
        plan: ['Add the x-coordinates and divide by 2.', 'Add the y-coordinates and divide by 2.'],
        steps: [
          {
            heading: 'A(11, 14) and B(3, 5)',
            mathLines: ['M = ((11 + 3)/2, (14 + 5)/2)', 'M = (7, 9.5)'],
            preScene: {
              xMin: 1,
              xMax: 13,
              yMin: 3,
              yMax: 16,
              segments: [{ from: [3, 5], to: [11, 14], color: 'blue' }],
              points: [
                { id: 'a', x: 11, y: 14, label: 'A', showCoords: true, color: 'blue' },
                { id: 'b', x: 3, y: 5, label: 'B', showCoords: true, color: 'blue' },
              ],
            },
            scene: {
              xMin: 1,
              xMax: 13,
              yMin: 3,
              yMax: 16,
              segments: [
                { from: [3, 5], to: [7, 9.5], color: 'blue', ticks: 1 },
                { from: [7, 9.5], to: [11, 14], color: 'blue', ticks: 1 },
              ],
              points: [
                { id: 'a', x: 11, y: 14, label: 'A', showCoords: true, color: 'blue' },
                { id: 'b', x: 3, y: 5, label: 'B', showCoords: true, color: 'blue' },
                { id: 'm', x: 7, y: 9.5, label: 'M', showCoords: true, color: 'amber', emphasis: true },
              ],
            },
          },
          {
            heading: 'Negative coordinates: P(−4, −8) and Q(−3, −1)',
            mathLines: ['M = ((−4 + (−3))/2, (−8 + (−1))/2)', 'M = (−3.5, −4.5)'],
            preScene: {
              xMin: -7,
              xMax: 1,
              yMin: -10,
              yMax: 1,
              segments: [{ from: [-4, -8], to: [-3, -1], color: 'teal' }],
              points: [
                { id: 'p', x: -4, y: -8, label: 'P', showCoords: true, color: 'teal' },
                { id: 'q', x: -3, y: -1, label: 'Q', showCoords: true, color: 'teal' },
              ],
            },
            scene: {
              xMin: -7,
              xMax: 1,
              yMin: -10,
              yMax: 1,
              segments: [
                { from: [-4, -8], to: [-3.5, -4.5], color: 'teal', ticks: 1 },
                { from: [-3.5, -4.5], to: [-3, -1], color: 'teal', ticks: 1 },
              ],
              points: [
                { id: 'p', x: -4, y: -8, label: 'P', showCoords: true, color: 'teal' },
                { id: 'q', x: -3, y: -1, label: 'Q', showCoords: true, color: 'teal' },
                { id: 'm', x: -3.5, y: -4.5, label: 'M', showCoords: true, color: 'amber', emphasis: true },
              ],
            },
          },
        ],
      },
      {
        id: 'l2-p3-ch7',
        kind: 'math-input',
        source: 'Ch. 2 Test · #7',
        prompt: 'Find the midpoint of **A(−2, −5)** and **B(−8, 3)**.',
        placeholder: '(x, y)',
        scene: {
          xMin: -10,
          xMax: 1,
          yMin: -7,
          yMax: 5,
          segments: [{ from: [-2, -5], to: [-8, 3], color: 'blue' }],
          points: [
            { id: 'a', x: -2, y: -5, label: 'A', showCoords: true, color: 'blue' },
            { id: 'b', x: -8, y: 3, label: 'B', showCoords: true, color: 'blue' },
          ],
        },
        solvedScene: {
          xMin: -10,
          xMax: 1,
          yMin: -7,
          yMax: 5,
          segments: [
            { from: [-2, -5], to: [-5, -1], color: 'blue', ticks: 1 },
            { from: [-5, -1], to: [-8, 3], color: 'blue', ticks: 1 },
          ],
          points: [
            { id: 'a', x: -2, y: -5, label: 'A', showCoords: true, color: 'blue' },
            { id: 'b', x: -8, y: 3, label: 'B', showCoords: true, color: 'blue' },
            { id: 'm', x: -5, y: -1, label: 'M', showCoords: true, color: 'amber', emphasis: true },
          ],
        },
        answer: {
          kind: 'point',
          expected: [-5, -1],
          display: '(−5, −1)',
          commonMistakes: [
            { value: [3, -4], message: 'Midpoint adds; do not subtract the coordinates.' },
          ],
        },
        explanation: {
          steps: [
            {
              text: 'Add the x-values and y-values, then divide each by 2.',
              math: 'M = ((−2 + −8)/2, (−5 + 3)/2) = (−5, −1)',
              scene: {
                xMin: -10,
                xMax: 1,
                yMin: -7,
                yMax: 5,
                segments: [{ from: [-2, -5], to: [-8, 3], color: 'blue' }],
                points: [{ id: 'm', x: -5, y: -1, label: 'M', showCoords: true, color: 'amber', emphasis: true }],
              },
            },
          ],
        },
      },
      {
        id: 'l2-p4-worked-rev',
        kind: 'worked',
        checkChoice: {
          prompt: 'Which missing endpoint E did you get?',
          options: [
            { id: 'a', label: 'E(−3, −9)' },
            { id: 'b', label: 'E(1.5, −1.5)', hint: 'That averages D and M. Here M is the midpoint, so double the jump from D to M.' },
            { id: 'c', label: 'E(−3, −7)', hint: 'Check y: (1 + y)/2 = −4 gives 1 + y = −8, so y = −9.' },
          ],
          correctId: 'a',
        },
        source: 'Ch. 2 Test · #8',
        prompt:
          '**M(0, −4)** is the midpoint of segment **DE**, and **D(3, 1)**. Find the other endpoint **E**.',
        plan: ['Set (3 + x)/2 = 0 and solve for x.', 'Set (1 + y)/2 = −4 and solve for y.'],
        preScene: {
          xMin: -6,
          xMax: 6,
          yMin: -11,
          yMax: 3,
          segments: [{ from: [3, 1], to: [0, -4], color: 'blue' }],
          points: [
            { id: 'd', x: 3, y: 1, label: 'D', showCoords: true, color: 'blue' },
            { id: 'm', x: 0, y: -4, label: 'M', showCoords: true, color: 'amber', emphasis: true },
          ],
        },
        steps: [
          {
            heading: 'Solve the midpoint equation backwards',
            mathLines: [
              '(3 + x)/2 = 0   →  x = −3',
              '(1 + y)/2 = −4  →  1 + y = −8  →  y = −9',
              'E = (−3, −9)',
            ],
            scene: {
              xMin: -6,
              xMax: 6,
              yMin: -11,
              yMax: 3,
              segments: [
                { from: [3, 1], to: [0, -4], color: 'blue', ticks: 1 },
                { from: [0, -4], to: [-3, -9], color: 'teal', ticks: 1 },
              ],
              points: [
                { id: 'd', x: 3, y: 1, label: 'D', showCoords: true, color: 'blue' },
                { id: 'm', x: 0, y: -4, label: 'M', showCoords: true, color: 'amber', emphasis: true },
                { id: 'e', x: -3, y: -9, label: 'E', showCoords: true, color: 'teal', emphasis: true },
              ],
            },
          },
        ],
      },
    ],
    checks: [
      {
        id: 'l2-c1-diam',
        kind: 'math-input',
        source: 'Handout W4 · #7',
        prompt: 'A circle has diameter endpoints **M(−3, 5)** and **N(9, 7)**. Find its **centre**.',
        placeholder: '(x, y)',
        scene: {
          xMin: -5,
          xMax: 11,
          yMin: -1,
          yMax: 13,
          circles: [{ cx: 3, cy: 6, r: Math.sqrt(37), color: 'muted', dashed: true }],
          segments: [{ from: [-3, 5], to: [9, 7], color: 'blue' }],
          points: [
            { id: 'm', x: -3, y: 5, label: 'M', showCoords: true, color: 'blue' },
            { id: 'n', x: 9, y: 7, label: 'N', showCoords: true, color: 'blue' },
          ],
        },
        solvedScene: {
          xMin: -5,
          xMax: 11,
          yMin: -1,
          yMax: 13,
          circles: [{ cx: 3, cy: 6, r: Math.sqrt(37), color: 'teal' }],
          segments: [{ from: [-3, 5], to: [9, 7], color: 'blue' }],
          points: [
            { id: 'm', x: -3, y: 5, label: 'M', showCoords: true, color: 'blue' },
            { id: 'n', x: 9, y: 7, label: 'N', showCoords: true, color: 'blue' },
            { id: 'c', x: 3, y: 6, label: 'C', showCoords: true, color: 'amber', emphasis: true },
          ],
        },
        answer: { kind: 'point', expected: [3, 6], display: '(3, 6)' },
        explanation: {
          steps: [
            {
              text: 'The centre of a circle is always the midpoint of any diameter.',
              math: 'C = ((−3 + 9)/2, (5 + 7)/2) = (3, 6)',
              scene: {
                xMin: -5,
                xMax: 11,
                yMin: -1,
                yMax: 13,
                circles: [{ cx: 3, cy: 6, r: Math.sqrt(37), color: 'teal' }],
                points: [{ id: 'c', x: 3, y: 6, label: 'C', showCoords: true, color: 'amber', emphasis: true }],
              },
            },
          ],
        },
      },
      {
        id: 'l2-c2-rev',
        kind: 'math-input',
        source: 'Ch. 2 Test · #8 practice',
        prompt: 'Segment **PQ** has endpoint **P(−2, 6)** and midpoint **M(3, 1)**. Find endpoint **Q**.',
        placeholder: '(x, y)',
        scene: {
          xMin: -4,
          xMax: 10,
          yMin: -6,
          yMax: 8,
          segments: [{ from: [-2, 6], to: [3, 1], color: 'blue', ticks: 1 }],
          points: [
            { id: 'p', x: -2, y: 6, label: 'P', showCoords: true, color: 'blue' },
            { id: 'm', x: 3, y: 1, label: 'M', showCoords: true, color: 'amber', emphasis: true },
          ],
        },
        solvedScene: {
          xMin: -4,
          xMax: 10,
          yMin: -6,
          yMax: 8,
          segments: [
            { from: [-2, 6], to: [3, 1], color: 'blue', ticks: 1 },
            { from: [3, 1], to: [8, -4], color: 'teal', ticks: 1 },
          ],
          points: [
            { id: 'p', x: -2, y: 6, label: 'P', showCoords: true, color: 'blue' },
            { id: 'm', x: 3, y: 1, label: 'M', showCoords: true, color: 'amber' },
            { id: 'q', x: 8, y: -4, label: 'Q', showCoords: true, color: 'teal', emphasis: true },
          ],
        },
        answer: {
          kind: 'point',
          expected: [8, -4],
          display: '(8, −4)',
          commonMistakes: [
            { value: [0.5, 3.5], message: 'M is already the midpoint. Step past M by the same jump (+5, −5).' },
          ],
        },
        explanation: {
          steps: [
            {
              text: 'From P(−2, 6) to M(3, 1), x goes +5 and y goes −5. Repeat that jump from M.',
              math: '(−2 + x)/2 = 3 → x = 8;  (6 + y)/2 = 1 → y = −4  →  Q(8, −4)',
              scene: {
                xMin: -4,
                xMax: 10,
                yMin: -6,
                yMax: 8,
                segments: [
                  { from: [-2, 6], to: [3, 1], color: 'blue', ticks: 1 },
                  { from: [3, 1], to: [8, -4], color: 'teal', ticks: 1 },
                ],
                points: [{ id: 'q', x: 8, y: -4, label: 'Q', showCoords: true, color: 'teal', emphasis: true }],
              },
            },
          ],
        },
      },
      {
        id: 'l2-c3-multi',
        kind: 'multi-choice',
        prompt: 'Which pairs of endpoints have midpoint **(2, 1)**?',
        options: [
          { id: 'a', label: '(0, 0) and (4, 2)' },
          { id: 'b', label: '(−1, 5) and (5, −3)' },
          { id: 'c', label: '(6, 3) and (2, 1)', hint: 'Average is (4, 2), which looks like subtraction instead of addition.' },
          { id: 'd', label: '(2, −4) and (2, 6)' },
        ],
        correctIds: ['a', 'b', 'd'],
        explanation: {
          steps: [
            {
              text: 'Check that the x-values add to 4 (so average = 2) and the y-values add to 2 (so average = 1).',
              math: '0+4=4, 0+2=2 ✓  ·  −1+5=4, 5+(−3)=2 ✓  ·  2+2=4, −4+6=2 ✓',
              scene: {
                xMin: -2,
                xMax: 6,
                yMin: -5,
                yMax: 7,
                segments: [
                  { from: [0, 0], to: [4, 2], color: 'blue' },
                  { from: [-1, 5], to: [5, -3], color: 'teal' },
                  { from: [2, -4], to: [2, 6], color: 'amber' },
                ],
                points: [{ id: 'm', x: 2, y: 1, label: 'M', showCoords: true, color: 'green', emphasis: true }],
              },
            },
          ],
        },
      },
    ],
  },

  // =========================================================================
  // LESSON 3 · Medians
  // =========================================================================
  {
    id: 'u2-l3-medians',
    level: 1,
    number: 3,
    title: 'Medians',
    shortTitle: 'Medians',
    subtitle: 'Connecting a triangle corner to the opposite midpoint',
    completionColor: '#9d62ff',
    completionRiveColor: 0,
    pages: [
      {
        id: 'l3-p1-explore',
        kind: 'explore',
        prompt:
          'A **median** connects a corner straight to the halfway point of the opposite side. Drag **A**, **B**, or **C**.',
        exploration: 'median',
      },
      {
        id: 'l3-p2-plan',
        kind: 'plan-order',
        prompt: 'Build the numbered **plan** to find the equation of the **median from vertex C**.',
        scene: {
          xMin: -5,
          xMax: 7,
          yMin: -6,
          yMax: 5,
          polygons: [{ vertices: [[-3, 3], [2, -5], [5, 2]], color: 'blue', fillOpacity: 0.08 }],
          points: [
            { id: 'a', x: -3, y: 3, label: 'A', color: 'blue' },
            { id: 'b', x: 2, y: -5, label: 'B', color: 'blue' },
            { id: 'c', x: 5, y: 2, label: 'C', color: 'amber', emphasis: true },
          ],
        },
        pool: [
          { id: 'mid', text: 'Find midpoint M of opposite side AB.', category: 'midpoint' },
          { id: 'slope', text: 'Find the slope between C and M.', category: 'slope' },
          { id: 'eq', text: 'Sub that slope and C (or M) into y = mx + b.', category: 'line' },
          { id: 'perp', text: 'Take the negative reciprocal of slope AB.', category: 'slope' },
        ],
        validPlans: [
          {
            name: 'Median plan',
            steps: ['mid', 'slope', 'eq'],
            explanation: 'A median uses C and opposite midpoint M, with no 90° slope needed.',
          },
        ],
        missingFeedback: [
          { missingId: 'mid', message: 'Find the midpoint M of opposite side AB first.' },
        ],
        orderFeedback: [
          { before: 'mid', after: 'slope', message: 'Find midpoint M before finding the slope CM.' },
          { before: 'slope', after: 'eq', message: 'Find the slope before plugging into y = mx + b.' },
        ],
        explanation: {
          steps: [
            {
              text: '1) Midpoint M of AB  →  2) Slope from C to M  →  3) Plug into y = mx + b.',
              scene: {
                xMin: -5,
                xMax: 7,
                yMin: -6,
                yMax: 5,
                polygons: [{ vertices: [[-3, 3], [2, -5], [5, 2]], color: 'blue', fillOpacity: 0.08 }],
                lines: [{ a: 6, b: -11, c: -8, color: 'teal' }],
                points: [{ id: 'm', x: -0.5, y: -1, label: 'M', showCoords: true, color: 'teal' }],
              },
            },
          ],
        },
      },
      {
        id: 'l3-p3-worked',
        kind: 'worked',
        checkChoice: {
          prompt: 'Which equation did you get for the median from C?',
          options: [
            { id: 'a', label: 'y = 6/11 x − 8/11' },
            { id: 'b', label: 'y = 11/6 x − 43/6', hint: 'Check rise over run: Δy = 2 − (−1) = 3 and Δx = 5 − (−0.5) = 5.5, so m = 6/11.' },
            { id: 'c', label: 'y = 6/11 x + 8/11', hint: 'Check b: 2 = (6/11)(5) + b gives 22/11 − 30/11 = −8/11.' },
          ],
          correctId: 'a',
        },
        source: "Alex's Notes · Oct 22",
        prompt: 'Find the equation of the **median from C** in **△ABC** with A(−3, 3), B(2, −5), C(5, 2).',
        plan: ['Find midpoint M of AB.', 'Find slope of CM.', 'Sub C(5, 2) into y = mx + b.'],
        preScene: {
          xMin: -5,
          xMax: 7,
          yMin: -6,
          yMax: 5,
          polygons: [{ vertices: [[-3, 3], [2, -5], [5, 2]], color: 'blue', fillOpacity: 0.08 }],
          points: [
            { id: 'a', x: -3, y: 3, label: 'A', showCoords: true, color: 'blue' },
            { id: 'b', x: 2, y: -5, label: 'B', showCoords: true, color: 'blue' },
            { id: 'c', x: 5, y: 2, label: 'C', showCoords: true, color: 'amber', emphasis: true },
          ],
        },
        steps: [
          {
            heading: 'Midpoint M of opposite side AB',
            mathLines: ['M_AB = ((−3 + 2)/2, (3 − 5)/2) = (−0.5, −1)'],
            scene: {
              xMin: -5,
              xMax: 7,
              yMin: -6,
              yMax: 5,
              polygons: [{ vertices: [[-3, 3], [2, -5], [5, 2]], color: 'blue', fillOpacity: 0.08 }],
              points: [
                { id: 'a', x: -3, y: 3, label: 'A', showCoords: true, color: 'blue' },
                { id: 'b', x: 2, y: -5, label: 'B', showCoords: true, color: 'blue' },
                { id: 'c', x: 5, y: 2, label: 'C', showCoords: true, color: 'amber' },
                { id: 'm', x: -0.5, y: -1, label: 'M', showCoords: true, color: 'teal', emphasis: true },
              ],
            },
          },
          {
            heading: 'Slope CM and equation',
            mathLines: [
              'm = (2 − (−1)) / (5 − (−0.5)) = 3 / 5.5 = 6/11',
              '2 = (6/11)(5) + b  →  b = −8/11',
              'y = 6/11 x − 8/11',
            ],
            scene: {
              xMin: -5,
              xMax: 7,
              yMin: -6,
              yMax: 5,
              polygons: [{ vertices: [[-3, 3], [2, -5], [5, 2]], color: 'blue', fillOpacity: 0.08 }],
              lines: [{ a: 6, b: -11, c: -8, color: 'teal', label: 'y = 6/11 x − 8/11' }],
              points: [
                { id: 'a', x: -3, y: 3, label: 'A', showCoords: true, color: 'blue' },
                { id: 'b', x: 2, y: -5, label: 'B', showCoords: true, color: 'blue' },
                { id: 'c', x: 5, y: 2, label: 'C', showCoords: true, color: 'amber' },
                { id: 'm', x: -0.5, y: -1, label: 'M', showCoords: true, color: 'teal' },
              ],
            },
          },
        ],
      },
      {
        id: 'l3-p4-w2-1a',
        kind: 'math-input',
        source: 'Handout W2 · #1a',
        prompt:
          'In **△ABC** with **A(3, 4), B(−5, 2), C(1, −4)**, find the equation of the **median from C**.',
        placeholder: 'y = ...',
        scene: {
          xMin: -7,
          xMax: 5,
          yMin: -6,
          yMax: 6,
          polygons: [{ vertices: [[3, 4], [-5, 2], [1, -4]], color: 'blue', fillOpacity: 0.08 }],
          points: [
            { id: 'a', x: 3, y: 4, label: 'A', showCoords: true, color: 'blue' },
            { id: 'b', x: -5, y: 2, label: 'B', showCoords: true, color: 'blue' },
            { id: 'c', x: 1, y: -4, label: 'C', showCoords: true, color: 'amber', emphasis: true },
          ],
        },
        solvedScene: {
          xMin: -7,
          xMax: 5,
          yMin: -6,
          yMax: 6,
          polygons: [{ vertices: [[3, 4], [-5, 2], [1, -4]], color: 'blue', fillOpacity: 0.08 }],
          lines: [{ a: 7, b: 2, c: 1, color: 'teal', label: 'y = −7/2 x − 1/2' }],
          points: [
            { id: 'c', x: 1, y: -4, label: 'C', showCoords: true, color: 'amber' },
            { id: 'm', x: -1, y: 3, label: 'M', showCoords: true, color: 'teal', emphasis: true },
          ],
        },
        answer: {
          kind: 'line',
          expected: { a: 7, b: 2, c: 1 },
          requireSlopeIntercept: true,
          display: 'y = −7/2 x − 1/2',
        },
        explanation: {
          steps: [
            {
              text: 'Step 1: Find midpoint M of opposite side AB.',
              math: 'M_AB = ((3 − 5)/2, (4 + 2)/2) = (−1, 3)',
              scene: {
                xMin: -7,
                xMax: 5,
                yMin: -6,
                yMax: 6,
                polygons: [{ vertices: [[3, 4], [-5, 2], [1, -4]], color: 'blue', fillOpacity: 0.08 }],
                points: [{ id: 'm', x: -1, y: 3, label: 'M', showCoords: true, color: 'teal', emphasis: true }],
              },
            },
            {
              text: 'Step 2: Slope from M(−1, 3) to C(1, −4), then sub C(1, −4) for b.',
              math: 'm = (−4 − 3)/(1 − (−1)) = −7/2  →  −4 = −7/2 + b  →  b = −1/2',
              scene: {
                xMin: -7,
                xMax: 5,
                yMin: -6,
                yMax: 6,
                polygons: [{ vertices: [[3, 4], [-5, 2], [1, -4]], color: 'blue', fillOpacity: 0.08 }],
                lines: [{ a: 7, b: 2, c: 1, color: 'teal', label: 'y = −7/2 x − 1/2' }],
                points: [{ id: 'm', x: -1, y: 3, label: 'M', showCoords: true, color: 'teal' }],
              },
            },
          ],
        },
      },
    ],
    checks: [
      {
        id: 'l3-c1-vert',
        kind: 'math-input',
        source: 'Handout W2 · #3a',
        prompt:
          'In **△KLM** with **K(2, 2), L(0, −2), M(4, 0)**, find the equation of the **median from K**.',
        placeholder: 'e.g. x = ...',
        scene: {
          xMin: -2,
          xMax: 6,
          yMin: -4,
          yMax: 4,
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
          yMin: -4,
          yMax: 4,
          polygons: [{ vertices: [[2, 2], [0, -2], [4, 0]], color: 'blue', fillOpacity: 0.08 }],
          lines: [{ a: 1, b: 0, c: -2, color: 'teal', label: 'x = 2' }],
          points: [{ id: 'n', x: 2, y: -1, label: 'N', showCoords: true, color: 'teal', emphasis: true }],
        },
        answer: { kind: 'line', expected: { a: 1, b: 0, c: -2 }, display: 'x = 2' },
        explanation: {
          steps: [
            {
              text: 'Midpoint of LM is (2, −1). Both K(2, 2) and (2, −1) have x = 2, so it is a vertical line!',
              math: 'x = 2',
              scene: {
                xMin: -2,
                xMax: 6,
                yMin: -4,
                yMax: 4,
                polygons: [{ vertices: [[2, 2], [0, -2], [4, 0]], color: 'blue', fillOpacity: 0.08 }],
                lines: [{ a: 1, b: 0, c: -2, color: 'teal', label: 'x = 2' }],
                points: [{ id: 'n', x: 2, y: -1, label: 'N', showCoords: true, color: 'teal' }],
              },
            },
          ],
        },
      },
      {
        id: 'l3-c2-w2-2a',
        kind: 'math-input',
        source: 'Handout W2 · #2a',
        prompt:
          'In **△JKL** with **J(−6, 4), K(−4, −5), L(6, 1)**, find the equation of the **median from J**.',
        placeholder: 'y = ...',
        scene: {
          xMin: -8,
          xMax: 8,
          yMin: -7,
          yMax: 6,
          polygons: [{ vertices: [[-6, 4], [-4, -5], [6, 1]], color: 'blue', fillOpacity: 0.08 }],
          points: [
            { id: 'j', x: -6, y: 4, label: 'J', showCoords: true, color: 'amber', emphasis: true },
            { id: 'k', x: -4, y: -5, label: 'K', showCoords: true, color: 'blue' },
            { id: 'l', x: 6, y: 1, label: 'L', showCoords: true, color: 'blue' },
          ],
        },
        solvedScene: {
          xMin: -8,
          xMax: 8,
          yMin: -7,
          yMax: 6,
          polygons: [{ vertices: [[-6, 4], [-4, -5], [6, 1]], color: 'blue', fillOpacity: 0.08 }],
          lines: [{ a: 6, b: 7, c: 8, color: 'teal', label: 'y = −6/7 x − 8/7' }],
          points: [{ id: 'm', x: 1, y: -2, label: 'M', showCoords: true, color: 'teal' }],
        },
        answer: {
          kind: 'line',
          expected: { a: 6, b: 7, c: 8 },
          requireSlopeIntercept: true,
          display: 'y = −6/7 x − 8/7',
        },
        explanation: {
          steps: [
            {
              text: 'Midpoint of KL is (1, −2). Slope from J(−6, 4) to (1, −2) is −6/7.',
              math: '−2 = (−6/7)(1) + b  →  b = −8/7  →  y = −6/7 x − 8/7',
              scene: {
                xMin: -8,
                xMax: 8,
                yMin: -7,
                yMax: 6,
                polygons: [{ vertices: [[-6, 4], [-4, -5], [6, 1]], color: 'blue', fillOpacity: 0.08 }],
                lines: [{ a: 6, b: 7, c: 8, color: 'teal' }],
                points: [{ id: 'm', x: 1, y: -2, label: 'M', showCoords: true, color: 'teal' }],
              },
            },
          ],
        },
      },
      {
        id: 'l3-c3-multi',
        kind: 'multi-choice',
        prompt: 'Which statements are **always true** about a median of a triangle?',
        options: [
          { id: 'a', label: 'It passes through a vertex of the triangle.' },
          { id: 'b', label: 'It passes through the midpoint of the opposite side.' },
          {
            id: 'c',
            label: 'It meets the opposite side at a 90° angle.',
            hint: 'Only in special (isosceles/equilateral) triangles, not in general!',
          },
          { id: 'd', label: 'All three medians meet at the centroid.' },
        ],
        correctIds: ['a', 'b', 'd'],
        explanation: {
          steps: [
            {
              text: 'A median connects a vertex to the opposite midpoint (no 90° requirement), and all three medians intersect at the centroid.',
              scene: {
                xMin: -1,
                xMax: 9,
                yMin: -5,
                yMax: 5,
                polygons: [{ vertices: [[0, 0], [4, 4], [8, -4]], color: 'blue', fillOpacity: 0.08 }],
                lines: [
                  { a: 0, b: 1, c: 0, color: 'teal', dashed: true },
                  { a: 1, b: 0, c: -4, color: 'amber', dashed: true },
                ],
                points: [{ id: 'g', x: 4, y: 0, label: 'G', color: 'green', emphasis: true }],
              },
            },
          ],
        },
      },
    ],
  },

  // =========================================================================
  // LESSON 4 · Length & Circles
  // =========================================================================
  {
    id: 'u2-l4-length-circles',
    level: 1,
    number: 4,
    title: 'Length & Circles',
    shortTitle: 'Length & Circles',
    subtitle: 'Pythagoras on the grid, classifying triangles, and x² + y² = r²',
    completionColor: '#9d62ff',
    completionRiveColor: 0,
    pages: [
      {
        id: 'l4-p1-explore',
        kind: 'explore',
        prompt:
          'Drag **A** or **B** to see the length formula as a right triangle. Switch tabs to resize a circle **x² + y² = r²**.',
        exploration: 'length-circle',
      },
      {
        id: 'l4-p2-worked',
        kind: 'worked',
        checkChoice: {
          prompt: 'How did you classify △DEF from its exact side lengths?',
          options: [
            { id: 'a', label: 'Isosceles (DE = EF = √17)' },
            { id: 'b', label: 'Equilateral (all three sides √17)', hint: 'Check DF: Δx = −3, Δy = −5 gives DF = √(9 + 25) = √34.' },
            { id: 'c', label: 'Scalene (all sides different)', hint: 'Recheck DE and EF: both equal √(4² + 1²) = √17.' },
          ],
          correctId: 'a',
        },
        source: "Alex's Notes · Oct 26",
        prompt:
          'Find exact length **AB** for **A(3, 1), B(6, 9)**, then classify **△DEF** with **D(1, 3), E(−3, 2), F(−2, −2)**.',
        plan: ['Use d = √((x₂ − x₁)² + (y₂ − y₁)²).', 'Keep exact radicals to compare side lengths cleanly.'],
        steps: [
          {
            heading: 'Exact length AB',
            mathLines: ['d_AB = √((6 − 3)² + (9 − 1)²)', 'd_AB = √(9 + 64) = √73 ≈ 8.54'],
            preScene: {
              xMin: 0,
              xMax: 10,
              yMin: -1,
              yMax: 11,
              segments: [{ from: [3, 1], to: [6, 9], color: 'blue' }],
              points: [
                { id: 'a', x: 3, y: 1, label: 'A', showCoords: true, color: 'blue' },
                { id: 'b', x: 6, y: 9, label: 'B', showCoords: true, color: 'blue' },
              ],
            },
            scene: {
              xMin: 0,
              xMax: 10,
              yMin: -1,
              yMax: 11,
              riseRuns: [{ from: [3, 1], to: [6, 9], color: 'amber', showLabels: true }],
              segments: [{ from: [3, 1], to: [6, 9], color: 'blue', label: '√73' }],
              points: [
                { id: 'a', x: 3, y: 1, label: 'A', showCoords: true, color: 'blue' },
                { id: 'b', x: 6, y: 9, label: 'B', showCoords: true, color: 'blue' },
              ],
            },
          },
          {
            heading: 'Classify △DEF',
            mathLines: ['DE = √17,  EF = √17,  DF = √34', 'Two equal sides → Isosceles'],
            preScene: {
              xMin: -5,
              xMax: 3,
              yMin: -4,
              yMax: 5,
              polygons: [{ vertices: [[1, 3], [-3, 2], [-2, -2]], color: 'blue', fillOpacity: 0.08 }],
              points: [
                { id: 'd', x: 1, y: 3, label: 'D', showCoords: true, color: 'blue' },
                { id: 'e', x: -3, y: 2, label: 'E', showCoords: true, color: 'blue' },
                { id: 'f', x: -2, y: -2, label: 'F', showCoords: true, color: 'blue' },
              ],
            },
            scene: {
              xMin: -5,
              xMax: 3,
              yMin: -4,
              yMax: 5,
              polygons: [{ vertices: [[1, 3], [-3, 2], [-2, -2]], color: 'blue', fillOpacity: 0.08 }],
              segments: [
                { from: [1, 3], to: [-3, 2], color: 'teal', ticks: 1, label: '√17' },
                { from: [-3, 2], to: [-2, -2], color: 'teal', ticks: 1, label: '√17' },
                { from: [1, 3], to: [-2, -2], color: 'blue', label: '√34' },
              ],
              points: [
                { id: 'd', x: 1, y: 3, label: 'D', showCoords: true, color: 'blue' },
                { id: 'e', x: -3, y: 2, label: 'E', showCoords: true, color: 'blue' },
                { id: 'f', x: -2, y: -2, label: 'F', showCoords: true, color: 'blue' },
              ],
            },
          },
        ],
      },
      {
        id: 'l4-p3-cd',
        kind: 'math-input',
        source: "Alex's Notes · Oct 26",
        prompt: 'Find the **exact** length of segment **CD** with **C(2, −4)** and **D(−3, 5)**.',
        placeholder: 'sqrt(...)',
        scene: {
          xMin: -6,
          xMax: 5,
          yMin: -6,
          yMax: 7,
          segments: [{ from: [2, -4], to: [-3, 5], color: 'blue' }],
          points: [
            { id: 'c', x: 2, y: -4, label: 'C', showCoords: true, color: 'blue' },
            { id: 'd', x: -3, y: 5, label: 'D', showCoords: true, color: 'blue' },
          ],
        },
        solvedScene: {
          xMin: -6,
          xMax: 5,
          yMin: -6,
          yMax: 7,
          riseRuns: [{ from: [2, -4], to: [-3, 5], color: 'amber', showLabels: true }],
          segments: [{ from: [2, -4], to: [-3, 5], color: 'blue', label: '√106' }],
          points: [
            { id: 'c', x: 2, y: -4, label: 'C', showCoords: true, color: 'blue' },
            { id: 'd', x: -3, y: 5, label: 'D', showCoords: true, color: 'blue' },
          ],
        },
        answer: {
          kind: 'number',
          expected: Math.sqrt(106),
          exactRequired: true,
          display: '√106',
          commonMistakes: [
            { value: 106, message: 'Don’t forget the square root: √106.' },
            { value: Math.sqrt(26), message: 'Check Δy: 5 − (−4) = 9, and 9² = 81.' },
          ],
        },
        explanation: {
          steps: [
            {
              text: 'Δx = −5 and Δy = 9. Square both, add, and take the square root.',
              math: 'd = √((−5)² + 9²) = √(25 + 81) = √106',
              scene: {
                xMin: -6,
                xMax: 5,
                yMin: -6,
                yMax: 7,
                riseRuns: [{ from: [2, -4], to: [-3, 5], color: 'amber', showLabels: true }],
                segments: [{ from: [2, -4], to: [-3, 5], color: 'blue', label: '√106' }],
              },
            },
          ],
        },
      },
      {
        id: 'l4-p4-circle',
        kind: 'math-input',
        source: 'Ch. 2 Test · #2b',
        prompt: 'Write the equation of a circle centred at **(0, 0)** with **radius 7**.',
        placeholder: 'x^2 + y^2 = ...',
        scene: {
          xMin: -9,
          xMax: 9,
          yMin: -9,
          yMax: 9,
          points: [{ id: 'o', x: 0, y: 0, label: 'O', color: 'ink' }],
        },
        solvedScene: {
          xMin: -9,
          xMax: 9,
          yMin: -9,
          yMax: 9,
          circles: [{ cx: 0, cy: 0, r: 7, color: 'blue', label: 'x² + y² = 49' }],
          segments: [{ from: [0, 0], to: [7, 0], color: 'amber', label: 'r = 7' }],
          points: [{ id: 'o', x: 0, y: 0, label: 'O', color: 'ink' }],
        },
        answer: { kind: 'circle', expectedRadius: 7, display: 'x² + y² = 49' },
        explanation: {
          steps: [
            {
              text: 'Square the radius on the right-hand side: r² = 7² = 49.',
              math: 'x² + y² = 49',
              scene: {
                xMin: -9,
                xMax: 9,
                yMin: -9,
                yMax: 9,
                circles: [{ cx: 0, cy: 0, r: 7, color: 'blue', label: 'x² + y² = 49' }],
              },
            },
          ],
        },
      },
    ],
    checks: [
      {
        id: 'l4-c1-multi',
        kind: 'multi-choice',
        prompt: 'Which points lie **ON** the circle **x² + y² = 25**?',
        scene: {
          xMin: -6,
          xMax: 6,
          yMin: -6,
          yMax: 6,
          circles: [{ cx: 0, cy: 0, r: 5, color: 'blue', label: 'x² + y² = 25' }],
        },
        options: [
          { id: 'a', label: '(3, −4)' },
          { id: 'b', label: '(0, 5)' },
          { id: 'c', label: '(4, 4)', hint: '4² + 4² = 32 > 25 (outside the circle).' },
          { id: 'd', label: '(−5, 0)' },
        ],
        correctIds: ['a', 'b', 'd'],
        explanation: {
          steps: [
            {
              text: 'Plug each point into x² + y² and check if it equals 25.',
              math: '3² + (−4)² = 25 ✓  ·  0² + 5² = 25 ✓  ·  (−5)² + 0² = 25 ✓',
              scene: {
                xMin: -6,
                xMax: 6,
                yMin: -6,
                yMax: 6,
                circles: [{ cx: 0, cy: 0, r: 5, color: 'blue' }],
                points: [
                  { id: 'p1', x: 3, y: -4, label: '(3,−4)', color: 'green' },
                  { id: 'p2', x: 0, y: 5, label: '(0,5)', color: 'green' },
                  { id: 'p3', x: -5, y: 0, label: '(−5,0)', color: 'green' },
                ],
              },
            },
          ],
        },
      },
      {
        id: 'l4-c2-rad',
        kind: 'math-input',
        source: 'Handout W4 · #7',
        prompt:
          'A circle has centre **C(3, 6)** and passes through **N(9, 7)**. Find its **exact radius**.',
        placeholder: 'sqrt(...)',
        scene: {
          xMin: -5,
          xMax: 11,
          yMin: -1,
          yMax: 13,
          circles: [{ cx: 3, cy: 6, r: Math.sqrt(37), color: 'teal', dashed: true }],
          segments: [{ from: [3, 6], to: [9, 7], color: 'amber', width: 2.5, label: 'r = ?' }],
          points: [
            { id: 'c', x: 3, y: 6, label: 'C', showCoords: true, color: 'amber' },
            { id: 'n', x: 9, y: 7, label: 'N', showCoords: true, color: 'blue' },
          ],
        },
        solvedScene: {
          xMin: -5,
          xMax: 11,
          yMin: -1,
          yMax: 13,
          circles: [{ cx: 3, cy: 6, r: Math.sqrt(37), color: 'teal' }],
          riseRuns: [{ from: [3, 6], to: [9, 7], color: 'blue', showLabels: true }],
          segments: [{ from: [3, 6], to: [9, 7], color: 'green', width: 3, label: 'r = √37' }],
          points: [
            { id: 'c', x: 3, y: 6, label: 'C', showCoords: true, color: 'amber' },
            { id: 'n', x: 9, y: 7, label: 'N', showCoords: true, color: 'blue' },
          ],
        },
        answer: { kind: 'number', expected: Math.sqrt(37), exactRequired: true, display: '√37' },
        explanation: {
          steps: [
            {
              text: 'Measure the distance from centre C(3, 6) to N(9, 7).',
              math: 'r = √((9 − 3)² + (7 − 6)²) = √(36 + 1) = √37',
              scene: {
                xMin: -5,
                xMax: 11,
                yMin: -1,
                yMax: 13,
                circles: [{ cx: 3, cy: 6, r: Math.sqrt(37), color: 'teal' }],
                segments: [{ from: [3, 6], to: [9, 7], color: 'amber', label: '√37' }],
              },
            },
          ],
        },
      },
      {
        id: 'l4-c3-medlen',
        kind: 'math-input',
        source: 'Handout W2 · #4a',
        prompt:
          'In **△ABC** with **A(−4, 2), B(−2, −6), C(6, −2)**, find the **exact length** of the **median from A**.',
        placeholder: 'sqrt(...) or 6sqrt(2)',
        scene: {
          xMin: -6,
          xMax: 8,
          yMin: -8,
          yMax: 4,
          polygons: [{ vertices: [[-4, 2], [-2, -6], [6, -2]], color: 'blue', fillOpacity: 0.08 }],
          points: [
            { id: 'a', x: -4, y: 2, label: 'A', showCoords: true, color: 'amber', emphasis: true },
            { id: 'b', x: -2, y: -6, label: 'B', showCoords: true, color: 'blue' },
            { id: 'c', x: 6, y: -2, label: 'C', showCoords: true, color: 'blue' },
          ],
        },
        solvedScene: {
          xMin: -6,
          xMax: 8,
          yMin: -8,
          yMax: 4,
          polygons: [{ vertices: [[-4, 2], [-2, -6], [6, -2]], color: 'blue', fillOpacity: 0.08 }],
          segments: [{ from: [-4, 2], to: [2, -4], color: 'teal', width: 2.8, label: '√72' }],
          points: [{ id: 'm', x: 2, y: -4, label: 'M', showCoords: true, color: 'teal' }],
        },
        answer: { kind: 'number', expected: Math.sqrt(72), exactRequired: true, display: '√72 (6√2)' },
        explanation: {
          steps: [
            {
              text: 'Step 1: Midpoint of BC is ((−2+6)/2, (−6−2)/2) = (2, −4). Step 2: Distance from A(−4, 2) to M(2, −4).',
              math: 'd = √((2 − (−4))² + (−4 − 2)²) = √(36 + 36) = √72',
              scene: {
                xMin: -6,
                xMax: 8,
                yMin: -8,
                yMax: 4,
                polygons: [{ vertices: [[-4, 2], [-2, -6], [6, -2]], color: 'blue', fillOpacity: 0.08 }],
                segments: [{ from: [-4, 2], to: [2, -4], color: 'teal', label: '√72' }],
                points: [{ id: 'm', x: 2, y: -4, label: 'M', showCoords: true, color: 'teal' }],
              },
            },
          ],
        },
      },
    ],
  },
]
