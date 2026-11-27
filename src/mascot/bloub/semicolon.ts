// First-class 3D semicolon tail geometry and choreography for Sema inside bloub.
// Contours are sub-pixel traced from the classic semicolon typeface chart (Jenson, Palatino,
// Bembo, Poliphilus, Garamond, Gill Sans, Didot) plus the refined original hand-drawn Sema
// crescent-comma, proportioned for a slightly larger cute expressive head above.
import { closedPath, type Point } from './shape'
import type { StateId } from './states'

export type SemaTailName =
  | 'jenson'
  | 'palatino'
  | 'original'
  | 'bembo'
  | 'poliphilus'
  | 'garamond'
  | 'gill-sans'
  | 'didot'

export const DEFAULT_TAIL: SemaTailName = 'jenson'

export const SEMA_TAILS: { id: SemaTailName; label: string }[] = [
  { id: 'jenson', label: 'Jenson' },
  { id: 'palatino', label: 'Palatino' },
  { id: 'original', label: 'Original' },
  { id: 'bembo', label: 'Bembo' },
  { id: 'poliphilus', label: 'Poliphilus' },
  { id: 'garamond', label: 'Garamond' },
  { id: 'gill-sans', label: 'Gill Sans' },
  { id: 'didot', label: 'Didot' },
]

export interface TailVertex3D {
  x: number
  y: number
  z: number
}

export interface TailProfile {
  id: SemaTailName
  pivotY: number
  verts: ReadonlyArray<TailVertex3D>
}

