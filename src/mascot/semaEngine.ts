/**
 * Sema (';') 3D Spherical Eye & Continuous Pose-Blending Engine.
 *
 * Adapted directly from bloub's spherical tangent-plane projection math:
 * - Eyes live on a unit sphere rotated by (yaw, pitch, roll), yielding a 2x2
 *   orthographic tangent basis [a, b, c, d] for authentic perspective squash
 *   near the curved silhouette edge.
 * - Blinks squash strictly along screen-space Y AFTER the tangent basis.
 * - Loading continuously morphs the two eyes themselves into chasing orbital
 *   arcs and smoothly retracts them back into eyes on exit (zero swap).
 * - Nodding glides gaze.pitch smoothly up and down on the 3D sphere rather
 *   than violently shaking the head.
 */

export type SemaState =
  | 'idle'
  | 'bobbing'
  | 'nodding'
  | 'loading'
  | 'thinking'
  | 'guiding'
  | 'speaking'
  | 'celebrate'
  | 'nudge'
  | 'wink'

export type HeadGaze = {
  /** degrees, positive = look right */
  yaw: number
  /** degrees, positive = look up */
  pitch: number
  /** degrees, head tilt in screen plane */
  roll: number
}

export type EyeShapeConfig = {
  w: number
  h: number
  open: number
  tilt: number
  /** 0 = capsule, 1 = happy arch (^ ^) */
  arch: number
}

export type SemaPose = {
  gaze: HeadGaze
  split: number
  eyes: [EyeShapeConfig, EyeShapeConfig]
  offX: number
  offY: number
  sx: number
  sy: number
  headRot: number
  /** 0 = normal eyes, 1 = eyes morphed into chasing orbital spinner arcs */
  spinnerMorph: number
  /** continuous orbital angle in radians for spinner morph */
  spinnerAngle: number
  /** 0..1 sparkle visibility (celebrate) */
  sparkle: number
  /** semantic eye tint key */
  tint: 'default' | 'blue' | 'green' | 'amber'
}

export type RenderedEye = {
  d: string
  matrix: string
  alpha: number
}

export type SpinnerArc = {
  d: string
  strokeWidth: number
  opacity: number
}

export type SemaFrame = {
  bodyPath: string
  eyes: RenderedEye[]
  spinnerArcs: SpinnerArc[]
  tint: 'default' | 'blue' | 'green' | 'amber'
  offX: number
  offY: number
  sx: number
  sy: number
  headRot: number
  sparkle: number
  sparklePhase: number
}

type Vec3 = [number, number, number]

export const HEAD_RADIUS = 56
export const EYE_SPLIT = 16.5
export const BASE_EYE_W = 0.175
export const BASE_EYE_H = 0.365
export const REST_GAZE: HeadGaze = { yaw: 8, pitch: 6, roll: -4 }

export function clamp(v: number, lo = 0, hi = 1): number {
  return v < lo ? lo : v > hi ? hi : v
}

export function lerp(a: number, b: number, t: number): number {
  return a + (b - a) * t
}

export function easeOutQuint(t: number): number {
  const u = 1 - clamp(t)
  return 1 - u * u * u * u * u
}

export function easeInOutCubic(t: number): number {
  const x = clamp(t)
  return x < 0.5 ? 4 * x * x * x : 1 - Math.pow(-2 * x + 2, 3) / 2
}

function r2(n: number): number {
  return Math.round(n * 100) / 100
}

function deg(d: number): number {
  return (d * Math.PI) / 180
}

function spin(u: Vec3, v: Vec3, angle: number): [Vec3, Vec3] {
  const c = Math.cos(angle)
  const s = Math.sin(angle)
  return [
    [u[0] * c + v[0] * s, u[1] * c + v[1] * s, u[2] * c + v[2] * s],
    [v[0] * c - u[0] * s, v[1] * c - u[1] * s, v[2] * c - u[2] * s],
  ]
}

export type EyePose3D = {
  x: number
  y: number
  a: number
  b: number
  c: number
  d: number
  depth: number
}

