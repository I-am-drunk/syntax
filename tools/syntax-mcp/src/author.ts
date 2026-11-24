import type { GeoColor, GeoScene } from '../../../src/mpm2d/types.js'
import {
  lineThrough,
  perpendicularThrough,
  midpoint,
  circleThrough,
  rightAngleAtIntersection,
  computeAutoBounds,
} from './sceneBuilders.js'
import type { ToolResult } from './types.js'

export interface SceneBuilderOp {
  op: 'line_through' | 'perpendicular_through' | 'midpoint' | 'circle_through' | 'right_angle_at_intersection' | 'point' | 'segment'
  id?: string
  p1?: [number, number]
  p2?: [number, number]
  baseLineId?: string
  line1Id?: string
  line2Id?: string
  point?: [number, number]
  center?: [number, number]
  throughPoint?: [number, number]
  label?: string
  showCoords?: boolean
  color?: GeoColor
  dashed?: boolean
  dim?: boolean
}

export function buildVerifiedScene(ops: SceneBuilderOp[], pad = 2): ToolResult<{ scene: GeoScene }> {
  const scene: GeoScene = {
    lines: [],
    segments: [],
    points: [],
    circles: [],
    rightAngles: [],
  }
  const namedLines = new Map<string, { a: number; b: number; c: number }>()

  for (const op of ops) {
    switch (op.op) {
      case 'point': {
        if (!op.point) throw new Error('point op requires `point: [x, y]`')
        scene.points!.push({
          id: op.id ?? `pt-${scene.points!.length + 1}`,
          x: op.point[0],
          y: op.point[1],
          label: op.label,
          showCoords: op.showCoords ?? true,
          color: op.color ?? 'blue',
          dim: op.dim,
        })
        break
      }
      case 'segment': {
        if (!op.p1 || !op.p2) throw new Error('segment op requires `p1` and `p2`')
        scene.segments!.push({
          from: op.p1,
          to: op.p2,
          color: op.color ?? 'blue',
          dashed: op.dashed,
          label: op.label,
          dim: op.dim,
        })
        break
      }
      case 'line_through': {
        if (!op.p1 || !op.p2) throw new Error('line_through requires `p1` and `p2`')
        const line = lineThrough(op.p1, op.p2, {
          color: op.color ?? 'blue',
          dashed: op.dashed,
          label: op.label,
          dim: op.dim,
        })
        scene.lines!.push(line)
        if (op.id) namedLines.set(op.id, line)
        break
      }
      case 'perpendicular_through': {
        if (!op.baseLineId || !op.point) {
          throw new Error('perpendicular_through requires `baseLineId` and `point`')
        }
        const base = namedLines.get(op.baseLineId)
        if (!base) throw new Error(`Unknown baseLineId "${op.baseLineId}"`)
        const line = perpendicularThrough(base, op.point, {
          color: op.color ?? 'teal',
          dashed: op.dashed,
          label: op.label,
          dim: op.dim,
        })
        scene.lines!.push(line)
        if (op.id) namedLines.set(op.id, line)
        break
      }
      case 'midpoint': {
        if (!op.p1 || !op.p2) throw new Error('midpoint requires `p1` and `p2`')
        scene.points!.push(
          midpoint(op.p1, op.p2, {
            id: op.id ?? 'm',
            label: op.label ?? 'M',
            showCoords: op.showCoords ?? true,
            color: op.color ?? 'teal',
          }),
        )
        break
      }
      case 'circle_through': {
        if (!op.center || !op.throughPoint) {
          throw new Error('circle_through requires `center` and `throughPoint`')
        }
        scene.circles!.push(
          circleThrough(op.center, op.throughPoint, {
            color: op.color ?? 'blue',
            dashed: op.dashed,
            label: op.label,
            dim: op.dim,
          }),
        )
        break
      }
      case 'right_angle_at_intersection': {
        if (!op.line1Id || !op.line2Id) {
          throw new Error('right_angle_at_intersection requires `line1Id` and `line2Id`')
        }
        const l1 = namedLines.get(op.line1Id)
        const l2 = namedLines.get(op.line2Id)
        if (!l1 || !l2) throw new Error(`Unknown line IDs "${op.line1Id}", "${op.line2Id}"`)
        scene.rightAngles!.push(rightAngleAtIntersection(l1, l2, { color: op.color ?? 'green' }))
        break
      }
    }
  }

  const bounds = computeAutoBounds(scene, pad)
  const finalScene: GeoScene = {
    ...bounds,
    ...(scene.lines!.length ? { lines: scene.lines } : {}),
    ...(scene.segments!.length ? { segments: scene.segments } : {}),
    ...(scene.circles!.length ? { circles: scene.circles } : {}),
    ...(scene.rightAngles!.length ? { rightAngles: scene.rightAngles } : {}),
    ...(scene.points!.length ? { points: scene.points } : {}),
  }

  return {
    ok: true,
    summary: `Built verified GeoScene with ${ops.length} geometric operation(s).`,
    evidence: { scene: finalScene },
    unknowns: [],
  }
}