export const TAIL_PROFILES: Record<SemaTailName, TailProfile> = {
  'jenson': {
    id: 'jenson',
    pivotY: 205.8,
    verts: [{ x: 11.4, y: -71.8, z: 5.8 }, { x: 24.6, y: -66.8, z: 5.3 }, { x: 33.7, y: -54.5, z: 4.4 }, { x: 37.0, y: -38.9, z: 3.1 }, { x: 35.5, y: -22.6, z: 1.8 }, { x: 31.2, y: -7.0, z: 0.5 }, { x: 24.7, y: 7.6, z: -0.6 }, { x: 16.3, y: 21.4, z: -1.7 }, { x: 6.3, y: 34.4, z: -2.7 }, { x: -5.3, y: 46.4, z: -3.7 }, { x: -17.9, y: 57.6, z: -4.6 }, { x: -31.2, y: 67.4, z: -5.4 }, { x: -44.2, y: 71.8, z: -5.8 }, { x: -50.5, y: 64.4, z: -5.1 }, { x: -44.3, y: 51.9, z: -4.1 }, { x: -34.0, y: 39.2, z: -3.1 }, { x: -25.0, y: 25.7, z: -2.0 }, { x: -18.6, y: 11.3, z: -0.9 }, { x: -16.8, y: -4.5, z: 0.4 }, { x: -21.1, y: -19.7, z: 1.6 }, { x: -27.8, y: -33.3, z: 2.7 }, { x: -26.2, y: -46.1, z: 3.7 }, { x: -15.4, y: -56.7, z: 4.5 }, { x: -2.3, y: -66.5, z: 5.3 }],
  },
  'palatino': {
    id: 'palatino',
    pivotY: 212.7,
    verts: [{ x: 31.7, y: -75.7, z: 6.1 }, { x: 41.1, y: -68.0, z: 5.5 }, { x: 38.2, y: -53.5, z: 4.3 }, { x: 30.8, y: -37.8, z: 3.0 }, { x: 22.7, y: -22.5, z: 1.8 }, { x: 13.7, y: -7.5, z: 0.6 }, { x: 4.7, y: 7.4, z: -0.6 }, { x: -4.6, y: 22.2, z: -1.8 }, { x: -14.2, y: 36.8, z: -3.0 }, { x: -24.5, y: 51.1, z: -4.1 }, { x: -36.3, y: 64.4, z: -5.1 }, { x: -50.5, y: 74.3, z: -5.9 }, { x: -63.3, y: 75.7, z: -6.1 }, { x: -65.8, y: 65.1, z: -5.2 }, { x: -59.4, y: 50.1, z: -4.0 }, { x: -51.2, y: 34.8, z: -2.8 }, { x: -43.8, y: 19.1, z: -1.6 }, { x: -36.7, y: 3.3, z: -0.2 }, { x: -30.7, y: -12.9, z: 1.0 }, { x: -26.4, y: -29.9, z: 2.4 }, { x: -22.4, y: -46.7, z: 3.7 }, { x: -14.8, y: -60.6, z: 4.8 }, { x: -0.3, y: -67.7, z: 5.4 }, { x: 16.4, y: -72.5, z: 5.8 }],
  },
  'original': {
    id: 'original',
    pivotY: 198.7,
    verts: [{ x: 52.3, y: -64.7, z: 5.2 }, { x: 53.7, y: -48.9, z: 3.9 }, { x: 47.9, y: -32.1, z: 2.6 }, { x: 40.7, y: -15.8, z: 1.3 }, { x: 32.7, y: 0.1, z: 0.0 }, { x: 23.6, y: 15.4, z: -1.2 }, { x: 12.6, y: 29.4, z: -2.4 }, { x: 0.5, y: 42.3, z: -3.4 }, { x: -13.9, y: 52.9, z: -4.2 }, { x: -29.7, y: 60.7, z: -4.8 }, { x: -46.5, y: 66.7, z: -5.4 }, { x: -56.7, y: 55.5, z: -4.5 }, { x: -51.1, y: 38.8, z: -3.1 }, { x: -45.1, y: 22.1, z: -1.8 }, { x: -42.6, y: 4.5, z: -0.4 }, { x: -42.9, y: -13.3, z: 1.1 }, { x: -44.9, y: -31.0, z: 2.5 }, { x: -48.0, y: -48.5, z: 3.9 }, { x: -46.6, y: -63.4, z: 5.0 }, { x: -30.9, y: -58.4, z: 4.7 }, { x: -14.4, y: -51.7, z: 4.1 }, { x: 3.3, y: -50.0, z: 4.0 }, { x: 20.9, y: -52.6, z: 4.2 }, { x: 37.0, y: -60.0, z: 4.8 }],
  },
  'bembo': {
    id: 'bembo',
    pivotY: 208.7,
    verts: [{ x: -3.0, y: -71.7, z: 5.8 }, { x: 15.1, y: -68.7, z: 5.5 }, { x: 30.2, y: -58.9, z: 4.7 }, { x: 40.1, y: -43.8, z: 3.5 }, { x: 45.2, y: -26.3, z: 2.1 }, { x: 45.6, y: -7.3, z: 0.6 }, { x: 42.4, y: 11.0, z: -0.9 }, { x: 34.8, y: 27.6, z: -2.2 }, { x: 23.9, y: 42.7, z: -3.4 }, { x: 10.0, y: 55.2, z: -4.4 }, { x: -5.5, y: 65.4, z: -5.2 }, { x: -21.4, y: 71.7, z: -5.8 }, { x: -31.7, y: 68.4, z: -5.5 }, { x: -26.1, y: 57.6, z: -4.6 }, { x: -12.5, y: 45.6, z: -3.7 }, { x: -0.5, y: 31.6, z: -2.5 }, { x: 3.7, y: 16.1, z: -1.2 }, { x: -5.8, y: 4.8, z: -0.4 }, { x: -22.5, y: -0.6, z: 0.1 }, { x: -37.1, y: -10.2, z: 0.8 }, { x: -44.7, y: -25.7, z: 2.0 }, { x: -44.3, y: -43.1, z: 3.4 }, { x: -35.9, y: -58.4, z: 4.7 }, { x: -21.1, y: -68.6, z: 5.5 }],
  },
  'poliphilus': {
    id: 'poliphilus',
    pivotY: 206.3,
    verts: [{ x: -11.1, y: -70.3, z: 5.6 }, { x: 5.7, y: -69.2, z: 5.5 }, { x: 20.8, y: -61.9, z: 4.9 }, { x: 33.1, y: -50.5, z: 4.1 }, { x: 41.1, y: -35.8, z: 2.9 }, { x: 44.8, y: -19.1, z: 1.6 }, { x: 43.9, y: -2.0, z: 0.2 }, { x: 38.8, y: 14.2, z: -1.2 }, { x: 31.4, y: 29.5, z: -2.3 }, { x: 21.2, y: 43.4, z: -3.5 }, { x: 9.1, y: 55.6, z: -4.4 }, { x: -4.7, y: 65.7, z: -5.2 }, { x: -20.2, y: 70.3, z: -5.6 }, { x: -34.2, y: 65.3, z: -5.2 }, { x: -38.6, y: 52.5, z: -4.2 }, { x: -30.7, y: 38.9, z: -3.1 }, { x: -18.6, y: 26.8, z: -2.2 }, { x: -11.3, y: 13.2, z: -1.0 }, { x: -16.3, y: -0.3, z: 0.0 }, { x: -29.4, y: -10.1, z: 0.8 }, { x: -40.6, y: -21.9, z: 1.7 }, { x: -43.6, y: -37.7, z: 3.0 }, { x: -38.4, y: -53.0, z: 4.2 }, { x: -26.6, y: -64.4, z: 5.1 }],
  },
  'garamond': {
    id: 'garamond',
    pivotY: 207.1,
    verts: [{ x: -10.3, y: -71.1, z: 5.7 }, { x: 6.3, y: -68.6, z: 5.5 }, { x: 20.9, y: -59.6, z: 4.8 }, { x: 31.9, y: -46.1, z: 3.7 }, { x: 39.0, y: -30.3, z: 2.4 }, { x: 41.0, y: -12.6, z: 1.0 }, { x: 39.2, y: 5.3, z: -0.4 }, { x: 32.9, y: 21.4, z: -1.7 }, { x: 23.6, y: 36.1, z: -2.9 }, { x: 11.7, y: 49.2, z: -3.9 }, { x: -2.5, y: 59.7, z: -4.8 }, { x: -17.8, y: 68.0, z: -5.5 }, { x: -32.0, y: 71.1, z: -5.7 }, { x: -37.0, y: 62.8, z: -5.0 }, { x: -26.8, y: 52.7, z: -4.2 }, { x: -12.8, y: 42.4, z: -3.4 }, { x: -1.8, y: 29.3, z: -2.3 }, { x: 4.4, y: 13.7, z: -1.1 }, { x: 2.5, y: -2.5, z: 0.2 }, { x: -9.0, y: -14.4, z: 1.2 }, { x: -23.3, y: -24.0, z: 2.0 }, { x: -34.0, y: -36.6, z: 2.9 }, { x: -34.9, y: -52.3, z: 4.2 }, { x: -25.5, y: -65.1, z: 5.2 }],
  },
  'gill-sans': {
    id: 'gill-sans',
    pivotY: 207.9,
    verts: [{ x: -9.4, y: -70.9, z: 5.7 }, { x: 6.2, y: -69.3, z: 5.5 }, { x: 19.3, y: -61.2, z: 4.9 }, { x: 28.5, y: -48.5, z: 3.9 }, { x: 34.6, y: -33.9, z: 2.7 }, { x: 36.8, y: -17.9, z: 1.4 }, { x: 36.0, y: -1.3, z: 0.1 }, { x: 32.4, y: 14.4, z: -1.2 }, { x: 26.1, y: 28.9, z: -2.3 }, { x: 17.4, y: 42.4, z: -3.4 }, { x: 6.5, y: 54.6, z: -4.4 }, { x: -6.2, y: 64.7, z: -5.1 }, { x: -20.0, y: 70.9, z: -5.7 }, { x: -30.0, y: 68.5, z: -5.5 }, { x: -27.0, y: 56.8, z: -4.5 }, { x: -19.6, y: 42.7, z: -3.4 }, { x: -15.3, y: 27.5, z: -2.2 }, { x: -15.2, y: 12.7, z: -1.0 }, { x: -23.6, y: 0.4, z: -0.0 }, { x: -34.8, y: -11.0, z: 0.9 }, { x: -41.4, y: -25.0, z: 2.0 }, { x: -41.3, y: -40.8, z: 3.3 }, { x: -34.6, y: -54.9, z: 4.4 }, { x: -23.8, y: -65.8, z: 5.2 }],
  },
  'didot': {
    id: 'didot',
    pivotY: 213.8,
    verts: [{ x: -12.3, y: -76.8, z: 6.2 }, { x: 6.3, y: -75.3, z: 6.0 }, { x: 22.7, y: -65.6, z: 5.2 }, { x: 34.1, y: -50.3, z: 4.1 }, { x: 39.5, y: -31.7, z: 2.6 }, { x: 40.3, y: -11.5, z: 0.9 }, { x: 37.1, y: 8.0, z: -0.6 }, { x: 29.6, y: 25.7, z: -2.0 }, { x: 19.3, y: 42.0, z: -3.4 }, { x: 7.1, y: 57.0, z: -4.5 }, { x: -6.7, y: 70.6, z: -5.6 }, { x: -18.4, y: 76.8, z: -6.2 }, { x: -17.0, y: 68.2, z: -5.5 }, { x: -4.9, y: 54.6, z: -4.4 }, { x: 7.6, y: 39.5, z: -3.1 }, { x: 17.1, y: 22.5, z: -1.8 }, { x: 21.8, y: 3.7, z: -0.3 }, { x: 19.2, y: -13.4, z: 1.1 }, { x: 6.6, y: -20.0, z: 1.6 }, { x: -10.8, y: -18.5, z: 1.5 }, { x: -27.9, y: -23.6, z: 1.9 }, { x: -39.2, y: -37.6, z: 3.0 }, { x: -39.4, y: -55.0, z: 4.4 }, { x: -28.9, y: -69.3, z: 5.5 }],
  },
}