export function eyePoses(gaze: HeadGaze, scale: number, split = EYE_SPLIT): [EyePose3D, EyePose3D] {
  let f: Vec3 = [0, 0, 1]
  let right: Vec3 = [1, 0, 0]
  let down: Vec3 = [0, 1, 0]

  ;[f, right] = spin(f, right, deg(gaze.yaw))
  ;[down, f] = spin(down, f, deg(gaze.pitch))
  ;[right, down] = spin(right, down, deg(gaze.roll))

  const build = (side: number): EyePose3D => {
    const [ef, er] = spin(f, right, deg(split * side))
    return {
      x: ef[0] * scale,
      y: ef[1] * scale,
      a: er[0],
      b: er[1],
      c: down[0],
      d: down[1],
      depth: ef[2],
    }
  }

  return [build(-1), build(1)]
}

/** Deterministic pseudo-random blink schedule (bloub style) */
const BLINKS: number[] = (() => {
  let seed = 0x5eed
  const rand = () => {
    seed = (seed * 1664525 + 1013904223) >>> 0
    return seed / 4294967296
  }
  const out: number[] = []
  let t = 1.6
  while (t < 1800) {
    out.push(t)
    t += 2.2 + rand() * 2.8
    if (rand() < 0.16) {
      out.push(t)
      t += 0.25
    }
  }
  return out
})()

const BLINK_DUR = 0.17

function blinkLid(t: number): number {
  const modT = t % 1750
  for (let i = 0; i < BLINKS.length; i++) {
    const start = BLINKS[i]!
    if (modT < start) break
    const k = (modT - start) / BLINK_DUR
    if (k >= 0 && k <= 1) {
      return k < 0.44 ? 1 - k / 0.44 : (k - 0.44) / 0.56
    }
  }
  return 1
}

function loopNoise(t: number, period: number, phase: number): number {
  const a = (t / period) * Math.PI * 2 + phase
  return Math.sin(a) * 0.65 + Math.sin(a * 2.13 + phase * 1.7) * 0.35
}

export function blinkScale(lid: number): number {
  return 0.07 + 0.93 * clamp(lid)
}

/** Rounded capsule SVG path centered at (0,0) with half-width w and half-height h */
export function capsulePath(w: number, h: number): string {
  const rx = Math.max(0.8, w)
  const ry = Math.max(rx, h)
  const straight = Math.max(0, ry - rx)
  if (straight < 0.2) {
    return `M${r2(-rx)},0 A${r2(rx)},${r2(rx)} 0 1,0 ${r2(rx)},0 A${r2(rx)},${r2(rx)} 0 1,0 ${r2(-rx)},0 Z`
  }
  return (
    `M${r2(-rx)},${r2(-straight)} ` +
    `A${r2(rx)},${r2(rx)} 0 0,1 ${r2(rx)},${r2(-straight)} ` +
    `L${r2(rx)},${r2(straight)} ` +
    `A${r2(rx)},${r2(rx)} 0 0,1 ${r2(-rx)},${r2(straight)} Z`
  )
}

/** Happy upward arch eye (^ ^) for celebrate */
export function happyArchPath(w: number, h: number): string {
  const hw = w * 1.45
  const hh = h * 0.62
  const t = Math.max(2.6, w * 0.56)
  return (
    `M${r2(-hw)},${r2(hh * 0.45)} ` +
    `Q0,${r2(-hh * 1.35)} ${r2(hw)},${r2(hh * 0.45)} ` +
    `A${r2(t * 0.55)},${r2(t * 0.55)} 0 0,1 ${r2(hw - t * 0.85)},${r2(hh * 0.45 + t * 0.72)} ` +
    `Q0,${r2(-hh * 1.35 + t * 1.45)} ${r2(-hw + t * 0.85)},${r2(hh * 0.45 + t * 0.72)} ` +
    `A${r2(t * 0.55)},${r2(t * 0.55)} 0 0,1 ${r2(-hw)},${r2(hh * 0.45)} Z`
  )
}

