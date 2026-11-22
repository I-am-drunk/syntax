import type { GeoLessonPage } from '../pageTypes'
import type { GeoScene } from '../types'
import { resolveRescueLessonId } from '../data/catchupCourses'
import type { SemaKeyframe, StageSpec } from './animationEngine'

export type WalkthroughCue = SemaKeyframe

export type WalkthroughBeat = {
  id: string
  stepIndex: number
  title: string
  caption: string
  /** Optional static neural MP3 voiceover; when omitted, WalkthroughPlayer uses neural Web Speech narration */
  audioPath?: string
  durationSec: number
  cues: WalkthroughCue[]
  /** Declarative Animation Plugin spec ('graph-timeline' | 'algebra-timeline' | custom) */
  stage?: StageSpec
  /** Fallback data for dynamically generated page walkthroughs */
  scene?: GeoScene
  mathLines?: string[]
}

export type WalkthroughStepItem = {
  id: string
  stepNum: number
  label: string
  equation: string
}

export type WalkthroughLens = {
  id: 'visual' | 'algebra'
  label: string
  beats: WalkthroughBeat[]
}

export type WalkthroughSpec = {
  pageId: string
  title: string
  steps: WalkthroughStepItem[]
  lenses: WalkthroughLens[]
  rescueLessonId: string
  rescueMessage: string
}

/* ============================================================================
   Lesson 1 Worked Example: Perpendicular line through P(6, 1)
   100% Declarative Plugin Specs (Graph Timeline + Algebra Token Choreography)
   ============================================================================ */