export function isValidTailName(v: unknown): v is SemaTailName {
  return typeof v === 'string' && v in TAIL_PROFILES
}

export function resolveTailProfile(name?: SemaTailName | string | null): TailProfile {
  if (name && name in TAIL_PROFILES) return TAIL_PROFILES[name as SemaTailName]
  return TAIL_PROFILES[DEFAULT_TAIL]
}

export interface TailChoreography {
  extraOffX: number
  extraOffY: number
  extraYaw: number
  extraPitch: number
  extraRoll: number
  scaleMult: number
  alphaMult: number
}

/**
 * State-aware semicolon choreography inside bloub so the head and comma act as one
 * unified living semicolon character across every animation state.
 */
export function semicolonChoreography(stateId: StateId, t: number, bodyAlpha: number): TailChoreography {
  // Pure particle / dot dissolves tuck the comma smoothly away with the body
  if (stateId === 'thinking' || stateId === 'burst' || stateId === 'comet' || bodyAlpha <= 0.25) {
    return {
      extraOffX: 0,
      extraOffY: -22,
      extraYaw: 0,
      extraPitch: 0,
      extraRoll: 0,
      scaleMult: 0.48,
      alphaMult: 0,
    }
  }

  // Gentle counter-phase living semicolon float during idle / expressive states
  const breath = Math.sin(t * 2.15 - 0.65)
  const sway = Math.sin(t * 1.35 - 0.4)

  if (stateId === 'sleep') {
    return {
      extraOffX: -4,
      extraOffY: 14 + breath * 2.5,
      extraYaw: -6,
      extraPitch: 8,
      extraRoll: -9 + sway * 2,
      scaleMult: 0.94,
      alphaMult: Math.min(1, bodyAlpha),
    }
  }

  if (stateId === 'alert' || stateId === 'exclaim') {
    const snap = Math.sin(t * 8.0) * 3.5
    return {
      extraOffX: 0,
      extraOffY: 8 + snap,
      extraYaw: 0,
      extraPitch: -6,
      extraRoll: 0,
      scaleMult: 0.96,
      alphaMult: Math.min(1, bodyAlpha),
    }
  }

  if (stateId === 'play' || stateId === 'orbit' || stateId === 'swirl') {
    const spin = Math.sin(t * 4.4)
    return {
      extraOffX: spin * 16,
      extraOffY: Math.cos(t * 4.4) * 6,
      extraYaw: spin * 22,
      extraPitch: Math.cos(t * 4.4) * 10,
      extraRoll: spin * 12,
      scaleMult: 0.96,
      alphaMult: Math.min(1, bodyAlpha),
    }
  }

  return {
    extraOffX: sway * 2.2,
    extraOffY: breath * 2.4,
    extraYaw: sway * 4.5,
    extraPitch: breath * 3.0,
    extraRoll: sway * 2.5,
    scaleMult: 1,
    alphaMult: Math.min(1, bodyAlpha),
  }
}