/** Superellipse squircle head centered at (0,0) with radius R */
export function squircleHeadPath(R: number, n = 2.65): string {
  const steps = 48
  const pts: string[] = []
  const exp = 2 / n
  for (let i = 0; i < steps; i++) {
    const a = (i / steps) * Math.PI * 2
    const ca = Math.cos(a)
    const sa = Math.sin(a)
    const x = Math.sign(ca) * Math.pow(Math.abs(ca), exp) * R
    const y = Math.sign(sa) * Math.pow(Math.abs(sa), exp) * R
    pts.push(`${i === 0 ? 'M' : 'L'}${r2(x)},${r2(y)}`)
  }
  return `${pts.join(' ')} Z`
}

const BASE_HEAD_PATH = squircleHeadPath(HEAD_RADIUS, 2.55)

function pair(w = BASE_EYE_W, h = BASE_EYE_H, open = 1, tilt = 0, arch = 0): [EyeShapeConfig, EyeShapeConfig] {
  return [
    { w, h, open, tilt, arch },
    { w, h, open, tilt: -tilt, arch },
  ]
}

function basePose(patch: Partial<SemaPose> = {}): SemaPose {
  return {
    gaze: { ...REST_GAZE },
    split: EYE_SPLIT,
    eyes: pair(),
    offX: 0,
    offY: 0,
    sx: 1,
    sy: 1,
    headRot: 0,
    spinnerMorph: 0,
    spinnerAngle: 0,
    sparkle: 0,
    tint: 'default',
    ...patch,
  }
}

function blendEye(a: EyeShapeConfig, b: EyeShapeConfig, t: number): EyeShapeConfig {
  return {
    w: lerp(a.w, b.w, t),
    h: lerp(a.h, b.h, t),
    open: lerp(a.open, b.open, t),
    tilt: lerp(a.tilt, b.tilt, t),
    arch: lerp(a.arch, b.arch, t),
  }
}

export function blendPose(a: SemaPose, b: SemaPose, t: number): SemaPose {
  return {
    gaze: {
      yaw: lerp(a.gaze.yaw, b.gaze.yaw, t),
      pitch: lerp(a.gaze.pitch, b.gaze.pitch, t),
      roll: lerp(a.gaze.roll, b.gaze.roll, t),
    },
    split: lerp(a.split, b.split, t),
    eyes: [blendEye(a.eyes[0], b.eyes[0], t), blendEye(a.eyes[1], b.eyes[1], t)],
    offX: lerp(a.offX, b.offX, t),
    offY: lerp(a.offY, b.offY, t),
    sx: lerp(a.sx, b.sx, t),
    sy: lerp(a.sy, b.sy, t),
    headRot: lerp(a.headRot, b.headRot, t),
    spinnerMorph: lerp(a.spinnerMorph, b.spinnerMorph, t),
    spinnerAngle: b.spinnerAngle,
    sparkle: lerp(a.sparkle, b.sparkle, t),
    tint: t > 0.35 ? b.tint : a.tint,
  }
}

