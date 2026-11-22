import { useLayoutEffect, useRef, useState } from 'react'
import { assetUrl } from '../assetUrl'
import type { GeoLesson } from '../pageTypes'
import type { CatchupLesson } from '../data/catchupCourses'
import './divergingPath.css'

export type PathLessonStat = {
  correct: number
  total: number
  tier: 'none' | 'attempted' | 'good' | 'mastered'
}

type PathCurve = {
  id: string
  d: string
  kind: 'main' | 'branch'
}

export function DivergingLevelPath({
  lessons,
  catchups,
  showCatchupPaths,
  selectedId,
  getStat,
  hasResume,
  onSelect,
  onOpen,
  registerNodeRef,
}: {
  lessons: GeoLesson[]
  catchups: CatchupLesson[]
  showCatchupPaths: boolean
  selectedId: string
  getStat: (lessonId: string) => PathLessonStat | undefined
  hasResume: (lessonId: string) => boolean
  onSelect: (lesson: GeoLesson) => void
  onOpen: (lessonId: string) => void
  registerNodeRef: (lessonId: string, el: HTMLButtonElement | null) => void
}) {
  const containerRef = useRef<HTMLDivElement>(null)
  const itemRefs = useRef(new Map<string, HTMLElement>())
  const [svgSize, setSvgSize] = useState({ w: 0, h: 0 })
  const [curves, setCurves] = useState<PathCurve[]>([])

  // Group catch-up lessons by the main lesson they support
  const catchupsByTarget = new Map<string, CatchupLesson[]>()
  if (showCatchupPaths) {
    for (const c of catchups) {
      const arr = catchupsByTarget.get(c.supportsLessonId) ?? []
      arr.push(c)
      catchupsByTarget.set(c.supportsLessonId, arr)
    }
  }

  useLayoutEffect(() => {
    const container = containerRef.current
    if (!container) return

    const recompute = () => {
      const cRect = container.getBoundingClientRect()
      if (cRect.width <= 0 || cRect.height <= 0) return

      const centerOf = (id: string): { x: number; y: number } | null => {
        const el = itemRefs.current.get(id)
        if (!el) return null
        const iconEl = el.querySelector('.outline-node-anchor') ?? el.querySelector('img') ?? el
        const r = iconEl.getBoundingClientRect()
        return {
          x: r.left - cRect.left + r.width * 0.5,
          y: r.top - cRect.top + r.height * 0.5,
        }
      }

      const nextCurves: PathCurve[] = []

      // Main winding vertical cubic Bezier spine between consecutive Unit 2 lessons
      for (let i = 0; i < lessons.length - 1; i++) {
        const p1 = centerOf(lessons[i]!.id)
        const p2 = centerOf(lessons[i + 1]!.id)
        if (!p1 || !p2) continue
        const midY = (p1.y + p2.y) * 0.5
        nextCurves.push({
          id: `main-${lessons[i]!.id}-${lessons[i + 1]!.id}`,
          kind: 'main',
          d: `M ${p1.x.toFixed(1)} ${p1.y.toFixed(1)} C ${p1.x.toFixed(1)} ${midY.toFixed(1)}, ${p2.x.toFixed(1)} ${midY.toFixed(1)}, ${p2.x.toFixed(1)} ${p2.y.toFixed(1)}`,
        })
      }

      // Dashed lateral diverging & merge-back spurs for catch-up nodes
      if (showCatchupPaths) {
        lessons.forEach((lesson, idx) => {
          const branchList = catchupsByTarget.get(lesson.id)
          if (!branchList?.length) return
          const targetPt = centerOf(lesson.id)
          if (!targetPt) return
          const prevPt = idx > 0 ? centerOf(lessons[idx - 1]!.id) : null
          const originPt = prevPt ?? { x: targetPt.x, y: Math.max(12, targetPt.y - 120) }

          for (const c of branchList) {
            const cPt = centerOf(c.id)
            if (!cPt) continue
            // Diverge from origin (or upper spine) -> catchup node -> merge back into target main lesson
            const midInY = (originPt.y + cPt.y) * 0.5
            const midOutY = (cPt.y + targetPt.y) * 0.5
            nextCurves.push({
              id: `branch-in-${c.id}`,
              kind: 'branch',
              d: `M ${originPt.x.toFixed(1)} ${originPt.y.toFixed(1)} C ${originPt.x.toFixed(1)} ${midInY.toFixed(1)}, ${cPt.x.toFixed(1)} ${midInY.toFixed(1)}, ${cPt.x.toFixed(1)} ${cPt.y.toFixed(1)}`,
            })
            nextCurves.push({
              id: `branch-out-${c.id}`,
              kind: 'branch',
              d: `M ${cPt.x.toFixed(1)} ${cPt.y.toFixed(1)} C ${cPt.x.toFixed(1)} ${midOutY.toFixed(1)}, ${targetPt.x.toFixed(1)} ${midOutY.toFixed(1)}, ${targetPt.x.toFixed(1)} ${targetPt.y.toFixed(1)}`,
            })
          }
        })
      }

      setSvgSize({ w: cRect.width, h: cRect.height })
      setCurves(nextCurves)
    }

    recompute()
    const ro = new ResizeObserver(recompute)
    ro.observe(container)
    window.addEventListener('resize', recompute)
    return () => {
      ro.disconnect()
      window.removeEventListener('resize', recompute)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [lessons, showCatchupPaths])

  return (
    <div ref={containerRef} className="outline-nodes outline-nodes-with-svg">
      {svgSize.w > 0 && svgSize.h > 0 && (
        <svg
          className="outline-path-svg"
          width={svgSize.w}
          height={svgSize.h}
          viewBox={`0 0 ${svgSize.w} ${svgSize.h}`}
          aria-hidden="true"
        >
          {curves.map(c => (
            <path
              key={c.id}
              d={c.d}
              className={c.kind === 'main' ? 'outline-spine-curve' : 'outline-branch-curve'}
            />
          ))}
        </svg>
      )}

      {lessons.map((lesson, ni) => {
        const isSelected = lesson.id === selectedId
        const stat = getStat(lesson.id)
        const tier = stat?.tier ?? 'none'
        const inProgress = !stat && hasResume(lesson.id)
        const icon =
          tier === 'mastered'
            ? isSelected
              ? 'complete-selected'
              : 'complete'
            : lesson.isReview
              ? 'review'
              : isSelected
                ? 'selected'
                : 'lesson'

        const branchNodes = catchupsByTarget.get(lesson.id) ?? []

        return (
          <div key={lesson.id} className="outline-node-cluster">
            {branchNodes.length > 0 && (
              <div className="outline-branch-row">
                {branchNodes.map(c => {
                  const cSelected = c.id === selectedId
                  const cStat = getStat(c.id)
                  const cDone = cStat?.tier === 'mastered' || cStat?.tier === 'good'
                  return (
                    <button
                      key={c.id}
                      type="button"
                      className={`outline-catchup-node is-${c.branchSide}${cSelected ? ' is-selected' : ''}${
                        cDone ? ' is-done' : ''
                      }`}
                      ref={el => {
                        if (el) itemRefs.current.set(c.id, el)
                        else itemRefs.current.delete(c.id)
                        registerNodeRef(c.id, el)
                      }}
                      aria-label={`${c.title}, ${c.minutes} minute catch-up`}
                      aria-pressed={cSelected}
                      onClick={() => onSelect(c)}
                      onDoubleClick={() => onOpen(c.id)}
                    >
                      <span className="outline-node-anchor outline-catchup-dot" aria-hidden="true">
                        {cDone ? (
                          <svg width="18" height="18" viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="2.6" strokeLinecap="round" strokeLinejoin="round">
                            <path d="M4.5 10.5 L8.2 14.2 L15.8 6.2" />
                          </svg>
                        ) : (
                          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                            <path d="M6 3v12" />
                            <circle cx="18" cy="6" r="3" />
                            <circle cx="6" cy="18" r="3" />
                            <path d="M18 9a9 9 0 0 1-9 9" />
                          </svg>
                        )}
                      </span>
                      <span className="outline-catchup-meta">
                        <span className="outline-catchup-title">{c.shortTitle}</span>
                        <span className="outline-catchup-sub">Catch-up · {c.minutes}m</span>
                      </span>
                    </button>
                  )
                })}
              </div>
            )}

            <button
              type="button"
              className="outline-node"
              data-mastery={tier}
              ref={el => {
                if (el) itemRefs.current.set(lesson.id, el)
                else itemRefs.current.delete(lesson.id)
                registerNodeRef(lesson.id, el)
              }}
              style={{ transform: `translateX(${[0, -1, 0, 1][ni % 4]! * 12}%)` }}
              aria-label={`${lesson.title}${
                stat ? `, ${stat.correct} of ${stat.total} checks` : inProgress ? ', in progress' : ''
              }`}
              aria-pressed={isSelected}
              onClick={() => onSelect(lesson)}
              onDoubleClick={() => onOpen(lesson.id)}
            >
              <img className="outline-node-anchor" src={assetUrl(`/assets/courses/node-${icon}.svg`)} alt="" />
              <span className="outline-node-label">{lesson.shortTitle}</span>
              {stat && stat.total > 0 && (
                <span className={`outline-node-score is-${tier}`}>
                  {stat.correct}/{stat.total}
                </span>
              )}
              {inProgress && <span className="outline-node-score is-progress">Resume</span>}
            </button>
          </div>
        )
      })}
    </div>
  )
}
