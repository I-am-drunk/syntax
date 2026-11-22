import type { SemaExpressionName, SemaShapeName, SemaState } from '../mascot/Sema'

export type SemaPromptDisplayMode = 'callout' | 'bubble' | 'subtitle' | 'all' | 'off'

export type SemaAccentToken = 'blue' | 'teal' | 'amber' | 'green' | 'red' | 'violet' | 'ink'

export type SemaKeyframe = {
  t: number
  /** Normalized 0..1 viewport X coordinate */
  x: number
  /** Normalized 0..1 viewport Y coordinate */
  y: number
  /** Normalized -1..1 horizontal eye gaze */
  lookX: number
  /** Normalized -1..1 vertical eye gaze */
  lookY: number
  state: SemaState
  expression?: SemaExpressionName | null
  shape?: SemaShapeName | null
  scale?: number
  speaking?: boolean
}

export type SemaPromptCue = {
  start: number
  end: number
  callout?: string | null
  say?: string | null
  subtitle?: string | null
  mode?: string
  accent?: SemaAccentToken | string
  side?: 'auto' | 'left' | 'right' | 'top' | 'bottom' | string
}

export type WordTiming = {
  text: string
  start: number
  end: number
}

export type SemaTrack = {
  version: number
  voice: string
  fps: number
  duration: number
  aspectRatio: number
  keyframes: SemaKeyframe[]
  prompts: SemaPromptCue[]
  words: WordTiming[]
  qa?: {
    maxStaticGapSec: number
    overlapNudges: number
    cueCount: number
    keyframeCount: number
    promptCount: number
    wordCount: number
  }
}

export function sampleSemaTrack(track: SemaTrack, t: number): SemaKeyframe {
  const kfs = track.keyframes
  if (!kfs.length) {
    return {
      t: 0,
      x: 0.16,
      y: 0.22,
      lookX: 0.5,
      lookY: 0.3,
      state: 'speaking',
      expression: 'attentive',
      shape: 'circle',
      scale: 1,
      speaking: true,
    }
  }
  if (t <= kfs[0].t) return kfs[0]
  if (t >= kfs[kfs.length - 1].t) return kfs[kfs.length - 1]

  // Binary search for bracketing keyframes
  let lo = 0
  let hi = kfs.length - 1
  while (lo + 1 < hi) {
    const mid = (lo + hi) >> 1
    if (kfs[mid].t <= t) lo = mid
    else hi = mid
  }
  const a = kfs[lo]
  const b = kfs[hi]
  const span = Math.max(1e-5, b.t - a.t)
  const u = Math.max(0, Math.min(1, (t - a.t) / span))
  // Smooth Hermite interpolation for graceful continuous flight
  const s = u * u * (3 - 2 * u)

  return {
    t,
    x: a.x + (b.x - a.x) * s,
    y: a.y + (b.y - a.y) * s,
    lookX: a.lookX + (b.lookX - a.lookX) * s,
    lookY: a.lookY + (b.lookY - a.lookY) * s,
    state: u < 0.85 ? a.state : b.state,
    expression: u < 0.85 ? a.expression : b.expression,
    shape: u < 0.85 ? a.shape : b.shape,
    scale: (a.scale ?? 1) + ((b.scale ?? 1) - (a.scale ?? 1)) * s,
    speaking: a.speaking,
  }
}

export function findActivePrompt(track: SemaTrack | null, t: number): SemaPromptCue | null {
  if (!track?.prompts?.length) return null
  for (let i = track.prompts.length - 1; i >= 0; i--) {
    const p = track.prompts[i]
    if (t >= p.start - 0.04 && t <= p.end + 0.08) {
      return p
    }
  }
  return track.prompts[track.prompts.length - 1] ?? null
}

export function findActiveWordIndex(words: WordTiming[], t: number): number {
  if (!words.length) return -1
  for (let i = 0; i < words.length; i++) {
    if (t >= words[i].start - 0.03 && t <= words[i].end + 0.08) {
      return i
    }
  }
  // Return most recently spoken word for smooth subtitle windowing
  let last = -1
  for (let i = 0; i < words.length; i++) {
    if (words[i].start <= t) last = i
    else break
  }
  return last
}