export function evaluateStatePose(state: SemaState, localT: number, speakLevel = 0): SemaPose {
  switch (state) {
    case 'idle':
      return basePose()

    case 'bobbing': {
      const sway = Math.sin(localT * 3.1)
      const lift = -Math.abs(Math.sin(localT * 3.1)) * 3.4
      return basePose({
        gaze: {
          yaw: 6 + sway * 16,
          pitch: 6 + Math.cos(localT * 6.2) * 4,
          roll: -3 + sway * 9,
        },
        offX: sway * 5.2,
        offY: lift,
        headRot: sway * 6.5,
      })
    }

    case 'nodding': {
      // Grokbot-style eye-pitch nodding: eyes glide smoothly up and down on the 3D sphere,
      // head stays almost completely calm (micro ~1.4px follow-through only).
      const phase = localT * 5.6
      const nod = Math.sin(phase)
      const doubleDecay = 0.78 + 0.22 * Math.cos(localT * 2.1)
      const pitch = -6 + nod * 24 * doubleDecay
      return basePose({
        gaze: { yaw: 6, pitch, roll: -2 },
        eyes: pair(BASE_EYE_W * 1.02, BASE_EYE_H * 0.96, 1, 0, 0),
        offY: -nod * 1.3,
      })
    }

    case 'loading': {
      // Eyes smoothly contract into orbital dots and stretch into chasing spinner arcs!
      const morph = easeInOutCubic(clamp(localT / 0.45))
      const spinAngle = localT * 4.2 + Math.sin(localT * 2.1) * 0.55
      return basePose({
        gaze: { yaw: 0, pitch: 0, roll: 0 },
        split: lerp(EYE_SPLIT, 18.5, morph),
        eyes: pair(BASE_EYE_W * 0.94, lerp(BASE_EYE_H, BASE_EYE_W * 0.94, morph)),
        spinnerMorph: morph,
        spinnerAngle: spinAngle,
        tint: 'blue',
      })
    }

    case 'thinking': {
      const drift = Math.sin(localT * 1.9) * 5
      return basePose({
        gaze: { yaw: 24 + drift, pitch: 22 + Math.cos(localT * 1.4) * 3, roll: -9 },
        split: 14.8,
        eyes: [
          { w: BASE_EYE_W * 0.96, h: BASE_EYE_H * 0.84, open: 0.92, tilt: 6, arch: 0 },
          { w: BASE_EYE_W * 1.06, h: BASE_EYE_H * 1.04, open: 1, tilt: -4, arch: 0 },
        ],
        headRot: -6.5,
      })
    }

    case 'guiding':
      return basePose({
        gaze: { yaw: 18, pitch: 2, roll: -5 },
        eyes: pair(BASE_EYE_W * 1.04, BASE_EYE_H * 1.04),
        headRot: 3.5,
        tint: 'blue',
      })

    case 'speaking': {
      // Conversational micro-cadence driven by live audio/synthetic speech envelope
      const env =
        speakLevel > 0.02
          ? speakLevel
          : 0.45 + 0.35 * Math.sin(localT * 7.8) + 0.2 * Math.sin(localT * 13.4)
      const pulse = clamp(env)
      return basePose({
        gaze: {
          yaw: 10 + Math.sin(localT * 2.4) * 8,
          pitch: 4 + (pulse - 0.5) * 11,
          roll: -3 + Math.sin(localT * 1.8) * 4,
        },
        eyes: pair(BASE_EYE_W * (1 + pulse * 0.08), BASE_EYE_H * (0.96 + pulse * 0.14)),
        offY: -pulse * 2.1,
        sx: 1 - pulse * 0.022,
        sy: 1 + pulse * 0.028,
        headRot: Math.sin(localT * 2.2) * 3.5,
        tint: 'blue',
      })
    }

    case 'celebrate': {
      const hopPhase = Math.min(localT, 1.35)
      const hop1 = Math.max(0, Math.sin(hopPhase * Math.PI * 2.4))
      const hopY = -hop1 * 11
      const stretch = hop1 * 0.09
      return basePose({
        gaze: { yaw: 4, pitch: 12 + hop1 * 8, roll: Math.sin(localT * 6) * 5 },
        split: 17.5,
        eyes: pair(BASE_EYE_W * 1.12, BASE_EYE_H * 0.92, 1, 0, 1),
        offY: hopY,
        sx: 1 - stretch * 0.65,
        sy: 1 + stretch,
        headRot: Math.sin(localT * 5.2) * 5,
        sparkle: 1,
        tint: 'green',
      })
    }

    case 'nudge':
      return basePose({
        gaze: { yaw: -10, pitch: -10, roll: 9 },
        split: 15.5,
        eyes: [
          { w: BASE_EYE_W * 1.05, h: BASE_EYE_H * 0.78, open: 0.9, tilt: -10, arch: 0 },
          { w: BASE_EYE_W * 1.05, h: BASE_EYE_H * 0.78, open: 0.9, tilt: 10, arch: 0 },
        ],
        headRot: 8,
        tint: 'amber',
      })

    case 'wink': {
      const wPulse = Math.sin(clamp(localT / 0.55) * Math.PI)
      return basePose({
        gaze: { yaw: 14, pitch: 8, roll: -7 },
        eyes: [
          { w: BASE_EYE_W * 1.06, h: BASE_EYE_H * 1.06, open: 1, tilt: 0, arch: 0 },
          { w: BASE_EYE_W * 1.06, h: BASE_EYE_H * 0.96, open: 1 - 0.92 * wPulse, tilt: 4, arch: 0 },
        ],
        headRot: -4.5 * wPulse,
      })
    }
  }
}

