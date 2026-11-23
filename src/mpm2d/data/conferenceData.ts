import type { LessonDef, MakePlanScenario, ReadPlanScenario } from '../types'

export const MAKE_PLAN_SCENARIOS: MakePlanScenario[] = [
  {
    id: 'mp-1-median',
    title: 'Equation of a median',
    question:
      'Given vertices A, B, and C of △ABC, create a numbered plan to find the equation of the median from vertex C.',
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
      { id: 'mid-ab', text: 'Find the midpoint M of opposite side AB.', category: 'midpoint' },
      { id: 'slope-cm', text: 'Find the slope between C and midpoint M.', category: 'slope' },
      { id: 'eq-cm', text: 'Sub that slope and point C (or M) into y = mx + b to solve for b and write the equation.', category: 'line' },
      { id: 'slope-ab', text: 'Find the slope of AB and take its negative reciprocal.', category: 'slope' },
      { id: 'len-cm', text: 'Use the length formula to find the distance from C to M.', category: 'length' },
    ],
    validPlans: [
      {
        name: 'Median plan',
        steps: ['mid-ab', 'slope-cm', 'eq-cm'],
        explanation:
          'A median connects corner C straight to the halfway point M of AB. You do not need a perpendicular slope or a length, just midpoint M, slope CM, and y = mx + b.',
      },
    ],
    missingFeedback: [
      {
        missingId: 'mid-ab',
        message: 'A median lands on the halfway point of opposite side AB, so you must find midpoint M first.',
      },
      {
        missingId: 'slope-cm',
        message: 'Once you have C and M, find the slope directly between C and M (not perpendicular to AB).',
      },
    ],
    orderFeedback: [
      {
        before: 'mid-ab',
        after: 'slope-cm',
        message: 'You have to find midpoint M of AB before you can calculate the slope between C and M.',
      },
      {
        before: 'slope-cm',
        after: 'eq-cm',
        message: 'You need the slope m before substituting into y = mx + b.',
      },
    ],
  },
  {
    id: 'mp-2-altitude',
    title: 'Equation of an altitude',
    question:
      'Given vertices A, B, and C of △ABC, create a numbered plan to find the equation of the altitude from vertex A.',
    scene: {
      xMin: -6,
      xMax: 5,
      yMin: -5,
      yMax: 5,
      polygons: [{ vertices: [[3, 4], [-5, 2], [1, -4]], color: 'blue', fillOpacity: 0.08 }],
      points: [
        { id: 'a', x: 3, y: 4, label: 'A', color: 'amber', emphasis: true },
        { id: 'b', x: -5, y: 2, label: 'B', color: 'blue' },
        { id: 'c', x: 1, y: -4, label: 'C', color: 'blue' },
      ],
    },
    pool: [
      { id: 'slope-bc', text: 'Find the slope of opposite side BC.', category: 'slope' },
      { id: 'perp-bc', text: 'Take the negative reciprocal to get the perpendicular slope.', category: 'slope' },
      { id: 'eq-a', text: 'Sub the perpendicular slope and vertex A into y = mx + b to solve for b and write the equation.', category: 'line' },
      { id: 'mid-bc', text: 'Find the midpoint of side BC.', category: 'midpoint' },
      { id: 'poi', text: 'Find the POI of the altitude and side BC.', category: 'poi' },
    ],
    validPlans: [
      {
        name: 'Altitude plan',
        steps: ['slope-bc', 'perp-bc', 'eq-a'],
        explanation:
          'An altitude goes from vertex A straight to opposite side BC at 90°. It does NOT usually hit the midpoint of BC, and you do not need the POI unless asked for the height/length.',
      },
    ],
    missingFeedback: [
      {
        missingId: 'slope-bc',
        message: 'To know what direction is 90° to side BC, you first need the slope of BC.',
      },
      {
        missingId: 'perp-bc',
        message: 'An altitude meets side BC at 90°, so you must take the negative reciprocal of BC’s slope.',
      },
    ],
    orderFeedback: [
      {
        before: 'slope-bc',
        after: 'perp-bc',
        message: 'Find the slope of BC before flipping and negating it.',
      },
      {
        before: 'perp-bc',
        after: 'eq-a',
        message: 'Get the perpendicular slope before plugging into y = mx + b.',
      },
    ],
  },
  {
    id: 'mp-3-right-bisector',
    title: 'Right bisector of a segment',
    question:
      'Given endpoints A and B of segment AB, create a numbered plan to find the equation of the right bisector of AB.',
    scene: {
      xMin: -4,
      xMax: 6,
      yMin: -2,
      yMax: 5,
      segments: [{ from: [-3, 4], to: [5, 0], color: 'blue' }],
      points: [
        { id: 'a', x: -3, y: 4, label: 'A', color: 'blue' },
        { id: 'b', x: 5, y: 0, label: 'B', color: 'blue' },
      ],
    },
    pool: [
      { id: 'mid-ab', text: 'Find the midpoint M of segment AB.', category: 'midpoint' },
      { id: 'slope-ab', text: 'Find the slope of AB.', category: 'slope' },
      { id: 'perp-ab', text: 'Take the negative reciprocal for the perpendicular slope.', category: 'slope' },
      { id: 'eq-m', text: 'Sub the perpendicular slope and midpoint M into y = mx + b to solve for b.', category: 'line' },
      { id: 'eq-a', text: 'Sub the perpendicular slope and endpoint A into y = mx + b to solve for b.', category: 'line' },
      { id: 'len-ab', text: 'Find the length of AB.', category: 'length' },
    ],
    validPlans: [
      {
        name: 'Midpoint first',
        steps: ['mid-ab', 'slope-ab', 'perp-ab', 'eq-m'],
        explanation:
          'A right bisector splits AB in half (midpoint M) at 90° (negative reciprocal of m_AB). Always plug in M, not A or B.',
      },
      {
        name: 'Slope first',
        steps: ['slope-ab', 'perp-ab', 'mid-ab', 'eq-m'],
        explanation:
          'Finding the perpendicular slope before the midpoint is completely fine since both are needed before plugging into y = mx + b.',
      },
      {
        name: 'Slope, midpoint, then flip',
        steps: ['slope-ab', 'mid-ab', 'perp-ab', 'eq-m'],
        explanation: 'All ingredients (midpoint M and m⊥) are ready before writing y = mx + b.',
      },
    ],
    missingFeedback: [
      {
        missingId: 'eq-m',
        message: 'A right bisector passes through the MIDPOINT M (not endpoint A or B).',
      },
      {
        missingId: 'mid-ab',
        message: '“Bisector” means it cuts AB in half, so you must find the midpoint of AB.',
      },
    ],
    orderFeedback: [
      {
        before: 'slope-ab',
        after: 'perp-ab',
        message: 'Find the slope of AB before taking its negative reciprocal.',
      },
      {
        before: 'mid-ab',
        after: 'eq-m',
        message: 'Find midpoint M before substituting M into y = mx + b.',
      },
    ],
  },
  {
    id: 'mp-4-shortest-dist',
    title: 'Shortest distance from a point to a line',
    question:
      'Given a point P and a line in standard form Ax + By + C = 0, create a numbered plan to find the shortest distance from P to the line.',
    scene: {
      xMin: -3,
      xMax: 6,
      yMin: 0,
      yMax: 7,
      lines: [{ a: 1, b: 1, c: -5, color: 'blue', label: 'Ax + By + C = 0' }],
      points: [{ id: 'p', x: -1, y: 3, label: 'P', color: 'amber', emphasis: true }],
    },
    pool: [
      { id: 'rearrange', text: 'Rearrange the given line into y = mx + b to read its slope.', category: 'line' },
      { id: 'perp-line', text: 'Take the negative reciprocal slope and sub point P into y = mx + b to get the perpendicular line.', category: 'line' },
      { id: 'poi', text: 'Solve the system of the two lines to find their point of intersection (POI).', category: 'poi' },
      { id: 'dist', text: 'Use the length formula to find the distance from P to the POI.', category: 'length' },
      { id: 'mid', text: 'Find the midpoint between P and the y-intercept.', category: 'midpoint' },
    ],
    validPlans: [
      {
        name: 'Standard 4-step shortest distance plan',
        steps: ['rearrange', 'perp-line', 'poi', 'dist'],
        explanation:
          'Shortest path meets the line at 90°. Rearrange → perpendicular line through P → POI → length from P to POI.',
      },
    ],
    missingFeedback: [
      { missingId: 'rearrange', message: 'You need the slope of the given line first: isolate y to read it.' },
      { missingId: 'poi', message: 'Before you can measure the distance, you need the exact spot where the 90° line hits the given line (the POI).' },
      { missingId: 'dist', message: 'Don’t stop at the POI! The question asks for the shortest DISTANCE, so finish with the length formula.' },
    ],
    orderFeedback: [
      { before: 'rearrange', after: 'perp-line', message: 'Read the slope of the given line before building the perpendicular line.' },
      { before: 'perp-line', after: 'poi', message: 'You need both line equations before finding their POI.' },
      { before: 'poi', after: 'dist', message: 'You need the POI coordinates before measuring the distance from P to the POI.' },
    ],
  },
  {
    id: 'mp-5-right-triangle',
    title: 'Prove a triangle is a right triangle (2 valid methods!)',
    question:
      'Given vertices A, B, and C of △ABC, create a numbered plan to determine whether △ABC is a right triangle.',
    scene: {
      xMin: -5,
      xMax: 7,
      yMin: -5,
      yMax: 7,
      polygons: [{ vertices: [[5, 5], [-3, -1], [1, -3]], color: 'blue', fillOpacity: 0.08 }],
      points: [
        { id: 'a', x: 5, y: 5, label: 'A', color: 'blue' },
        { id: 'b', x: -3, y: -1, label: 'B', color: 'blue' },
        { id: 'c', x: 1, y: -3, label: 'C', color: 'blue' },
      ],
    },
    pool: [
      { id: 'slopes', text: 'Find the slopes of the three sides AB, BC, and AC.', category: 'slope' },
      { id: 'check-perp', text: 'Check if any pair of slopes are negative reciprocals (multiply to -1) → 90° angle.', category: 'compare' },
      { id: 'lengths', text: 'Use the length formula to find all three side lengths AB, BC, and AC.', category: 'length' },
      { id: 'check-pyth', text: 'Check whether (shorter₁)² + (shorter₂)² = (longest)² using the Pythagorean theorem.', category: 'compare' },
      { id: 'midpoints', text: 'Find the midpoints of all three sides.', category: 'midpoint' },
    ],
    validPlans: [
      {
        name: 'Method 1: Slopes',
        steps: ['slopes', 'check-perp'],
        explanation:
          'Two sides whose slopes multiply to -1 meet at 90°. This is usually the fastest method.',
      },
      {
        name: 'Method 2: Pythagorean Theorem',
        steps: ['lengths', 'check-pyth'],
        explanation:
          'If a² + b² = c² holds for the three side lengths, the angle opposite the longest side is 90°.',
      },
    ],
    missingFeedback: [
      {
        missingId: 'check-perp',
        message: 'Computing numbers is not enough: always end a proof plan with what you compare to make the conclusion!',
      },
      {
        missingId: 'check-pyth',
        message: 'Always state the final check (a² + b² = c² or negative reciprocals) that proves the right angle.',
      },
    ],
    orderFeedback: [
      { before: 'slopes', after: 'check-perp', message: 'Calculate the slopes before checking if any pair multiplies to -1.' },
      { before: 'lengths', after: 'check-pyth', message: 'Find the three side lengths before testing a² + b² = c².' },
    ],
  },
  {
    id: 'mp-6-rectangle',
    title: 'Prove a quadrilateral is a rectangle',
    question:
      'Given four vertices P, Q, R, and S in order around quadrilateral PQRS, create a numbered plan to prove that PQRS is a rectangle.',
    scene: {
      xMin: -4,
      xMax: 7,
      yMin: -3,
      yMax: 6,
      polygons: [{ vertices: [[-2, 1], [4, 4], [6, 0], [0, -3]], color: 'blue', fillOpacity: 0.08 }],
      points: [
        { id: 'p', x: -2, y: 1, label: 'P', color: 'blue' },
        { id: 'q', x: 4, y: 4, label: 'Q', color: 'blue' },
        { id: 'r', x: 6, y: 0, label: 'R', color: 'blue' },
        { id: 's', x: 0, y: -3, label: 'S', color: 'blue' },
      ],
    },
    pool: [
      { id: 'four-slopes', text: 'Find the slopes of all four sides PQ, QR, RS, and SP.', category: 'slope' },
      { id: 'opp-par', text: 'Verify both pairs of opposite sides have equal slopes (parallel → parallelogram).', category: 'compare' },
      { id: 'adj-perp', text: 'Verify adjacent sides have negative reciprocal slopes (90° corners → rectangle).', category: 'compare' },
      { id: 'diag-mid', text: 'Find the midpoints of diagonals PR and QS and verify they are the same (bisect each other).', category: 'midpoint' },
      { id: 'diag-len', text: 'Find the lengths of diagonals PR and QS and verify they are equal.', category: 'length' },
      { id: 'four-lens', text: 'Find all four side lengths and verify they are all equal.', category: 'length' },
    ],
    validPlans: [
      {
        name: 'Slopes only (parallel + 90°)',
        steps: ['four-slopes', 'opp-par', 'adj-perp'],
        explanation:
          'Finding the 4 side slopes proves BOTH opposite sides parallel (parallelogram) AND adjacent sides perpendicular (90° corners → rectangle) in one sweep!',
      },
      {
        name: 'Slopes (90° then parallel)',
        steps: ['four-slopes', 'adj-perp', 'opp-par'],
        explanation: 'Checking both parallel opposite sides and perpendicular adjacent sides proves a rectangle.',
      },
      {
        name: 'Diagonals method',
        steps: ['diag-mid', 'diag-len'],
        explanation:
          'A quadrilateral whose diagonals bisect each other (same midpoint) AND have equal length is guaranteed to be a rectangle!',
      },
      {
        name: 'Diagonals method (length first)',
        steps: ['diag-len', 'diag-mid'],
        explanation: 'Equal diagonals that share the same midpoint uniquely prove a rectangle.',
      },
    ],
    missingFeedback: [
      {
        missingId: 'adj-perp',
        message: 'Opposite sides parallel only proves a parallelogram. You also need 90° corners for a rectangle!',
      },
    ],
    orderFeedback: [
      { before: 'four-slopes', after: 'opp-par', message: 'Find the four side slopes before comparing them.' },
      { before: 'four-slopes', after: 'adj-perp', message: 'Find the four side slopes before checking negative reciprocals.' },
    ],
  },
  {
    id: 'mp-7-square',
    title: 'Prove a quadrilateral is a square',
    question:
      'Given vertices R, S, T, and U in order, create a numbered plan to prove that RSTU is a square.',
    scene: {
      xMin: -4,
      xMax: 5,
      yMin: -3,
      yMax: 6,
      polygons: [{ vertices: [[3, 2], [0, 4], [-2, 1], [1, -1]], color: 'blue', fillOpacity: 0.08 }],
      points: [
        { id: 'r', x: 3, y: 2, label: 'R', color: 'blue' },
        { id: 's', x: 0, y: 4, label: 'S', color: 'blue' },
        { id: 't', x: -2, y: 1, label: 'T', color: 'blue' },
        { id: 'u', x: 1, y: -1, label: 'U', color: 'blue' },
      ],
    },
    pool: [
      { id: 'four-lens', text: 'Find the lengths of all four sides RS, ST, TU, and UR and verify all 4 are equal (rhombus).', category: 'length' },
      { id: 'adj-slopes', text: 'Find the slopes of two adjacent sides (e.g. RS and ST) and verify they are negative reciprocals (90°).', category: 'slope' },
      { id: 'conclude', text: 'Conclude RSTU is a square (4 equal sides + 90° corner).', category: 'compare' },
      { id: 'only-opp', text: 'Check that opposite sides have equal slopes.', category: 'slope' },
      { id: 'area', text: 'Multiply length times width to get the area.', category: 'length' },
    ],
    validPlans: [
      {
        name: '4 equal sides + 90° corner',
        steps: ['four-lens', 'adj-slopes', 'conclude'],
        explanation:
          'Four equal sides narrows it down to a rhombus; one 90° corner locks all four corners to 90°, proving a square.',
      },
      {
        name: '90° corner + 4 equal sides',
        steps: ['adj-slopes', 'four-lens', 'conclude'],
        explanation: 'Order between checking the 90° corner and checking the 4 equal side lengths does not matter.',
      },
    ],
    missingFeedback: [
      { missingId: 'four-lens', message: 'To prove a square (not just a rectangle), you must show all four sides have equal length.' },
      { missingId: 'adj-slopes', message: 'Four equal sides alone only proves a rhombus. You also need a 90° corner via negative reciprocal slopes.' },
    ],
    orderFeedback: [
      { before: 'four-lens', after: 'conclude', message: 'State your conclusion after checking the lengths and slopes.' },
      { before: 'adj-slopes', after: 'conclude', message: 'Check the adjacent slopes before concluding it is a square.' },
    ],
  },
  {
    id: 'mp-8-circumcentre',
    title: 'Equidistant from three locations (circumcentre)',
    question:
      'Three towns sit at A, B, and C. Create a numbered plan to find the exact coordinates of a hospital that is the same distance from all three towns.',
    scene: {
      xMin: -1,
      xMax: 9,
      yMin: -2,
      yMax: 6,
      polygons: [{ vertices: [[4, 4], [0, 0], [8, 0]], color: 'blue', fillOpacity: 0.08 }],
      points: [
        { id: 'a', x: 4, y: 4, label: 'A', color: 'blue' },
        { id: 'b', x: 0, y: 0, label: 'B', color: 'blue' },
        { id: 'c', x: 8, y: 0, label: 'C', color: 'blue' },
      ],
    },
    pool: [
      { id: 'rb1', text: 'Find the equation of the right bisector of side AB (midpoint + perpendicular slope).', category: 'line' },
      { id: 'rb2', text: 'Find the equation of the right bisector of side BC (midpoint + perpendicular slope).', category: 'line' },
      { id: 'poi', text: 'Find the point of intersection (POI) of those two right bisectors.', category: 'poi' },
      { id: 'med1', text: 'Find the equation of two medians of △ABC.', category: 'line' },
      { id: 'alt1', text: 'Find the equation of two altitudes of △ABC.', category: 'line' },
    ],
    validPlans: [
      {
        name: 'Intersect two right bisectors',
        steps: ['rb1', 'rb2', 'poi'],
        explanation:
          'Every point on the right bisector of AB is equidistant from A and B. Every point on the right bisector of BC is equidistant from B and C. Where they meet is equidistant from all three!',
      },
      {
        name: 'Intersect two right bisectors (BC first)',
        steps: ['rb2', 'rb1', 'poi'],
        explanation: 'Any two right bisectors of the triangle will intersect at the exact same circumcentre.',
      },
    ],
    missingFeedback: [
      {
        missingId: 'rb1',
        message: 'Right bisectors (not medians or altitudes!) are the lines of points equidistant from two vertices.',
      },
      {
        missingId: 'poi',
        message: 'Once you have two right bisectors, find their POI to get the single point that lies on both.',
      },
    ],
    orderFeedback: [
      { before: 'rb1', after: 'poi', message: 'Find both right bisector equations before solving for their POI.' },
      { before: 'rb2', after: 'poi', message: 'Find both right bisector equations before solving for their POI.' },
    ],
  },
  {
    id: 'mp-9-area',
    title: 'Area of a triangle from its vertices',
    question:
      'Given vertices J, K, and L of △JKL, create a numbered plan to calculate the exact area of △JKL.',
    scene: {
      xMin: -4,
      xMax: 10,
      yMin: -5,
      yMax: 10,
      polygons: [{ vertices: [[-2, 0], [4, -3], [8, 8]], color: 'blue', fillOpacity: 0.08 }],
      points: [
        { id: 'j', x: -2, y: 0, label: 'J', color: 'blue' },
        { id: 'k', x: 4, y: -3, label: 'K', color: 'blue' },
        { id: 'l', x: 8, y: 8, label: 'L', color: 'amber', emphasis: true },
      ],
    },
    pool: [
      { id: 'base-eq', text: 'Find the equation of base line JK.', category: 'line' },
      { id: 'alt-eq', text: 'Find the equation of the altitude from L perpendicular to JK.', category: 'line' },
      { id: 'poi', text: 'Find the POI where the altitude meets base line JK.', category: 'poi' },
      { id: 'lengths', text: 'Find the base length (JK) and height (distance from L to the POI).', category: 'length' },
      { id: 'area', text: 'Compute Area = (1/2) · base · height.', category: 'compare' },
      { id: 'med', text: 'Find the midpoint of JK and measure the median length.', category: 'midpoint' },
    ],
    validPlans: [
      {
        name: 'Base × Altitude height',
        steps: ['base-eq', 'alt-eq', 'poi', 'lengths', 'area'],
        explanation:
          'Area needs a perpendicular height, not a slanted median! Base line + altitude + POI gives you the exact height.',
      },
      {
        name: 'Altitude first × Base height',
        steps: ['alt-eq', 'base-eq', 'poi', 'lengths', 'area'],
        explanation:
          'Finding the altitude equation before the base line equation is equally valid; you just need both lines before solving their POI.',
      },
    ],
    missingFeedback: [
      { missingId: 'alt-eq', message: 'Height must meet the base at 90°, so you need the altitude from L.' },
      { missingId: 'poi', message: 'To measure the height, you first need the POI where the altitude hits JK.' },
      { missingId: 'area', message: 'Finish with Area = (1/2) · base · height.' },
    ],
    orderFeedback: [
      { before: 'base-eq', after: 'poi', message: 'You need both the base line and altitude equations before finding their POI.' },
      { before: 'alt-eq', after: 'poi', message: 'Find the altitude equation before solving for the POI.' },
      { before: 'poi', after: 'lengths', message: 'Find the POI before measuring the height from L to the POI.' },
      { before: 'lengths', after: 'area', message: 'Find the base and height lengths before computing (1/2) · base · height.' },
    ],
  },
  {
    id: 'mp-10-chord',
    title: 'Chord right bisector passes through circle centre',
    question:
      'Points C and D lie on the circle x² + y² = r². Create a numbered plan to verify that the right bisector of chord CD passes through the centre (0, 0).',
    scene: {
      xMin: -4,
      xMax: 4,
      yMin: -4,
      yMax: 4,
      circles: [{ cx: 0, cy: 0, r: Math.sqrt(10), color: 'blue' }],
      segments: [{ from: [3, 1], to: [1, -3], color: 'teal', width: 2.5 }],
      points: [
        { id: 'o', x: 0, y: 0, label: 'O', color: 'ink' },
        { id: 'c', x: 3, y: 1, label: 'C', color: 'teal' },
        { id: 'd', x: 1, y: -3, label: 'D', color: 'teal' },
      ],
    },
    pool: [
      { id: 'mid-cd', text: 'Find the midpoint M of chord CD.', category: 'midpoint' },
      { id: 'perp-cd', text: 'Find the slope of chord CD and take its negative reciprocal.', category: 'slope' },
      { id: 'rb-eq', text: 'Sub the perpendicular slope and midpoint M into y = mx + b to get the right bisector equation.', category: 'line' },
      { id: 'test-o', text: 'Substitute (0, 0) into the right bisector equation (or check that b = 0) to verify LS = RS.', category: 'compare' },
      { id: 'len-cd', text: 'Find the length of chord CD.', category: 'length' },
    ],
    validPlans: [
      {
        name: 'Right bisector + check (0, 0)',
        steps: ['mid-cd', 'perp-cd', 'rb-eq', 'test-o'],
        explanation:
          'Build the right bisector of CD, then verify that (0, 0) satisfies its equation (meaning its y-intercept b is 0).',
      },
      {
        name: 'Perp slope first + check (0, 0)',
        steps: ['perp-cd', 'mid-cd', 'rb-eq', 'test-o'],
        explanation: 'Finding the perpendicular slope before the midpoint is equally valid.',
      },
    ],
    missingFeedback: [
      { missingId: 'test-o', message: 'Don’t stop after writing the right bisector: explicitly test whether (0, 0) lies on it!' },
    ],
    orderFeedback: [
      { before: 'rb-eq', after: 'test-o', message: 'Write the right bisector equation before testing (0, 0) in it.' },
    ],
  },
]