export function projectSemicolonTail3D(
  fromProfile: TailProfile,
  toProfile: TailProfile,
  morphT: number,
  yawDeg: number,
  pitchDeg: number,
  rollDeg: number,
  bodyRotDeg: number,
  offX: number,
  offY: number,
  sx: number,
  sy: number,
  scaleMult: number,
  extraPivotY = 0,
): string {
  const m = morphT < 0 ? 0 : morphT > 1 ? 1 : morphT
  const pivotY = fromProfile.pivotY + (toProfile.pivotY - fromProfile.pivotY) * m + extraPivotY

  const deg = Math.PI / 180
  const yRad = yawDeg * deg * 0.85
  const pRad = pitchDeg * deg * 0.48
  const rRad = (rollDeg * 0.85 + bodyRotDeg * 0.72) * deg
  const cY = Math.cos(yRad), sY = Math.sin(yRad)
  const cP = Math.cos(pRad), sP = Math.sin(pRad)
  const cR = Math.cos(rRad), sR = Math.sin(rRad)

  // Genuine 3D orbital parallax beneath the turning head
  const orbitX = Math.sin(yRad) * 16
  const orbitY = -Math.sin(pRad) * 6
  const orbitRot = bodyRotDeg * deg * 0.52
  const cO = Math.cos(orbitRot), sO = Math.sin(orbitRot)
  const camZ = 620

  const n = Math.min(fromProfile.verts.length, toProfile.verts.length)
  const pts: Point[] = []
  for (let i = 0; i < n; i++) {
    const a = fromProfile.verts[i]!
    const b = toProfile.verts[i]!
    const vx = a.x + (b.x - a.x) * m
    const vy = a.y + (b.y - a.y) * m
    const vz = a.z + (b.z - a.z) * m

    const x1 = vx * cR - vy * sR
    const y1 = vx * sR + vy * cR
    const z1 = vz
    const y2 = y1 * cP - z1 * sP
    const z2 = y1 * sP + z1 * cP
    const x3 = x1 * cY + z2 * sY
    const z3 = -x1 * sY + z2 * cY

    const bx = x3 * sx * scaleMult + orbitX
    const by = (pivotY + y2 * scaleMult) * sy + orbitY
    const rx = bx * cO - by * sO + offX
    const ry = bx * sO + by * cO + offY

    const persp = camZ / (camZ - z3)
    pts.push({ x: rx * persp, y: ry * persp })
  }

  return closedPath(pts)
}