const L1_P3_WALKTHROUGH: WalkthroughSpec = {
  pageId: 'l1-p3-worked',
  title: 'Perpendicular line through P(6, 1)',
  rescueLessonId: 'rescue-isolate-y',
  rescueMessage:
    "If rearranging equations or flipping slopes still feels shaky, let's run a quick 3-minute catch-up on isolating y first.",
  steps: [
    { id: 's1', stepNum: 1, label: 'Isolate y', equation: '3x + y = −3  →  find m' },
    { id: 's2', stepNum: 2, label: 'Flip & negate', equation: 'm = −3  →  find m⊥' },
    { id: 's3', stepNum: 3, label: 'Solve for b', equation: 'y = m⊥x + b  using P(6, 1)' },
  ],
  lenses: [
    {
      id: 'visual',
      label: 'Visual',
      beats: [
        {
          id: 'vis-1',
          stepIndex: 0,
          title: 'Plot y = −3x − 3 and see slope m = −3',
          caption:
            'Every step of +1 right drops the line 3 units down. That steep downhill triangle is slope m = −3.',
          audioPath: '/assets/voice/walkthroughs/l1-p3/vis-1.mp3',
          durationSec: 11.2,
          stage: {
            plugin: 'graph-timeline',
            config: {
              ariaLabel: 'Plotting y = -3x - 3 and rise over run triangle',
              bounds: { xMin: -5, xMax: 8, yMin: -5, yMax: 5 },
              tracks: [
                {
                  type: 'line-draw',
                  id: 'line-orig',
                  from: [-2.67, 5],
                  to: [0.67, -5],
                  color: 'blue',
                  fromT: 0.05,
                  toT: 0.34,
                },
                {
                  type: 'point',
                  id: 'pt-0',
                  at: [-1, 0],
                  label: '(−1, 0)',
                  labelDx: -48,
                  labelDy: -8,
                  color: 'blue',
                  fromT: 0.24,
                  toT: 0.36,
                },
                {
                  type: 'slope-triangle',
                  id: 'tri-slope',
                  from: [-1, 0],
                  dx: 1,
                  dy: -3,
                  runLabel: '+1',
                  riseLabel: '−3',
                  color: 'amber',
                  runFromT: 0.38,
                  runToT: 0.56,
                  riseFromT: 0.54,
                  riseToT: 0.74,
                },
                {
                  type: 'point',
                  id: 'pt-1',
                  at: [0, -3],
                  label: '(0, −3)',
                  labelDx: 10,
                  labelDy: 14,
                  color: 'blue',
                  fromT: 0.68,
                  toT: 0.8,
                  pulseAtT: 0.74,
                },
                {
                  type: 'badge',
                  id: 'badge-m',
                  at: [4.2, 2.5],
                  text: 'm = −3 / 1 = −3',
                  tone: 'blue',
                  width: 148,
                  fromT: 0.72,
                  toT: 0.92,
                },
              ],
            },
          },
          cues: [
            { at: 0.0, semaX: 18, semaY: 22, lookX: 0.7, lookY: 0.5, semaState: 'speaking', expression: 'attentive', tag: 'Plot the line' },
            { at: 0.36, semaX: 64, semaY: 64, lookX: -0.6, lookY: 0.3, semaState: 'guiding', expression: 'curious', tag: 'Right 1, down 3' },
            { at: 0.74, semaX: 28, semaY: 74, lookX: 0.6, lookY: -0.3, semaState: 'nodding', expression: 'proud', tag: 'm = −3' },
          ],
        },
        {
          id: 'vis-2',
          stepIndex: 1,
          title: 'Rotate +90° to get perpendicular slope m⊥ = 1/3',
          caption:
            'Turn the direction a full 90°. A steep drop of 3 over 1 becomes a gentle climb of 1 up for every 3 right.',
          audioPath: '/assets/voice/walkthroughs/l1-p3/vis-2.mp3',
          durationSec: 11.8,
          stage: {
            plugin: 'graph-timeline',
            config: {
              ariaLabel: 'Rotating line 90 degrees to perpendicular slope 1/3',
              bounds: { xMin: -5, xMax: 8, yMin: -5, yMax: 5 },
              tracks: [
                {
                  type: 'line-draw',
                  id: 'orig-ref',
                  from: [-2.67, 5],
                  to: [0.67, -5],
                  color: 'blue',
                  fromT: 0.0,
                  toT: 0.08,
                  dimAfterT: 0.14,
                  dimOpacity: 0.35,
                },
                {
                  type: 'line-rotate',
                  id: 'rot-90',
                  pivot: [-1, 0],
                  baseSlope: -3,
                  rotateDeg: -90,
                  color: 'teal',
                  fromT: 0.12,
                  toT: 0.66,
                  rightAngleFromT: 0.62,
                  rightAngleToT: 0.84,
                },
                {
                  type: 'slope-triangle',
                  id: 'perp-tri',
                  from: [-1, 0],
                  dx: 3,
                  dy: 1,
                  runLabel: '+3',
                  riseLabel: '+1',
                  color: 'teal',
                  runFromT: 0.68,
                  runToT: 0.82,
                  riseFromT: 0.78,
                  riseToT: 0.92,
                },
                {
                  type: 'badge',
                  id: 'badge-perp',
                  at: [4.5, -2.5],
                  text: 'Rotating 90°',
                  phases: [
                    { at: 0.0, text: 'Rotate +90°' },
                    { at: 0.64, text: 'm⊥ = +1/3' },
                  ],
                  tone: 'teal',
                  width: 136,
                  fromT: 0.16,
                  toT: 0.35,
                },
              ],
            },
          },
          cues: [
            { at: 0.0, semaX: 20, semaY: 24, lookX: 0.5, lookY: 0.6, semaState: 'speaking', expression: 'attentive', tag: 'Rotate +90°' },
            { at: 0.35, semaX: 60, semaY: 32, lookX: -0.6, lookY: 0.6, semaState: 'guiding', expression: 'excited', tag: '90° right angle' },
            { at: 0.72, semaX: 78, semaY: 66, lookX: -0.7, lookY: -0.2, semaState: 'nodding', expression: 'proud', tag: 'm⊥ = +1/3' },
          ],
        },
        {
          id: 'vis-3',
          stepIndex: 2,
          title: 'Move the line through P(6, 1)',
          caption:
            'Keep the slope at 1/3. Move the line until it passes through P(6, 1). It crosses the y-axis at −1.',
          audioPath: '/assets/voice/walkthroughs/l1-p3/vis-3.mp3',
          durationSec: 13.4,
          stage: {
            plugin: 'graph-timeline',
            config: {
              ariaLabel: 'Sliding perpendicular line onto P(6, 1)',
              bounds: { xMin: -5, xMax: 8, yMin: -5, yMax: 5 },
              tracks: [
                {
                  type: 'line-draw',
                  id: 'orig-dim',
                  from: [-2.67, 5],
                  to: [0.67, -5],
                  color: 'blue',
                  strokeWidth: 2.5,
                  fromT: 0.0,
                  toT: 0.05,
                  dimAfterT: 0.05,
                  dimOpacity: 0.28,
                },
                {
                  type: 'line-glide',
                  id: 'glide-p',
                  slope: 1 / 3,
                  fromB: 2.4,
                  toB: -1.0,
                  fromT: 0.12,
                  toT: 0.66,
                  lockFromT: 0.66,
                  lockToT: 0.92,
                  targetPoint: [6, 1],
                  targetLabel: 'P(6, 1)',
                  color: 'teal',
                },
                {
                  type: 'badge',
                  id: 'badge-final',
                  at: [2.4, -3.4],
                  text: 'y = 1/3 x − 1',
                  tone: 'green',
                  width: 156,
                  fromT: 0.68,
                  toT: 0.92,
                },
              ],
            },
          },
          cues: [
            { at: 0.0, semaX: 22, semaY: 24, lookX: 0.7, lookY: 0.2, semaState: 'speaking', expression: 'attentive', tag: 'Slide to P(6, 1)' },
            { at: 0.42, semaX: 82, semaY: 28, lookX: -0.5, lookY: 0.6, semaState: 'guiding', expression: 'curious', tag: 'Lock on P(6, 1)' },
            { at: 0.78, semaX: 26, semaY: 72, lookX: 0.6, lookY: -0.2, semaState: 'celebrate', expression: 'happy', tag: 'b = −1!' },
          ],
        },
      ],
    },
    {
      id: 'algebra',
      label: 'Algebra',
      beats: [
        {
          id: 'alg-1',
          stepIndex: 0,
          title: 'Move 3x across = to isolate y',
          caption:
            'Subtract 3x from both sides so +3x arcs across as −3x. Now read the slope directly: m = −3.',
          audioPath: '/assets/voice/walkthroughs/l1-p3/alg-1.mp3',
          durationSec: 12.2,
          stage: {
            plugin: 'algebra-timeline',
            config: {
              ariaLabel: 'Isolating y from 3x + y = -3 via smooth parabolic token arc',
              hints: [
                { at: 0.0, text: 'Start in standard form: 3x + y = −3' },
                { at: 0.2, text: 'Arc +3x across = and flip its sign to −3x' },
                { at: 0.66, text: 'Read slope m right in front of x' },
              ],
              tokens: [
                {
                  id: 'tok-3x',
                  text: '3x',
                  altText: '−3x',
                  flipAt: 0.43,
                  tone: 'blue',
                  altTone: 'teal',
                  from: [-114, 0],
                  to: [24, 0],
                  arcHeight: 62,
                  fromT: 0.22,
                  toT: 0.62,
                  spotAt: [0.68, 1.0],
                },
                {
                  id: 'tok-plus',
                  text: '+',
                  tone: 'ink',
                  from: [-64, 0],
                  to: [-64, 0],
                  fromT: 0.22,
                  toT: 0.36,
                  fadeOut: [0.22, 0.36],
                },
                {
                  id: 'tok-y',
                  text: 'y',
                  tone: 'ink',
                  from: [-28, 0],
                  to: [-106, 0],
                  fromT: 0.22,
                  toT: 0.62,
                },
                {
                  id: 'tok-eq',
                  text: '=',
                  tone: 'ink',
                  from: [16, 0],
                  to: [-54, 0],
                  fromT: 0.22,
                  toT: 0.62,
                },
                {
                  id: 'tok-const',
                  text: '−3',
                  tone: 'ink',
                  from: [70, 0],
                  to: [112, 0],
                  fromT: 0.22,
                  toT: 0.62,
                },
              ],
              resultPill: {
                text: 'Slope m = −3',
                tone: 'blue',
                fromT: 0.68,
                toT: 0.88,
              },
            },
          },
          cues: [
            { at: 0.0, semaX: 16, semaY: 26, lookX: 0.8, lookY: 0.4, semaState: 'speaking', expression: 'attentive', tag: 'Spot +3x' },
            { at: 0.3, semaX: 54, semaY: 16, lookX: 0.2, lookY: 0.8, semaState: 'guiding', expression: 'excited', tag: 'Arc across =' },
            { at: 0.7, semaX: 78, semaY: 74, lookX: -0.7, lookY: -0.4, semaState: 'nodding', expression: 'proud', tag: 'm = −3' },
          ],
        },
        {
          id: 'alg-2',
          stepIndex: 1,
          title: 'Write −3 as −3/1, flip, and switch the sign',
          caption:
            'Flip numerator and denominator 180°, then switch negative to positive: m⊥ = +1/3.',
          audioPath: '/assets/voice/walkthroughs/l1-p3/alg-2.mp3',
          durationSec: 9.6,
          stage: {
            plugin: 'algebra-timeline',
            config: {
              ariaLabel: 'Taking the negative reciprocal of -3',
              hints: [
                { at: 0.0, text: 'Write −3 as a fraction over 1' },
                { at: 0.3, text: 'Flip numerator and denominator 180°' },
                { at: 0.7, text: 'Switch the sign from negative to positive' },
              ],
              fracBars: [{ id: 'fbar', x: 34, y: 0, fromT: 0.06, toT: 0.28 }],
              tokens: [
                {
                  id: 'lbl-m',
                  text: 'm =',
                  altText: 'm⊥ =',
                  flipAt: 0.72,
                  tone: 'ink',
                  from: [-108, 0],
                  fromT: 0,
                  toT: 0,
                },
                {
                  id: 'tok-sign',
                  text: '−',
                  altText: '+',
                  flipAt: 0.8,
                  tone: 'amber',
                  altTone: 'green',
                  from: [-28, 0],
                  fromT: 0,
                  toT: 0,
                  spin: { fromDeg: 0, toDeg: 180, fromT: 0.7, toT: 0.9, scalePulse: 0.28 },
                },
                {
                  id: 'tok-3',
                  text: '3',
                  tone: 'blue',
                  from: [34, 0],
                  fromT: 0,
                  toT: 0,
                  fadeIn: [0.06, 0.28],
                  orbit: { cx: 34, cy: 0, rx: 29, ry: 26, fromDeg: 0, toDeg: 180, fromT: 0.3, toT: 0.68 },
                },
                {
                  id: 'tok-1',
                  text: '1',
                  tone: 'teal',
                  from: [34, 26],
                  fromT: 0,
                  toT: 0,
                  fadeIn: [0.06, 0.28],
                  orbit: { cx: 34, cy: 0, rx: 29, ry: 26, fromDeg: 180, toDeg: 360, fromT: 0.3, toT: 0.68 },
                },
              ],
              resultPill: {
                text: 'm⊥ = +1/3',
                tone: 'green',
                fromT: 0.78,
                toT: 0.95,
              },
            },
          },
          cues: [
            { at: 0.0, semaX: 18, semaY: 36, lookX: 0.8, lookY: 0.2, semaState: 'speaking', expression: 'attentive', tag: 'Write over 1' },
            { at: 0.34, semaX: 76, semaY: 24, lookX: -0.8, lookY: 0.5, semaState: 'guiding', expression: 'excited', tag: 'Flip 180°!' },
            { at: 0.72, semaX: 80, semaY: 72, lookX: -0.8, lookY: -0.3, semaState: 'nodding', expression: 'proud', tag: '− becomes +' },
          ],
        },
        {
          id: 'alg-3',
          stepIndex: 2,
          title: 'Sub m⊥ = 1/3 and P(6, 1) into y = mx + b',
          caption:
            'Multiply (1/3)(6) = 2, then subtract 2 from 1 to get b = −1. Final line: y = 1/3 x − 1.',
          audioPath: '/assets/voice/walkthroughs/l1-p3/alg-3.mp3',
          durationSec: 12.2,
          stage: {
            plugin: 'algebra-timeline',
            config: {
              ariaLabel: 'Substituting P(6, 1) into y = mx + b',
              hints: [
                { at: 0.0, text: 'Drop P(6, 1) and m⊥ = 1/3 into y = mx + b' },
                { at: 0.38, text: 'Multiply (1/3)(6) = 2' },
                { at: 0.68, text: 'Subtract 2 from both sides → b = −1' },
              ],
              rows: [
                {
                  id: 'r1',
                  fromT: 0.08,
                  toT: 0.34,
                  chips: [
                    { kind: 'chip', text: '1', tone: 'amber' },
                    { kind: 'sym', text: '=' },
                    { kind: 'chip', text: '(1/3)(6)', tone: 'teal', pulseWindow: [0.34, 0.62] },
                    { kind: 'sym', text: '+ b' },
                  ],
                },
                {
                  id: 'r2',
                  fromT: 0.38,
                  toT: 0.64,
                  chips: [
                    { kind: 'chip', text: '1', tone: 'amber' },
                    { kind: 'sym', text: '=' },
                    { kind: 'chip', text: '2', tone: 'blue' },
                    { kind: 'sym', text: '+ b' },
                  ],
                },
                {
                  id: 'r3',
                  fromT: 0.68,
                  toT: 0.9,
                  isFinal: true,
                  chips: [{ kind: 'result', text: 'b = −1   →   y = 1/3 x − 1', tone: 'green' }],
                },
              ],
            },
          },
          cues: [
            { at: 0.0, semaX: 18, semaY: 22, lookX: 0.8, lookY: 0.5, semaState: 'speaking', expression: 'attentive', tag: 'Plug in P(6, 1)' },
            { at: 0.38, semaX: 82, semaY: 32, lookX: -0.8, lookY: 0.3, semaState: 'guiding', expression: 'curious', tag: '(1/3)(6) = 2' },
            { at: 0.74, semaX: 20, semaY: 76, lookX: 0.8, lookY: -0.2, semaState: 'celebrate', expression: 'happy', tag: 'y = 1/3 x − 1!' },
          ],
        },
      ],
    },
  ],
}

