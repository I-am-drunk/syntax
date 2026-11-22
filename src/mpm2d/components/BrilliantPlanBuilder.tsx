import { useEffect, useLayoutEffect, useRef, useState } from 'react'
import type { CSSProperties, PointerEvent as ReactPointerEvent } from 'react'
import type { PlanBlock, ValidPlan } from '../types'
import type { ChoiceEvaluation } from './BrilliantChoice'
import { MathText } from './MathText'

type Source = { kind: 'bank' | 'line'; index: number }
type Point = { x: number; y: number }
type Box = Point & { width: number; height: number }
type Move = { blockId: string; source: Source; from: Box; to: Box }
type Gesture = {
  kind: 'pressed' | 'dragging'
  source: Source
  blockId: string
  start: Point
  point: Point
  box: Box
  pointerId: number
  targets: { source: Source; rect: Box }[]
}
type Settling = {
  kind: 'settling'
  moves: Move[]
  next: (string | null)[]
  started: boolean
  destination: Source | null
}
type Transient = Gesture | Settling | null

const keyOf = (source: Source) => `${source.kind}-${source.index}`
const sameSource = (a: Source, b: Source) => a.kind === b.kind && a.index === b.index

function RowMark({ kind }: { kind: 'success' | 'match' | 'mismatch' }) {
  return (
    <div className="grid-row-mark" data-kind={kind} aria-hidden="true">
      <svg width="12" height="12" viewBox="0 0 12 12" fill="none">
        <path
          fill="white"
          d={
            kind === 'mismatch'
              ? 'M6 4.62069L2.37931 1L1 2.37931L4.62069 6L1 9.62069L2.37931 11L6 7.37931L9.62069 11L11 9.62069L7.37931 6L11 2.37931L9.62069 1L6 4.62069Z'
              : 'M12 3.00002L10.5882 1.58826L4.58824 7.58826L1.41176 4.41178L0 5.82354L4.58827 10.4117L12 3.00002Z'
          }
        />
      </svg>
    </div>
  )
}

function DragGrip() {
  return (
    <svg
      width="12"
      height="14"
      viewBox="0 0 12 14"
      fill="none"
      className="br-drag-grip"
      aria-hidden="true"
    >
      <circle cx="3.5" cy="3" r="1.25" fill="currentColor" />
      <circle cx="8.5" cy="3" r="1.25" fill="currentColor" />
      <circle cx="3.5" cy="7" r="1.25" fill="currentColor" />
      <circle cx="8.5" cy="7" r="1.25" fill="currentColor" />
      <circle cx="3.5" cy="11" r="1.25" fill="currentColor" />
      <circle cx="8.5" cy="11" r="1.25" fill="currentColor" />
    </svg>
  )
}