export const SEMA_REST_COMMA_PATHS: Record<SemaTailName, string> = {
  jenson: projectSemicolonTail3D(TAIL_PROFILES.jenson, TAIL_PROFILES.jenson, 1, 0, 0, 0, 0, 0, 0, 1, 1, 1),
  palatino: projectSemicolonTail3D(TAIL_PROFILES.palatino, TAIL_PROFILES.palatino, 1, 0, 0, 0, 0, 0, 0, 1, 1, 1),
  original: projectSemicolonTail3D(TAIL_PROFILES.original, TAIL_PROFILES.original, 1, 0, 0, 0, 0, 0, 0, 1, 1, 1),
  bembo: projectSemicolonTail3D(TAIL_PROFILES.bembo, TAIL_PROFILES.bembo, 1, 0, 0, 0, 0, 0, 0, 1, 1, 1),
  poliphilus: projectSemicolonTail3D(TAIL_PROFILES.poliphilus, TAIL_PROFILES.poliphilus, 1, 0, 0, 0, 0, 0, 0, 1, 1, 1),
  garamond: projectSemicolonTail3D(TAIL_PROFILES.garamond, TAIL_PROFILES.garamond, 1, 0, 0, 0, 0, 0, 0, 1, 1, 1),
  'gill-sans': projectSemicolonTail3D(TAIL_PROFILES['gill-sans'], TAIL_PROFILES['gill-sans'], 1, 0, 0, 0, 0, 0, 0, 1, 1, 1),
  didot: projectSemicolonTail3D(TAIL_PROFILES.didot, TAIL_PROFILES.didot, 1, 0, 0, 0, 0, 0, 0, 1, 1, 1),
}
