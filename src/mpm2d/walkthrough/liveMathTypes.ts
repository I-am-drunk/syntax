import type { GeoColor, GeoScene } from '../types'
import type { SemaTrack } from './semaTrackTypes'

export type LiveVideoMode = 'hint' | 'solution'
export type LiveLensId = 'visual' | 'algebra'

export type LiveVisualEffect =
  | {
      kind: 'rise-run'
      from: [number, number]
      to: [number, number]
      color?: GeoColor
      runLabel?: string
      riseLabel?: string
      startFrac?: number
      endFrac?: number
    }
  | {
      kind: 'rotate-90'
      pivot: [number, number]
      /** Direction vector of the starting line from pivot */
      fromDir: [number, number]
      /** +90 or -90 degrees */
      angleDeg: 90 | -90
      length?: number
      fromLabel?: string
      toLabel?: string
      color?: GeoColor
      startFrac?: number
      endFrac?: number
    }
  | {
      kind: 'slide-line'
      /** Line ax + by + cFrom = 0 sliding to ax + by + cTo = 0 */
      a: number
      b: number
      cFrom: number
      cTo: number
      targetPoint: [number, number]
      targetLabel?: string
      lineLabel?: string
      color?: GeoColor
      startFrac?: number
      endFrac?: number
    }
  | {
      kind: 'midpoint-converge'
      a: [number, number]
      b: [number, number]
      color?: GeoColor
      label?: string
      /** If true, keeps label as M = (?, ?) so Guided Hints never spoil the answer */
      hideAnswer?: boolean
      startFrac?: number
      endFrac?: number
    }
  | {
      kind: 'pythagoras-legs'
      a: [number, number]
      b: [number, number]
      color?: GeoColor
      dxLabel?: string
      dyLabel?: string
      hypLabel?: string
      hideAnswer?: boolean
      startFrac?: number
      endFrac?: number
    }
  | {
      kind: 'circle-sweep'
      cx: number
      cy: number
      r: number
      color?: GeoColor
      radiusLabel?: string
      startFrac?: number
      endFrac?: number
    }
  | {
      kind: 'poi-pulse'
      point: [number, number]
      label?: string
      color?: GeoColor
      startFrac?: number
      endFrac?: number
    }
  | {
      kind: 'highlight-point'
      point: [number, number]
      label?: string
      color?: GeoColor
      startFrac?: number
      endFrac?: number
    }

export type LiveAlgebraStep =
  | {
      kind: 'write'
      tag?: string
      math: string
      accent?: GeoColor
      note?: string
      startFrac?: number
      endFrac?: number
    }
  | {
      kind: 'parabolic-jump'
      tag?: string
      /** Terms before the jump: leftFixed + movingTerm + " = " + rightFixed */
      leftFixed: string
      movingTerm: string
      landedTerm: string
      rightFixed: string
      accent?: GeoColor
      note?: string
      startFrac?: number
      endFrac?: number
    }
  | {
      kind: 'orbital-flip'
      tag?: string
      /** Starting slope fraction sign + numerator + denominator */
      fromSign: '+' | '-' | ''
      fromNum: string
      fromDen: string
      /** Resulting perpendicular slope */
      toSign: '+' | '-' | ''
      toNum: string
      toDen: string
      leftLabel?: string
      rightLabel?: string
      note?: string
      startFrac?: number
      endFrac?: number
    }
  | {
      kind: 'substitute-drop'
      tag?: string
      givens: { label: string; value: string; color: GeoColor }[]
      template: string
      substituted: string
      simplified?: string
      note?: string
      startFrac?: number
      endFrac?: number
    }
  | {
      kind: 'divide-all'
      tag?: string
      before: string
      divisor: string
      after: string
      accent?: GeoColor
      note?: string
      startFrac?: number
      endFrac?: number
    }
  | {
      kind: 'result-pill'
      tag?: string
      math: string
      accent?: GeoColor
      note?: string
      startFrac?: number
      endFrac?: number
    }

export type LiveMathBeat = {
  id: string
  stepIndex: number
  title: string
  badge?: string
  /** Short equation or takeaway pill shown in header */
  summaryMath?: string
  /** Full spoken narration text (auto-segmented into word-by-word synced subtitles) */
  narration: string
  /** Short Sema callout tag (2-4 words) */
  semaCallout: string
  /** Sema perch coordinates (normalized 0..1 on the video stage) */
  semaPerch?: [number, number]
  /** Where Sema looks on stage (normalized 0..1) */
  semaLook?: [number, number]
  /** Beat duration in seconds (deliberate, easy to follow: 7s-15s) */
  durationSec: number
  /** Visual lens data: base Cartesian scene + real-time animated effects */
  scene?: GeoScene
  /** Optional target scene elements that draw in gradually during the beat */
  revealScene?: GeoScene
  visualEffects?: LiveVisualEffect[]
  /** Algebra lens data: choreographed Manim-style kinetic steps */
  algebraSteps?: LiveAlgebraStep[]
  /** Optional given-facts chips pinned at the top of the algebra board */
  givenChips?: { label: string; color: GeoColor }[]
}

export type LiveMathLens = {
  id: LiveLensId
  label: string
  subtitle: string
  beats: LiveMathBeat[]
}

export type LiveMathProgram = {
  pageId: string
  mode: LiveVideoMode
  title: string
  subtitle: string
  lenses: LiveMathLens[]
  rescueLessonId: string
  rescueMessage: string
}

export type LiveBeatRuntime = {
  beat: LiveMathBeat
  track: SemaTrack
}