export function BrilliantPlanBuilder({
  pool,
  chosen,
  expectedSlots,
  validPlans,
  dynamicSlots = false,
  hideRowHints = false,
  defaultOralTest = false,
  evaluation,
  feedback,
  active,
  onChange,
  onSound,
}: {
  pool: PlanBlock[]
  chosen: string[]
  expectedSlots: number
  validPlans?: ValidPlan[]
  /** When true, grows dynamically without leaking exact step count */
  dynamicSlots?: boolean
  /** When true, suppresses Wordle-style per-row green/red marks on retries */
  hideRowHints?: boolean
  defaultOralTest?: boolean
  evaluation: ChoiceEvaluation
  feedback?: string
  active: boolean
  onChange: (next: string[]) => void
  onSound?: (cue: 'drag-started' | 'drag-released') => void
}) {
  const locked = evaluation !== 'unsubmitted'
  const slotCount = dynamicSlots
    ? Math.min(pool.length, Math.max(2, chosen.length + (locked ? 0 : 1)))
    : Math.max(
        expectedSlots,
        chosen.length,
        ...(validPlans?.map(vp => vp.steps.length) ?? [expectedSlots]),
      )

  const makeInitialSlots = (ids: string[], count: number): (string | null)[] => {
    const arr: (string | null)[] = Array(count).fill(null)
    for (let i = 0; i < Math.min(ids.length, count); i++) {
      arr[i] = ids[i]
    }
    return arr
  }

  const rootRef = useRef<HTMLDivElement>(null)
  const [slots, setSlots] = useState<(string | null)[]>(() => makeInitialSlots(chosen, slotCount))
  const slotsRef = useRef(slots)
  slotsRef.current = slots

  const [transient, setTransient] = useState<Transient>(null)
  const [oralHidden, setOralHidden] = useState<boolean>(defaultOralTest)
  const transientRef = useRef<Transient>(null)
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const generationRef = useRef(0)

  const blockById = (id: string | null): PlanBlock | null =>
    id ? pool.find(b => b.id === id) ?? null : null
  const bankIndexOf = (id: string) => pool.findIndex(b => b.id === id)

  const changeTransient = (value: Transient) => {
    transientRef.current = value
    setTransient(value)
  }

  const cancelEdit = () => {
    generationRef.current += 1
    if (timerRef.current !== null) {
      clearTimeout(timerRef.current)
      timerRef.current = null
    }
    changeTransient(null)
  }

  // Keep slots synchronized if parent resets or switches page
  useEffect(() => {
    const compacted = slotsRef.current.filter((x): x is string => x !== null)
    const same =
      compacted.length === chosen.length && compacted.every((id, i) => id === chosen[i])
    if (!same || slotsRef.current.length !== slotCount) {
      cancelEdit()
      const next = makeInitialSlots(chosen, slotCount)
      slotsRef.current = next
      setSlots(next)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [chosen, slotCount, pool])

  useEffect(() => {
    return () => {
      generationRef.current += 1
      if (timerRef.current !== null) clearTimeout(timerRef.current)
    }
  }, [])

  const measureBox = (source: Source): Box | null => {
    const root = rootRef.current
    if (!root) return null
    const origin = root.getBoundingClientRect()
    const node = root.querySelector<HTMLElement>(`[data-plan-location="${keyOf(source)}"]`)
    if (!node) return null
    const rect = node.getBoundingClientRect()
    return {
      x: rect.x - origin.x,
      y: rect.y - origin.y,
      width: rect.width,
      height: rect.height,
    }
  }

  const localPoint = (clientX: number, clientY: number): Point => {
    const rect = rootRef.current!.getBoundingClientRect()
    return { x: clientX - rect.x, y: clientY - rect.y }
  }

  const commitSlots = (next: (string | null)[]) => {
    slotsRef.current = next
    setSlots(next)
    onChange(next.filter((x): x is string => x !== null))
  }

  const settle = (gesture: Gesture, destination: Source) => {
    const from = gesture.source
    const next = [...slotsRef.current]
    const measured = (source: Source): Box | null =>
      gesture.targets.find(t => sameSource(t.source, source))?.rect ?? measureBox(source)

    const homeIndex = bankIndexOf(gesture.blockId)
    const home: Source = { kind: 'bank', index: Math.max(0, homeIndex) }
    const to: Source = destination.kind === 'bank' ? home : destination
    const moves: Move[] = []

    if (from.kind === 'line' && to.kind === 'line' && from.index !== to.index) {
      // Shift intermediate tiles cleanly so reordering matches the live visual shift
      const dir = to.index > from.index ? 1 : -1
      for (let i = from.index; i !== to.index; i += dir) {
        const shiftedId = next[i + dir]
        next[i] = shiftedId
        if (shiftedId) {
          const sFrom = measured({ kind: 'line', index: i + dir })
          const sTo = measured({ kind: 'line', index: i })
          if (sFrom && sTo) {
            moves.push({ blockId: shiftedId, source: { kind: 'line', index: i + dir }, from: sFrom, to: sTo })
          }
        }
      }
      next[to.index] = gesture.blockId
    } else {
      if (from.kind === 'line') {
        next[from.index] = null
      }
      if (to.kind === 'line') {
        const displaced = next[to.index]
        if (displaced !== null && displaced !== gesture.blockId) {
          const returnTo: Source = { kind: 'bank', index: Math.max(0, bankIndexOf(displaced)) }
          const dispFrom = measured(to)
          const dispTo = measured(returnTo)
          if (dispFrom && dispTo) {
            moves.push({ blockId: displaced, source: to, from: dispFrom, to: dispTo })
          }
        }
        next[to.index] = gesture.blockId
      }
    }

    const fromBox: Box = { ...gesture.box }
    if (gesture.kind === 'dragging') {
      fromBox.x += gesture.point.x - gesture.start.x
      fromBox.y += gesture.point.y - gesture.start.y - 8
    }
    const toBox = measured(to)
    if (toBox) {
      moves.push({ blockId: gesture.blockId, source: from, from: fromBox, to: toBox })
    }

    onSound?.('drag-released')

    if (moves.length === 0) {
      changeTransient(null)
      commitSlots(next)
      return
    }

    const token = ++generationRef.current
    changeTransient({
      kind: 'settling',
      moves,
      next,
      started: false,
      destination: gesture.kind === 'dragging' ? to : null,
    })

    timerRef.current = setTimeout(() => {
      if (token !== generationRef.current) return
      timerRef.current = null
      changeTransient(null)
      commitSlots(next)
    }, 220)
  }

  const press = (event: ReactPointerEvent, source: Source, blockId: string) => {
    if (!active || locked || transientRef.current || event.button !== 0) return
    event.preventDefault()

    const point =
      event.pointerType === 'mouse'
        ? localPoint(Math.floor(event.clientX), Math.floor(event.clientY))
        : localPoint(event.clientX, event.clientY)
    const rect = event.currentTarget.getBoundingClientRect()
    const origin = rootRef.current!.getBoundingClientRect()

    const sources: Source[] = [
      ...pool.map((_, index) => ({ kind: 'bank' as const, index })),
      ...slotsRef.current.map((_, index) => ({ kind: 'line' as const, index })),
    ]
    const targets: { source: Source; rect: Box }[] = []
    for (const s of sources) {
      const b = measureBox(s)
      if (b) targets.push({ source: s, rect: b })
    }

    changeTransient({
      kind: 'pressed',
      source,
      blockId,
      start: point,
      point,
      targets,
      pointerId: event.pointerId,
      box: {
        x: rect.x - origin.x,
        y: rect.y - origin.y,
        width: rect.width,
        height: rect.height,
      },
    })
  }

  const dropTarget = (gesture: Gesture): Source | null => {
    const tile: Box = {
      ...gesture.box,
      x: gesture.box.x + gesture.point.x - gesture.start.x,
      y: gesture.box.y + gesture.point.y - gesture.start.y,
    }
    let best: Source | null = null
    let bestArea = 0
    for (const { source, rect } of gesture.targets) {
      const overlapW = Math.max(0, Math.min(tile.x + tile.width, rect.x + rect.width) - Math.max(tile.x, rect.x))
      const overlapH = Math.max(0, Math.min(tile.y + tile.height, rect.y + rect.height) - Math.max(tile.y, rect.y))
      const area = overlapW * overlapH
      if (area > bestArea) {
        bestArea = area
        best = source
      }
    }
    return best
  }

  useLayoutEffect(() => {
    if (!active) {
      if (transientRef.current && transientRef.current.kind !== 'settling') cancelEdit()
      return
    }
    const movePointer = (event: PointerEvent) => {
      const state = transientRef.current
      if (!state || state.kind === 'settling' || state.pointerId !== event.pointerId) return
      const point = localPoint(event.clientX, event.clientY)
      const distance = Math.hypot(point.x - state.start.x, point.y - state.start.y)
      const kind = state.kind === 'dragging' || distance > 5 ? 'dragging' : 'pressed'
      changeTransient({ ...state, kind, point })
      if (state.kind === 'pressed' && kind === 'dragging') {
        onSound?.('drag-started')
      }
    }
    const releasePointer = (event: PointerEvent) => {
      const state = transientRef.current
      if (!state || state.kind === 'settling' || state.pointerId !== event.pointerId) return
      const gesture: Gesture = { ...state, point: localPoint(event.clientX, event.clientY) }

      if (state.kind === 'dragging') {
        const target = dropTarget(gesture)
        if (target) {
          settle(gesture, target)
        } else if (state.source.kind === 'line') {
          // Dragging a placed step outside the slots cleanly returns it to the bank
          settle(gesture, { kind: 'bank', index: Math.max(0, bankIndexOf(state.blockId)) })
        } else {
          changeTransient(null)
        }
        return
      }

      // Short tap behavior (matching Brilliant GridProblem)
      if (state.source.kind === 'line') {
        settle(gesture, { kind: 'bank', index: Math.max(0, bankIndexOf(state.blockId)) })
        return
      }
      const firstEmpty = slotsRef.current.indexOf(null)
      if (firstEmpty < 0) {
        cancelEdit()
        return
      }
      settle(gesture, { kind: 'line', index: firstEmpty })
    }
    const cancelPointer = (event: PointerEvent) => {
      const state = transientRef.current
      if (state && state.kind !== 'settling' && state.pointerId === event.pointerId) cancelEdit()
    }
    document.addEventListener('pointermove', movePointer)
    document.addEventListener('pointerup', releasePointer)
    document.addEventListener('pointercancel', cancelPointer)
    return () => {
      document.removeEventListener('pointermove', movePointer)
      document.removeEventListener('pointerup', releasePointer)
      document.removeEventListener('pointercancel', cancelPointer)
    }
  })

  // Trigger settling CSS transform transition on next animation frame
  useLayoutEffect(() => {
    const pending = transientRef.current
    if (!active || pending?.kind !== 'settling' || pending.started) return
    const root = rootRef.current
    if (root) {
      for (const node of root.querySelectorAll('.grid-settling')) {
        void getComputedStyle(node).transform
      }
    }
    const token = generationRef.current
    const frame = requestAnimationFrame(() => {
      if (token === generationRef.current && transientRef.current === pending) {
        changeTransient({ ...pending, started: true })
      }
    })
    return () => cancelAnimationFrame(frame)
  }, [active, transient])

  // Keyboard shortcuts (1-9 to place/remove, Backspace to remove last placed)
  useEffect(() => {
    if (!active || locked || oralHidden) return
    const onKey = (e: KeyboardEvent) => {
      if (
        e.target instanceof HTMLInputElement ||
        e.target instanceof HTMLTextAreaElement ||
        (e.target as HTMLElement | null)?.closest('[data-pen-workspace]') ||
        e.metaKey ||
        e.ctrlKey ||
        e.altKey ||
        transientRef.current
      ) {
        return
      }
      const n = Number(e.key)
      if (n >= 1 && n <= pool.length) {
        e.preventDefault()
        const id = pool[n - 1].id
        const cur = [...slotsRef.current]
        const existingIdx = cur.indexOf(id)
        if (existingIdx >= 0) {
          cur[existingIdx] = null
          onSound?.('drag-released')
          commitSlots(cur)
        } else {
          const emptyIdx = cur.indexOf(null)
          if (emptyIdx >= 0) {
            cur[emptyIdx] = id
            onSound?.('drag-released')
            commitSlots(cur)
          }
        }
      } else if (e.key === 'Backspace') {
        const cur = [...slotsRef.current]
        for (let i = cur.length - 1; i >= 0; i--) {
          if (cur[i] !== null) {
            e.preventDefault()
            cur[i] = null
            onSound?.('drag-released')
            commitSlots(cur)
            break
          }
        }
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [active, locked, pool])

  // Row feedback marks (matching Brilliant's success / match / mismatch diagnostics)
  const closestPlan = (() => {
    if (!validPlans || validPlans.length === 0) return null
    const placedIds = slots.filter((x): x is string => x !== null)
    let best = validPlans[0]
    let bestScore = -1
    for (const vp of validPlans) {
      const score = vp.steps.filter(s => placedIds.includes(s)).length
      if (score > bestScore) {
        bestScore = score
        best = vp
      }
    }
    return best
  })()

  const rowMark = (index: number): 'success' | 'match' | 'mismatch' | null => {
    if (evaluation === 'unsubmitted') return null
    const id = slots[index]
    if (!id) return null
    if (evaluation === 'correct') return 'success'
    if (hideRowHints) return null
    if (closestPlan && closestPlan.steps[index] === id) return 'match'
    return 'mismatch'
  }

  const moves: Move[] = transient?.kind === 'settling' ? transient.moves : []
  const isMoving = (source: Source) =>
    moves.some(m => sameSource(m.source, source)) ||
    (transient?.kind === 'dragging' && sameSource(transient.source, source))

  const destination =
    transient?.kind === 'dragging'
      ? dropTarget(transient)
      : transient?.kind === 'settling'
        ? transient.destination
        : null

  const isSelectedDest = (source: Source) => Boolean(destination && sameSource(source, destination))
  const placedSet = new Set(slots.filter((x): x is string => x !== null))

  return (
    <div ref={rootRef} className="grid-problem br-plan-problem">
      <div className="grid-shell br-plan-shell">
        <div className="grid-editor" aria-label="Ordered solution plan">
          <div className="grid-lines br-plan-lines">
            <div className="grid-line-numbers br-plan-numbers">
              {slots.map((_, index) => {
                const mark = rowMark(index)
                return (
                  <div
                    key={index}
                    className="grid-line-number br-plan-num"
                    data-feedback={mark ?? undefined}
                  >
                    <span style={{ opacity: mark ? 0 : 1 }}>{index + 1}</span>
                    {mark && <RowMark kind={mark} />}
                  </div>
                )
              })}
            </div>

            <div className="grid-slots br-plan-slots">
              {slots.map((blockId, index) => {
                const source: Source = { kind: 'line', index }
                const block = blockById(blockId)
                const selected = isSelectedDest(source)
                const moving = isMoving(source)
                const isNextEmpty = !block && index === slots.indexOf(null) && !locked && !transient
                return (
                  <div
                    key={index}
                    className="grid-slot br-plan-slot"
                    data-plan-location={keyOf(source)}
                  >
                    {block ? (
                      <>
                        {!locked && (
                          <div
                            className="grid-slot-backdrop br-plan-backdrop"
                            data-selected={selected ? 'true' : undefined}
                          />
                        )}
                        <div
                          className="grid-tile br-plan-tile-node"
                          data-read-only={locked ? 'true' : 'false'}
                          style={{
                            opacity: moving ? 0 : selected && transient?.kind === 'dragging' && transient.source.kind !== 'line' ? 0.45 : 1,
                            transform: (() => {
                              if (
                                transient?.kind === 'dragging' &&
                                transient.source.kind === 'line' &&
                                destination?.kind === 'line' &&
                                transient.source.index !== destination.index
                              ) {
                                const fromIdx = transient.source.index
                                const toIdx = destination.index
                                const stepY = (transient.box.height || 48) + 8
                                if (fromIdx < toIdx && index > fromIdx && index <= toIdx) {
                                  return `translateY(${-stepY}px)`
                                }
                                if (fromIdx > toIdx && index >= toIdx && index < fromIdx) {
                                  return `translateY(${stepY}px)`
                                }
                              }
                              return 'translateY(0px)'
                            })(),
                            transition: 'transform 180ms cubic-bezier(0.2, 0.9, 0.2, 1), opacity 140ms ease',
                          }}
                          onPointerDown={e => press(e, source, block.id)}
                          title={locked ? undefined : 'Drag to reorder or tap to remove'}
                        >
                          <div className="grid-tile-face br-plan-tile-face">
                            {!locked && <DragGrip />}
                            <span className="br-plan-tile-label">
                              <MathText text={block.text} />
                            </span>
                          </div>
                        </div>
                      </>
                    ) : (
                      <div
                        className="grid-slot-empty br-plan-empty"
                        data-selected={selected ? 'true' : undefined}
                      >
                        {isNextEmpty ? 'Drag or tap a step below' : ''}
                      </div>
                    )}
                  </div>
                )
              })}
            </div>
          </div>
        </div>
      </div>

      {!locked && (
        <div className="br-plan-bank-region">
          <div className="br-plan-oral-bar">
            <span className="br-plan-oral-hint">
              {oralHidden
                ? 'Oral mode: say your numbered steps out loud first.'
                : 'Drag or tap steps in order (keys 1–9).'}
            </span>
            <button
              type="button"
              className="br-plan-oral-toggle"
              data-active={oralHidden || undefined}
              onClick={() => setOralHidden(v => !v)}
            >
              {oralHidden ? 'Show Tiles' : 'Oral Test (Hide Tiles)'}
            </button>
          </div>
          {oralHidden ? (
            <div className="br-plan-oral-veil">
              <p>Say your plan out loud to Alex (no algebra, just the numbered steps), then reveal the tiles to check your sequence.</p>
              <button
                type="button"
                className="br-worked-reveal-btn"
                onClick={() => setOralHidden(false)}
              >
                Reveal Tiles &amp; Build
              </button>
            </div>
          ) : (
          <div className="br-plan-bank">
            {pool.map((block, index) => {
              const source: Source = { kind: 'bank', index }
              const isPlaced = placedSet.has(block.id)
              const moving = isMoving(source)
              const selected = isSelectedDest(source)
              return (
                <div
                  key={block.id}
                  className="br-plan-bank-slot"
                  data-plan-location={keyOf(source)}
                  data-used={isPlaced ? 'true' : undefined}
                  data-selected={selected ? 'true' : undefined}
                >
                  <div className="br-plan-bank-ghost" aria-hidden="true">
                    <span className="br-tile-num">{index + 1}</span>
                    <span>
                      <MathText text={block.text} />
                    </span>
                  </div>
                  {!isPlaced && (
                    <div
                      className="grid-tile br-plan-tile-node br-plan-bank-tile"
                      data-read-only="false"
                      style={{ opacity: moving ? 0 : 1 }}
                      onPointerDown={e => press(e, source, block.id)}
                    >
                      <div className="grid-tile-face br-plan-tile-face">
                        <span className="br-tile-num">{index + 1}</span>
                        <span className="br-plan-tile-label">
                          <MathText text={block.text} />
                        </span>
                      </div>
                    </div>
                  )}
                </div>
              )
            })}
          </div>
          )}
        </div>
      )}

      {moves.map((move, idx) => {
        const block = blockById(move.blockId)
        if (!block) return null
        return (
          <div
            key={`${generationRef.current}-${idx}`}
            className="grid-floating grid-settling br-plan-floating"
            data-started={transient?.kind === 'settling' && transient.started ? 'true' : undefined}
            style={
              {
                left: move.to.x,
                top: move.to.y,
                width: move.from.width,
                '--move-x': `${move.from.x - move.to.x}px`,
                '--move-y': `${move.from.y - move.to.y}px`,
              } as CSSProperties
            }
          >
            <div className="grid-tile-face br-plan-tile-face">
              <DragGrip />
              <span className="br-plan-tile-label">
                <MathText text={block.text} />
              </span>
            </div>
          </div>
        )
      })}

      {transient?.kind === 'dragging' && (() => {
        const block = blockById(transient.blockId)
        if (!block) return null
        return (
          <div
            className="grid-floating br-plan-floating is-dragging"
            style={{
              left: transient.box.x + transient.point.x - transient.start.x,
              top: transient.box.y + transient.point.y - transient.start.y - 8,
              width: transient.box.width,
            }}
          >
            <div className="grid-tile-face br-plan-tile-face">
              <DragGrip />
              <span className="br-plan-tile-label">
                <MathText text={block.text} />
              </span>
            </div>
          </div>
        )
      })()}

      {feedback && evaluation !== 'unsubmitted' && (
        <div className={`br-inline-note ${evaluation === 'correct' ? 'is-correct' : 'is-hint'}`}>
          <MathText text={feedback} />
        </div>
      )}
    </div>
  )
}
