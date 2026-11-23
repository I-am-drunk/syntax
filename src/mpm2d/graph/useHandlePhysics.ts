import { useEffect, useRef, useState } from 'react'
import type { DraggablePointSpec, Viewport } from './math'
import { HANDLE_METRICS } from './tokens'

export interface VisualHandleState {
  id: string
  x: number
  y: number
  dotR: number
}

interface SpringNode {
  x: number
  y: number
  vx: number
  vy: number
  dotR: number
  vDotR: number
  /** Timestamp until which viscous slow-down stays engaged during separation */
  viscousUntil: number
}

function isFreeHandle(pt: DraggablePointSpec): boolean {
  return (
    pt.direction !== 'horizontal' &&
    pt.direction !== 'vertical' &&
    pt.direction !== 'line'
  )
}

/**
 * 60fps spring-damper physics for BrilliantGraph draggable handles.
 *
 * - Normal open-space dragging stays crisp and responsive.
 * - Opt-in merge scenes slow only during the final overlap into one grid point.
 *   Adjacent grid points keep the original crisp Brilliant response.
 * - Animates the inner blue nucleus radius with Brilliant's bouncy overshoot
 *   so inner-nucleus telophase bridges track the exact live radius at 60fps.
 * - Stops RAF immediately when settled (0% idle CPU).
 */
