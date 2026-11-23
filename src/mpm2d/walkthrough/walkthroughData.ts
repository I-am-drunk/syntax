import type { GeoLessonPage } from '../pageTypes'
import type { GeoScene } from '../types'
import { resolveRescueLessonId } from '../data/catchupCourses'
import { WALKTHROUGH_VIDEO_MANIFEST } from './videoManifest'
import type { WalkthroughLensAsset, WalkthroughLensId } from './videoTypes'

export type WalkthroughBeat = {
  id: string
  stepIndex: number
  title: string
  caption: string
  durationSec: number
  /** Static fallback data for pages not yet rendered through manim-pipeline */
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
  id: WalkthroughLensId
  label: string
  beats: WalkthroughBeat[]
  /** Packaged lens video + chapters + captions + Sema track, if rendered */
  asset: WalkthroughLensAsset | null
}

export type WalkthroughSpec = {
  pageId: string
  title: string
  steps: WalkthroughStepItem[]
  lenses: WalkthroughLens[]
  rescueLessonId: string
  rescueMessage: string
}

function lens(
  pageId: string,
  id: WalkthroughLensId,
  label: string,
  beats: WalkthroughBeat[],
): WalkthroughLens {
  const asset = WALKTHROUGH_VIDEO_MANIFEST[pageId]?.[id] ?? null
  const timed = beats.map(b => {
    const ch = asset?.chapters.find(c => c.beatId === b.id)
    return ch ? { ...b, durationSec: Math.max(1, Math.round((ch.end - ch.start) * 10) / 10) } : b
  })
  return { id, label, beats: timed, asset }
}

function beat(
  id: string,
  stepIndex: number,
  title: string,
  caption: string,
  durationSec = 12,
): WalkthroughBeat {
  return { id, stepIndex, title, caption, durationSec }
}

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
    lens('l1-p3-worked', 'visual', 'Visual', [
      beat(
        'vis-1',
        0,
        'Plot y = −3x − 3 and see slope m = −3',
        'Move +1 unit right and the line drops 3 units down. That steep downhill triangle shows slope m = −3.',
      ),
      beat(
        'vis-2',
        1,
        'Rotate +90° to get perpendicular slope m⊥ = 1/3',
        'Rotate the direction 90°. A steep drop of 3 over 1 turns into a gentle climb of 1 up for every 3 right.',
      ),
      beat(
        'vis-3',
        2,
        'Slide the line through P(6, 1)',
        'Keep slope locked at 1/3 and slide vertically until it hits P(6, 1). It crosses the y-axis at b = −1.',
      ),
    ]),
    lens('l1-p3-worked', 'algebra', 'Algebra', [
      beat(
        'alg-1',
        0,
        'Move 3x across = to isolate y',
        'Subtract 3x from both sides so +3x crosses as −3x, giving y = −3x − 3 and slope m = −3.',
      ),
      beat(
        'alg-2',
        1,
        'Flip the fraction and switch the sign',
        'Rewrite −3 as −3/1, flip numerator and denominator to 1/3, and negate the minus sign to get m⊥ = +1/3.',
      ),
      beat(
        'alg-3',
        2,
        'Substitute P(6, 1) to solve for b',
        'Plug x = 6 and y = 1 into y = (1/3)x + b to get 1 = 2 + b, so b = −1 and y = (1/3)x − 1.',
      ),
    ]),
  ],
}