/* ============================================================================
   Lesson 2 Worked Example: Midpoint Formula (Plugin-Driven Graph + Algebra)
   ============================================================================ */
const L2_P2_WALKTHROUGH: WalkthroughSpec = {
  pageId: 'l2-p2-worked',
  title: 'Midpoint of A(11, 14) & B(3, 5)',
  rescueLessonId: 'rescue-signed-avg',
  rescueMessage:
    'Mixing up signs when averaging negative coordinates? Try a quick 3-minute catch-up on signed averages.',
  steps: [
    { id: 'm1', stepNum: 1, label: 'Meet halfway', equation: 'Sweep A & B inward to M' },
    { id: 'm2', stepNum: 2, label: 'Average x & y', equation: 'M = ((11+3)/2, (14+5)/2)' },
  ],
  lenses: [
    {
      id: 'visual',
      label: 'Visual',
      beats: [
        {
          id: 'l2-vis-1',
          stepIndex: 0,
          title: 'Midpoint is the exact balance point between A and B',
          caption:
            'Walk inward from A(11, 14) and B(3, 5) at the same speed. Both halves meet right in the middle at M(7, 9.5).',
          audioPath: '/assets/voice/walkthroughs/l2-p2/vis-1.mp3',
          durationSec: 9.5,
          stage: {
            plugin: 'graph-timeline',
            config: {
              ariaLabel: 'Midpoint sweep between B(3, 5) and A(11, 14)',
              bounds: { xMin: 1, xMax: 13, yMin: 3, yMax: 16, step: 2 },
              tracks: [
                {
                  type: 'midpoint-sweep',
                  id: 'mid-ab',
                  a: [3, 5],
                  b: [11, 14],
                  labelA: 'B(3, 5)',
                  labelB: 'A(11, 14)',
                  labelM: 'M(7, 9.5)',
                  color: 'blue',
                  fromT: 0.12,
                  toT: 0.62,
                  lockFromT: 0.62,
                  lockToT: 0.86,
                },
                {
                  type: 'badge',
                  id: 'mid-badge',
                  at: [9.5, 5.5],
                  text: 'M = (7, 9.5)',
                  tone: 'green',
                  width: 136,
                  fromT: 0.68,
                  toT: 0.9,
                },
              ],
            },
          },
          cues: [
            { at: 0.0, semaX: 18, semaY: 22, lookX: 0.7, lookY: 0.4, semaState: 'speaking', expression: 'attentive', tag: 'Start at A & B' },
            { at: 0.38, semaX: 78, semaY: 32, lookX: -0.7, lookY: 0.4, semaState: 'guiding', expression: 'curious', tag: 'Walk inward equally' },
            { at: 0.7, semaX: 24, semaY: 72, lookX: 0.7, lookY: -0.2, semaState: 'celebrate', expression: 'happy', tag: 'M(7, 9.5)!' },
          ],
        },
        {
          id: 'l2-vis-2',
          stepIndex: 1,
          title: 'Same midpoint rule with negative coordinates',
          caption:
            'For P(−4, −8) and Q(−3, −1), keep every negative sign when adding. Halfway between them lands cleanly at (−3.5, −4.5).',
          audioPath: '/assets/voice/walkthroughs/l2-p2/vis-2.mp3',
          durationSec: 9.8,
          stage: {
            plugin: 'graph-timeline',
            config: {
              ariaLabel: 'Midpoint sweep for negative coordinates P(-4, -8) and Q(-3, -1)',
              bounds: { xMin: -7, xMax: 1, yMin: -10, yMax: 1, step: 2 },
              tracks: [
                {
                  type: 'midpoint-sweep',
                  id: 'mid-pq',
                  a: [-4, -8],
                  b: [-3, -1],
                  labelA: 'P(−4, −8)',
                  labelB: 'Q(−3, −1)',
                  labelM: 'M(−3.5, −4.5)',
                  color: 'teal',
                  fromT: 0.12,
                  toT: 0.62,
                  lockFromT: 0.62,
                  lockToT: 0.86,
                },
                {
                  type: 'badge',
                  id: 'mid-pq-badge',
                  at: [-1.4, -7.8],
                  text: 'M = (−3.5, −4.5)',
                  tone: 'teal',
                  width: 158,
                  fromT: 0.68,
                  toT: 0.9,
                },
              ],
            },
          },
          cues: [
            { at: 0.0, semaX: 20, semaY: 24, lookX: 0.6, lookY: 0.4, semaState: 'speaking', expression: 'attentive', tag: 'Watch the signs' },
            { at: 0.45, semaX: 80, semaY: 36, lookX: -0.8, lookY: 0.3, semaState: 'guiding', expression: 'curious', tag: 'Halfway between' },
            { at: 0.74, semaX: 22, semaY: 74, lookX: 0.7, lookY: -0.2, semaState: 'nodding', expression: 'proud', tag: '(−3.5, −4.5)' },
          ],
        },
      ],
    },
    {
      id: 'algebra',
      label: 'Algebra',
      beats: [
        {
          id: 'l2-alg-1',
          stepIndex: 0,
          title: 'Add x-values and y-values, then divide by 2',
          caption:
            'Midpoint always adds! Add 11 + 3 to get 14, divide by 2 for 7. Add 14 + 5 to get 19, divide by 2 for 9.5.',
          audioPath: '/assets/voice/walkthroughs/l2-p2/alg-1.mp3',
          durationSec: 10.0,
          stage: {
            plugin: 'algebra-timeline',
            config: {
              ariaLabel: 'Computing midpoint of A(11, 14) and B(3, 5)',
              hints: [
                { at: 0.0, text: 'Midpoint ADDS coordinates and divides by 2' },
                { at: 0.38, text: 'Sum the numerators: 14 and 19' },
                { at: 0.7, text: 'Divide both by 2 → M = (7, 9.5)' },
              ],
              rows: [
                {
                  id: 'm-r1',
                  fromT: 0.08,
                  toT: 0.34,
                  chips: [
                    { kind: 'sym', text: 'M = (' },
                    { kind: 'chip', text: '(11 + 3)/2', tone: 'blue', pulseWindow: [0.32, 0.6] },
                    { kind: 'sym', text: ',' },
                    { kind: 'chip', text: '(14 + 5)/2', tone: 'teal', pulseWindow: [0.32, 0.6] },
                    { kind: 'sym', text: ')' },
                  ],
                },
                {
                  id: 'm-r2',
                  fromT: 0.38,
                  toT: 0.64,
                  chips: [
                    { kind: 'sym', text: 'M = (' },
                    { kind: 'chip', text: '14 / 2', tone: 'blue' },
                    { kind: 'sym', text: ',' },
                    { kind: 'chip', text: '19 / 2', tone: 'teal' },
                    { kind: 'sym', text: ')' },
                  ],
                },
                {
                  id: 'm-r3',
                  fromT: 0.68,
                  toT: 0.9,
                  isFinal: true,
                  chips: [{ kind: 'result', text: 'M = (7, 9.5)', tone: 'green' }],
                },
              ],
            },
          },
          cues: [
            { at: 0.0, semaX: 16, semaY: 22, lookX: 0.8, lookY: 0.4, semaState: 'speaking', expression: 'attentive', tag: 'Always add!' },
            { at: 0.42, semaX: 82, semaY: 34, lookX: -0.8, lookY: 0.3, semaState: 'guiding', expression: 'curious', tag: '14/2 & 19/2' },
            { at: 0.74, semaX: 22, semaY: 74, lookX: 0.8, lookY: -0.2, semaState: 'celebrate', expression: 'happy', tag: 'M = (7, 9.5)' },
          ],
        },
        {
          id: 'l2-alg-2',
          stepIndex: 1,
          title: 'Keep negative signs intact',
          caption:
            'Negative 4 plus negative 3 is negative 7, divided by 2 gives −3.5. Negative 8 plus negative 1 is negative 9, divided by 2 gives −4.5.',
          audioPath: '/assets/voice/walkthroughs/l2-p2/alg-2.mp3',
          durationSec: 10.2,
          stage: {
            plugin: 'algebra-timeline',
            config: {
              ariaLabel: 'Computing midpoint of P(-4, -8) and Q(-3, -1)',
              hints: [
                { at: 0.0, text: 'Keep brackets around negative coordinates' },
                { at: 0.4, text: 'Add negatives: −4 + (−3) = −7 and −8 + (−1) = −9' },
                { at: 0.72, text: 'Divide by 2 → M = (−3.5, −4.5)' },
              ],
              rows: [
                {
                  id: 'mn-r1',
                  fromT: 0.08,
                  toT: 0.34,
                  chips: [
                    { kind: 'sym', text: 'M = (' },
                    { kind: 'chip', text: '(−4 + −3)/2', tone: 'amber', pulseWindow: [0.34, 0.62] },
                    { kind: 'sym', text: ',' },
                    { kind: 'chip', text: '(−8 + −1)/2', tone: 'teal', pulseWindow: [0.34, 0.62] },
                    { kind: 'sym', text: ')' },
                  ],
                },
                {
                  id: 'mn-r2',
                  fromT: 0.38,
                  toT: 0.64,
                  chips: [
                    { kind: 'sym', text: 'M = (' },
                    { kind: 'chip', text: '−7 / 2', tone: 'amber' },
                    { kind: 'sym', text: ',' },
                    { kind: 'chip', text: '−9 / 2', tone: 'teal' },
                    { kind: 'sym', text: ')' },
                  ],
                },
                {
                  id: 'mn-r3',
                  fromT: 0.68,
                  toT: 0.9,
                  isFinal: true,
                  chips: [{ kind: 'result', text: 'M = (−3.5, −4.5)', tone: 'green' }],
                },
              ],
            },
          },
          cues: [
            { at: 0.0, semaX: 18, semaY: 24, lookX: 0.8, lookY: 0.4, semaState: 'speaking', expression: 'attentive', tag: 'Keep negatives' },
            { at: 0.42, semaX: 82, semaY: 36, lookX: -0.8, lookY: 0.3, semaState: 'guiding', expression: 'curious', tag: '−7/2 & −9/2' },
            { at: 0.74, semaX: 24, semaY: 74, lookX: 0.7, lookY: -0.2, semaState: 'nodding', expression: 'proud', tag: '(−3.5, −4.5)' },
          ],
        },
      ],
    },
  ],
}