const MORPH_DURATION: Record<SemaState, number> = {
  idle: 0.34,
  bobbing: 0.32,
  nodding: 0.24,
  loading: 0.42,
  thinking: 0.36,
  guiding: 0.28,
  speaking: 0.26,
  celebrate: 0.24,
  nudge: 0.34,
  wink: 0.2,
}

/** Build an SVG circular arc path around (0, 0) from angle a0 to a1 at radius r */
function orbitalArcPath(r: number, a0: number, sweep: number): string {
  const s = Math.max(0.015, Math.min(Math.PI * 1.85, sweep))
  const a1 = a0 + s
  const x0 = Math.cos(a0) * r
  const y0 = Math.sin(a0) * r
  const x1 = Math.cos(a1) * r
  const y1 = Math.sin(a1) * r
  const largeArc = s > Math.PI ? 1 : 0
  return `M${r2(x0)},${r2(y0)} A${r2(r)},${r2(r)} 0 ${largeArc},1 ${r2(x1)},${r2(y1)}`
}

export class SemaEngine {
  private cur: SemaState = 'idle'
  private prev: SemaState | null = null
  private tCur = 0
  private tPrev = 0
  private frozenOrigin: SemaPose | null = null
  private forcedBlinkAt = -10

  // Smooth external gaze override (cursor tracking / walkthrough target focus)
  private lookYaw = 0
  private lookPitch = 0
  private lookMix = 0

  get state(): SemaState {
    return this.cur
  }

  setState(next: SemaState, now: number) {
    if (next === this.cur) return
    const curMorph = MORPH_DURATION[this.cur]
    const midBlend = this.prev !== null && now - this.tCur < curMorph
    this.frozenOrigin = midBlend ? this.composePose(now, 0) : null
    this.prev = this.cur
    this.tPrev = this.tCur
    this.cur = next
    this.tCur = now
    // Mask mood swaps with a crisp Grokbot blink (except when morphing smoothly into/out of loading)
    if (next !== 'loading' && this.prev !== 'loading' && next !== 'wink') {
      this.forcedBlinkAt = now
    }
  }

  triggerBlink(now: number) {
    this.forcedBlinkAt = now
  }

  setLookTarget(yaw: number, pitch: number, active: boolean, dt: number) {
    const rate = 1 - Math.exp(-dt * (active ? 10 : 5))
    this.lookMix = lerp(this.lookMix, active ? 0.78 : 0, rate)
    if (active) {
      this.lookYaw = lerp(this.lookYaw, clamp(yaw, -42, 42), 1 - Math.exp(-dt * 12))
      this.lookPitch = lerp(this.lookPitch, clamp(pitch, -34, 34), 1 - Math.exp(-dt * 12))
    }
  }

  private composePose(now: number, speakLevel: number): SemaPose {
    const curPose = evaluateStatePose(this.cur, Math.max(0, now - this.tCur), speakLevel)
    const since = now - this.tCur
    const morphDur = MORPH_DURATION[this.cur]
    if (since >= morphDur || !this.prev) return curPose

    const origin =
      this.frozenOrigin ?? evaluateStatePose(this.prev, Math.max(0, now - this.tPrev), speakLevel)
    const ratio = easeOutQuint(clamp(since / morphDur))
    return blendPose(origin, curPose, ratio)
  }

