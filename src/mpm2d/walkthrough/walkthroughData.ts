import type { SemaState } from '../mascot/Sema'
import type { GeoLessonPage } from '../pageTypes'
import type { GeoScene } from '../types'
import { resolveRescueLessonId } from '../data/catchupCourses'

export type WalkthroughCue = {
  /** Normalized beat progress 0..1 when this flight waypoint activates */
  at: number
  /** Sema position as percentage of stage width/height */
  semaX: number
  semaY: number
  /** Normalized direction Sema looks (-1..1, -1..1) */
  lookX: number
  lookY: number
  semaState: SemaState
  tag?: string
}

export type WalkthroughBeatMode =
  | 'l1p3-alg-1'
  | 'l1p3-alg-2'
  | 'l1p3-alg-3'
  | 'l1p3-vis-1'
  | 'l1p3-vis-2'
  | 'l1p3-vis-3'
  | 'generic-step'

export type WalkthroughBeat = {
  id: string
  stepIndex: number
  title: string
  caption: string
  audioPath?: string
  durationSec: number
  mode: WalkthroughBeatMode
  cues: WalkthroughCue[]
  /** Fallback data for generic-step beats */
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
          mode: 'l1p3-vis-1',
          cues: [
            { at: 0.0, semaX: 18, semaY: 22, lookX: 0.7, lookY: 0.5, semaState: 'speaking', tag: 'Plot the line' },
            { at: 0.36, semaX: 64, semaY: 64, lookX: -0.6, lookY: 0.3, semaState: 'guiding', tag: 'Right 1, down 3' },
            { at: 0.74, semaX: 28, semaY: 74, lookX: 0.6, lookY: -0.3, semaState: 'nodding', tag: 'm = −3' },
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
          mode: 'l1p3-vis-2',
          cues: [
            { at: 0.0, semaX: 20, semaY: 24, lookX: 0.5, lookY: 0.6, semaState: 'speaking', tag: 'Rotate +90°' },
            { at: 0.35, semaX: 60, semaY: 32, lookX: -0.6, lookY: 0.6, semaState: 'guiding', tag: '90° right angle' },
            { at: 0.72, semaX: 78, semaY: 66, lookX: -0.7, lookY: -0.2, semaState: 'nodding', tag: 'm⊥ = +1/3' },
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
          mode: 'l1p3-vis-3',
          cues: [
            { at: 0.0, semaX: 22, semaY: 24, lookX: 0.7, lookY: 0.2, semaState: 'speaking', tag: 'Slide to P(6, 1)' },
            { at: 0.42, semaX: 82, semaY: 28, lookX: -0.5, lookY: 0.6, semaState: 'guiding', tag: 'Lock on P(6, 1)' },
            { at: 0.78, semaX: 26, semaY: 72, lookX: 0.6, lookY: -0.2, semaState: 'celebrate', tag: 'b = −1!' },
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
            'Subtract 3x from both sides so +3x moves across as −3x. Now read the slope directly: m = −3.',
          audioPath: '/assets/voice/walkthroughs/l1-p3/alg-1.mp3',
          durationSec: 12.2,
          mode: 'l1p3-alg-1',
          cues: [
            { at: 0.0, semaX: 16, semaY: 26, lookX: 0.8, lookY: 0.4, semaState: 'speaking', tag: 'Spot +3x' },
            { at: 0.3, semaX: 54, semaY: 18, lookX: 0.2, lookY: 0.8, semaState: 'guiding', tag: 'Flip sign across =' },
            { at: 0.7, semaX: 78, semaY: 74, lookX: -0.7, lookY: -0.4, semaState: 'nodding', tag: 'm = −3' },
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
          mode: 'l1p3-alg-2',
          cues: [
            { at: 0.0, semaX: 18, semaY: 36, lookX: 0.8, lookY: 0.2, semaState: 'speaking', tag: 'Write over 1' },
            { at: 0.34, semaX: 76, semaY: 24, lookX: -0.8, lookY: 0.5, semaState: 'guiding', tag: 'Flip 180°!' },
            { at: 0.72, semaX: 80, semaY: 72, lookX: -0.8, lookY: -0.3, semaState: 'nodding', tag: '− becomes +' },
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
          mode: 'l1p3-alg-3',
          cues: [
            { at: 0.0, semaX: 18, semaY: 22, lookX: 0.8, lookY: 0.5, semaState: 'speaking', tag: 'Plug in P(6, 1)' },
            { at: 0.38, semaX: 82, semaY: 32, lookX: -0.8, lookY: 0.3, semaState: 'guiding', tag: '(1/3)(6) = 2' },
            { at: 0.74, semaX: 20, semaY: 76, lookX: 0.8, lookY: -0.2, semaState: 'celebrate', tag: 'y = 1/3 x − 1!' },
          ],
        },
      ],
    },
  ],
}

export function getWalkthroughForPage(
  lessonId: string,
  page: GeoLessonPage,
): WalkthroughSpec | null {
  if (page.id === 'l1-p3-worked') {
    return L1_P3_WALKTHROUGH
  }

  const rescueLessonId = resolveRescueLessonId(lessonId, page.id)

  // Worked pages: build flying-Sema walkthrough directly from their worked steps
  if (page.kind === 'worked') {
    const steps: WalkthroughStepItem[] = page.steps.map((s, i) => ({
      id: `ws-${i}`,
      stepNum: i + 1,
      label: s.heading,
      equation: s.mathLines[0] ?? s.heading,
    }))
    const beats: WalkthroughBeat[] = page.steps.map((s, i) => ({
      id: `wb-${i}`,
      stepIndex: i,
      title: s.heading,
      caption: page.plan[i] ?? s.heading,
      durationSec: 6.5,
      mode: 'generic-step',
      scene: s.scene,
      mathLines: s.mathLines,
      cues: [
        { at: 0.0, semaX: 16, semaY: 24, lookX: 0.8, lookY: 0.4, semaState: 'speaking', tag: `Step ${i + 1}` },
        { at: 0.45, semaX: 82, semaY: 30, lookX: -0.8, lookY: 0.4, semaState: 'guiding', tag: 'Watch the math' },
        { at: 0.8, semaX: 80, semaY: 76, lookX: -0.7, lookY: -0.3, semaState: 'nodding', tag: 'Got it!' },
      ],
    }))
    return {
      pageId: page.id,
      title: 'Guided walkthrough',
      steps,
      lenses: [{ id: 'visual', label: 'Walkthrough', beats }],
      rescueLessonId,
      rescueMessage:
        'Still feeling stuck on this move? We can jump into a quick 3-minute catch-up lesson and bring you right back here.',
    }
  }

  const splitMathLines = (raw?: string): string[] => {
    if (!raw) return []
    const parts = raw
      .split(/\s*(?:;|\n|⇒|→)\s*/)
      .map(s => s.trim())
      .filter(Boolean)
    return parts.length > 0 ? parts : [raw.trim()]
  }

  // Interactive explore labs: guide what to drag and what invariant to discover
  if (page.kind === 'explore') {
    const cleanPrompt = page.prompt.replace(/\*\*/g, '').replace(/\n+/g, ' ').trim()
    const beats: WalkthroughBeat[] = [
      {
        id: `exp-1-${page.id}`,
        stepIndex: 0,
        title: 'What to test in this interactive lab',
        caption: cleanPrompt,
        durationSec: 6.0,
        mode: 'generic-step',
        mathLines: [
          'Drag the handles on the interactive canvas',
          'Watch which geometric value stays invariant as you move',
        ],
        cues: [
          { at: 0.0, semaX: 16, semaY: 24, lookX: 0.8, lookY: 0.4, semaState: 'speaking', tag: 'Explore first' },
          { at: 0.52, semaX: 82, semaY: 36, lookX: -0.8, lookY: 0.3, semaState: 'guiding', tag: 'Spot the pattern' },
          { at: 0.85, semaX: 76, semaY: 72, lookX: -0.7, lookY: -0.3, semaState: 'nodding', tag: 'Lock the rule in' },
        ],
      },
      {
        id: `exp-2-${page.id}`,
        stepIndex: 1,
        title: 'Turn the pattern into a fast strategy',
        caption: 'Before clicking Continue, summarize the rule in one sentence so you can recognize it instantly in practice problems.',
        durationSec: 5.5,
        mode: 'generic-step',
        mathLines: [
          'Notice: What changes when you drag?',
          'Notice: What relationship stays true every time?',
        ],
        cues: [
          { at: 0.0, semaX: 18, semaY: 26, lookX: 0.8, lookY: 0.4, semaState: 'speaking', tag: 'Key takeaway' },
          { at: 0.6, semaX: 80, semaY: 66, lookX: -0.8, lookY: -0.2, semaState: 'nodding', tag: 'Ready for practice' },
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
        mode: 'generic-step',
        scene: page.scene,
        mathLines: [
          `Step ${i + 1}: ${txt}`,
          ...(i > 0 ? [`Builds directly from Step ${i}`] : ['Start from the given coordinates & target']),
        ],
        cues: [
          { at: 0.0, semaX: 16, semaY: 22, lookX: 0.8, lookY: 0.4, semaState: 'speaking', tag: `Move ${i + 1}` },
          { at: 0.5, semaX: 82, semaY: 32, lookX: -0.8, lookY: 0.4, semaState: 'guiding', tag: 'Check dependencies' },
          { at: 0.84, semaX: 78, semaY: 74, lookX: -0.8, lookY: -0.3, semaState: 'nodding', tag: 'Next move unlocked' },
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
      mode: 'generic-step',
      scene: st.solvedScene ?? st.scene,
      mathLines: [
        `Goal: ${st.label}`,
        ...splitMathLines(st.ledgerResult),
      ],
      cues: [
        { at: 0.0, semaX: 16, semaY: 22, lookX: 0.8, lookY: 0.4, semaState: 'speaking', tag: st.label },
        { at: 0.45, semaX: 82, semaY: 28, lookX: -0.8, lookY: 0.4, semaState: 'guiding', tag: 'Focus here' },
        { at: 0.8, semaX: 78, semaY: 74, lookX: -0.8, lookY: -0.3, semaState: 'nodding', tag: st.ledgerResult },
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
        mode: 'generic-step',
        scene: s.scene ?? ('scene' in page ? page.scene : undefined),
        mathLines: mLines.length > 0 ? mLines : [s.text],
        cues: [
          { at: 0.0, semaX: 16, semaY: 24, lookX: 0.8, lookY: 0.4, semaState: 'speaking', tag: `Step ${i + 1}` },
          { at: 0.48, semaX: 82, semaY: 32, lookX: -0.8, lookY: 0.4, semaState: 'guiding', tag: 'Check the math' },
          { at: 0.82, semaX: 78, semaY: 74, lookX: -0.8, lookY: -0.3, semaState: 'nodding', tag: mLines[mLines.length - 1]?.slice(0, 24) ?? 'Locked in' },
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
            mode: 'generic-step',
            scene: fallbackScene,
            mathLines: [
              '1. List the given points or equation',
              '2. Pick the matching Unit 2 formula from your Playbook',
              '3. Substitute carefully and double-check signs',
            ],
            cues: [
              { at: 0.0, semaX: 16, semaY: 24, lookX: 0.8, lookY: 0.4, semaState: 'speaking', tag: 'Start here' },
              { at: 0.5, semaX: 82, semaY: 36, lookX: -0.8, lookY: 0.4, semaState: 'guiding', tag: 'Pick formula' },
              { at: 0.85, semaX: 78, semaY: 74, lookX: -0.8, lookY: -0.3, semaState: 'nodding', tag: 'Check signs' },
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
