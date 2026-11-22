import type React from 'react'
import type { SemaExpressionName, SemaState } from '../mascot/Sema'

/* ============================================================================
   Syntax Declarative Walkthrough Animation & Plugin Engine
   ----------------------------------------------------------------------------
   Inspired by Brilliant's data-driven Interactive / Scene Plugin architecture:
   1. Normalized timeline t ∈ [0, 1] is the single source of truth (scrubbable,
      reversible, and frame-locked to audio narration).
   2. Courses author pure declarative JSON/TS configs referencing registered
      Stage Plugins ('graph-timeline', 'algebra-timeline', or any custom future
      course plugin via registerStagePlugin).
   3. Sema choreography continuously interpolates (x, y, lookX, lookY) between
      timed keyframes so Sema glides and reacts organically to the math.
   ============================================================================ */

export type EaseKind = 'linear' | 'easeOut' | 'easeInOut' | 'easeBack'

export function clamp(v: number, lo = 0, hi = 1): number {
  return v < lo ? lo : v > hi ? hi : v
}

export function lerp(a: number, b: number, t: number): number {
  return a + (b - a) * t
}

export function seg(progress: number, start: number, end: number): number {
  if (end <= start) return progress >= end ? 1 : 0
  return clamp((progress - start) / (end - start), 0, 1)
}

export function easeOut(t: number): number {
  const c = clamp(t)
  return 1 - Math.pow(1 - c, 3)
}

export function easeInOut(t: number): number {
  const c = clamp(t)
  return c < 0.5 ? 4 * c * c * c : 1 - Math.pow(-2 * c + 2, 3) / 2
}

export function easeBack(t: number): number {
  const c = clamp(t)
  const c1 = 1.70158
  const c3 = c1 + 1
  return 1 + c3 * Math.pow(c - 1, 3) + c1 * Math.pow(c - 1, 2)
}

export function evalEase(t: number, ease: EaseKind = 'easeInOut'): number {
  switch (ease) {
    case 'linear':
      return clamp(t)
    case 'easeOut':
      return easeOut(t)
    case 'easeBack':
      return easeBack(t)
    default:
      return easeInOut(t)
  }
}

/* ----------------------------------------------------------------------------
   Reactive Sema Keyframe Interpolation
   ---------------------------------------------------------------------------- */

export type SemaKeyframe = {
  /** Normalized beat progress 0..1 */
  at: number
  /** Sema position as percentage of stage width/height */
  semaX: number
  semaY: number
  /** Normalized direction Sema looks (-1..1, -1..1) */
  lookX: number
  lookY: number
  semaState: SemaState
  expression?: SemaExpressionName
  tag?: string
}

export type InterpolatedSemaPose = {
  semaX: number
  semaY: number
  lookX: number
  lookY: number
  bankTilt: number
  semaState: SemaState
  expression?: SemaExpressionName
  tag?: string
  cueIndex: number
}

export function interpolateSemaCues(
  cues: SemaKeyframe[],
  progress: number,
): InterpolatedSemaPose {
  if (cues.length === 0) {
    return {
      semaX: 18,
      semaY: 22,
      lookX: 0.7,
      lookY: 0.4,
      bankTilt: 0,
      semaState: 'speaking',
      cueIndex: 0,
    }
  }

  let idx = 0
  for (let i = 0; i < cues.length; i++) {
    if (progress >= cues[i]!.at) idx = i
  }

  const cur = cues[idx]!
  const next = cues[idx + 1]

  if (!next) {
    return {
      semaX: cur.semaX,
      semaY: cur.semaY,
      lookX: cur.lookX,
      lookY: cur.lookY,
      bankTilt: 0,
      semaState: cur.semaState,
      expression: cur.expression,
      tag: cur.tag,
      cueIndex: idx,
    }
  }

  // Begin gliding smoothly during the last 32% before the next keyframe arrives
  const span = Math.max(0.05, next.at - cur.at)
  const glideStart = cur.at + span * 0.62
  const rawGlide = seg(progress, glideStart, next.at)
  const k = easeInOut(rawGlide)

  const dx = next.semaX - cur.semaX
  const speedEnvelope = Math.sin(rawGlide * Math.PI)
  const bankTilt = clamp(dx * 0.28 * speedEnvelope, -14, 14)

  return {
    semaX: lerp(cur.semaX, next.semaX, k),
    semaY: lerp(cur.semaY, next.semaY, k),
    lookX: lerp(cur.lookX, next.lookX, k),
    lookY: lerp(cur.lookY, next.lookY, k),
    bankTilt,
    semaState: cur.semaState,
    expression: cur.expression,
    tag: cur.tag,
    cueIndex: idx,
  }
}

/* ----------------------------------------------------------------------------
   Declarative Graph-Timeline Plugin Config Types
   ---------------------------------------------------------------------------- */

export type GraphColorToken = 'blue' | 'teal' | 'green' | 'amber' | 'violet' | 'ink'

export const GRAPH_COLORS: Record<GraphColorToken, string> = {
  blue: '#456dff',
  teal: '#0d9488',
  green: '#29cc57',
  amber: '#f59e0b',
  violet: '#7c3aed',
  ink: 'currentColor',
}

export type GraphBounds = {
  xMin: number
  xMax: number
  yMin: number
  yMax: number
  step?: number
}

