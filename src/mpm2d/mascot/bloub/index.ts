// Adapted from jeremy-prt/bloub (MIT License) for Sema in Syntax MPM2D.
import { EXPRESSIONS, EXPRESSION_BY_ID, type BotExpression, type ExpressionId } from './expressions'
import { SHAPES, SHAPE_BY_ID, COLORS, COLOR_BY_ID, mixHex, type BotShape, type ShapeId, type ColorId } from './skins'
import { STATES, STATE_BY_ID, POSES, type StateId } from './states'
import { BotEngine, type BotFrame, type Look, type RenderedEye } from './engine'
import { NOTIF_BLUE } from './decor'
import { DEMI_VIEWBOX, RAYON, RAYON as RAYON_BOULE } from './repere'

export {
  BotEngine,
  EXPRESSIONS,
  EXPRESSION_BY_ID,
  SHAPES,
  SHAPE_BY_ID,
  COLORS,
  COLOR_BY_ID,
  STATES,
  STATE_BY_ID,
  POSES,
  NOTIF_BLUE,
  DEMI_VIEWBOX,
  RAYON,
  RAYON_BOULE,
  mixHex,
}

export type { BotExpression, ExpressionId, BotShape, ShapeId, ColorId, StateId, BotFrame, Look, RenderedEye }

export type SemaExpressionName =
  | 'neutral'
  | 'attentive'
  | 'surprised'
  | 'excited'
  | 'happy'
  | 'laughing'
  | 'angry'
  | 'sad'
  | 'scared'
  | 'suspicious'
  | 'confused'
  | 'curious'
  | 'proud'
  | 'shy'
  | 'unimpressed'
  | 'sleepy'

export type SemaShapeName =
  | 'squircle'
  | 'circle'
  | 'pebble'
  | 'capsule'
  | 'triangle'
  | 'hexagon'
  | 'cloud'
  | 'droplet'

const EXPR_EN_TO_FR: Record<SemaExpressionName, ExpressionId> = {
  neutral: 'neutre',
  attentive: 'attentif',
  surprised: 'surpris',
  excited: 'excite',
  happy: 'heureux',
  laughing: 'hilare',
  angry: 'colere',
  sad: 'triste',
  scared: 'effraye',
  suspicious: 'mefiant',
  confused: 'confus',
  curious: 'curieux',
  proud: 'fier',
  shy: 'timide',
  unimpressed: 'blase',
  sleepy: 'somnolent',
}

const SHAPE_EN_TO_FR: Record<SemaShapeName, ShapeId> = {
  squircle: 'squircle',
  circle: 'cercle',
  pebble: 'galet',
  capsule: 'capsule',
  triangle: 'triangle',
  hexagon: 'hexagone',
  cloud: 'nuage',
  droplet: 'goutte',
}

export const SEMA_EXPRESSIONS: { id: SemaExpressionName; label: string }[] = [
  { id: 'neutral', label: 'Neutral' },
  { id: 'happy', label: 'Happy' },
  { id: 'laughing', label: 'Laughing' },
  { id: 'excited', label: 'Excited' },
  { id: 'proud', label: 'Proud' },
  { id: 'curious', label: 'Curious' },
  { id: 'attentive', label: 'Attentive' },
  { id: 'surprised', label: 'Surprised' },
  { id: 'confused', label: 'Confused' },
  { id: 'suspicious', label: 'Suspicious' },
  { id: 'shy', label: 'Shy' },
  { id: 'sleepy', label: 'Sleepy' },
  { id: 'unimpressed', label: 'Unimpressed' },
  { id: 'sad', label: 'Sad' },
  { id: 'angry', label: 'Angry' },
  { id: 'scared', label: 'Scared' },
]

export const SEMA_SHAPES: { id: SemaShapeName; label: string }[] = [
  { id: 'squircle', label: 'Squircle' },
  { id: 'circle', label: 'Circle' },
  { id: 'pebble', label: 'Pebble' },
  { id: 'capsule', label: 'Capsule' },
  { id: 'triangle', label: 'Triangle' },
  { id: 'hexagon', label: 'Hexagon' },
  { id: 'cloud', label: 'Cloud' },
  { id: 'droplet', label: 'Droplet' },
]

export const SEMA_ANIMATIONS: { id: StateId; label: string }[] = [
  { id: 'idle', label: 'Idle' },
  { id: 'checkbox', label: 'Checkbox' },
  { id: 'notify', label: 'Notification' },
  { id: 'thinking', label: 'Thinking' },
  { id: 'wink', label: 'Wink' },
  { id: 'wide', label: 'Wide' },
  { id: 'alert', label: 'Alert !' },
  { id: 'exclaim', label: 'Exclaim !' },
  { id: 'sleep', label: 'Sleep' },
  { id: 'egg', label: 'Egg' },
  { id: 'hexagon', label: 'Hexagon' },
  { id: 'play', label: 'Play' },
  { id: 'orbit', label: 'Orbit' },
  { id: 'swirl', label: 'Swirl' },
  { id: 'burst', label: 'Burst' },
  { id: 'comet', label: 'Comet' },
]

export function resolveExpression(name?: SemaExpressionName | ExpressionId | null): BotExpression {
  if (!name) return EXPRESSION_BY_ID.get('neutre')!
  const fr = (EXPR_EN_TO_FR as Record<string, ExpressionId>)[name] ?? (name as ExpressionId)
  return EXPRESSION_BY_ID.get(fr) ?? EXPRESSION_BY_ID.get('neutre')!
}

export function resolveShapeRadii(name?: SemaShapeName | ShapeId | null): number[] {
  const key = name ?? 'squircle'
  const fr = (SHAPE_EN_TO_FR as Record<string, ShapeId>)[key] ?? (key as ShapeId)
  return (SHAPE_BY_ID.get(fr) ?? SHAPE_BY_ID.get('squircle')!).radii
}