/* ============================================================================
   Lesson 3 Worked Example: Median from C in △ABC
   ============================================================================ */
const L3_P3_WALKTHROUGH: WalkthroughSpec = {
  pageId: 'l3-p3-worked',
  title: 'Median from C in △ABC',
  rescueLessonId: 'rescue-isolate-y',
  rescueMessage:
    'Need a quick review of turning two points into y = mx + b before tackling triangle medians?',
  steps: [
    { id: 'med1', stepNum: 1, label: 'Midpoint of AB', equation: 'M_AB = (−0.5, −1)' },
    { id: 'med2', stepNum: 2, label: 'Line CM', equation: 'm = 6/11  →  y = 6/11 x − 8/11' },
  ],
  lenses: [
    {
      id: 'visual',
      label: 'Visual',
      beats: [
        {
          id: 'l3-vis-1',
          stepIndex: 0,
          title: 'Step 1: Find midpoint M of opposite side AB',
          caption:
            'A median from vertex C always targets the exact midpoint of the opposite side AB. Sweep A(−3, 3) and B(2, −5) inward to M(−0.5, −1).',
          audioPath: '/assets/voice/walkthroughs/l3-p3/vis-1.mp3',
          durationSec: 10.2,
          stage: {
            plugin: 'graph-timeline',
            config: {
              ariaLabel: 'Finding midpoint M of side AB in triangle ABC',
              bounds: { xMin: -5, xMax: 7, yMin: -6, yMax: 5 },
              tracks: [
                {
                  type: 'polygon',
                  id: 'tri-abc',
                  vertices: [[-3, 3], [2, -5], [5, 2]],
                  color: 'blue',
                  fillOpacity: 0.08,
                  fromT: 0.02,
                  toT: 0.2,
                },
                {
                  type: 'point',
                  id: 'pt-c',
                  at: [5, 2],
                  label: 'C(5, 2)',
                  labelDx: -14,
                  labelDy: -12,
                  color: 'amber',
                  fromT: 0.08,
                  toT: 0.22,
                },
                {
                  type: 'midpoint-sweep',
                  id: 'mid-ab',
                  a: [-3, 3],
                  b: [2, -5],
                  labelA: 'A(−3, 3)',
                  labelB: 'B(2, −5)',
                  labelM: 'M(−0.5, −1)',
                  color: 'teal',
                  fromT: 0.22,
                  toT: 0.66,
                  lockFromT: 0.66,
                  lockToT: 0.88,
                },
              ],
            },
          },
          cues: [
            { at: 0.0, semaX: 80, semaY: 24, lookX: -0.7, lookY: 0.4, semaState: 'speaking', expression: 'attentive', tag: 'Opposite side AB' },
            { at: 0.42, semaX: 20, semaY: 64, lookX: 0.7, lookY: -0.2, semaState: 'guiding', expression: 'curious', tag: 'Meet at M' },
            { at: 0.74, semaX: 78, semaY: 72, lookX: -0.7, lookY: -0.3, semaState: 'nodding', expression: 'proud', tag: 'M(−0.5, −1)' },
          ],
        },
        {
          id: 'l3-vis-2',
          stepIndex: 1,
          title: 'Step 2: Connect C(5, 2) to M(−0.5, −1)',
          caption:
            'Draw the median straight from C through M. Its rise is 3 and run is 5.5, which simplifies cleanly to slope 6/11.',
          audioPath: '/assets/voice/walkthroughs/l3-p3/vis-2.mp3',
          durationSec: 10.4,
          stage: {
            plugin: 'graph-timeline',
            config: {
              ariaLabel: 'Drawing median CM in triangle ABC',
              bounds: { xMin: -5, xMax: 7, yMin: -6, yMax: 5 },
              tracks: [
                {
                  type: 'polygon',
                  id: 'tri-abc-2',
                  vertices: [[-3, 3], [2, -5], [5, 2]],
                  color: 'blue',
                  fillOpacity: 0.08,
                  fromT: 0.0,
                  toT: 0.1,
                },
                {
                  type: 'point',
                  id: 'pt-m2',
                  at: [-0.5, -1],
                  label: 'M(−0.5, −1)',
                  labelDx: -72,
                  labelDy: -10,
                  color: 'teal',
                  fromT: 0.04,
                  toT: 0.16,
                },
                {
                  type: 'point',
                  id: 'pt-c2',
                  at: [5, 2],
                  label: 'C(5, 2)',
                  labelDx: -12,
                  labelDy: -12,
                  color: 'amber',
                  fromT: 0.04,
                  toT: 0.16,
                },
                {
                  type: 'segment-draw',
                  id: 'seg-cm',
                  from: [-0.5, -1],
                  to: [5, 2],
                  color: 'teal',
                  strokeWidth: 4,
                  fromT: 0.16,
                  toT: 0.56,
                },
                {
                  type: 'slope-triangle',
                  id: 'cm-tri',
                  from: [-0.5, -1],
                  dx: 5.5,
                  dy: 3,
                  runLabel: '+5.5',
                  riseLabel: '+3',
                  color: 'amber',
                  runFromT: 0.52,
                  runToT: 0.68,
                  riseFromT: 0.64,
                  riseToT: 0.8,
                },
                {
                  type: 'badge',
                  id: 'cm-badge',
                  at: [2.8, -4.2],
                  text: 'y = 6/11 x − 8/11',
                  tone: 'green',
                  width: 164,
                  fromT: 0.72,
                  toT: 0.92,
                },
              ],
            },
          },
          cues: [
            { at: 0.0, semaX: 20, semaY: 22, lookX: 0.7, lookY: 0.4, semaState: 'speaking', expression: 'attentive', tag: 'Connect C → M' },
            { at: 0.5, semaX: 80, semaY: 36, lookX: -0.7, lookY: 0.3, semaState: 'guiding', expression: 'excited', tag: 'Slope = 6/11' },
            { at: 0.76, semaX: 22, semaY: 74, lookX: 0.7, lookY: -0.2, semaState: 'celebrate', expression: 'happy', tag: 'Median locked!' },
          ],
        },
      ],
    },
    {
      id: 'algebra',
      label: 'Algebra',
      beats: [
        {
          id: 'l3-alg-1',
          stepIndex: 0,
          title: 'Compute M_AB and slope of CM',
          caption:
            'Average A and B to get M(−0.5, −1). Then divide rise 3 by run 5.5, and double both to clear the decimal: m = 6/11.',
          audioPath: '/assets/voice/walkthroughs/l3-p3/alg-1.mp3',
          durationSec: 10.6,
          stage: {
            plugin: 'algebra-timeline',
            config: {
              ariaLabel: 'Computing midpoint M_AB and slope of CM',
              hints: [
                { at: 0.0, text: 'Find midpoint M of opposite side AB' },
                { at: 0.38, text: 'Compute slope m = (y₂ − y₁) / (x₂ − x₁)' },
                { at: 0.7, text: 'Double 3 / 5.5 to clear decimals → 6/11' },
              ],
              rows: [
                {
                  id: 'l3-r1',
                  fromT: 0.08,
                  toT: 0.34,
                  chips: [
                    { kind: 'sym', text: 'M_AB =' },
                    { kind: 'chip', text: '(−0.5, −1)', tone: 'teal' },
                  ],
                },
                {
                  id: 'l3-r2',
                  fromT: 0.38,
                  toT: 0.64,
                  chips: [
                    { kind: 'sym', text: 'm =' },
                    { kind: 'chip', text: '(2 − −1) / (5 − −0.5)', tone: 'blue', pulseWindow: [0.42, 0.68] },
                    { kind: 'sym', text: '= 3 / 5.5' },
                  ],
                },
                {
                  id: 'l3-r3',
                  fromT: 0.68,
                  toT: 0.9,
                  isFinal: true,
                  chips: [{ kind: 'result', text: 'm = 6/11', tone: 'green' }],
                },
              ],
            },
          },
          cues: [
            { at: 0.0, semaX: 16, semaY: 22, lookX: 0.8, lookY: 0.4, semaState: 'speaking', expression: 'attentive', tag: 'Find M first' },
            { at: 0.42, semaX: 82, semaY: 34, lookX: -0.8, lookY: 0.3, semaState: 'guiding', expression: 'curious', tag: 'Clear decimals' },
            { at: 0.74, semaX: 22, semaY: 74, lookX: 0.8, lookY: -0.2, semaState: 'nodding', expression: 'proud', tag: 'm = 6/11' },
          ],
        },
        {
          id: 'l3-alg-2',
          stepIndex: 1,
          title: 'Sub C(5, 2) into y = (6/11)x + b',
          caption:
            'Use the clean integer point C(5, 2) to avoid extra decimals. Multiply 6/11 by 5 to get 30/11, then subtract from 22/11 to get b = −8/11.',
          audioPath: '/assets/voice/walkthroughs/l3-p3/alg-2.mp3',
          durationSec: 10.8,
          stage: {
            plugin: 'algebra-timeline',
            config: {
              ariaLabel: 'Solving for b using C(5, 2)',
              hints: [
                { at: 0.0, text: 'Sub C(5, 2) into y = (6/11)x + b' },
                { at: 0.4, text: 'Convert 2 = 22/11 and subtract 30/11' },
                { at: 0.72, text: 'Write exact fraction equation y = 6/11 x − 8/11' },
              ],
              rows: [
                {
                  id: 'l3b-r1',
                  fromT: 0.08,
                  toT: 0.34,
                  chips: [
                    { kind: 'chip', text: '2', tone: 'amber' },
                    { kind: 'sym', text: '=' },
                    { kind: 'chip', text: '(6/11)(5)', tone: 'teal', pulseWindow: [0.32, 0.6] },
                    { kind: 'sym', text: '+ b' },
                  ],
                },
                {
                  id: 'l3b-r2',
                  fromT: 0.38,
                  toT: 0.64,
                  chips: [
                    { kind: 'chip', text: '22/11 − 30/11', tone: 'blue' },
                    { kind: 'sym', text: '= b' },
                  ],
                },
                {
                  id: 'l3b-r3',
                  fromT: 0.68,
                  toT: 0.9,
                  isFinal: true,
                  chips: [{ kind: 'result', text: 'y = 6/11 x − 8/11', tone: 'green' }],
                },
              ],
            },
          },
          cues: [
            { at: 0.0, semaX: 16, semaY: 24, lookX: 0.8, lookY: 0.4, semaState: 'speaking', expression: 'attentive', tag: 'Sub C(5, 2)' },
            { at: 0.42, semaX: 82, semaY: 36, lookX: -0.8, lookY: 0.3, semaState: 'guiding', expression: 'curious', tag: 'Common denom 11' },
            { at: 0.74, semaX: 22, semaY: 74, lookX: 0.8, lookY: -0.2, semaState: 'celebrate', expression: 'happy', tag: 'Exact fraction!' },
          ],
        },
      ],
    },
  ],
}