export type GraphTrack =
  | {
      type: 'polygon'
      id: string
      vertices: [number, number][]
      color?: GraphColorToken
      fillOpacity?: number
      fromT: number
      toT: number
    }
  | {
      type: 'line-draw'
      id: string
      /** Either explicit endpoints or slope-intercept clipped to viewport */
      from: [number, number]
      to: [number, number]
      color?: GraphColorToken
      strokeWidth?: number
      dashed?: boolean
      fromT: number
      toT: number
      /** Optional opacity override after a certain timestamp */
      dimAfterT?: number
      dimOpacity?: number
    }
  | {
      type: 'segment-draw'
      id: string
      from: [number, number]
      to: [number, number]
      color?: GraphColorToken
      strokeWidth?: number
      ticks?: number
      label?: string
      fromT: number
      toT: number
    }
  | {
      type: 'slope-triangle'
      id: string
      from: [number, number]
      dx: number
      dy: number
      runLabel: string
      riseLabel: string
      color?: GraphColorToken
      runFromT: number
      runToT: number
      riseFromT: number
      riseToT: number
    }
  | {
      type: 'line-rotate'
      id: string
      pivot: [number, number]
      baseSlope: number
      rotateDeg: number
      armLengthPx?: number
      color?: GraphColorToken
      fromT: number
      toT: number
      rightAngleFromT?: number
      rightAngleToT?: number
    }
  | {
      type: 'line-glide'
      id: string
      slope: number
      fromB: number
      toB: number
      fromT: number
      toT: number
      lockFromT: number
      lockToT: number
      targetPoint: [number, number]
      targetLabel: string
      color?: GraphColorToken
    }
  | {
      type: 'midpoint-sweep'
      id: string
      a: [number, number]
      b: [number, number]
      labelA: string
      labelB: string
      labelM?: string
      color?: GraphColorToken
      fromT: number
      toT: number
      lockFromT: number
      lockToT: number
    }
  | {
      type: 'distance-triangle'
      id: string
      a: [number, number]
      b: [number, number]
      dxLabel: string
      dyLabel: string
      hypLabel: string
      color?: GraphColorToken
      fromT: number
      toT: number
      hypFromT: number
      hypToT: number
    }
  | {
      type: 'point'
      id: string
      at: [number, number]
      label?: string
      labelDx?: number
      labelDy?: number
      color?: GraphColorToken
      radius?: number
      fromT: number
      toT: number
      pulseAtT?: number
    }
  | {
      type: 'badge'
      id: string
      at: [number, number]
      text: string
      /** Optional dynamic text phases based on progress */
      phases?: { at: number; text: string }[]
      tone?: 'blue' | 'teal' | 'green' | 'amber'
      width?: number
      fromT: number
      toT: number
    }

export type GraphTimelineConfig = {
  ariaLabel: string
  bounds: GraphBounds
  tracks: GraphTrack[]
}

/* ----------------------------------------------------------------------------
   Declarative Algebra-Timeline Plugin Config Types
   ---------------------------------------------------------------------------- */

export type AlgebraTokenTone = 'ink' | 'blue' | 'teal' | 'green' | 'amber'

export type AlgebraHintPhase = {
  at: number
  text: string
}

export type AlgebraMotionToken = {
  id: string
  text: string
  altText?: string
  flipAt?: number
  tone: AlgebraTokenTone
  altTone?: AlgebraTokenTone
  from: [number, number]
  to?: [number, number]
  arcHeight?: number
  fromT: number
  toT: number
  fadeIn?: [number, number]
  fadeOut?: [number, number]
  /** Optional 2D orbital motion (e.g. 180-degree reciprocal flip around fraction bar) */
  orbit?: {
    cx: number
    cy: number
    rx: number
    ry: number
    fromDeg: number
    toDeg: number
    fromT: number
    toT: number
  }
  /** Optional in-place spin + scale pulse (e.g. minus sign spinning into plus) */
  spin?: {
    fromDeg: number
    toDeg: number
    fromT: number
    toT: number
    scalePulse?: number
  }
  spotAt?: [number, number]
}

export type AlgebraFracBar = {
  id: string
  x: number
  y: number
  fromT: number
  toT: number
}

export type AlgebraStackChip = {
  text: string
  kind: 'chip' | 'sym' | 'result'
  tone?: AlgebraTokenTone
  pulseWindow?: [number, number]
}

export type AlgebraStackRow = {
  id: string
  fromT: number
  toT: number
  isFinal?: boolean
  chips: AlgebraStackChip[]
}

export type AlgebraTimelineConfig = {
  ariaLabel: string
  hints: AlgebraHintPhase[]
  /** 2D token-choreography stage (parabolic arcs, orbital flips, smooth glides) */
  tokens?: AlgebraMotionToken[]
  fracBars?: AlgebraFracBar[]
  /** Multi-row animated algebra derivation stack */
  rows?: AlgebraStackRow[]
  resultPill?: {
    text: string
    tone: 'blue' | 'teal' | 'green' | 'amber'
    fromT: number
    toT: number
  }
}

/* ----------------------------------------------------------------------------
   Extensible Stage Plugin Registry (Brilliant-Style Course Component System)
   ---------------------------------------------------------------------------- */

export type StageSpec =
  | { plugin: 'graph-timeline'; config: GraphTimelineConfig }
  | { plugin: 'algebra-timeline'; config: AlgebraTimelineConfig }
  | { plugin: string; config: unknown }

export type StagePluginRenderer<TConfig = unknown> = (
  config: TConfig,
  progress: number,
) => React.ReactNode

export type StagePlugin<TConfig = unknown> = {
  id: string
  label: string
  description: string
  render: StagePluginRenderer<TConfig>
}

const stagePluginRegistry = new Map<string, StagePlugin<unknown>>()

export function registerStagePlugin<TConfig>(plugin: StagePlugin<TConfig>): void {
  stagePluginRegistry.set(plugin.id, plugin as StagePlugin<unknown>)
}

export function getStagePlugin(id: string): StagePlugin<unknown> | undefined {
  return stagePluginRegistry.get(id)
}

export function listStagePlugins(): StagePlugin<unknown>[] {
  return Array.from(stagePluginRegistry.values())
}