export const READ_PLAN_SCENARIOS: ReadPlanScenario[] = [
  {
    id: 'rp-1-median',
    title: 'Plan 1: Triangle line A',
    given: 'Triangle ABC with vertices A(-3, 3), B(2, -5), and C(5, 2).',
    planSteps: [
      {
        text: 'Find the midpoint M of side AB.',
        scene: {
          xMin: -5,
          xMax: 7,
          yMin: -6,
          yMax: 5,
          polygons: [{ vertices: [[-3, 3], [2, -5], [5, 2]], color: 'blue', fillOpacity: 0.08 }],
          points: [
            { id: 'a', x: -3, y: 3, label: 'A', color: 'blue' },
            { id: 'b', x: 2, y: -5, label: 'B', color: 'blue' },
            { id: 'c', x: 5, y: 2, label: 'C', color: 'blue' },
            { id: 'm', x: -0.5, y: -1, label: 'M', color: 'teal', emphasis: true },
          ],
        },
      },
      {
        text: 'Calculate the slope between vertex C and point M.',
        scene: {
          xMin: -5,
          xMax: 7,
          yMin: -6,
          yMax: 5,
          polygons: [{ vertices: [[-3, 3], [2, -5], [5, 2]], color: 'blue', fillOpacity: 0.08 }],
          segments: [{ from: [5, 2], to: [-0.5, -1], color: 'teal', width: 2.5 }],
          points: [
            { id: 'a', x: -3, y: 3, label: 'A', color: 'blue' },
            { id: 'b', x: 2, y: -5, label: 'B', color: 'blue' },
            { id: 'c', x: 5, y: 2, label: 'C', color: 'amber', emphasis: true },
            { id: 'm', x: -0.5, y: -1, label: 'M', color: 'teal' },
          ],
        },
      },
      {
        text: 'Substitute that slope and vertex C into y = mx + b to solve for b and write the line equation.',
        scene: {
          xMin: -5,
          xMax: 7,
          yMin: -6,
          yMax: 5,
          polygons: [{ vertices: [[-3, 3], [2, -5], [5, 2]], color: 'blue', fillOpacity: 0.08 }],
          lines: [{ a: 6, b: -11, c: -8, color: 'teal' }],
          points: [
            { id: 'a', x: -3, y: 3, label: 'A', color: 'blue' },
            { id: 'b', x: 2, y: -5, label: 'B', color: 'blue' },
            { id: 'c', x: 5, y: 2, label: 'C', color: 'amber' },
            { id: 'm', x: -0.5, y: -1, label: 'M', color: 'teal' },
          ],
        },
      },
    ],
    options: [
      { id: 'median', label: 'Find the equation of the median from vertex C.' },
      {
        id: 'alt',
        label: 'Find the equation of the altitude from vertex C.',
        whyWrong: 'There is no perpendicular (negative reciprocal) slope anywhere in this plan; it goes straight to the midpoint M.',
      },
      {
        id: 'rb',
        label: 'Find the equation of the right bisector of side AB.',
        whyWrong: 'A right bisector uses a perpendicular slope to AB and does not need vertex C.',
      },
      {
        id: 'len',
        label: 'Find the length of the median from vertex C.',
        whyWrong: 'Step 3 writes a line equation y = mx + b; it never uses the length formula.',
      },
    ],
    correctOptionId: 'median',
    explanation: 'Connecting opposite midpoint M to vertex C and writing y = mx + b gives the equation of the median from C.',
  },
  {
    id: 'rp-2-altitude',
    title: 'Plan 2: Triangle line B',
    given: 'Triangle ABC with vertices A(3, 4), B(-5, 2), and C(1, -4).',
    planSteps: [
      {
        text: 'Calculate the slope of side BC.',
        scene: {
          xMin: -7,
          xMax: 5,
          yMin: -6,
          yMax: 6,
          polygons: [{ vertices: [[3, 4], [-5, 2], [1, -4]], color: 'blue', fillOpacity: 0.08 }],
          segments: [{ from: [-5, 2], to: [1, -4], color: 'blue', width: 3 }],
          points: [
            { id: 'a', x: 3, y: 4, label: 'A', color: 'amber' },
            { id: 'b', x: -5, y: 2, label: 'B', color: 'blue' },
            { id: 'c', x: 1, y: -4, label: 'C', color: 'blue' },
          ],
        },
      },
      {
        text: 'Take the negative reciprocal of m_BC.',
        scene: {
          xMin: -7,
          xMax: 5,
          yMin: -6,
          yMax: 6,
          polygons: [{ vertices: [[3, 4], [-5, 2], [1, -4]], color: 'blue', fillOpacity: 0.08 }],
          segments: [{ from: [-5, 2], to: [1, -4], color: 'blue', width: 3 }],
          points: [
            { id: 'a', x: 3, y: 4, label: 'A', color: 'amber', emphasis: true },
            { id: 'b', x: -5, y: 2, label: 'B', color: 'blue' },
            { id: 'c', x: 1, y: -4, label: 'C', color: 'blue' },
          ],
        },
      },
      {
        text: 'Substitute that perpendicular slope and point A into y = mx + b to solve for b.',
        scene: {
          xMin: -7,
          xMax: 5,
          yMin: -6,
          yMax: 6,
          polygons: [{ vertices: [[3, 4], [-5, 2], [1, -4]], color: 'blue', fillOpacity: 0.08 }],
          lines: [{ a: 1, b: -1, c: 1, color: 'amber' }],
          rightAngles: [{ vertex: [-2, -1], dir1: [1, -1], dir2: [1, 1], color: 'green' }],
          points: [
            { id: 'a', x: 3, y: 4, label: 'A', color: 'amber', emphasis: true },
            { id: 'b', x: -5, y: 2, label: 'B', color: 'blue' },
            { id: 'c', x: 1, y: -4, label: 'C', color: 'blue' },
          ],
        },
      },
    ],
    options: [
      { id: 'rb', label: 'Find the right bisector of BC.', whyWrong: 'Notice it never finds the midpoint of BC; it plugs in vertex A instead.' },
      { id: 'alt', label: 'Find the equation of the altitude from vertex A.' },
      { id: 'dist', label: 'Find the shortest distance from A to BC.', whyWrong: 'It stops after writing the perpendicular line, with no POI and no length step.' },
      { id: 'med', label: 'Find the equation of the median from A.', whyWrong: 'It uses a perpendicular slope to BC rather than the midpoint of BC.' },
    ],
    correctOptionId: 'alt',
    explanation: 'Passing through vertex A perpendicular to opposite side BC is the exact definition of the altitude from A.',
  },
  {
    id: 'rp-3-shortest-dist',
    title: 'Plan 3: Point and line',
    given: 'A point P(-1, 3) and a line x + y - 5 = 0.',
    planSteps: [
      {
        text: 'Isolate y in x + y - 5 = 0 to read its slope, then take the negative reciprocal.',
        scene: {
          xMin: -3,
          xMax: 6,
          yMin: 0,
          yMax: 7,
          lines: [{ a: 1, b: 1, c: -5, color: 'blue' }],
          points: [{ id: 'p', x: -1, y: 3, label: 'P', color: 'amber', emphasis: true }],
        },
      },
      {
        text: 'Sub the negative reciprocal slope and P(-1, 3) into y = mx + b to write a second line.',
        scene: {
          xMin: -3,
          xMax: 6,
          yMin: 0,
          yMax: 7,
          lines: [
            { a: 1, b: 1, c: -5, color: 'blue' },
            { a: 1, b: -1, c: 4, color: 'teal', dashed: true },
          ],
          points: [{ id: 'p', x: -1, y: 3, label: 'P', color: 'amber' }],
        },
      },
      {
        text: 'Solve the system of the two lines to find their POI.',
        scene: {
          xMin: -3,
          xMax: 6,
          yMin: 0,
          yMax: 7,
          lines: [
            { a: 1, b: 1, c: -5, color: 'blue' },
            { a: 1, b: -1, c: 4, color: 'teal', dashed: true },
          ],
          rightAngles: [{ vertex: [0.5, 4.5], dir1: [1, -1], dir2: [-1, -1], color: 'green' }],
          points: [
            { id: 'p', x: -1, y: 3, label: 'P', color: 'amber' },
            { id: 'poi', x: 0.5, y: 4.5, label: 'POI', color: 'green', emphasis: true },
          ],
        },
      },
      {
        text: 'Use the length formula between P(-1, 3) and the POI.',
        scene: {
          xMin: -3,
          xMax: 6,
          yMin: 0,
          yMax: 7,
          lines: [{ a: 1, b: 1, c: -5, color: 'blue' }],
          segments: [{ from: [-1, 3], to: [0.5, 4.5], color: 'teal', width: 3 }],
          rightAngles: [{ vertex: [0.5, 4.5], dir1: [1, -1], dir2: [-1, -1], color: 'green' }],
          points: [
            { id: 'p', x: -1, y: 3, label: 'P', color: 'amber' },
            { id: 'poi', x: 0.5, y: 4.5, label: 'POI', color: 'green' },
          ],
        },
      },
    ],
    options: [
      { id: 'dist', label: 'Find the shortest distance from point P to the line.' },
      { id: 'rb', label: 'Find the right bisector of the line.', whyWrong: 'An infinite line does not have a midpoint or a right bisector.' },
      { id: 'par', label: 'Verify whether P lies on the line.', whyWrong: 'To check if P lies on a line you just plug P into x + y - 5 = 0.' },
      { id: 'circ', label: 'Find the radius of a circle centred at the origin.', whyWrong: 'The length is measured from P(-1, 3) to the POI, not from (0, 0).' },
    ],
    correctOptionId: 'dist',
    explanation: 'Perpendicular line through P → POI → length from P to POI is the exact shortest-distance plan.',
  },
  {
    id: 'rp-4-midsegment',
    title: 'Plan 4: Two midpoints inside a triangle',
    given: 'Triangle KLM with vertices K(2, 6), L(4, 10), and M(8, -2).',
    planSteps: [
      {
        text: 'Find midpoint P of KL and midpoint Q of LM.',
        scene: {
          xMin: 0,
          xMax: 10,
          yMin: -4,
          yMax: 12,
          polygons: [{ vertices: [[2, 6], [4, 10], [8, -2]], color: 'blue', fillOpacity: 0.08 }],
          points: [
            { id: 'k', x: 2, y: 6, label: 'K', color: 'blue' },
            { id: 'l', x: 4, y: 10, label: 'L', color: 'blue' },
            { id: 'm', x: 8, y: -2, label: 'M', color: 'blue' },
            { id: 'p', x: 3, y: 8, label: 'P', color: 'teal', emphasis: true },
            { id: 'q', x: 6, y: 4, label: 'Q', color: 'teal', emphasis: true },
          ],
        },
      },
      {
        text: 'Calculate m_PQ and m_KM and check that they are equal.',
        scene: {
          xMin: 0,
          xMax: 10,
          yMin: -4,
          yMax: 12,
          polygons: [{ vertices: [[2, 6], [4, 10], [8, -2]], color: 'blue', fillOpacity: 0.08 }],
          segments: [
            { from: [3, 8], to: [6, 4], color: 'teal', width: 2.5 },
            { from: [2, 6], to: [8, -2], color: 'amber', width: 2.5 },
          ],
          points: [
            { id: 'p', x: 3, y: 8, label: 'P', color: 'teal' },
            { id: 'q', x: 6, y: 4, label: 'Q', color: 'teal' },
          ],
        },
      },
      {
        text: 'Calculate lengths PQ and KM and check that PQ = (1/2) · KM.',
        scene: {
          xMin: 0,
          xMax: 10,
          yMin: -4,
          yMax: 12,
          polygons: [{ vertices: [[2, 6], [4, 10], [8, -2]], color: 'blue', fillOpacity: 0.08 }],
          segments: [
            { from: [3, 8], to: [6, 4], color: 'teal', width: 3, label: '5' },
            { from: [2, 6], to: [8, -2], color: 'amber', width: 2.5, label: '10' },
          ],
          points: [
            { id: 'p', x: 3, y: 8, label: 'P', color: 'teal' },
            { id: 'q', x: 6, y: 4, label: 'Q', color: 'teal' },
          ],
        },
      },
    ],
    options: [
      { id: 'midseg', label: 'Verify that the segment joining two midpoints is parallel to the third side and half its length.' },
      { id: 'centroid', label: 'Find the centroid of △KLM.', whyWrong: 'A centroid intersects medians (from vertices to midpoints), not the segment connecting two midpoints.' },
      { id: 'iso', label: 'Prove △KLM is isosceles.', whyWrong: 'It compares PQ to KM, not the sides of △KLM to each other.' },
      { id: 'right', label: 'Prove △KLM is a right triangle.', whyWrong: 'It checks EQUAL slopes (parallel), not negative reciprocal slopes (90°).' },
    ],
    correctOptionId: 'midseg',
    explanation: 'Equal slopes verify PQ ∥ KM, and PQ = (1/2)KM verifies the midsegment is half as long as the third side.',
  },
  {
    id: 'rp-5-circumcentre',
    title: 'Plan 5: Intersecting two right bisectors',
    given: 'Three points A(4, 4), O(0, 0), and B(8, 0).',
    planSteps: [
      {
        text: 'Find the midpoint and perpendicular slope of OB, and write the equation of its right bisector.',
        scene: {
          xMin: -1,
          xMax: 9,
          yMin: -2,
          yMax: 6,
          polygons: [{ vertices: [[4, 4], [0, 0], [8, 0]], color: 'blue', fillOpacity: 0.08 }],
          lines: [{ a: 1, b: 0, c: -4, color: 'violet', dashed: true }],
          points: [
            { id: 'a', x: 4, y: 4, label: 'A', color: 'blue' },
            { id: 'o', x: 0, y: 0, label: 'O', color: 'blue' },
            { id: 'b', x: 8, y: 0, label: 'B', color: 'blue' },
          ],
        },
      },
      {
        text: 'Find the midpoint and perpendicular slope of AO, and write the equation of its right bisector.',
        scene: {
          xMin: -1,
          xMax: 9,
          yMin: -2,
          yMax: 6,
          polygons: [{ vertices: [[4, 4], [0, 0], [8, 0]], color: 'blue', fillOpacity: 0.08 }],
          lines: [
            { a: 1, b: 0, c: -4, color: 'violet', dashed: true },
            { a: 1, b: 1, c: -4, color: 'teal', dashed: true },
          ],
          points: [
            { id: 'a', x: 4, y: 4, label: 'A', color: 'blue' },
            { id: 'o', x: 0, y: 0, label: 'O', color: 'blue' },
            { id: 'b', x: 8, y: 0, label: 'B', color: 'blue' },
          ],
        },
      },
      {
        text: 'Find the POI of the two right bisectors.',
        scene: {
          xMin: -1,
          xMax: 9,
          yMin: -2,
          yMax: 6,
          polygons: [{ vertices: [[4, 4], [0, 0], [8, 0]], color: 'blue', fillOpacity: 0.08 }],
          lines: [
            { a: 1, b: 0, c: -4, color: 'violet', dashed: true },
            { a: 1, b: 1, c: -4, color: 'teal', dashed: true },
          ],
          circles: [{ cx: 4, cy: 0, r: 4, color: 'green', dashed: true }],
          points: [{ id: 'c', x: 4, y: 0, label: 'C', color: 'green', emphasis: true }],
        },
      },
    ],
    options: [
      { id: 'circ', label: 'Find the point equidistant from all three vertices (the circumcentre / circle centre through A, O, B).' },
      { id: 'cent', label: 'Find the centroid (balance point) of △AOB.', whyWrong: 'The centroid is where MEDIANS meet, not right bisectors.' },
      { id: 'ortho', label: 'Find the orthocentre of △AOB.', whyWrong: 'The orthocentre is where ALTITUDES meet, not right bisectors.' },
      { id: 'area', label: 'Find the area of △AOB.', whyWrong: 'It never measures base or height.' },
    ],
    correctOptionId: 'circ',
    explanation: 'The intersection of two right bisectors is the circumcentre, equally far from all three corners A, O, and B.',
  },
  {
    id: 'rp-6-centroid',
    title: 'Plan 6: Intersecting two medians',
    given: 'Triangle XYZ with vertices X(0, 0), Y(4, 4), and Z(8, -4).',
    planSteps: [
      {
        text: 'Find midpoint M₁ of YZ and write the line equation through X and M₁.',
        scene: {
          xMin: -1,
          xMax: 9,
          yMin: -5,
          yMax: 5,
          polygons: [{ vertices: [[0, 0], [4, 4], [8, -4]], color: 'blue', fillOpacity: 0.08 }],
          lines: [{ a: 0, b: 1, c: 0, color: 'teal', dashed: true }],
          points: [
            { id: 'x', x: 0, y: 0, label: 'X', color: 'blue' },
            { id: 'y', x: 4, y: 4, label: 'Y', color: 'blue' },
            { id: 'z', x: 8, y: -4, label: 'Z', color: 'blue' },
          ],
        },
      },
      {
        text: 'Find midpoint M₂ of XZ and write the line equation through Y and M₂.',
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
          points: [
            { id: 'x', x: 0, y: 0, label: 'X', color: 'blue' },
            { id: 'y', x: 4, y: 4, label: 'Y', color: 'blue' },
            { id: 'z', x: 8, y: -4, label: 'Z', color: 'blue' },
          ],
        },
      },
      {
        text: 'Find the POI of those two lines.',
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
    options: [
      { id: 'cent', label: 'Find the centroid (centre of mass / meeting point of medians) of △XYZ.' },
      { id: 'circ', label: 'Find the point equidistant from X, Y, and Z.', whyWrong: 'These are medians (vertex to midpoint, no 90°), not right bisectors.' },
      { id: 'right', label: 'Check whether △XYZ has a 90° corner.', whyWrong: 'It never checks slopes of sides or Pythagoras.' },
      { id: 'area', label: 'Find the perimeter of △XYZ.', whyWrong: 'It never uses the length formula.' },
    ],
    correctOptionId: 'cent',
    explanation: 'Intersecting two medians gives the centroid, the balance point where all three medians meet.',
  },
  {
    id: 'rp-7-chord',
    title: 'Plan 7: Chord on a circle',
    given: 'Circle x² + y² = 10 and two points C(3, 1), D(1, -3) on the circle.',
    planSteps: [
      {
        text: 'Find the midpoint M of CD and the negative reciprocal of m_CD.',
        scene: {
          xMin: -4,
          xMax: 4,
          yMin: -4,
          yMax: 4,
          circles: [{ cx: 0, cy: 0, r: Math.sqrt(10), color: 'blue' }],
          segments: [{ from: [3, 1], to: [1, -3], color: 'teal', width: 2.5 }],
          points: [
            { id: 'c', x: 3, y: 1, label: 'C', color: 'teal' },
            { id: 'd', x: 1, y: -3, label: 'D', color: 'teal' },
            { id: 'm', x: 2, y: -1, label: 'M', color: 'amber', emphasis: true },
          ],
        },
      },
      {
        text: 'Write the line equation through M with that perpendicular slope.',
        scene: {
          xMin: -4,
          xMax: 4,
          yMin: -4,
          yMax: 4,
          circles: [{ cx: 0, cy: 0, r: Math.sqrt(10), color: 'blue' }],
          segments: [{ from: [3, 1], to: [1, -3], color: 'teal', width: 2.5 }],
          lines: [{ a: 1, b: 2, c: 0, color: 'violet' }],
          points: [{ id: 'm', x: 2, y: -1, label: 'M', color: 'amber' }],
        },
      },
      {
        text: 'Plug (0, 0) into that line equation and verify that Left Side = Right Side.',
        scene: {
          xMin: -4,
          xMax: 4,
          yMin: -4,
          yMax: 4,
          circles: [{ cx: 0, cy: 0, r: Math.sqrt(10), color: 'blue' }],
          segments: [{ from: [3, 1], to: [1, -3], color: 'teal', width: 2.5 }],
          lines: [{ a: 1, b: 2, c: 0, color: 'violet' }],
          rightAngles: [{ vertex: [2, -1], dir1: [1, 2], dir2: [-2, 1], color: 'green' }],
          points: [{ id: 'o', x: 0, y: 0, label: 'O', color: 'green', emphasis: true }],
        },
      },
    ],
    options: [
      { id: 'chord', label: 'Verify that the right bisector of chord CD passes through the circle’s centre (0, 0).' },
      { id: 'on', label: 'Verify that C and D lie on the circle.', whyWrong: 'To test if C and D lie on the circle you would plug C and D into x² + y² = 10.' },
      { id: 'diam', label: 'Show that CD is a diameter of the circle.', whyWrong: 'If CD were a diameter, (0, 0) would be the midpoint of CD itself, but here M is (2, −1).' },
      { id: 'tan', label: 'Find the length of chord CD.', whyWrong: 'No length formula is used anywhere in this plan.' },
    ],
    correctOptionId: 'chord',
    explanation: 'Steps 1–2 construct the right bisector of chord CD; Step 3 checks that the circle’s centre (0, 0) lies on it.',
  },
  {
    id: 'rp-8-area',
    title: 'Plan 8: Five-step triangle calculation',
    given: 'Triangle JKL with vertices J(-2, 0), K(4, -3), and L(8, 8).',
    planSteps: [
      {
        text: 'Write the equation of line JK.',
        scene: {
          xMin: -4,
          xMax: 10,
          yMin: -5,
          yMax: 10,
          polygons: [{ vertices: [[-2, 0], [4, -3], [8, 8]], color: 'blue', fillOpacity: 0.08 }],
          lines: [{ a: 1, b: 2, c: 2, color: 'blue', dashed: true }],
          points: [
            { id: 'j', x: -2, y: 0, label: 'J', color: 'blue' },
            { id: 'k', x: 4, y: -3, label: 'K', color: 'blue' },
            { id: 'l', x: 8, y: 8, label: 'L', color: 'amber' },
          ],
        },
      },
      {
        text: 'Write the equation of the line through L perpendicular to JK, and find its POI with line JK.',
        scene: {
          xMin: -4,
          xMax: 10,
          yMin: -5,
          yMax: 10,
          polygons: [{ vertices: [[-2, 0], [4, -3], [8, 8]], color: 'blue', fillOpacity: 0.08 }],
          lines: [
            { a: 1, b: 2, c: 2, color: 'blue', dashed: true },
            { a: 2, b: -1, c: -8, color: 'amber', dashed: true },
          ],
          rightAngles: [{ vertex: [2.8, -2.4], dir1: [2, -1], dir2: [1, 2], color: 'green' }],
          points: [{ id: 'h', x: 2.8, y: -2.4, label: 'H', color: 'green', emphasis: true }],
        },
      },
      {
        text: 'Find the length of JK and the length from L to the POI, then multiply them and divide by 2.',
        scene: {
          xMin: -4,
          xMax: 10,
          yMin: -5,
          yMax: 10,
          polygons: [{ vertices: [[-2, 0], [4, -3], [8, 8]], color: 'blue', fillOpacity: 0.14 }],
          segments: [
            { from: [-2, 0], to: [4, -3], color: 'blue', width: 3, label: 'base' },
            { from: [8, 8], to: [2.8, -2.4], color: 'amber', width: 3, label: 'height' },
          ],
          rightAngles: [{ vertex: [2.8, -2.4], dir1: [2, -1], dir2: [1, 2], color: 'green' }],
        },
      },
    ],
    options: [
      { id: 'area', label: 'Calculate the area of △JKL.' },
      { id: 'dist', label: 'Find only the shortest distance from L to JK.', whyWrong: 'It goes further: it also finds base length JK and computes (1/2) · base · height.' },
      { id: 'perim', label: 'Calculate the perimeter of △JKL.', whyWrong: 'Perimeter adds the 3 side lengths JL + KL + JK without needing an altitude.' },
      { id: 'right', label: 'Prove △JKL is a right triangle.', whyWrong: 'An altitude creates a 90° angle inside ANY triangle; it does not mean a corner of △JKL is 90°.' },
    ],
    correctOptionId: 'area',
    explanation: 'Base length JK times perpendicular altitude height divided by 2 is the area of △JKL.',
  },
  {
    id: 'rp-9-hyp-mid',
    title: 'Plan 9: Right triangle midpoint check',
    given: 'Right triangle KLM with ∠K = 90° and hypotenuse LM.',
    planSteps: [
      {
        text: 'Find the midpoint N of hypotenuse LM.',
        scene: {
          xMin: -4,
          xMax: 5,
          yMin: -5,
          yMax: 7,
          polygons: [{ vertices: [[-2, 2], [1, 5], [3, -3]], color: 'blue', fillOpacity: 0.08 }],
          rightAngles: [{ vertex: [-2, 2], dir1: [3, 3], dir2: [5, -5], color: 'green' }],
          points: [
            { id: 'k', x: -2, y: 2, label: 'K', color: 'blue' },
            { id: 'l', x: 1, y: 5, label: 'L', color: 'blue' },
            { id: 'm', x: 3, y: -3, label: 'M', color: 'blue' },
            { id: 'n', x: 2, y: 1, label: 'N', color: 'amber', emphasis: true },
          ],
        },
      },
      {
        text: 'Use the length formula to compute KN, LN, and MN, and check that all three lengths are equal.',
        scene: {
          xMin: -4,
          xMax: 5,
          yMin: -5,
          yMax: 7,
          polygons: [{ vertices: [[-2, 2], [1, 5], [3, -3]], color: 'blue', fillOpacity: 0.08 }],
          segments: [
            { from: [-2, 2], to: [2, 1], color: 'teal', ticks: 1 },
            { from: [1, 5], to: [2, 1], color: 'teal', ticks: 1 },
            { from: [3, -3], to: [2, 1], color: 'teal', ticks: 1 },
          ],
          circles: [{ cx: 2, cy: 1, r: Math.sqrt(17), color: 'teal', dashed: true }],
          points: [{ id: 'n', x: 2, y: 1, label: 'N', color: 'amber' }],
        },
      },
    ],
    options: [
      { id: 'equidist', label: 'Verify that the midpoint of the hypotenuse is equidistant from all three vertices of the right triangle.' },
      { id: 'eq', label: 'Prove △KLM is equilateral.', whyWrong: 'KN, LN, and MN are distances from midpoint N to the corners, not the three sides of △KLM.' },
      { id: 'alt', label: 'Find the equation of the altitude to hypotenuse LM.', whyWrong: 'No line equation or perpendicular slope is computed.' },
      { id: 'area', label: 'Find the area of △KLM.', whyWrong: 'It compares three lengths KN = LN = MN rather than computing (1/2) · b · h.' },
    ],
    correctOptionId: 'equidist',
    explanation: 'Showing KN = LN = MN proves that the midpoint of the hypotenuse is the exact same distance from all three corners (it is the circumcentre of every right triangle!).',
  },
  {
    id: 'rp-10-rhombus-trap',
    title: 'Plan 10: Watch what this actually proves!',
    given: 'Four vertices A, B, C, and D in order around quadrilateral ABCD.',
    planSteps: [
      {
        text: 'Use the length formula to calculate AB, BC, CD, and DA.',
        scene: {
          xMin: -4,
          xMax: 6,
          yMin: -4,
          yMax: 4,
          polygons: [{ vertices: [[1, 3], [5, 0], [1, -3], [-3, 0]], color: 'blue', fillOpacity: 0.08 }],
          segments: [
            { from: [1, 3], to: [5, 0], color: 'teal', ticks: 1, label: '5' },
            { from: [5, 0], to: [1, -3], color: 'teal', ticks: 1, label: '5' },
            { from: [1, -3], to: [-3, 0], color: 'teal', ticks: 1, label: '5' },
            { from: [-3, 0], to: [1, 3], color: 'teal', ticks: 1, label: '5' },
          ],
          points: [
            { id: 'a', x: 1, y: 3, label: 'A', color: 'blue' },
            { id: 'b', x: 5, y: 0, label: 'B', color: 'blue' },
            { id: 'c', x: 1, y: -3, label: 'C', color: 'blue' },
            { id: 'd', x: -3, y: 0, label: 'D', color: 'blue' },
          ],
        },
      },
      {
        text: 'Verify that AB = BC = CD = DA.',
        scene: {
          xMin: -4,
          xMax: 6,
          yMin: -4,
          yMax: 4,
          polygons: [{ vertices: [[1, 3], [5, 0], [1, -3], [-3, 0]], color: 'teal', fillOpacity: 0.14 }],
          segments: [
            { from: [1, 3], to: [5, 0], color: 'teal', ticks: 1, label: '5' },
            { from: [5, 0], to: [1, -3], color: 'teal', ticks: 1, label: '5' },
            { from: [1, -3], to: [-3, 0], color: 'teal', ticks: 1, label: '5' },
            { from: [-3, 0], to: [1, 3], color: 'teal', ticks: 1, label: '5' },
          ],
        },
      },
    ],
    options: [
      { id: 'rhombus', label: 'Prove that ABCD is a rhombus (all 4 sides equal).' },
      {
        id: 'square',
        label: 'Prove that ABCD is a square.',
        whyWrong: 'Careful! Equal side lengths alone do NOT guarantee 90° corners. This diamond has all sides = 5, but its angles are NOT 90°. You would also need adjacent slopes.',
      },
      {
        id: 'rect',
        label: 'Prove that ABCD is a rectangle.',
        whyWrong: 'Rectangles require 90° corners, and this plan never checks any slopes or angles.',
      },
      {
        id: 'trap',
        label: 'Prove that ABCD is a trapezoid.',
        whyWrong: 'Trapezoids are proved using slopes (one pair of parallel sides), not 4 equal lengths.',
      },
    ],
    correctOptionId: 'rhombus',
    explanation:
      'Four equal sides proves a rhombus, not a square! To prove a square, you would also need to check that two adjacent sides meet at 90°.',
  },
]

export const LESSON_9_CONFERENCE: LessonDef = {
  id: 'lesson-9-conference',
  number: 9,
  title: 'Tuesday Conference: Making & Reading Plans',
  shortTitle: 'Conference Prep',
  subtitle: 'Write numbered plans for any Unit 2 question and interpret plans visually with no arithmetic required',
  dateTag: 'Due Tue, Nov 24 · Marked Assessment',
  sourceLabel: 'U2 Conference Prep · All Unit 2 Topics',
  plainIntro:
    'Tuesday’s conference tests the most valuable part of analytic geometry: knowing WHAT to do and WHY before touching a calculator. Practice both halves of the assessment below: building valid plans (including alternative valid methods) and reading a plan to recognize what it solves.',
  explorationId: 'conference-overview',
  workedExamples: [],
  guidedProblems: [],
  independentProblems: [],
}
