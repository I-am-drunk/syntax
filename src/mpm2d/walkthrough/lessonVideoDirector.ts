import { resolveRescueLessonId } from '../data/catchupCourses'
import type { GeoColor, GeoScene } from '../types'
import type { GeoLessonPage } from '../pageTypes'
import type { SemaPromptCue, SemaTrack, WordTiming } from './semaTrackTypes'
import type {
  LiveAlgebraStep,
  LiveMathBeat,
  LiveMathLens,
  LiveMathProgram,
  LiveVisualEffect,
} from './liveMathTypes'

/** Clean human-readable spoken text for subtitles & TTS */
function cleanSpoken(raw: string): string {
  return raw
    .replace(/\*\*/g, '')
    .replace(/`([^`]+)`/g, '$1')
    .replace(/\\frac\{([^}]+)\}\{([^}]+)\}/g, '$1 over $2')
    .replace(/\s+/g, ' ')
    .trim()
}

/** Generate natural word-by-word timestamps across [0.45s, duration - 0.65s] */
export function buildWordTimings(narration: string, durationSec: number): WordTiming[] {
  const clean = cleanSpoken(narration)
  const rawWords = clean.split(/\s+/).filter(Boolean)
  if (!rawWords.length) return []

  const startOffset = 0.45
  const usable = Math.max(1.8, durationSec - 1.1)
  const weights = rawWords.map(w => {
    const base = Math.max(2.5, Math.min(11, w.length * 0.85))
    const pause = /[.!?]$/.test(w) ? 3.8 : /[,;:]$/.test(w) ? 1.8 : 0
    return base + pause
  })
  const totalWeight = weights.reduce((a, b) => a + b, 0) || 1

  let cursor = startOffset
  return rawWords.map((text, idx) => {
    const dur = (weights[idx]! / totalWeight) * usable
    const start = Number(cursor.toFixed(3))
    const end = Number((cursor + Math.max(0.14, dur * 0.92)).toFixed(3))
    cursor += dur
    return { text, start, end }
  })
}

/** Build a SemaTrack directly from a LiveMathBeat so Sema flies, looks at the math, and drives karaoke CC */
export function buildSemaTrackForBeat(beat: LiveMathBeat, lensId: 'visual' | 'algebra'): SemaTrack {
  const dur = Math.max(5, beat.durationSec)
  const words = buildWordTimings(beat.narration, dur)
  const [px, py] = beat.semaPerch ?? (lensId === 'visual' ? [0.11, 0.22] : [0.89, 0.2])
  const [lx, ly] = beat.semaLook ?? [0.5, 0.5]

  const midX = px < 0.5 ? Math.min(0.18, px + 0.03) : Math.max(0.82, px - 0.03)
  const midY = Math.min(0.68, py + 0.16)
  const endY = Math.max(0.18, py + 0.06)

  const keyframes: SemaTrack['keyframes'] = [
    {
      t: 0,
      x: px,
      y: py,
      lookX: lx,
      lookY: ly,
      state: 'speaking',
      expression: 'attentive',
      scale: 0.94,
    },
    {
      t: Number((dur * 0.36).toFixed(2)),
      x: midX,
      y: midY,
      lookX: lx,
      lookY: Math.min(0.76, ly + 0.08),
      state: 'speaking',
      expression: 'curious',
      scale: 0.96,
    },
    {
      t: Number((dur * 0.72).toFixed(2)),
      x: px,
      y: endY,
      lookX: lx,
      lookY: ly,
      state: 'celebrate',
      expression: 'happy',
      scale: 0.98,
    },
    {
      t: dur,
      x: px,
      y: py,
      lookX: lx,
      lookY: ly,
      state: 'idle',
      expression: 'happy',
      scale: 0.94,
    },
  ]

  const prompts: SemaPromptCue[] = [
    {
      start: 0,
      end: dur,
      callout: beat.semaCallout,
      say: beat.title,
      subtitle: cleanSpoken(beat.narration),
      side: px < 0.5 ? 'right' : 'left',
      accent: lensId === 'visual' ? 'teal' : 'blue',
    },
  ]

  return {
    version: 2,
    voice: 'live',
    duration: dur,
    fps: 60,
    aspectRatio: 16 / 9,
    keyframes,
    words,
    prompts,
  }
}

type TopicKind =
  | 'perp-line'
  | 'parallel-line'
  | 'rearrange-slope'
  | 'slope'
  | 'midpoint'
  | 'median'
  | 'length'
  | 'circle'
  | 'right-triangle'
  | 'shortest-distance'
  | 'altitude'
  | 'right-bisector'
  | 'quad-proof'
  | 'chord-centre'
  | 'poi'
  | 'general'

function detectTopic(lessonId: string, page: GeoLessonPage): TopicKind {
  const txt = `${lessonId} ${page.id} ${page.prompt}`.toLowerCase()
  if (txt.includes('shortest distance') || lessonId === 'u2-l6') return 'shortest-distance'
  if (txt.includes('right bisector') || txt.includes('perpendicular bisector')) return 'right-bisector'
  if (txt.includes('altitude')) return 'altitude'
  if (txt.includes('median')) return 'median'
  if (txt.includes('chord') || txt.includes('circumcentre') || lessonId === 'u2-l9') return 'chord-centre'
  if (
    txt.includes('parallelogram') ||
    txt.includes('rhombus') ||
    txt.includes('rectangle') ||
    txt.includes('quadrilateral') ||
    txt.includes('trapezoid') ||
    lessonId === 'u2-l8'
  ) {
    return 'quad-proof'
  }
  if (txt.includes('right triangle') || txt.includes('isosceles') || txt.includes('equilateral') || lessonId === 'u2-l5') {
    return 'right-triangle'
  }
  if (txt.includes('circle') || txt.includes('radius') || txt.includes('x² + y²') || lessonId === 'rescue-radicals') {
    return 'circle'
  }
  if (txt.includes('point of intersection') || txt.includes('poi') || lessonId === 'rescue-poi') return 'poi'
  if (txt.includes('perpendicular') || txt.includes('negative reciprocal')) return 'perp-line'
  if (txt.includes('parallel')) return 'parallel-line'
  if (txt.includes('isolate y') || txt.includes('standard form') || lessonId === 'rescue-isolate-y') {
    return 'rearrange-slope'
  }
  if (txt.includes('midpoint') || lessonId === 'u2-l2') return 'midpoint'
  if (txt.includes('length') || txt.includes('distance') || lessonId === 'u2-l4') return 'length'
  if (txt.includes('slope') || lessonId === 'rescue-slope' || lessonId === 'u2-l1') return 'slope'
  return 'general'
}

export function inferRescueLessonId(lessonId: string, page: GeoLessonPage): string {
  return resolveRescueLessonId(lessonId, page.id)
}

/** Extract a strictly NON-SPOILER initial scene for Guided Hint Videos */
function getNonSpoilerScene(page: GeoLessonPage): GeoScene | undefined {
  if (page.kind === 'worked') {
    return page.preScene ?? page.steps[0]?.preScene ?? stripAnswerFromScene(page.steps[0]?.scene)
  }
  if (page.kind === 'math-input') return page.scene
  if (page.kind === 'choice') return page.scene
  if (page.kind === 'multi-choice') return page.scene
  if (page.kind === 'plan-order') return page.scene
  if (page.kind === 'multi-step') return page.steps[0]?.scene
  if (page.kind === 'read-plan') return page.blindScene ? undefined : page.planSteps[0]?.scene
  return undefined
}

/** Fallback strip if a worked step has no explicit preScene */
function stripAnswerFromScene(scene?: GeoScene): GeoScene | undefined {
  if (!scene) return undefined
  return {
    ...scene,
    // Keep only points & blue/muted givens; hide green/teal solution lines
    lines: scene.lines?.filter(l => l.color !== 'green' && l.color !== 'teal'),
    segments: scene.segments?.filter(s => s.color !== 'green' && !s.dashed),
    rightAngles: undefined,
  }
}

/** Extract the fullest solved scene for Full Solution Videos */
function getSolvedScene(page: GeoLessonPage): GeoScene | undefined {
  if (page.kind === 'worked') return page.steps[page.steps.length - 1]?.scene
  if (page.kind === 'math-input') return page.solvedScene ?? page.explanation.steps[page.explanation.steps.length - 1]?.scene ?? page.scene
  if (page.kind === 'choice') return page.solvedScene ?? page.explanation.steps[page.explanation.steps.length - 1]?.scene ?? page.scene
  if (page.kind === 'multi-choice') return page.explanation.steps[page.explanation.steps.length - 1]?.scene ?? page.scene
  if (page.kind === 'multi-step') return page.steps[page.steps.length - 1]?.solvedScene ?? page.steps[page.steps.length - 1]?.scene
  if (page.kind === 'plan-order') return page.explanation.steps[page.explanation.steps.length - 1]?.scene ?? page.scene
  if (page.kind === 'read-plan') return page.explanation.steps[page.explanation.steps.length - 1]?.scene ?? page.planSteps[page.planSteps.length - 1]?.scene
  return undefined
}

/** Infer animated visual effects automatically from scene geometry */
function inferVisualEffects(scene?: GeoScene, options?: { hideAnswer?: boolean; topic?: TopicKind }): LiveVisualEffect[] {
  if (!scene) return []
  const effects: LiveVisualEffect[] = []
  const hideAnswer = Boolean(options?.hideAnswer)
  const topic = options?.topic

  const pts = scene.points ?? []
  const segs = scene.segments ?? []
  const circles = scene.circles ?? []
  const riseRuns = scene.riseRuns ?? []
  const rightAngles = scene.rightAngles ?? []

  if (riseRuns.length > 0) {
    const rr = riseRuns[0]!
    const dx = rr.to[0] - rr.from[0]
    const dy = rr.to[1] - rr.from[1]
    effects.push({
      kind: 'rise-run',
      from: rr.from,
      to: rr.to,
      color: rr.color ?? 'amber',
      runLabel: hideAnswer ? 'run = Δx' : `run ${dx >= 0 ? '+' : ''}${Number(dx.toFixed(2))}`,
      riseLabel: hideAnswer ? 'rise = Δy' : `rise ${dy >= 0 ? '+' : ''}${Number(dy.toFixed(2))}`,
      startFrac: 0.12,
      endFrac: 0.78,
    })
  }

  if (circles.length > 0 && !hideAnswer) {
    const c = circles[0]!
    effects.push({
      kind: 'circle-sweep',
      cx: c.cx,
      cy: c.cy,
      r: c.r,
      color: c.color ?? 'teal',
      radiusLabel: c.label ?? `r = ${Number(c.r.toFixed(2))}`,
      startFrac: 0.14,
      endFrac: 0.82,
    })
  }

  if ((topic === 'midpoint' || topic === 'median') && pts.length >= 2) {
    const a = pts[0]!
    const b = pts[1]!
    effects.push({
      kind: 'midpoint-converge',
      a: [a.x, a.y],
      b: [b.x, b.y],
      color: 'teal',
      hideAnswer,
      startFrac: 0.16,
      endFrac: 0.84,
    })
  } else if ((topic === 'length' || topic === 'right-triangle') && pts.length >= 2) {
    const a = pts[0]!
    const b = pts[1]!
    const dx = Math.abs(b.x - a.x)
    const dy = Math.abs(b.y - a.y)
    if (dx > 0.01 && dy > 0.01) {
      effects.push({
        kind: 'pythagoras-legs',
        a: [a.x, a.y],
        b: [b.x, b.y],
        color: 'amber',
        dxLabel: hideAnswer ? 'Δx = ?' : `Δx = ${Number(dx.toFixed(2))}`,
        dyLabel: hideAnswer ? 'Δy = ?' : `Δy = ${Number(dy.toFixed(2))}`,
        hypLabel: hideAnswer ? 'd = ?' : `d = √${Number((dx * dx + dy * dy).toFixed(1))}`,
        hideAnswer,
        startFrac: 0.15,
        endFrac: 0.85,
      })
    }
  } else if (rightAngles.length > 0 && !hideAnswer) {
    const ra = rightAngles[0]!
    effects.push({
      kind: 'rotate-90',
      pivot: ra.vertex,
      fromDir: ra.dir1,
      angleDeg: 90,
      color: 'green',
      startFrac: 0.18,
      endFrac: 0.76,
    })
  } else if ((topic === 'poi' || topic === 'shortest-distance') && !hideAnswer) {
    const poiPt = pts.find(p => p.emphasis || /poi|i|h|p|c/i.test(p.label ?? ''))
    if (poiPt) {
      effects.push({
        kind: 'poi-pulse',
        point: [poiPt.x, poiPt.y],
        label: poiPt.label,
        color: poiPt.color ?? 'green',
        startFrac: 0.35,
        endFrac: 0.9,
      })
    }
  } else if (segs.length > 0 && riseRuns.length === 0 && topic === 'slope') {
    const s = segs[0]!
    const dx = s.to[0] - s.from[0]
    const dy = s.to[1] - s.from[1]
    if (Math.abs(dx) > 0.01 && Math.abs(dy) > 0.01) {
      effects.push({
        kind: 'rise-run',
        from: s.from,
        to: s.to,
        color: 'amber',
        runLabel: hideAnswer ? 'run = x₂ − x₁' : `run ${dx >= 0 ? '+' : ''}${Number(dx.toFixed(2))}`,
        riseLabel: hideAnswer ? 'rise = y₂ − y₁' : `rise ${dy >= 0 ? '+' : ''}${Number(dy.toFixed(2))}`,
        startFrac: 0.15,
        endFrac: 0.82,
      })
    }
  } else if (pts.length > 0) {
    const focus = pts.find(p => p.emphasis) ?? pts[0]!
    effects.push({
      kind: 'highlight-point',
      point: [focus.x, focus.y],
      label: focus.label,
      color: focus.color ?? 'teal',
      startFrac: 0.15,
      endFrac: 0.78,
    })
  }

  return effects
}

/** Curated studio-grade programs for signature Unit 2 problems */
function buildCuratedSolution(pageId: string): LiveMathProgram | null {
  if (pageId === 'l1-p3-worked') {
    const baseScene: GeoScene = {
      xMin: -6,
      xMax: 8,
      yMin: -6,
      yMax: 5,
      showGrid: true,
      showAxisNumbers: true,
      lines: [{ a: 3, b: 1, c: 3, color: 'blue', label: '3x + y = −3' }],
      points: [{ id: 'p', x: 6, y: 1, label: 'P(6, 1)', showCoords: true, color: 'amber', emphasis: true }],
    }
    const solvedScene: GeoScene = {
      ...baseScene,
      lines: [
        { a: 3, b: 1, c: 3, color: 'blue', dim: true, label: 'y = −3x − 3' },
        { a: 1, b: -3, c: -3, color: 'green', label: 'y = 1/3 x − 1' },
      ],
      rightAngles: [{ vertex: [-0.6, -1.2], dir1: [1, -3], dir2: [3, 1], color: 'green' }],
    }

    const visualBeats: LiveMathBeat[] = [
      {
        id: 'vis-1',
        stepIndex: 0,
        title: 'Read the slope of 3x + y = −3',
        badge: 'Step 1 · Given Slope',
        summaryMath: 'm₁ = −3',
        narration:
          'First, trace along the blue line 3x plus y equals negative 3. Every 1 unit you run right, the line drops 3 units down, so its slope is negative 3.',
        semaCallout: 'Run +1, drop −3',
        semaPerch: [0.12, 0.22],
        semaLook: [0.44, 0.5],
        durationSec: 9.0,
        scene: baseScene,
        visualEffects: [
          {
            kind: 'rise-run',
            from: [-1, 0],
            to: [0, -3],
            color: 'amber',
            runLabel: 'run +1',
            riseLabel: 'rise −3',
            startFrac: 0.14,
            endFrac: 0.8,
          },
        ],
      },
      {
        id: 'vis-2',
        stepIndex: 1,
        title: 'Rotate 90° to get the perpendicular slope',
        badge: 'Step 2 · 90° Turn',
        summaryMath: 'm⊥ = +1/3',
        narration:
          'Now rotate that direction a full 90 degrees! The drop of 3 and run of 1 trade places and flip sign, giving a gentle upward slope of positive 1 over 3.',
        semaCallout: 'Turn 90°!',
        semaPerch: [0.12, 0.24],
        semaLook: [0.46, 0.56],
        durationSec: 10.0,
        scene: baseScene,
        visualEffects: [
          {
            kind: 'rotate-90',
            pivot: [-0.6, -1.2],
            fromDir: [1, -3],
            angleDeg: 90,
            length: 5.0,
            fromLabel: 'm₁ = −3/1',
            toLabel: 'm⊥ = +1/3',
            color: 'green',
            startFrac: 0.14,
            endFrac: 0.82,
          },
        ],
      },
      {
        id: 'vis-3',
        stepIndex: 2,
        title: 'Slide the green line until it locks on P(6, 1)',
        badge: 'Step 3 · Lock on P',
        summaryMath: 'y = 1/3 x − 1',
        narration:
          'Finally, slide that green perpendicular line parallel to itself until it locks directly onto point P at 6, 1. Look at the y-axis: it crosses cleanly at b equals negative 1!',
        semaCallout: 'Lock on P(6, 1)',
        semaPerch: [0.12, 0.2],
        semaLook: [0.74, 0.44],
        durationSec: 10.5,
        scene: baseScene,
        revealScene: solvedScene,
        visualEffects: [
          {
            kind: 'slide-line',
            a: 1,
            b: -3,
            cFrom: 6,
            cTo: -3,
            targetPoint: [6, 1],
            targetLabel: 'P(6, 1)',
            lineLabel: 'y = 1/3 x − 1',
            color: 'green',
            startFrac: 0.12,
            endFrac: 0.76,
          },
          {
            kind: 'poi-pulse',
            point: [0, -1],
            label: 'b = −1',
            color: 'violet',
            startFrac: 0.72,
            endFrac: 0.96,
          },
        ],
      },
    ]

    const algebraBeats: LiveMathBeat[] = [
      {
        id: 'alg-1',
        stepIndex: 0,
        title: 'Isolate y to uncover slope m₁',
        badge: 'Step 1 · Isolate y',
        summaryMath: 'm₁ = −3',
        narration:
          'Start with 3x plus y equals negative 3. Jump positive 3x across the equals sign so it flips to negative 3x, leaving y equals negative 3x minus 3. The slope is negative 3.',
        semaCallout: 'Jump +3x across =',
        semaPerch: [0.89, 0.2],
        semaLook: [0.46, 0.48],
        durationSec: 10.5,
        givenChips: [
          { label: 'Line: 3x + y = −3', color: 'blue' },
          { label: 'Point: P(6, 1)', color: 'amber' },
        ],
        algebraSteps: [
          {
            kind: 'parabolic-jump',
            tag: 'Move +3x across =',
            leftFixed: 'y',
            movingTerm: '+ 3x',
            landedTerm: '− 3x',
            rightFixed: '− 3',
            accent: 'amber',
            note: 'Crossing = flips +3x into −3x',
            startFrac: 0.08,
            endFrac: 0.56,
          },
          {
            kind: 'result-pill',
            tag: 'Given slope',
            math: 'y = −3x − 3   →   m₁ = −3/1',
            accent: 'blue',
            note: 'Write whole numbers over 1 before flipping!',
            startFrac: 0.58,
            endFrac: 0.96,
          },
        ],
      },
      {
        id: 'alg-2',
        stepIndex: 1,
        title: 'Negative reciprocal: flip fraction & flip sign',
        badge: 'Step 2 · Flip & Negate',
        summaryMath: 'm⊥ = +1/3',
        narration:
          'Write negative 3 as negative 3 over 1. Now orbit the 3 and 1 around the fraction bar while spinning the negative sign into a positive sign, giving positive 1 third.',
        semaCallout: 'Flip & negate!',
        semaPerch: [0.89, 0.22],
        semaLook: [0.48, 0.5],
        durationSec: 10.0,
        givenChips: [{ label: 'm₁ = −3/1', color: 'blue' }],
        algebraSteps: [
          {
            kind: 'orbital-flip',
            tag: 'Negative reciprocal rule',
            fromSign: '-',
            fromNum: '3',
            fromDen: '1',
            toSign: '+',
            toNum: '1',
            toDen: '3',
            leftLabel: 'm₁',
            rightLabel: 'm⊥',
            note: '1) Flip 3/1 to 1/3   2) Flip − to +',
            startFrac: 0.12,
            endFrac: 0.78,
          },
          {
            kind: 'result-pill',
            tag: 'Perpendicular slope',
            math: 'm⊥ = 1/3',
            accent: 'green',
            startFrac: 0.78,
            endFrac: 0.96,
          },
        ],
      },
      {
        id: 'alg-3',
        stepIndex: 2,
        title: 'Substitute P(6, 1) to solve for b',
        badge: 'Step 3 · Find b',
        summaryMath: 'y = 1/3 x − 1',
        narration:
          'Drop m equals 1 third, x equals 6, and y equals 1 into y equals mx plus b. One third of 6 is 2, and subtracting 2 from 1 gives b equals negative 1.',
        semaCallout: 'Drop in P(6, 1)',
        semaPerch: [0.89, 0.19],
        semaLook: [0.46, 0.56],
        durationSec: 11.5,
        givenChips: [
          { label: 'm⊥ = 1/3', color: 'green' },
          { label: 'x = 6', color: 'amber' },
          { label: 'y = 1', color: 'violet' },
        ],
        algebraSteps: [
          {
            kind: 'substitute-drop',
            tag: 'Plug into y = mx + b',
            givens: [
              { label: 'm', value: '1/3', color: 'green' },
              { label: 'x', value: '6', color: 'amber' },
              { label: 'y', value: '1', color: 'violet' },
            ],
            template: 'y = m · x + b',
            substituted: '1 = (1/3)(6) + b',
            simplified: '1 = 2 + b   →   b = −1',
            startFrac: 0.08,
            endFrac: 0.68,
          },
          {
            kind: 'result-pill',
            tag: 'Final perpendicular line',
            math: 'y = 1/3 x − 1',
            accent: 'green',
            startFrac: 0.7,
            endFrac: 0.98,
          },
        ],
      },
    ]

    return {
      pageId,
      mode: 'solution',
      title: 'Perpendicular line through P(6, 1)',
      subtitle: 'Real-time Visual & Kinetic Algebra Walkthrough',
      lenses: [
        {
          id: 'visual',
          label: 'Visual',
          subtitle: 'Watch the line rotate 90° and slide onto P(6, 1)',
          beats: visualBeats,
        },
        {
          id: 'algebra',
          label: 'Algebra',
          subtitle: 'Watch +3x jump across = and −3/1 orbit-flip to +1/3',
          beats: algebraBeats,
        },
      ],
      rescueLessonId: 'rescue-isolate-y',
      rescueMessage:
        'Need a quick refresher on rearranging Ax + By = C into y = mx + b? Run this 3-minute catch-up first.',
    }
  }

  if (pageId === 'l6-p2-worked') {
    const baseScene: GeoScene = {
      xMin: -2,
      xMax: 8,
      yMin: -8,
      yMax: 3,
      showGrid: true,
      showAxisNumbers: true,
      lines: [{ a: 2, b: -1, c: -10, color: 'blue', label: 'y = 2x − 10' }],
      points: [{ id: 'o', x: 0, y: 0, label: 'O(0, 0)', showCoords: true, color: 'amber', emphasis: true }],
    }
    const solvedScene: GeoScene = {
      ...baseScene,
      lines: [
        { a: 2, b: -1, c: -10, color: 'blue', label: 'y = 2x − 10' },
        { a: 1, b: 2, c: 0, color: 'teal', dashed: true, label: 'y = −1/2 x' },
      ],
      segments: [{ from: [0, 0], to: [4, -2], color: 'green', width: 3.5, label: 'd = √20' }],
      rightAngles: [{ vertex: [4, -2], dir1: [-4, 2], dir2: [1, 2], color: 'green' }],
      points: [
        { id: 'o', x: 0, y: 0, label: 'O(0, 0)', color: 'amber' },
        { id: 'poi', x: 4, y: -2, label: 'POI(4, −2)', color: 'green', emphasis: true },
      ],
    }

    return {
      pageId,
      mode: 'solution',
      title: 'Shortest distance from O(0, 0) to y = 2x − 10',
      subtitle: 'Real-time 4-Step Shortest Distance Choreography',
      lenses: [
        {
          id: 'visual',
          label: 'Visual',
          subtitle: 'Watch the 90° drop lock onto POI(4, −2) and measure √20',
          beats: [
            {
              id: 'l6-vis-1',
              stepIndex: 0,
              title: 'Rotate 90° to get the perpendicular drop',
              badge: 'Step 1 · 90° Slope',
              summaryMath: 'm⊥ = −1/2',
              narration:
                'The blue line has slope 2. Rotate 90 degrees to find the perpendicular drop direction: slope negative 1 over 2, passing straight through the origin.',
              semaCallout: 'Drop at 90°',
              semaPerch: [0.12, 0.22],
              semaLook: [0.56, 0.56],
              durationSec: 9.5,
              scene: baseScene,
              visualEffects: [
                {
                  kind: 'rotate-90',
                  pivot: [4, -2],
                  fromDir: [1, 2],
                  angleDeg: 90,
                  length: 4.8,
                  fromLabel: 'm = 2',
                  toLabel: 'm⊥ = −1/2',
                  color: 'teal',
                  startFrac: 0.14,
                  endFrac: 0.84,
                },
              ],
            },
            {
              id: 'l6-vis-2',
              stepIndex: 1,
              title: 'Find the Point of Intersection (4, −2)',
              badge: 'Step 2 · Solve POI',
              summaryMath: 'POI = (4, −2)',
              narration:
                'Where the perpendicular drop hits the blue line is the closest point on the entire line: POI at 4, negative 2.',
              semaCallout: 'Hit POI(4, −2)',
              semaPerch: [0.12, 0.22],
              semaLook: [0.6, 0.62],
              durationSec: 8.5,
              scene: baseScene,
              revealScene: solvedScene,
              visualEffects: [
                {
                  kind: 'poi-pulse',
                  point: [4, -2],
                  label: 'POI(4, −2)',
                  color: 'green',
                  startFrac: 0.22,
                  endFrac: 0.9,
                },
              ],
            },
            {
              id: 'l6-vis-3',
              stepIndex: 2,
              title: 'Measure the exact length from O(0, 0) to (4, −2)',
              badge: 'Step 3 · Distance',
              summaryMath: 'd = √20 ≈ 4.5',
              narration:
                'Finally, build the right triangle from 0, 0 to 4, negative 2. Four squared plus negative 2 squared gives 16 plus 4 equals 20, so the exact shortest distance is square root of 20.',
              semaCallout: 'Pythagoras!',
              semaPerch: [0.12, 0.22],
              semaLook: [0.5, 0.5],
              durationSec: 10.0,
              scene: solvedScene,
              visualEffects: [
                {
                  kind: 'pythagoras-legs',
                  a: [0, 0],
                  b: [4, -2],
                  color: 'amber',
                  dxLabel: 'Δx = 4',
                  dyLabel: 'Δy = −2',
                  hypLabel: 'd = √20',
                  startFrac: 0.14,
                  endFrac: 0.88,
                },
              ],
            },
          ],
        },
        {
          id: 'algebra',
          label: 'Algebra',
          subtitle: 'Orbital flip, substitution, POI, and exact radical length',
          beats: [
            {
              id: 'l6-alg-1',
              stepIndex: 0,
              title: 'Flip & negate slope m = 2',
              badge: 'Step 1 · m⊥',
              summaryMath: 'y = −1/2 x',
              narration:
                'Write slope 2 as 2 over 1. Orbit-flip top and bottom and flip the sign to get negative 1 half. Since it passes through the origin, b is 0, giving y equals negative 1 half x.',
              semaCallout: 'Flip 2/1 → −1/2',
              semaPerch: [0.89, 0.2],
              semaLook: [0.46, 0.5],
              durationSec: 10.0,
              algebraSteps: [
                {
                  kind: 'orbital-flip',
                  tag: 'Perpendicular slope',
                  fromSign: '+',
                  fromNum: '2',
                  fromDen: '1',
                  toSign: '-',
                  toNum: '1',
                  toDen: '2',
                  leftLabel: 'm',
                  rightLabel: 'm⊥',
                  note: 'Through O(0, 0) means b = 0',
                  startFrac: 0.1,
                  endFrac: 0.68,
                },
                {
                  kind: 'result-pill',
                  tag: 'Perpendicular line',
                  math: 'y = −1/2 x',
                  accent: 'teal',
                  startFrac: 0.7,
                  endFrac: 0.96,
                },
              ],
            },
            {
              id: 'l6-alg-2',
              stepIndex: 1,
              title: 'Set lines equal to find POI',
              badge: 'Step 2 · POI',
              summaryMath: 'POI = (4, −2)',
              narration:
                'Set 2x minus 10 equal to negative 1 half x. Multiply every term by 2 to clear fractions cleanly: 4x minus 20 equals negative x, so 5x equals 20, x equals 4, and y equals negative 2.',
              semaCallout: 'Clear fractions!',
              semaPerch: [0.89, 0.2],
              semaLook: [0.46, 0.52],
              durationSec: 11.0,
              algebraSteps: [
                {
                  kind: 'write',
                  tag: 'Set y₁ = y₂',
                  math: '2x − 10 = −1/2 x   (×2)   →   4x − 20 = −x',
                  accent: 'blue',
                  startFrac: 0.08,
                  endFrac: 0.48,
                },
                {
                  kind: 'divide-all',
                  tag: 'Solve for x and y',
                  before: '5x = 20',
                  divisor: '5',
                  after: 'x = 4,   y = −1/2 (4) = −2',
                  accent: 'teal',
                  startFrac: 0.48,
                  endFrac: 0.8,
                },
                {
                  kind: 'result-pill',
                  tag: 'Foot of perpendicular',
                  math: 'POI = (4, −2)',
                  accent: 'green',
                  startFrac: 0.8,
                  endFrac: 0.98,
                },
              ],
            },
            {
              id: 'l6-alg-3',
              stepIndex: 2,
              title: 'Compute exact length d(O, POI)',
              badge: 'Step 3 · Length',
              summaryMath: 'd = √20 ≈ 4.5',
              narration:
                'Plug 0, 0 and 4, negative 2 into the distance formula. Four squared is 16 and negative 2 squared is positive 4. Add them to get exact length square root of 20.',
              semaCallout: 'Exact √20!',
              semaPerch: [0.89, 0.2],
              semaLook: [0.46, 0.54],
              durationSec: 10.5,
              algebraSteps: [
                {
                  kind: 'substitute-drop',
                  tag: 'Distance formula',
                  givens: [
                    { label: 'Δx', value: '4 − 0 = 4', color: 'amber' },
                    { label: 'Δy', value: '−2 − 0 = −2', color: 'violet' },
                  ],
                  template: 'd = √((Δx)² + (Δy)²)',
                  substituted: 'd = √(4² + (−2)²)',
                  simplified: 'd = √(16 + 4) = √20',
                  startFrac: 0.08,
                  endFrac: 0.72,
                },
                {
                  kind: 'result-pill',
                  tag: 'Shortest distance',
                  math: 'd = √20 ≈ 4.5 units',
                  accent: 'green',
                  startFrac: 0.72,
                  endFrac: 0.98,
                },
              ],
            },
          ],
        },
      ],
      rescueLessonId: 'rescue-linear-systems',
      rescueMessage: 'Need a quick refresher on solving linear systems (POI)? Try this 4-minute catch-up.',
    }
  }

  if (pageId === 'l7-p3-worked') {
    const baseScene: GeoScene = {
      xMin: -5,
      xMax: 7,
      yMin: -2,
      yMax: 6,
      showGrid: true,
      showAxisNumbers: true,
      segments: [{ from: [-3, 4], to: [5, 0], color: 'blue' }],
      points: [
        { id: 'a', x: -3, y: 4, label: 'A(−3, 4)', color: 'blue' },
        { id: 'b', x: 5, y: 0, label: 'B(5, 0)', color: 'blue' },
      ],
    }
    const solvedScene: GeoScene = {
      ...baseScene,
      lines: [{ a: 2, b: -1, c: 0, color: 'green', label: 'y = 2x' }],
      rightAngles: [{ vertex: [1, 2], dir1: [2, -1], dir2: [1, 2], color: 'green' }],
      points: [
        { id: 'a', x: -3, y: 4, label: 'A(−3, 4)', color: 'blue' },
        { id: 'b', x: 5, y: 0, label: 'B(5, 0)', color: 'blue' },
        { id: 'm', x: 1, y: 2, label: 'M(1, 2)', color: 'teal', emphasis: true },
      ],
    }

    return {
      pageId,
      mode: 'solution',
      title: 'Right bisector of segment AB',
      subtitle: 'Midpoint convergence + 90° rotation + kinetic algebra',
      lenses: [
        {
          id: 'visual',
          label: 'Visual',
          subtitle: 'Watch A and B converge to M(1, 2) and rotate 90°',
          beats: [
            {
              id: 'l7-vis-1',
              stepIndex: 0,
              title: 'Converge from A and B to midpoint M(1, 2)',
              badge: 'Step 1 · Midpoint',
              summaryMath: 'M = (1, 2)',
              narration:
                'First, slide inward equally from A at negative 3, 4 and B at 5, 0. They meet right in the middle at midpoint M at 1, 2.',
              semaCallout: 'Find midpoint M',
              semaPerch: [0.12, 0.22],
              semaLook: [0.5, 0.5],
              durationSec: 8.5,
              scene: baseScene,
              visualEffects: [
                {
                  kind: 'midpoint-converge',
                  a: [-3, 4],
                  b: [5, 0],
                  color: 'teal',
                  label: 'M(1, 2)',
                  startFrac: 0.14,
                  endFrac: 0.86,
                },
              ],
            },
            {
              id: 'l7-vis-2',
              stepIndex: 1,
              title: 'Rotate 90° around M(1, 2) to form y = 2x',
              badge: 'Step 2 · 90° Bisector',
              summaryMath: 'y = 2x',
              narration:
                'Segment AB slopes down at negative 1 half. Rotate 90 degrees around midpoint M to swing up to slope positive 2. Notice that the right bisector passes straight through the origin: y equals 2x!',
              semaCallout: '90° at M(1, 2)!',
              semaPerch: [0.12, 0.22],
              semaLook: [0.52, 0.48],
              durationSec: 10.0,
              scene: baseScene,
              revealScene: solvedScene,
              visualEffects: [
                {
                  kind: 'rotate-90',
                  pivot: [1, 2],
                  fromDir: [2, -1],
                  angleDeg: 90,
                  length: 4.4,
                  fromLabel: 'm = −1/2',
                  toLabel: 'm⊥ = +2',
                  color: 'green',
                  startFrac: 0.14,
                  endFrac: 0.84,
                },
              ],
            },
          ],
        },
        {
          id: 'algebra',
          label: 'Algebra',
          subtitle: 'Midpoint average, orbital flip, and subbing M(1, 2)',
          beats: [
            {
              id: 'l7-alg-1',
              stepIndex: 0,
              title: 'Average coordinates & flip the slope',
              badge: 'Step 1 · M & m⊥',
              summaryMath: 'M(1, 2),  m⊥ = 2',
              narration:
                'Average the x and y coordinates to get M equals 1, 2. The slope of AB is negative 1 over 2, so orbit-flipping and switching the sign gives perpendicular slope positive 2.',
              semaCallout: 'M + flip slope',
              semaPerch: [0.89, 0.2],
              semaLook: [0.46, 0.5],
              durationSec: 10.5,
              algebraSteps: [
                {
                  kind: 'write',
                  tag: 'Midpoint of AB',
                  math: 'M = ((−3 + 5)/2 , (4 + 0)/2) = (1, 2)',
                  accent: 'teal',
                  startFrac: 0.08,
                  endFrac: 0.42,
                },
                {
                  kind: 'orbital-flip',
                  tag: 'Perpendicular slope from m_AB = −1/2',
                  fromSign: '-',
                  fromNum: '1',
                  fromDen: '2',
                  toSign: '+',
                  toNum: '2',
                  toDen: '1',
                  leftLabel: 'm_AB',
                  rightLabel: 'm⊥',
                  note: 'm⊥ = +2/1 = 2',
                  startFrac: 0.44,
                  endFrac: 0.94,
                },
              ],
            },
            {
              id: 'l7-alg-2',
              stepIndex: 1,
              title: 'Substitute midpoint M(1, 2) into y = mx + b',
              badge: 'Step 2 · Find b',
              summaryMath: 'y = 2x',
              narration:
                'Always plug the midpoint M, never an endpoint! Dropping m equals 2, x equals 1, and y equals 2 gives 2 equals 2 plus b, so b equals 0 and the right bisector is y equals 2x.',
              semaCallout: 'Use M(1, 2)!',
              semaPerch: [0.89, 0.2],
              semaLook: [0.46, 0.52],
              durationSec: 10.0,
              algebraSteps: [
                {
                  kind: 'substitute-drop',
                  tag: 'Sub M(1, 2) & m⊥ = 2',
                  givens: [
                    { label: 'm⊥', value: '2', color: 'green' },
                    { label: 'x', value: '1', color: 'teal' },
                    { label: 'y', value: '2', color: 'violet' },
                  ],
                  template: 'y = m⊥ · x + b',
                  substituted: '2 = 2(1) + b',
                  simplified: 'b = 0',
                  startFrac: 0.08,
                  endFrac: 0.68,
                },
                {
                  kind: 'result-pill',
                  tag: 'Right bisector equation',
                  math: 'y = 2x',
                  accent: 'green',
                  startFrac: 0.7,
                  endFrac: 0.98,
                },
              ],
            },
          ],
        },
      ],
      rescueLessonId: 'rescue-geo-vocab',
      rescueMessage: 'Mixing up medians, altitudes, and right bisectors? Run this 3-minute mental model catch-up.',
    }
  }

  return null
}

type HintBlueprint = {
  formulaTag: string
  formulaMath: string
  firstMoveTag: string
  firstMoveMath: string
  trapNote: string
  narration1: string
  narration2: string
  callout1: string
  callout2: string
  algebraExtra?: LiveAlgebraStep
}

function getTopicHintBlueprint(topic: TopicKind, page: GeoLessonPage): HintBlueprint {
  const customNudge =
    page.kind === 'math-input' && page.nudge
      ? page.nudge
      : page.kind === 'multi-step' && page.steps[0]?.nudge
        ? page.steps[0].nudge
        : undefined

  switch (topic) {
    case 'perp-line':
      return {
        formulaTag: 'Perpendicular slope rule',
        formulaMath: 'm⊥ = −1 / m₁',
        firstMoveTag: 'Step 1 · Find m₁, then flip & negate',
        firstMoveMath: 'y = m⊥ x + b   (plug in given point to solve for b)',
        trapNote: customNudge ?? 'Trap check: remember to do BOTH moves: flip the fraction AND change the sign!',
        narration1:
          'Look at the given information first. Identify the starting line or slope, and note the exact point your new line must pass through.',
        narration2:
          'Perpendicular lines meet at 90 degrees, so flip the fraction and switch its sign to get the perpendicular slope. Then plug your point into y equals mx plus b to solve for b.',
        callout1: 'Spot the givens',
        callout2: 'Flip & negate!',
        algebraExtra: {
          kind: 'orbital-flip',
          tag: 'Negative reciprocal motion',
          fromSign: '+',
          fromNum: 'a',
          fromDen: 'b',
          toSign: '-',
          toNum: 'b',
          toDen: 'a',
          leftLabel: 'm₁',
          rightLabel: 'm⊥',
          note: 'Flip top & bottom, AND switch the sign',
          startFrac: 0.14,
          endFrac: 0.65,
        },
      }
    case 'parallel-line':
      return {
        formulaTag: 'Parallel slope rule',
        formulaMath: 'm∥ = m₁',
        firstMoveTag: 'Keep the exact same slope, solve for new b',
        firstMoveMath: 'y = m₁ x + b   (substitute the given point)',
        trapNote: customNudge ?? 'Trap check: parallel lines keep the SAME slope. Do NOT flip or negate it!',
        narration1:
          'First, identify the given line and the point your parallel line must pass through. Parallel lines never cross because they share the exact same tilt.',
        narration2:
          'Keep the exact same slope m, then substitute the x and y coordinates of the given point into y equals mx plus b to find your new y-intercept b.',
        callout1: 'Same tilt!',
        callout2: 'Keep m, find b',
      }
    case 'rearrange-slope':
      return {
        formulaTag: 'Slope-intercept target',
        formulaMath: 'y = mx + b',
        firstMoveTag: 'Move the x-term across =, then divide by y’s coefficient',
        firstMoveMath: 'By = −Ax + C   →   y = (−A/B)x + C/B',
        trapNote: customNudge ?? 'Trap check: moving a term across = flips its sign, and divide EVERY term by the number in front of y.',
        narration1:
          'Your goal is to get y completely alone on the left side so the equation matches y equals mx plus b.',
        narration2:
          'First jump the x-term across the equals sign and flip its sign. Next, divide every single term on the right side by the coefficient of y.',
        callout1: 'Isolate y',
        callout2: 'Jump & divide',
      }
    case 'slope':
      return {
        formulaTag: 'Slope formula',
        formulaMath: 'm = (y₂ − y₁) / (x₂ − x₁)',
        firstMoveTag: 'Rise (vertical change) over Run (horizontal change)',
        firstMoveMath: 'm = rise / run = (? − ?) / (? − ?)',
        trapNote: customNudge ?? 'Trap check: y goes on TOP, x goes on BOTTOM, and subtract both points in the same order!',
        narration1:
          'Trace from the first point to the second point on the grid. Count how far across you run horizontally, and how far up or down you rise vertically.',
        narration2:
          'Put rise over run: subtract y2 minus y1 on top, and x2 minus x1 on the bottom. Reduce your fraction to lowest terms and watch negative signs carefully.',
        callout1: 'Trace rise & run',
        callout2: 'Rise over run',
      }
    case 'midpoint':
      return {
        formulaTag: 'Midpoint formula',
        formulaMath: 'M = ( (x₁ + x₂) / 2 , (y₁ + y₂) / 2 )',
        firstMoveTag: 'Average the x-values, then average the y-values',
        firstMoveMath: 'M = ( (? + ?) / 2 , (? + ?) / 2 )',
        trapNote: customNudge ?? 'Trap check: ADD the coordinates for midpoint! Subtracting is for slope and length, not midpoint.',
        narration1:
          'Picture sliding from both endpoints inward at the exact same speed until they meet right in the middle of the segment.',
        narration2:
          'Midpoint is just the average of the endpoints. Add the two x-values and divide by 2, then add the two y-values and divide by 2.',
        callout1: 'Meet in the middle',
        callout2: 'Average x & y',
      }
    case 'median':
      return {
        formulaTag: 'Median recipe (3 steps)',
        formulaMath: '1. Midpoint M of opposite side   →   2. Slope from Vertex to M   →   3. Find b',
        firstMoveTag: 'Start by finding midpoint M of the opposite side',
        firstMoveMath: 'M = ( (x₁ + x₂) / 2 , (y₁ + y₂) / 2 )',
        trapNote: customNudge ?? 'Trap check: a median connects a VERTEX to the MIDPOINT of the opposite side (it does NOT need a 90° angle!).',
        narration1:
          'A median always starts at a vertex and aims straight for the midpoint of the opposite side. First, spot which vertex you start from and which two points form the opposite side.',
        narration2:
          'Step one: average the opposite side to find midpoint M. Step two: find the slope between the vertex and M. Step three: plug either point into y equals mx plus b to solve for b.',
        callout1: 'Vertex → Midpoint',
        callout2: '3-step median',
      }
    case 'length':
      return {
        formulaTag: 'Length / Distance formula',
        formulaMath: 'd = √((x₂ − x₁)² + (y₂ − y₁)²)',
        firstMoveTag: 'Build the right triangle: square Δx, square Δy, add, then take √',
        firstMoveMath: 'd = √((Δx)² + (Δy)²)',
        trapNote: customNudge ?? 'Trap check: squaring a negative number ALWAYS gives a positive! And do not forget the square root at the end.',
        narration1:
          'Every slanted segment is the hypotenuse of a right triangle on the grid. Look at the horizontal leg delta-x and the vertical leg delta-y.',
        narration2:
          'Square the horizontal difference, square the vertical difference, add them together, and take the square root. Leave exact radicals simplified unless asked for a decimal.',
        callout1: 'Spot Δx and Δy',
        callout2: 'Pythagoras!',
      }
    case 'circle':
      return {
        formulaTag: 'Circle centred at (0, 0)',
        formulaMath: 'x² + y² = r²',
        firstMoveTag: 'Compare x² + y² against r² (remember r² is radius squared!)',
        firstMoveMath: 'r = √(r²)   |   inside: < r²   ·   on: = r²   ·   outside: > r²',
        trapNote: customNudge ?? 'Trap check: the right side of x² + y² = r² is r SQUARED, not r itself!',
        narration1:
          'A circle centred at the origin is the set of all points at exact distance r from 0, 0. Think of the radius arm sweeping all the way around.',
        narration2:
          'Use x squared plus y squared equals r squared. If you are given r squared, take its square root to get the radius. To test a point, plug x and y in and compare with r squared.',
        callout1: 'Sweep radius r',
        callout2: 'x² + y² = r²',
      }
    case 'right-triangle':
      return {
        formulaTag: 'Triangle classification checks',
        formulaMath: 'Sides: d = √(Δx² + Δy²)   |   Right angle: m₁ · m₂ = −1',
        firstMoveTag: 'Test side lengths for isosceles/scalene, or slopes for 90°',
        firstMoveMath: 'a² + b² = c²   or   m₁ = −1 / m₂',
        trapNote: customNudge ?? 'Trap check: never trust your eyes on a sketch! Verify with exact side lengths or slopes.',
        narration1:
          'Look at all three sides of the triangle. Decide whether the question is asking about equal side lengths, or a 90-degree right angle, or both.',
        narration2:
          'Use the distance formula to compare side lengths. To prove a right angle, either check that two slopes are negative reciprocals or verify a squared plus b squared equals c squared.',
        callout1: 'Check all 3 sides',
        callout2: 'Lengths or 90°?',
      }
    case 'shortest-distance':
      return {
        formulaTag: 'Shortest distance = perpendicular drop',
        formulaMath: '1. m⊥ = −1/m   →   2. Line through P   →   3. POI   →   4. d(P, POI)',
        firstMoveTag: 'Start by finding the perpendicular slope from the given line',
        firstMoveMath: 'm⊥ = −1 / m₁ ,  then plug in P to find the perpendicular line',
        trapNote: customNudge ?? 'Trap check: the shortest path from a point to a line ALWAYS hits the line at 90 degrees!',
        narration1:
          'The shortest path from a point to a line is never slanted. It drops straight down to hit the line at an exact 90-degree angle.',
        narration2:
          'Follow the four-step chain: find the perpendicular slope, write the perpendicular line through your point, solve the point of intersection, and finally measure the distance between the two points.',
        callout1: 'Drop at 90°!',
        callout2: '4-step chain',
      }
    case 'altitude':
      return {
        formulaTag: 'Altitude recipe (Vertex ⊥ Opposite Side)',
        formulaMath: '1. Slope of opposite side   →   2. Flip & negate for m⊥   →   3. Plug in Vertex',
        firstMoveTag: 'Find the slope of the opposite side FIRST (not its midpoint!)',
        firstMoveMath: 'm⊥ = −1 / m_opp ,  then sub Vertex into y = m⊥ x + b',
        trapNote: customNudge ?? 'Trap check: an altitude uses the VERTEX and a 90° slope. Do NOT use the midpoint (that is for medians and right bisectors!).',
        narration1:
          'An altitude drops from a vertex and hits the opposite side at 90 degrees. It does not have to hit the middle of that side.',
        narration2:
          'Find the slope of the opposite side, flip and negate it for your perpendicular slope, and plug the starting vertex into y equals mx plus b.',
        callout1: 'Vertex ⊥ Side',
        callout2: 'No midpoint needed!',
      }
    case 'right-bisector':
      return {
        formulaTag: 'Right Bisector recipe (Midpoint + 90°)',
        formulaMath: '1. Midpoint M   →   2. Slope m & m⊥ = −1/m   →   3. Plug M into y = m⊥ x + b',
        firstMoveTag: 'You need BOTH the midpoint M AND the perpendicular slope m⊥',
        firstMoveMath: 'M = ((x₁+x₂)/2, (y₁+y₂)/2)   and   m⊥ = −1 / m',
        trapNote: customNudge ?? 'Trap check: plug the MIDPOINT M into y = mx + b, NOT one of the endpoints!',
        narration1:
          'A right bisector does two jobs at once: it cuts the segment right through its midpoint, and it crosses at a crisp 90-degree angle.',
        narration2:
          'First find midpoint M. Second, find the slope of the segment and take its negative reciprocal. Third, plug midpoint M into y equals mx plus b to solve for b.',
        callout1: 'Midpoint + 90°',
        callout2: 'Use M for b!',
      }
    case 'quad-proof':
      return {
        formulaTag: 'Quadrilateral verification toolkit',
        formulaMath: 'Parallel: m₁ = m₂   ·   90°: m₁·m₂ = −1   ·   Equal sides: d₁ = d₂',
        firstMoveTag: 'Compute slopes and/or lengths of all 4 sides cleanly',
        firstMoveMath: 'Parallelogram → Rectangle (+90°) / Rhombus (+equal sides) → Square (both)',
        trapNote: customNudge ?? 'Trap check: check opposite pairs carefully, and state a clear concluding sentence linking your math to the definition!',
        narration1:
          'To classify a quadrilateral with coordinate geometry, test its geometric properties using numbers rather than eyeballing the graph.',
        narration2:
          'Slopes prove parallel sides and 90-degree corners. Lengths prove equal sides. Midpoints of diagonals prove they bisect each other.',
        callout1: 'Prove with numbers',
        callout2: 'Slopes & lengths',
      }
    case 'chord-centre':
      return {
        formulaTag: 'Circle centre / Circumcentre theorem',
        formulaMath: 'Right bisector of Chord 1  ∩  Right bisector of Chord 2  =  Centre',
        firstMoveTag: 'Every chord’s right bisector passes straight through the centre!',
        firstMoveMath: 'Find 2 right bisectors, then solve their Point of Intersection',
        trapNote: customNudge ?? 'Trap check: the centre is equidistant from all points on the circle, so check by comparing radii if unsure!',
        narration1:
          'Here is the key circle geometry theorem: the right bisector of any chord passes directly through the centre of the circle.',
        narration2:
          'Find the right bisector of two different chords, then solve where those two bisector lines intersect. That point of intersection is your exact centre.',
        callout1: 'Chord theorem',
        callout2: '2 bisectors → POI',
      }
    case 'poi':
      return {
        formulaTag: 'Point of Intersection (POI)',
        formulaMath: 'Set y₁ = y₂ (substitution)  or  add/subtract equations (elimination)',
        firstMoveTag: 'Solve for x first, then plug x back in to find y',
        firstMoveMath: 'm₁ x + b₁ = m₂ x + b₂   →   (x, y)',
        trapNote: customNudge ?? 'Trap check: always plug your final (x, y) back into BOTH equations to verify it works!',
        narration1:
          'The point of intersection is the single coordinate pair x, y that lies on both lines at the exact same time.',
        narration2:
          'Set the two y expressions equal to solve for x, or line up the equations to eliminate a variable. Once you get x, substitute it back into either equation for y.',
        callout1: 'Where lines cross',
        callout2: 'Solve x, then y',
      }
    default:
      return {
        formulaTag: 'Break the problem into small moves',
        formulaMath: '1. List givens   →   2. Choose formula   →   3. Substitute cleanly',
        firstMoveTag: 'Identify what you know before writing equations',
        firstMoveMath: 'Given points / slopes   →   Target value',
        trapNote: customNudge ?? 'Trap check: double-check every sign and keep fractions exact until the final step.',
        narration1:
          'Start by reading the given coordinates and labels carefully on the graph. Separate what is given from what the question asks you to find.',
        narration2:
          'Match the goal to the right coordinate geometry formula, substitute your known numbers carefully into each slot, and check your signs before simplifying.',
        callout1: 'Read the givens',
        callout2: 'Pick your tool',
      }
  }
}

/**
 * Build a strictly NON-SPOILER Guided Hint Video for ANY page in the app.
 * Never reveals the final answer or solvedScene.
 */
export function buildGuidedHintProgram(lessonId: string, page: GeoLessonPage): LiveMathProgram {
  const topic = detectTopic(lessonId, page)
  const bp = getTopicHintBlueprint(topic, page)
  const safeScene = getNonSpoilerScene(page)
  const rescueLessonId = inferRescueLessonId(lessonId, page)

  const planSteps: string[] =
    page.kind === 'worked'
      ? page.plan
      : page.kind === 'math-input' && page.plan
        ? page.plan
        : page.kind === 'multi-step'
          ? page.plan
          : []

  const hintBeats: LiveMathBeat[] = []

  // Beat 1: Visual Setup (non-spoiler!)
  if (safeScene) {
    hintBeats.push({
      id: 'hint-1',
      stepIndex: 0,
      title: 'Step 1: Read the given setup',
      badge: 'Hint 1 · Setup',
      summaryMath: bp.formulaMath,
      narration: bp.narration1,
      semaCallout: bp.callout1,
      semaPerch: [0.12, 0.22],
      semaLook: [0.54, 0.5],
      durationSec: 8.5,
      scene: safeScene,
      visualEffects: inferVisualEffects(safeScene, { hideAnswer: true, topic }),
    })
  }

  // Beat 2: Formula & First Setup Move (kinetic algebra with ? slots, zero spoilers)
  const algebraSteps: LiveAlgebraStep[] = []
  if (bp.algebraExtra) {
    algebraSteps.push(bp.algebraExtra)
  } else {
    algebraSteps.push({
      kind: 'write',
      tag: bp.formulaTag,
      math: bp.formulaMath,
      accent: 'teal',
      startFrac: 0.08,
      endFrac: 0.45,
    })
  }
  algebraSteps.push({
    kind: 'write',
    tag: bp.firstMoveTag,
    math: bp.firstMoveMath,
    accent: 'blue',
    note: bp.trapNote,
    startFrac: bp.algebraExtra ? 0.64 : 0.46,
    endFrac: 0.94,
  })

  hintBeats.push({
    id: 'hint-2',
    stepIndex: hintBeats.length,
    title: 'Formula & first setup move',
    badge: `Hint ${hintBeats.length + 1} · Strategy`,
    summaryMath: bp.formulaMath,
    narration: bp.narration2,
    semaCallout: bp.callout2,
    semaPerch: [0.89, 0.21],
    semaLook: [0.46, 0.5],
    durationSec: 9.5,
    givenChips: planSteps.slice(0, 3).map((s, i) => ({
      label: `${i + 1}. ${s.length > 36 ? `${s.slice(0, 34)}...` : s}`,
      color: (['blue', 'teal', 'violet'] as GeoColor[])[i % 3]!,
    })),
    algebraSteps,
  })

  // Beat 3: Common Trap Check if there's a custom nudge or multi-step roadmap
  if (planSteps.length > 0 || (page.kind === 'math-input' && page.nudge)) {
    const roadmapLine =
      planSteps.length > 0
        ? planSteps.map((s, idx) => `${idx + 1}) ${s}`).join('   →   ')
        : bp.firstMoveMath
    hintBeats.push({
      id: 'hint-3',
      stepIndex: hintBeats.length,
      title: 'Watch out for the common trap',
      badge: `Hint ${hintBeats.length + 1} · Trap Check`,
      narration: `${bp.trapNote} Try writing out step 1 yourself first, then check your answer!`,
      semaCallout: 'Watch the trap!',
      semaPerch: [0.89, 0.22],
      semaLook: [0.48, 0.52],
      durationSec: 8.0,
      algebraSteps: [
        {
          kind: 'write',
          tag: 'Your roadmap (no spoilers)',
          math: roadmapLine,
          accent: 'blue',
          startFrac: 0.08,
          endFrac: 0.52,
        },
        {
          kind: 'result-pill',
          tag: 'Trap guard',
          math: bp.trapNote,
          accent: 'amber',
          startFrac: 0.52,
          endFrac: 0.94,
        },
      ],
    })
  }

  // Split beats into Visual (if scene exists) + Strategy/Algebra, OR unified guided hint lens
  const visualHintBeats = hintBeats.filter(b => Boolean(b.scene))
  const strategyHintBeats = hintBeats.filter(b => Boolean(b.algebraSteps && b.algebraSteps.length > 0))

  const lenses: LiveMathLens[] = []
  if (visualHintBeats.length > 0 && strategyHintBeats.length > 0) {
    lenses.push({
      id: 'visual',
      label: 'Guided Hint',
      subtitle: 'Non-spoiler visual setup + formula strategy',
      beats: hintBeats,
    })
    lenses.push({
      id: 'algebra',
      label: 'Formula Only',
      subtitle: 'Just the formula & trap guard without the graph',
      beats: strategyHintBeats.map((b, idx) => ({ ...b, stepIndex: idx })),
    })
  } else {
    lenses.push({
      id: 'algebra',
      label: 'Guided Hint',
      subtitle: 'Non-spoiler strategy and formula setup',
      beats: hintBeats,
    })
  }

  return {
    pageId: page.id,
    mode: 'hint',
    title: 'Guided Hint Video (No Spoilers)',
    subtitle: 'Setup, formula, and trap check without giving away the answer',
    lenses,
    rescueLessonId,
    rescueMessage:
      'Want a quick 3-minute catch-up on the underlying skill before trying again?',
  }
}

/**
 * Build a complete real-time Full Solution Video (Visual + Algebra lenses) for ANY page.
 */
export function buildFullSolutionProgram(lessonId: string, page: GeoLessonPage): LiveMathProgram {
  const curated = buildCuratedSolution(page.id)
  if (curated) return curated

  const topic = detectTopic(lessonId, page)
  const bp = getTopicHintBlueprint(topic, page)
  const rescueLessonId = inferRescueLessonId(lessonId, page)
  const baseScene = getNonSpoilerScene(page)
  const solvedScene = getSolvedScene(page)

  const visualBeats: LiveMathBeat[] = []
  const algebraBeats: LiveMathBeat[] = []

  if (page.kind === 'worked') {
    page.steps.forEach((step, idx) => {
      const isLast = idx === page.steps.length - 1
      const stepLines = step.mathLines.length > 0 ? step.mathLines : [step.heading]
      const narration = `${step.heading}. ${stepLines.join('. ')}.`

      visualBeats.push({
        id: `vis-${idx + 1}`,
        stepIndex: idx,
        title: step.heading,
        badge: `Step ${idx + 1} of ${page.steps.length}`,
        summaryMath: stepLines[stepLines.length - 1],
        narration,
        semaCallout: `Step ${idx + 1}`,
        semaPerch: [0.12, 0.22],
        semaLook: [0.55, 0.5],
        durationSec: Math.min(12.5, Math.max(7.5, narration.length * 0.085)),
        scene: step.preScene ?? (idx === 0 ? baseScene : page.steps[idx - 1]?.scene) ?? step.scene,
        revealScene: step.scene,
        visualEffects: inferVisualEffects(step.scene, { hideAnswer: false, topic }),
      })

      algebraBeats.push({
        id: `alg-${idx + 1}`,
        stepIndex: idx,
        title: step.heading,
        badge: `Step ${idx + 1} of ${page.steps.length}`,
        summaryMath: stepLines[stepLines.length - 1],
        narration,
        semaCallout: isLast ? 'Final result!' : `Step ${idx + 1}`,
        semaPerch: [0.89, 0.2],
        semaLook: [0.46, 0.5],
        durationSec: Math.min(12.5, Math.max(7.5, narration.length * 0.085)),
        algebraSteps: stepLines.map((line, li) => {
          const isFinalLine = isLast && li === stepLines.length - 1
          const fracStart = Number(((li / Math.max(1, stepLines.length)) * 0.8 + 0.08).toFixed(2))
          const fracEnd = Number((((li + 1) / Math.max(1, stepLines.length)) * 0.8 + 0.14).toFixed(2))
          return isFinalLine
            ? {
                kind: 'result-pill',
                tag: 'Answer',
                math: line,
                accent: 'green',
                startFrac: fracStart,
                endFrac: Math.min(0.98, fracEnd),
              }
            : {
                kind: 'write',
                tag: li === 0 ? step.heading : undefined,
                math: line,
                accent: li % 2 === 0 ? 'blue' : 'teal',
                startFrac: fracStart,
                endFrac: Math.min(0.95, fracEnd),
              }
        }),
      })
    })
  } else if (page.kind === 'multi-step') {
    page.steps.forEach((step, idx) => {
      const isLast = idx === page.steps.length - 1
      const expStep = page.explanation.steps[idx]
      const narration = expStep?.text ?? `${step.label}. ${step.prompt} Result: ${step.ledgerResult}.`

      visualBeats.push({
        id: `vis-${idx + 1}`,
        stepIndex: idx,
        title: step.label,
        badge: `Step ${idx + 1} of ${page.steps.length}`,
        summaryMath: step.ledgerResult,
        narration,
        semaCallout: step.label.slice(0, 18),
        semaPerch: [0.12, 0.22],
        semaLook: [0.55, 0.5],
        durationSec: Math.min(12, Math.max(7.5, narration.length * 0.08)),
        scene: step.scene,
        revealScene: step.solvedScene,
        visualEffects: inferVisualEffects(step.solvedScene, { hideAnswer: false, topic }),
      })

      const algSteps: LiveAlgebraStep[] = [
        {
          kind: 'write',
          tag: step.label,
          math: expStep?.math ?? step.prompt,
          accent: 'blue',
          note: expStep?.text,
          startFrac: 0.08,
          endFrac: 0.6,
        },
        {
          kind: 'result-pill',
          tag: isLast ? 'Final answer' : `Step ${idx + 1} result`,
          math: step.ledgerResult,
          accent: isLast ? 'green' : 'teal',
          startFrac: 0.62,
          endFrac: 0.96,
        },
      ]

      algebraBeats.push({
        id: `alg-${idx + 1}`,
        stepIndex: idx,
        title: step.label,
        badge: `Step ${idx + 1} of ${page.steps.length}`,
        summaryMath: step.ledgerResult,
        narration,
        semaCallout: isLast ? 'Solved!' : `Step ${idx + 1}`,
        semaPerch: [0.89, 0.2],
        semaLook: [0.46, 0.5],
        durationSec: Math.min(12, Math.max(7.5, narration.length * 0.08)),
        algebraSteps: algSteps,
      })
    })
  } else if (page.kind !== 'explore') {
    const expSteps = page.explanation.steps
    expSteps.forEach((es, idx) => {
      const isLast = idx === expSteps.length - 1
      const prevScene = idx === 0 ? baseScene : expSteps[idx - 1]?.scene
      const narration = es.text + (es.math ? ` ${es.math}` : '')

      visualBeats.push({
        id: `vis-${idx + 1}`,
        stepIndex: idx,
        title: isLast ? 'Complete the solution' : idx === 0 ? 'Set up the geometry' : `Step ${idx + 1}`,
        badge: `Step ${idx + 1} of ${expSteps.length}`,
        summaryMath: es.math,
        narration,
        semaCallout: isLast ? 'Done!' : `Step ${idx + 1}`,
        semaPerch: [0.12, 0.22],
        semaLook: [0.55, 0.5],
        durationSec: Math.min(12, Math.max(7.5, narration.length * 0.08)),
        scene: prevScene ?? es.scene ?? solvedScene,
        revealScene: es.scene ?? solvedScene,
        visualEffects: inferVisualEffects(es.scene ?? solvedScene, { hideAnswer: false, topic }),
      })

      const stepLines = (es.math ?? '')
        .split(/\n|→/)
        .map(s => s.trim())
        .filter(Boolean)

      const algSteps: LiveAlgebraStep[] = []
      if (idx === 0) {
        algSteps.push({
          kind: 'write',
          tag: bp.formulaTag,
          math: bp.formulaMath,
          accent: 'teal',
          startFrac: 0.06,
          endFrac: 0.34,
        })
      }
      if (stepLines.length > 0) {
        stepLines.forEach((line, li) => {
          const isFinal = isLast && li === stepLines.length - 1
          const baseStart = idx === 0 ? 0.36 : 0.1
          const span = 1 - baseStart - 0.06
          const sFrac = Number((baseStart + (li / stepLines.length) * span).toFixed(2))
          const eFrac = Number((baseStart + ((li + 1) / stepLines.length) * span).toFixed(2))
          algSteps.push(
            isFinal
              ? {
                  kind: 'result-pill',
                  tag: 'Final answer',
                  math: line,
                  accent: 'green',
                  note: es.text,
                  startFrac: sFrac,
                  endFrac: Math.min(0.98, eFrac),
                }
              : {
                  kind: 'write',
                  tag: li === 0 ? `Step ${idx + 1}` : undefined,
                  math: line,
                  accent: li % 2 === 0 ? 'blue' : 'violet',
                  note: li === stepLines.length - 1 ? es.text : undefined,
                  startFrac: sFrac,
                  endFrac: Math.min(0.95, eFrac),
                },
          )
        })
      } else {
        algSteps.push({
          kind: isLast ? 'result-pill' : 'write',
          tag: isLast ? 'Takeaway' : `Step ${idx + 1}`,
          math: es.text,
          accent: isLast ? 'green' : 'blue',
          startFrac: idx === 0 ? 0.38 : 0.12,
          endFrac: 0.94,
        })
      }

      algebraBeats.push({
        id: `alg-${idx + 1}`,
        stepIndex: idx,
        title: isLast ? 'Final result' : `Step ${idx + 1}`,
        badge: `Step ${idx + 1} of ${expSteps.length}`,
        summaryMath: es.math,
        narration,
        semaCallout: isLast ? 'Solved!' : `Step ${idx + 1}`,
        semaPerch: [0.89, 0.2],
        semaLook: [0.46, 0.5],
        durationSec: Math.min(12, Math.max(7.5, narration.length * 0.08)),
        algebraSteps: algSteps,
      })
    })
  } else {
    // Explore page quick guided overview
    algebraBeats.push({
      id: 'exp-1',
      stepIndex: 0,
      title: 'How to explore this interactive lab',
      badge: 'Lab Guide',
      narration: `${bp.narration1} ${bp.narration2}`,
      semaCallout: 'Drag & discover!',
      semaPerch: [0.89, 0.2],
      semaLook: [0.46, 0.5],
      durationSec: 9.0,
      algebraSteps: [
        {
          kind: 'write',
          tag: bp.formulaTag,
          math: bp.formulaMath,
          accent: 'teal',
          startFrac: 0.1,
          endFrac: 0.55,
        },
        {
          kind: 'result-pill',
          tag: 'Key takeaway',
          math: bp.firstMoveMath,
          accent: 'green',
          startFrac: 0.55,
          endFrac: 0.95,
        },
      ],
    })
  }

  const lenses: LiveMathLens[] = []
  if (visualBeats.length > 0 && visualBeats.some(b => b.scene || b.revealScene)) {
    lenses.push({
      id: 'visual',
      label: 'Visual',
      subtitle: 'Animated coordinate geometry step by step',
      beats: visualBeats,
    })
  }
  if (algebraBeats.length > 0) {
    lenses.push({
      id: 'algebra',
      label: 'Algebra',
      subtitle: 'Kinetic equations with stacked fractions',
      beats: algebraBeats,
    })
  }

  const cleanTitle = page.prompt.replace(/\*\*/g, '').slice(0, 68)
  return {
    pageId: page.id,
    mode: 'solution',
    title: cleanTitle.length < page.prompt.length ? `${cleanTitle}...` : cleanTitle,
    subtitle: 'Full Visual & Algebra Walkthrough',
    lenses,
    rescueLessonId,
    rescueMessage:
      'Still stuck on this step? Run this 3-minute catch-up mini-lesson on the skill behind it first.',
  }
}