/* ============================================================================
   Lesson 4 Worked Example: Exact Length AB & Classifying △DEF
   ============================================================================ */
const L4_P2_WALKTHROUGH: WalkthroughSpec = {
  pageId: 'l4-p2-worked',
  title: 'Exact Length AB & Classify △DEF',
  rescueLessonId: 'rescue-pythagorean',
  rescueMessage:
    'Want a quick 3-minute refresher on the Pythagorean theorem before computing coordinate distances?',
  steps: [
    { id: 'len1', stepNum: 1, label: 'Distance triangle', equation: 'd = √(3² + 8²) = √73' },
    { id: 'len2', stepNum: 2, label: 'Classify △DEF', equation: 'DE = EF = √17 → Isosceles' },
  ],
  lenses: [
    {
      id: 'visual',
      label: 'Visual',
      beats: [
        {
          id: 'l4-vis-1',
          stepIndex: 0,
          title: 'Build a right triangle under segment AB',
          caption:
            'Distance is just Pythagoras on the grid! Move +3 across and +8 up from A(3, 1) to B(6, 9), then take the hypotenuse √73.',
          audioPath: '/assets/voice/walkthroughs/l4-p2/vis-1.mp3',
          durationSec: 10.2,
          stage: {
            plugin: 'graph-timeline',
            config: {
              ariaLabel: 'Right triangle for exact distance AB',
              bounds: { xMin: 0, xMax: 10, yMin: -1, yMax: 11, step: 2 },
              tracks: [
                {
                  type: 'distance-triangle',
                  id: 'dist-ab',
                  a: [3, 1],
                  b: [6, 9],
                  dxLabel: 'Δx = 3',
                  dyLabel: 'Δy = 8',
                  hypLabel: 'd = √73',
                  color: 'blue',
                  fromT: 0.08,
                  toT: 0.56,
                  hypFromT: 0.52,
                  hypToT: 0.84,
                },
                {
                  type: 'point',
                  id: 'da',
                  at: [3, 1],
                  label: 'A(3, 1)',
                  labelDx: -48,
                  labelDy: 14,
                  color: 'blue',
                  fromT: 0.04,
                  toT: 0.16,
                },
                {
                  type: 'point',
                  id: 'db',
                  at: [6, 9],
                  label: 'B(6, 9)',
                  labelDx: 8,
                  labelDy: -8,
                  color: 'blue',
                  fromT: 0.04,
                  toT: 0.16,
                },
                {
                  type: 'badge',
                  id: 'dist-badge',
                  at: [7.6, 2.2],
                  text: 'd = √73',
                  tone: 'green',
                  width: 118,
                  fromT: 0.72,
                  toT: 0.92,
                },
              ],
            },
          },
          cues: [
            { at: 0.0, semaX: 18, semaY: 22, lookX: 0.7, lookY: 0.4, semaState: 'speaking', expression: 'attentive', tag: 'Drop legs Δx, Δy' },
            { at: 0.46, semaX: 80, semaY: 36, lookX: -0.7, lookY: 0.3, semaState: 'guiding', expression: 'excited', tag: '3² + 8² = 73' },
            { at: 0.74, semaX: 20, semaY: 74, lookX: 0.7, lookY: -0.2, semaState: 'celebrate', expression: 'happy', tag: 'Exact √73!' },
          ],
        },
        {
          id: 'l4-vis-2',
          stepIndex: 1,
          title: 'Compare all 3 exact sides of △DEF',
          caption:
            'Keep radicals exact! Both DE and EF equal √17 while DF equals √34. Two equal sides immediately prove △DEF is isosceles.',
          audioPath: '/assets/voice/walkthroughs/l4-p2/vis-2.mp3',
          durationSec: 10.6,
          stage: {
            plugin: 'graph-timeline',
            config: {
              ariaLabel: 'Classifying triangle DEF by exact side lengths',
              bounds: { xMin: -5, xMax: 3, yMin: -4, yMax: 5 },
              tracks: [
                {
                  type: 'polygon',
                  id: 'tri-def',
                  vertices: [[1, 3], [-3, 2], [-2, -2]],
                  color: 'blue',
                  fillOpacity: 0.08,
                  fromT: 0.04,
                  toT: 0.22,
                },
                {
                  type: 'segment-draw',
                  id: 'seg-de',
                  from: [1, 3],
                  to: [-3, 2],
                  color: 'teal',
                  ticks: 1,
                  label: '√17',
                  fromT: 0.2,
                  toT: 0.44,
                },
                {
                  type: 'segment-draw',
                  id: 'seg-ef',
                  from: [-3, 2],
                  to: [-2, -2],
                  color: 'teal',
                  ticks: 1,
                  label: '√17',
                  fromT: 0.42,
                  toT: 0.66,
                },
                {
                  type: 'segment-draw',
                  id: 'seg-df',
                  from: [1, 3],
                  to: [-2, -2],
                  color: 'blue',
                  label: '√34',
                  fromT: 0.62,
                  toT: 0.82,
                },
                {
                  type: 'badge',
                  id: 'def-badge',
                  at: [0.9, -2.5],
                  text: 'Isosceles △',
                  tone: 'green',
                  width: 130,
                  fromT: 0.74,
                  toT: 0.94,
                },
              ],
            },
          },
          cues: [
            { at: 0.0, semaX: 80, semaY: 22, lookX: -0.7, lookY: 0.4, semaState: 'speaking', expression: 'attentive', tag: 'Check DE = √17' },
            { at: 0.45, semaX: 20, semaY: 66, lookX: 0.7, lookY: -0.2, semaState: 'guiding', expression: 'excited', tag: 'EF = √17 too!' },
            { at: 0.74, semaX: 78, semaY: 72, lookX: -0.7, lookY: -0.2, semaState: 'celebrate', expression: 'proud', tag: 'Isosceles!' },
          ],
        },
      ],
    },
    {
      id: 'algebra',
      label: 'Algebra',
      beats: [
        {
          id: 'l4-alg-1',
          stepIndex: 0,
          title: 'Plug into d = √((x₂ − x₁)² + (y₂ − y₁)²)',
          caption:
            'Subtract coordinates first: 6 minus 3 is 3, and 9 minus 1 is 8. Square them to get 9 + 64 = 73, then leave √73 exact.',
          audioPath: '/assets/voice/walkthroughs/l4-p2/alg-1.mp3',
          durationSec: 10.2,
          stage: {
            plugin: 'algebra-timeline',
            config: {
              ariaLabel: 'Computing exact distance AB algebraically',
              hints: [
                { at: 0.0, text: 'Subtract coordinates: Δx = 6 − 3 and Δy = 9 − 1' },
                { at: 0.38, text: 'Square each difference: 3² = 9 and 8² = 64' },
                { at: 0.7, text: 'Add under the root → exact length √73' },
              ],
              rows: [
                {
                  id: 'd-r1',
                  fromT: 0.08,
                  toT: 0.34,
                  chips: [
                    { kind: 'sym', text: 'd = √(' },
                    { kind: 'chip', text: '(6 − 3)²', tone: 'amber', pulseWindow: [0.32, 0.58] },
                    { kind: 'sym', text: '+' },
                    { kind: 'chip', text: '(9 − 1)²', tone: 'teal', pulseWindow: [0.32, 0.58] },
                    { kind: 'sym', text: ')' },
                  ],
                },
                {
                  id: 'd-r2',
                  fromT: 0.38,
                  toT: 0.64,
                  chips: [
                    { kind: 'sym', text: 'd = √(' },
                    { kind: 'chip', text: '9', tone: 'amber' },
                    { kind: 'sym', text: '+' },
                    { kind: 'chip', text: '64', tone: 'teal' },
                    { kind: 'sym', text: ')' },
                  ],
                },
                {
                  id: 'd-r3',
                  fromT: 0.68,
                  toT: 0.9,
                  isFinal: true,
                  chips: [{ kind: 'result', text: 'd_AB = √73  (≈ 8.54)', tone: 'green' }],
                },
              ],
            },
          },
          cues: [
            { at: 0.0, semaX: 16, semaY: 22, lookX: 0.8, lookY: 0.4, semaState: 'speaking', expression: 'attentive', tag: 'Subtract first' },
            { at: 0.42, semaX: 82, semaY: 34, lookX: -0.8, lookY: 0.3, semaState: 'guiding', expression: 'curious', tag: '9 + 64 = 73' },
            { at: 0.74, semaX: 22, semaY: 74, lookX: 0.8, lookY: -0.2, semaState: 'celebrate', expression: 'happy', tag: 'Keep √73 exact' },
          ],
        },
        {
          id: 'l4-alg-2',
          stepIndex: 1,
          title: 'Exact radicals make side comparisons instant',
          caption:
            'Because √17 equals √17 with zero rounding error, we know DE = EF immediately. Plus 17 + 17 = 34 even shows it is a right isosceles triangle!',
          audioPath: '/assets/voice/walkthroughs/l4-p2/alg-2.mp3',
          durationSec: 10.6,
          stage: {
            plugin: 'algebra-timeline',
            config: {
              ariaLabel: 'Comparing exact radical side lengths of triangle DEF',
              hints: [
                { at: 0.0, text: 'Never round mid-proof — keep exact radicals' },
                { at: 0.42, text: 'DE = √17 and EF = √17 match exactly' },
                { at: 0.72, text: 'Bonus: (√17)² + (√17)² = (√34)² → right isosceles!' },
              ],
              rows: [
                {
                  id: 'df-r1',
                  fromT: 0.08,
                  toT: 0.34,
                  chips: [
                    { kind: 'chip', text: 'DE = √17', tone: 'teal', pulseWindow: [0.35, 0.65] },
                    { kind: 'sym', text: '·' },
                    { kind: 'chip', text: 'EF = √17', tone: 'teal', pulseWindow: [0.35, 0.65] },
                  ],
                },
                {
                  id: 'df-r2',
                  fromT: 0.38,
                  toT: 0.64,
                  chips: [
                    { kind: 'chip', text: 'DF = √34', tone: 'blue' },
                    { kind: 'sym', text: 'and 17 + 17 = 34' },
                  ],
                },
                {
                  id: 'df-r3',
                  fromT: 0.68,
                  toT: 0.9,
                  isFinal: true,
                  chips: [{ kind: 'result', text: 'Right Isosceles Triangle', tone: 'green' }],
                },
              ],
            },
          },
          cues: [
            { at: 0.0, semaX: 16, semaY: 22, lookX: 0.8, lookY: 0.4, semaState: 'speaking', expression: 'attentive', tag: 'Compare radicals' },
            { at: 0.42, semaX: 82, semaY: 36, lookX: -0.8, lookY: 0.3, semaState: 'guiding', expression: 'excited', tag: 'DE = EF = √17' },
            { at: 0.74, semaX: 24, semaY: 74, lookX: 0.8, lookY: -0.2, semaState: 'celebrate', expression: 'proud', tag: 'Right Isosceles!' },
          ],
        },
      ],
    },
  ],
}