const L2_P2_WALKTHROUGH: WalkthroughSpec = {
  pageId: 'l2-p2-worked',
  title: 'Midpoint of a line segment',
  rescueLessonId: 'rescue-read-line',
  rescueMessage:
    "Want a quick refresher on reading coordinate pairs and averages? Let's run a 2-minute catch-up first.",
  steps: [
    { id: 's1', stepNum: 1, label: 'Positive pairs', equation: 'A(11, 14), B(3, 5)  →  M(7, 9.5)' },
    { id: 's2', stepNum: 2, label: 'Negative signs', equation: 'P(−4, −8), Q(−3, −1)  →  M(−3.5, −4.5)' },
  ],
  lenses: [
    lens('l2-p2-worked', 'visual', 'Visual', [
      beat(
        'vis-1',
        0,
        'Midpoint is the exact balance point between A and B',
        'Walk inward from A(11, 14) and B(3, 5) at the same speed. Both halves meet right at M(7, 9.5).',
      ),
      beat(
        'vis-2',
        1,
        'Same midpoint rule with negative coordinates',
        'For P(−4, −8) and Q(−3, −1), keep every negative sign when adding. Halfway lands at (−3.5, −4.5).',
      ),
    ]),
    lens('l2-p2-worked', 'algebra', 'Algebra', [
      beat(
        'alg-1',
        0,
        'Add x-values and y-values, then divide by 2',
        'Midpoint always adds: (11 + 3)/2 = 7 and (14 + 5)/2 = 9.5.',
      ),
      beat(
        'alg-2',
        1,
        'Keep negative signs intact',
        'Wrap negatives in brackets: (−4 + (−3))/2 = −3.5 and (−8 + (−1))/2 = −4.5.',
      ),
    ]),
  ],
}

const L3_P3_WALKTHROUGH: WalkthroughSpec = {
  pageId: 'l3-p3-worked',
  title: 'Equation of the median from C',
  rescueLessonId: 'rescue-solve-b',
  rescueMessage:
    "Finding the slope and solving for b with fractions takes practice, so let's run a quick 3-minute catch-up on solving for b.",
  steps: [
    { id: 's1', stepNum: 1, label: 'Midpoint of AB', equation: 'A(−3, 3), B(2, −5)  →  M(−0.5, −1)' },
    { id: 's2', stepNum: 2, label: 'Line through CM', equation: 'm = 6/11  →  y = (6/11)x − 8/11' },
  ],
  lenses: [
    lens('l3-p3-worked', 'visual', 'Visual', [
      beat(
        'vis-1',
        0,
        'Step 1: Find midpoint M of opposite side AB',
        'A median from vertex C always targets the exact midpoint of opposite side AB at M(−0.5, −1).',
      ),
      beat(
        'vis-2',
        1,
        'Step 2: Connect C(5, 2) to M(−0.5, −1)',
        'Draw the median from C through M. Rise 3 over run 5.5 simplifies cleanly to slope 6/11.',
      ),
    ]),
    lens('l3-p3-worked', 'algebra', 'Algebra', [
      beat(
        'alg-1',
        0,
        'Compute M_AB and slope of CM',
        'Average A and B for M(−0.5, −1), then double rise/run (3 / 5.5) to clear the decimal: m = 6/11.',
      ),
      beat(
        'alg-2',
        1,
        'Sub C(5, 2) into y = (6/11)x + b',
        'Rewrite 2 as 22/11, subtract 30/11 to get b = −8/11, giving y = (6/11)x − 8/11.',
      ),
    ]),
  ],
}

const L4_P2_WALKTHROUGH: WalkthroughSpec = {
  pageId: 'l4-p2-worked',
  title: 'Exact distance & triangle classification',
  rescueLessonId: 'rescue-squares-radicals',
  rescueMessage:
    'Want a quick 3-minute catch-up on squaring negative numbers and keeping exact radicals?',
  steps: [
    { id: 's1', stepNum: 1, label: 'Exact length AB', equation: 'd = √((6−3)² + (9−1)²) = √73' },
    { id: 's2', stepNum: 2, label: 'Classify △DEF', equation: 'DE = EF = √17, DF = √34  →  Right Isosceles' },
  ],
  lenses: [
    lens('l4-p2-worked', 'visual', 'Visual', [
      beat(
        'vis-1',
        0,
        'Build a right triangle under segment AB',
        'Distance is Pythagoras on the grid: Δx = 3, Δy = 8, hypotenuse = √(9 + 64) = √73.',
      ),
      beat(
        'vis-2',
        1,
        'Compare all 3 exact sides of △DEF',
        'DE = √17 and EF = √17 match identically (isosceles), and 17 + 17 = 34 even proves a right angle at E.',
      ),
    ]),
    lens('l4-p2-worked', 'algebra', 'Algebra', [
      beat(
        'alg-1',
        0,
        'Plug into d = √((x₂ − x₁)² + (y₂ − y₁)²)',
        'Subtract coordinates (3 and 8), square them (9 + 64 = 73), and leave √73 exact.',
      ),
      beat(
        'alg-2',
        1,
        'Exact radicals make side comparisons instant',
        'Never round mid-proof: √17 = √17 proves DE = EF with zero rounding error.',
      ),
    ]),
  ],
}