export function useHandlePhysics(
  draggables: DraggablePointSpec[] | undefined,
  vp: Viewport,
  pressedId: string | null,
  dragOffset: { dx: number; dy: number },
  compact: boolean,
  mergeNearbyHandles: boolean,
): Record<string, VisualHandleState> {
  const m = compact ? HANDLE_METRICS.compact : HANDLE_METRICS.regular
  const nodesRef = useRef<Map<string, SpringNode>>(new Map())
  const targetsRef = useRef<Map<string, { tx: number; ty: number; tDotR: number; free: boolean }>>(
    new Map(),
  )
  const rafRef = useRef<number | null>(null)
  const lastTsRef = useRef<number>(0)
  const vpKeyRef = useRef<string>('')

  const [, setTick] = useState(0)

  const vpKey = `${vp.width}:${vp.height}:${vp.bounds.xMin}:${vp.bounds.xMax}:${vp.bounds.yMin}:${vp.bounds.yMax}`
  const vpChanged = vpKeyRef.current !== vpKey
  if (vpChanged) {
    vpKeyRef.current = vpKey
  }

  // Synchronously compute latest targets and seed any new handles (or reset on viewport change)
  const nextTargets = new Map<string, { tx: number; ty: number; tDotR: number; free: boolean }>()
  const list = draggables ?? []
  const nowPerf = typeof performance !== 'undefined' ? performance.now() : 0

  for (const pt of list) {
    const isPressed = pressedId === pt.id
    const free = isFreeHandle(pt)
    const tx = vp.toPxX(pt.x) + (isPressed ? dragOffset.dx : 0)
    const ty = vp.toPxY(pt.y) + (isPressed ? dragOffset.dy : 0)
    const baseR = free ? m.dotRadius : 4
    const pressScale = free ? m.pressScaleFree : m.pressScaleDirectional
    const tDotR = isPressed ? baseR * pressScale : baseR

    nextTargets.set(pt.id, { tx, ty, tDotR, free })

    const existing = nodesRef.current.get(pt.id)
    if (!existing || vpChanged) {
      nodesRef.current.set(pt.id, {
        x: tx,
        y: ty,
        vx: 0,
        vy: 0,
        dotR: tDotR,
        vDotR: 0,
        viscousUntil: 0,
      })
    } else if (isPressed && (!mergeNearbyHandles || nowPerf >= existing.viscousUntil)) {
      // Lock actively dragged handle 1:1 to live target so it never lags behind line or cursor
      existing.x = tx
      existing.y = ty
      existing.vx = 0
      existing.vy = 0
    }
  }

  // Remove stale handles no longer in draggables
  for (const id of Array.from(nodesRef.current.keys())) {
    if (!nextTargets.has(id)) {
      nodesRef.current.delete(id)
    }
  }

  // Detect if any free handle just entered or exited proximity of another free handle
  const freeIds = list.filter(isFreeHandle).map(p => p.id)
  const mergeDistance = m.discRadius * 1.22
  if (mergeNearbyHandles && freeIds.length >= 2) {
    for (let i = 0; i < freeIds.length; i++) {
      for (let j = i + 1; j < freeIds.length; j++) {
        const idA = freeIds[i]
        const idB = freeIds[j]
        const nA = nodesRef.current.get(idA)
        const nB = nodesRef.current.get(idB)
        const tA = nextTargets.get(idA)
        const tB = nextTargets.get(idB)
        if (!nA || !nB || !tA || !tB) continue
        const curD = Math.hypot(nA.x - nB.x, nA.y - nB.y)
        const tgtD = Math.hypot(tA.tx - tB.tx, tA.ty - tB.ty)
        // Whenever two handles are approaching, merged, or pulling apart,
        // keep viscous telophase damping active for 380ms
        if (curD < mergeDistance || tgtD < mergeDistance) {
          const until = nowPerf + 380
          nA.viscousUntil = Math.max(nA.viscousUntil, until)
          nB.viscousUntil = Math.max(nB.viscousUntil, until)
        }
      }
    }
  }

  targetsRef.current = nextTargets

  useEffect(() => {
    if (!list.length) return

    let needsRun = false
    for (const [id, tgt] of targetsRef.current.entries()) {
      const node = nodesRef.current.get(id)
      if (!node) continue
      if (
        Math.abs(node.x - tgt.tx) > 0.08 ||
        Math.abs(node.y - tgt.ty) > 0.08 ||
        Math.abs(node.dotR - tgt.tDotR) > 0.04 ||
        Math.abs(node.vx) > 0.4 ||
        Math.abs(node.vy) > 0.4 ||
        Math.abs(node.vDotR) > 0.4
      ) {
        needsRun = true
        break
      }
    }

    if (!needsRun) return
    if (rafRef.current !== null) return

    lastTsRef.current = performance.now()

    const step = (ts: number) => {
      const dt = Math.min(0.032, Math.max(0.004, (ts - lastTsRef.current) / 1000))
      lastTsRef.current = ts

      let anyMoving = false
      const entries = Array.from(targetsRef.current.entries())

      // Compute pairwise current proximity among free handles for smooth viscous modulation
      const minPeerDist = new Map<string, number>()
      for (let i = 0; i < entries.length; i++) {
        const [idA, tgtA] = entries[i]
        if (!tgtA.free) continue
        const nA = nodesRef.current.get(idA)
        if (!nA) continue
        let best = Infinity
        for (let j = 0; j < entries.length; j++) {
          if (i === j) continue
          const [idB, tgtB] = entries[j]
          if (!tgtB.free) continue
          const nB = nodesRef.current.get(idB)
          if (!nB) continue
          const dCur = Math.hypot(nA.x - nB.x, nA.y - nB.y)
          const dTgt = Math.hypot(tgtA.tx - tgtB.tx, tgtA.ty - tgtB.ty)
          best = Math.min(best, dCur, dTgt)
        }
        minPeerDist.set(idA, best)
      }

      for (const [id, tgt] of entries) {
        const node = nodesRef.current.get(id)
        if (!node) continue

        // Slow only inside the opt-in merge zone.
        const peerD = minPeerDist.get(id) ?? Infinity
        const inViscousWindow = ts < node.viscousUntil
        let viscous = 0
        if (mergeNearbyHandles && peerD < mergeDistance) {
          viscous = Math.max(
            0,
            Math.min(1, (mergeDistance - peerD) / mergeDistance),
          )
        }
        if (inViscousWindow) {
          viscous = Math.max(viscous, 0.85)
        }

        // Preserve the original crisp response until the final merge/split.
        const kPos = 540 * (1 - viscous) + 135 * viscous
        const cPos = 44 * (1 - viscous) + 23.2 * viscous

        const ax = (tgt.tx - node.x) * kPos - node.vx * cPos
        const ay = (tgt.ty - node.y) * kPos - node.vy * cPos
        node.vx += ax * dt
        node.vy += ay * dt
        node.x += node.vx * dt
        node.y += node.vy * dt

        // Bouncy Brilliant click spring for the inner blue nucleus radius
        // Matches cubic-bezier(0.34, 1.56, 0.64, 1) (~350ms with tasteful overshoot)
        const kRad = 360
        const cRad = 22.5
        const aRad = (tgt.tDotR - node.dotR) * kRad - node.vDotR * cRad
        node.vDotR += aRad * dt
        node.dotR = Math.max(2, node.dotR + node.vDotR * dt)

        const posStill =
          Math.abs(tgt.tx - node.x) < 0.14 &&
          Math.abs(tgt.ty - node.y) < 0.14 &&
          Math.abs(node.vx) < 0.8 &&
          Math.abs(node.vy) < 0.8
        const radStill =
          Math.abs(tgt.tDotR - node.dotR) < 0.04 && Math.abs(node.vDotR) < 0.4

        if (posStill) {
          node.x = tgt.tx
          node.y = tgt.ty
          node.vx = 0
          node.vy = 0
        }
        if (radStill) {
          node.dotR = tgt.tDotR
          node.vDotR = 0
        }

        if (!posStill || !radStill) {
          anyMoving = true
        }
      }

      setTick(t => (t + 1) & 0x7fffffff)

      if (anyMoving) {
        rafRef.current = requestAnimationFrame(step)
      } else {
        rafRef.current = null
      }
    }

    rafRef.current = requestAnimationFrame(step)
  })

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (rafRef.current !== null) {
        cancelAnimationFrame(rafRef.current)
        rafRef.current = null
      }
    }
  }, [])

  const snapshot: Record<string, VisualHandleState> = {}
  for (const pt of list) {
    const node = nodesRef.current.get(pt.id)
    if (node) {
      snapshot[pt.id] = { id: pt.id, x: node.x, y: node.y, dotR: node.dotR }
    } else {
      snapshot[pt.id] = {
        id: pt.id,
        x: vp.toPxX(pt.x),
        y: vp.toPxY(pt.y),
        dotR: isFreeHandle(pt) ? m.dotRadius : 4,
      }
    }
  }
  return snapshot
}