  sample(now: number, speakLevel = 0): SemaFrame {
    const pose = this.composePose(now, speakLevel)
    const R = HEAD_RADIUS

    // Ambient liveliness (subtle non-repeating drift + blink calendar)
    const suppressWander = this.cur === 'loading' ? 0 : this.cur === 'nodding' ? 0.25 : 1 - this.lookMix * 0.7
    const dYaw = (loopNoise(now, 11.3, 0.4) * 5.0 + loopNoise(now, 3.7, 2.1) * 1.4) * suppressWander
    const dPitch = (loopNoise(now, 9.1, 1.3) * 3.8 + loopNoise(now, 4.3, 0.7) * 1.1) * suppressWander
    const dRoll = loopNoise(now, 13.7, 3.2) * 1.8 * suppressWander
    const breath = 1 + Math.sin((now / 3.4) * Math.PI * 2) * 0.008

    const lookInfluence = this.cur === 'loading' || this.cur === 'nodding' ? 0 : this.lookMix
    const gaze: HeadGaze = {
      yaw: lerp(pose.gaze.yaw, this.lookYaw, lookInfluence) + dYaw,
      pitch: lerp(pose.gaze.pitch, this.lookPitch, lookInfluence) + dPitch,
      roll: pose.gaze.roll + dRoll,
    }

    // Natural blink + transition blink
    const naturalLid = this.cur === 'loading' || this.cur === 'celebrate' ? 1 : blinkLid(now)
    const forcedT = clamp((now - this.forcedBlinkAt) / 0.16)
    const forcedLid = forcedT < 1 ? Math.abs(forcedT * 2 - 1) : 1
    const lid = Math.min(naturalLid, forcedLid)

    // Render either 3D spherical eyes OR true continuous eye-to-spinner orbital morph!
    const eyes: RenderedEye[] = []
    const spinnerArcs: SpinnerArc[] = []

    const sm = pose.spinnerMorph
    if (sm < 0.42) {
      // Phase 0 -> 0.42: Normal 3D spherical eyes, gradually pulling into orbital dots if entering loading
      const pull = clamp(sm / 0.42)
      const poses = eyePoses(gaze, R, pose.split)
      const orbitR = R * 0.34
      for (let i = 0; i < 2; i++) {
        const e = poses[i]!
        if (e.depth <= 0.02) continue
        const cfg = pose.eyes[i]!
        const phi = deg(cfg.tilt)
        const cp = Math.cos(phi)
        const sp = Math.sin(phi)
        const ax = e.a * cp + e.c * sp
        const ay = e.b * cp + e.d * sp
        const cx2 = -e.a * sp + e.c * cp
        const cy2 = -e.b * sp + e.d * cp
        const k = blinkScale(Math.min(lid, cfg.open))

        const targetAngle = pose.spinnerAngle + i * Math.PI
        const targetX = Math.cos(targetAngle) * orbitR
        const targetY = Math.sin(targetAngle) * orbitR

        const ex = lerp(e.x, targetX, pull)
        const ey = lerp(e.y, targetY, pull)

        // Blend tangent matrix toward identity as eye becomes an orbital dot
        const ma = lerp(ax, 1, pull)
        const mb = lerp(ay * k, 0, pull)
        const mc = lerp(cx2, 0, pull)
        const md = lerp(cy2 * k, 1, pull)

        const ew = cfg.w * R
        const eh = lerp(cfg.h * R, ew, pull)
        const d = cfg.arch > 0.5 && pull < 0.2 ? happyArchPath(ew, eh) : capsulePath(ew, eh)

        eyes.push({
          d,
          matrix: `matrix(${r2(ma)},${r2(mb)},${r2(mc)},${r2(md)},${r2(ex)},${r2(ey)})`,
          alpha: clamp(e.depth / 0.14),
        })
      }
    } else {
      // Phase 0.42 -> 1.0: The exact two orbital eye dots stretch into chasing arcs!
      const stretchT = easeInOutCubic(clamp((sm - 0.42) / 0.58))
      const orbitR = R * 0.34
      const strokeW = BASE_EYE_W * 1.88 * R
      const breathe = 0.5 + 0.5 * Math.sin(now * 2.9)
      const sweep = lerp(0.02, 1.12 + breathe * 0.82, stretchT)
      for (let i = 0; i < 2; i++) {
        const a0 = pose.spinnerAngle + i * Math.PI - sweep * 0.5
        spinnerArcs.push({
          d: orbitalArcPath(orbitR, a0, sweep),
          strokeWidth: r2(strokeW),
          opacity: 1,
        })
      }
    }

    return {
      bodyPath: BASE_HEAD_PATH,
      eyes,
      spinnerArcs,
      tint: pose.tint,
      offX: pose.offX + loopNoise(now, 7.9, 1.9) * 0.9,
      offY: pose.offY + loopNoise(now, 5.3, 0.3) * 1.1,
      sx: pose.sx,
      sy: pose.sy * breath,
      headRot: pose.headRot,
      sparkle: pose.sparkle,
      sparklePhase: now,
    }
  }
}