const CURATED_WALKTHROUGHS: Record<string, WalkthroughSpec> = {
  'l1-p3-worked': L1_P3_WALKTHROUGH,
  'l2-p2-worked': L2_P2_WALKTHROUGH,
  'l3-p3-worked': L3_P3_WALKTHROUGH,
  'l4-p2-worked': L4_P2_WALKTHROUGH,
}

function cleanSummary(raw: string, maxLen: number): string {
  const plain = raw.replace(/\*\*/g, '').replace(/\s+/g, ' ').trim()
  if (plain.length <= maxLen) return plain
  const cut = plain.slice(0, maxLen)
  const sp = cut.lastIndexOf(' ')
  return (sp > maxLen * 0.55 ? cut.slice(0, sp) : cut).trim() + '...'
}

export function getWalkthroughForPage(lessonId: string, page: GeoLessonPage): WalkthroughSpec {
  const curated = CURATED_WALKTHROUGHS[page.id]
  if (curated) return curated

  const rescueLessonId = resolveRescueLessonId(lessonId, page.id)

  if (page.kind === 'worked') {
    const steps: WalkthroughStepItem[] = page.steps.map((s, idx) => ({
      id: `st-${idx}`,
      stepNum: idx + 1,
      label: s.heading,
      equation: s.mathLines[0] ?? s.heading,
    }))

    const beats: WalkthroughBeat[] = page.steps.map((s, idx) => ({
      id: `vis-${idx + 1}`,
      stepIndex: idx,
      title: s.heading,
      caption: s.mathLines.join('   ·   '),
      durationSec: 8,
      scene: s.scene,
      mathLines: s.mathLines,
    }))

    return {
      pageId: page.id,
      title: cleanSummary(page.prompt, 62),
      steps,
      lenses: [lens(page.id, 'visual', 'Step-by-step', beats)],
      rescueLessonId,
      rescueMessage:
        'If this step still feels blurry, jump into a 3-minute guided catch-up on the underlying skill first.',
    }
  }

  const hintText =
    'hint' in page && typeof page.hint === 'string' && page.hint
      ? page.hint
      : 'Break the problem into small pieces: identify the coordinates, pick the matching formula, then substitute cleanly.'

  const explanationText =
    'explanation' in page && typeof page.explanation === 'string' && page.explanation
      ? page.explanation
      : hintText

  const fallbackScene = 'scene' in page ? page.scene : undefined

  return {
    pageId: page.id,
    title: 'Walkthrough for this problem',
    steps: [
      { id: 'p1', stepNum: 1, label: 'Spot the strategy', equation: cleanSummary(hintText, 56) },
      { id: 'p2', stepNum: 2, label: 'See the clean move', equation: 'Substitute & check signs' },
    ],
    lenses: [
      lens(page.id, 'visual', 'Walkthrough', [
        {
          id: 'vis-1',
          stepIndex: 0,
          title: 'Start with the key move',
          caption: hintText,
          durationSec: 8,
          scene: fallbackScene,
          mathLines: [hintText],
        },
        {
          id: 'vis-2',
          stepIndex: 1,
          title: 'How the algebra clicks into place',
          caption: explanationText,
          durationSec: 8,
          scene: fallbackScene,
          mathLines: [explanationText],
        },
      ]),
    ],
    rescueLessonId,
    rescueMessage:
      "Still stuck on this step? Let's run a 3-minute catch-up walkthrough on the skill behind it first.",
  }
}