const CUSTOM_WALKTHROUGHS: Record<string, WalkthroughSpec> = {
  'l1-p3-worked': L1_P3_WALKTHROUGH,
  'l2-p2-worked': L2_P2_WALKTHROUGH,
  'l3-p3-worked': L3_P3_WALKTHROUGH,
  'l4-p2-worked': L4_P2_WALKTHROUGH,
}

function splitMathLines(raw?: string): string[] {
  if (!raw) return []
  return raw
    .split(/\n|;|→/)
    .map(s => s.trim())
    .filter(Boolean)
}

export function getWalkthroughForPage(
  lessonId: string,
  page: GeoLessonPage,
): WalkthroughSpec | null {
  const custom = CUSTOM_WALKTHROUGHS[page.id]
  if (custom) return custom

  const rescueLessonId = resolveRescueLessonId(lessonId, page.id)

  // Worked example pages: turn each worked step into a flying-Sema beat
  if (page.kind === 'worked' && page.steps.length > 0) {
    const steps: WalkthroughStepItem[] = page.steps.map((st, i) => ({
      id: `ws-${i}`,
      stepNum: i + 1,
      label: st.heading,
      equation: st.mathLines[0] ?? st.heading,
    }))
    const beats: WalkthroughBeat[] = page.steps.map((st, i) => ({
      id: `wb-${i}`,
      stepIndex: i,
      title: st.heading,
      caption: st.mathLines.join('. '),
      durationSec: 6.5,
      scene: st.scene,
      mathLines: st.mathLines,
      cues: [
        { at: 0.0, semaX: 16, semaY: 22, lookX: 0.8, lookY: 0.4, semaState: 'speaking', expression: 'attentive', tag: `Step ${i + 1}` },
        { at: 0.46, semaX: 82, semaY: 32, lookX: -0.8, lookY: 0.4, semaState: 'guiding', expression: 'curious', tag: 'Trace each line' },
        { at: 0.8, semaX: 76, semaY: 74, lookX: -0.7, lookY: -0.3, semaState: 'nodding', expression: 'proud', tag: 'Step complete' },
      ],
    }))
    return {
      pageId: page.id,
      title: 'Worked walkthrough',
      steps,
      lenses: [{ id: 'visual', label: 'Walkthrough', beats }],
      rescueLessonId,
      rescueMessage:
        'Want a quick 3-minute prerequisite refresher before trying the practice problems?',
    }
  }

  // Interactive explore labs: give Sema an interactive discovery walkthrough
  if (page.kind === 'explore') {
    const cleanPrompt = page.prompt.replace(/\*\*/g, '').replace(/\n+/g, ' ').trim()
    const beats: WalkthroughBeat[] = [
      {
        id: `exp-1-${page.id}`,
        stepIndex: 0,
        title: 'Drag & watch what changes',
        caption: cleanPrompt,
        durationSec: 6.0,
        mathLines: [
          'Drag the glowing orange handle on the interactive graph',
          'Watch which geometric value stays invariant as you move',
        ],
        cues: [
          { at: 0.0, semaX: 16, semaY: 24, lookX: 0.8, lookY: 0.4, semaState: 'speaking', expression: 'attentive', tag: 'Explore first' },
          { at: 0.52, semaX: 82, semaY: 36, lookX: -0.8, lookY: 0.3, semaState: 'guiding', expression: 'curious', tag: 'Spot the pattern' },
          { at: 0.85, semaX: 76, semaY: 72, lookX: -0.7, lookY: -0.3, semaState: 'nodding', expression: 'proud', tag: 'Lock the rule in' },
        ],
      },
      {
        id: `exp-2-${page.id}`,
        stepIndex: 1,
        title: 'Turn the pattern into a fast strategy',
        caption: 'Before clicking Continue, summarize the rule in one sentence so you can recognize it instantly in practice problems.',
        durationSec: 5.5,
        mathLines: [
          'Notice: What changes when you drag?',
          'Notice: What relationship stays true every time?',
        ],
        cues: [
          { at: 0.0, semaX: 18, semaY: 26, lookX: 0.8, lookY: 0.4, semaState: 'speaking', expression: 'attentive', tag: 'Key takeaway' },
          { at: 0.6, semaX: 80, semaY: 66, lookX: -0.8, lookY: -0.2, semaState: 'nodding', expression: 'proud', tag: 'Ready for practice' },
        ],
      },
    ]
    return {
      pageId: page.id,
      title: 'Interactive Lab Guide',
      steps: [
        { id: 'ex-1', stepNum: 1, label: 'Explore', equation: 'Drag & observe the pattern' },
        { id: 'ex-2', stepNum: 2, label: 'Takeaway', equation: 'Lock in the geometric rule' },
      ],
      lenses: [{ id: 'visual', label: 'Lab Guide', beats }],
      rescueLessonId,
      rescueMessage:
        'Need a quick prerequisite refresher before practicing this concept?',
    }
  }

  // Conference plan-order pages: walk through the optimal strategy step by step
  if (page.kind === 'plan-order' && page.validPlans.length > 0) {
    const primaryPlan = page.validPlans[0]!
    const blockById = new Map(page.pool.map(b => [b.id, b.text]))
    const steps: WalkthroughStepItem[] = primaryPlan.steps.map((id, i) => ({
      id: `pl-${id}`,
      stepNum: i + 1,
      label: `Move ${i + 1}`,
      equation: blockById.get(id) ?? id,
    }))
    const beats: WalkthroughBeat[] = primaryPlan.steps.map((id, i) => {
      const txt = blockById.get(id) ?? id
      return {
        id: `plb-${id}`,
        stepIndex: i,
        title: `Plan Step ${i + 1}: ${primaryPlan.name}`,
        caption: i === primaryPlan.steps.length - 1 ? primaryPlan.explanation : `Why this step comes #${i + 1}: it produces the exact piece you need for the next move.`,
        durationSec: 6.0,
        scene: page.scene,
        mathLines: [
          `Step ${i + 1}: ${txt}`,
          ...(i > 0 ? [`Builds directly from Step ${i}`] : ['Start from the given coordinates & target']),
        ],
        cues: [
          { at: 0.0, semaX: 16, semaY: 22, lookX: 0.8, lookY: 0.4, semaState: 'speaking', expression: 'attentive', tag: `Move ${i + 1}` },
          { at: 0.5, semaX: 82, semaY: 32, lookX: -0.8, lookY: 0.4, semaState: 'guiding', expression: 'curious', tag: 'Check dependencies' },
          { at: 0.84, semaX: 78, semaY: 74, lookX: -0.8, lookY: -0.3, semaState: 'nodding', expression: 'proud', tag: 'Next move unlocked' },
        ],
      }
    })
    return {
      pageId: page.id,
      title: `Conference Plan · ${primaryPlan.name}`,
      steps,
      lenses: [{ id: 'visual', label: 'Strategy', beats }],
      rescueLessonId,
      rescueMessage:
        'Want a quick refresher on the prerequisite formulas used in this plan?',
    }
  }

  // Multi-step pages: expose every sub-step with its actual goal & expression
  if (page.kind === 'multi-step') {
    const steps: WalkthroughStepItem[] = page.steps.map((st, i) => ({
      id: st.id,
      stepNum: i + 1,
      label: st.label,
      equation: `${st.label}  →  ${st.ledgerResult}`,
    }))
    const beats: WalkthroughBeat[] = page.steps.map((st, i) => ({
      id: `ms-${st.id}`,
      stepIndex: i,
      title: `Step ${i + 1}: ${st.label}`,
      caption: st.prompt.replace(/\*\*/g, ''),
      durationSec: 6.5,
      scene: st.solvedScene ?? st.scene,
      mathLines: [
        `Goal: ${st.label}`,
        ...splitMathLines(st.ledgerResult),
      ],
      cues: [
        { at: 0.0, semaX: 16, semaY: 22, lookX: 0.8, lookY: 0.4, semaState: 'speaking', expression: 'attentive', tag: st.label },
        { at: 0.45, semaX: 82, semaY: 28, lookX: -0.8, lookY: 0.4, semaState: 'guiding', expression: 'curious', tag: 'Focus here' },
        { at: 0.8, semaX: 78, semaY: 74, lookX: -0.8, lookY: -0.3, semaState: 'nodding', expression: 'proud', tag: st.ledgerResult },
      ],
    }))
    return {
      pageId: page.id,
      title: 'Step-by-step walkthrough',
      steps,
      lenses: [{ id: 'visual', label: 'Walkthrough', beats }],
      rescueLessonId,
      rescueMessage:
        'Want a quick refresher on the prerequisite skill behind this step before trying again?',
    }
  }

  // Any page with an explanation gets a structured flying-Sema walkthrough
  const expl = 'explanation' in page ? page.explanation : undefined
  if (expl && expl.steps.length > 0) {
    const steps: WalkthroughStepItem[] = expl.steps.map((s, i) => ({
      id: `es-${i}`,
      stepNum: i + 1,
      label: `Step ${i + 1}`,
      equation: s.math ?? s.text.slice(0, 44),
    }))
    const beats: WalkthroughBeat[] = expl.steps.map((s, i) => {
      const mLines = splitMathLines(s.math)
      return {
        id: `eb-${i}`,
        stepIndex: i,
        title: `Step ${i + 1} of ${expl.steps.length}`,
        caption: s.text,
        durationSec: 6.4,
        scene: s.scene ?? ('scene' in page ? page.scene : undefined),
        mathLines: mLines.length > 0 ? mLines : [s.text],
        cues: [
          { at: 0.0, semaX: 16, semaY: 24, lookX: 0.8, lookY: 0.4, semaState: 'speaking', expression: 'attentive', tag: `Step ${i + 1}` },
          { at: 0.48, semaX: 82, semaY: 32, lookX: -0.8, lookY: 0.4, semaState: 'guiding', expression: 'curious', tag: 'Check the math' },
          { at: 0.82, semaX: 78, semaY: 74, lookX: -0.8, lookY: -0.3, semaState: 'nodding', expression: 'proud', tag: mLines[mLines.length - 1]?.slice(0, 24) ?? 'Locked in' },
        ],
      }
    })
    return {
      pageId: page.id,
      title: 'Guided walkthrough',
      steps,
      lenses: [{ id: 'visual', label: 'Walkthrough', beats }],
      rescueLessonId,
      rescueMessage:
        'If this step still feels blurry, we can run a quick 3-minute catch-up mini-lesson first.',
    }
  }

  // Universal fallback so ? ("Walk me through with Sema") is always available on every page
  const fallbackPrompt = page.prompt.replace(/\*\*/g, '').replace(/\n+/g, ' ').trim()
  const fallbackScene = 'scene' in page ? page.scene : undefined
  return {
    pageId: page.id,
    title: 'Guided walkthrough',
    steps: [{ id: 'fb-1', stepNum: 1, label: 'Strategy', equation: 'Break the prompt down step by step' }],
    lenses: [
      {
        id: 'visual',
        label: 'Walkthrough',
        beats: [
          {
            id: `fb-${page.id}`,
            stepIndex: 0,
            title: 'Read the givens & target first',
            caption: fallbackPrompt,
            durationSec: 6.0,
            scene: fallbackScene,
            mathLines: [
              '1. List the given points or equation',
              '2. Pick the matching Unit 2 formula from your Playbook',
              '3. Substitute carefully and double-check signs',
            ],
            cues: [
              { at: 0.0, semaX: 16, semaY: 24, lookX: 0.8, lookY: 0.4, semaState: 'speaking', expression: 'attentive', tag: 'Start here' },
              { at: 0.5, semaX: 82, semaY: 36, lookX: -0.8, lookY: 0.4, semaState: 'guiding', expression: 'curious', tag: 'Pick formula' },
              { at: 0.85, semaX: 78, semaY: 74, lookX: -0.8, lookY: -0.3, semaState: 'nodding', expression: 'proud', tag: 'Check signs' },
            ],
          },
        ],
      },
    ],
    rescueLessonId,
    rescueMessage:
      'Need a quick 3-minute refresher on the prerequisite move behind this question?',
  }
}
