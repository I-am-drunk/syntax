import { useMemo, useState } from 'react'
import type { GeoLesson } from '../pageTypes'
import type { CatchupLesson } from '../data/catchupCourses'
import './divergingPath.css'

export type PathLessonStat = {
  correct: number
  total: number
  tier: 'none' | 'attempted' | 'good' | 'mastered'
}

type NodeTone = 'done' | 'active' | 'ready' | 'catchup' | 'trophy-done' | 'trophy-locked'
type GlyphKind = 'done' | 'slope' | 'midpoint' | 'triangle' | 'circle' | 'proof' | 'catchup' | 'trophy'

function glyphForLesson(lesson: GeoLesson, isDone: boolean): GlyphKind {
  if (isDone) return 'done'
  const id = lesson.id
  if (id.includes('slope')) return 'slope'
  if (id.includes('mid')) return 'midpoint'
  if (id.includes('median') || id.includes('line') || id.includes('class')) return 'triangle'
  if (id.includes('length') || id.includes('circle') || id.includes('dist')) return 'circle'
  return 'proof'
}

function MedallionGlyph({ kind }: { kind: GlyphKind }) {
  switch (kind) {
    case 'done':
      return (
        <path
          d="M 35 43 L 44 52 L 62 33"
          fill="none"
          stroke="currentColor"
          strokeWidth="5.2"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      )
    case 'slope':
      return (
        <g fill="none" stroke="currentColor" strokeWidth="3.4" strokeLinecap="round" strokeLinejoin="round">
          <path d="M 33 52 L 61 32" />
          <path d="M 38 52 L 56 52 L 56 38" strokeOpacity="0.65" strokeDasharray="3.2 3.2" strokeWidth="2.4" />
          <circle cx="35" cy="50.5" r="3" fill="currentColor" stroke="none" />
          <circle cx="59" cy="33.5" r="3" fill="currentColor" stroke="none" />
        </g>
      )
    case 'midpoint':
      return (
        <g fill="none" stroke="currentColor" strokeWidth="3.4" strokeLinecap="round">
          <line x1="33" y1="50" x2="63" y2="34" />
          <circle cx="33" cy="50" r="3.1" fill="currentColor" stroke="none" />
          <circle cx="63" cy="34" r="3.1" fill="currentColor" stroke="none" />
          <circle cx="48" cy="42" r="5" fill="#ffffff" stroke="currentColor" strokeWidth="3" />
        </g>
      )
    case 'triangle':
      return (
        <g fill="none" stroke="currentColor" strokeWidth="3.2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M 48 29 L 33 53 L 63 53 Z" />
          <line x1="48" y1="29" x2="48" y2="53" strokeDasharray="3 3" strokeWidth="2.4" strokeOpacity="0.8" />
        </g>
      )
    case 'circle':
      return (
        <g fill="none" stroke="currentColor" strokeWidth="3.2" strokeLinecap="round">
          <circle cx="48" cy="42" r="12.5" />
          <line x1="48" y1="42" x2="58" y2="35" />
          <circle cx="48" cy="42" r="2.8" fill="currentColor" stroke="none" />
        </g>
      )
    case 'catchup':
      return (
        <path
          d="M 48 28 L 51.8 38.2 L 62 42 L 51.8 45.8 L 48 56 L 44.2 45.8 L 34 42 L 44.2 38.2 Z"
          fill="currentColor"
          stroke="currentColor"
          strokeWidth="1.5"
          strokeLinejoin="round"
        />
      )
    case 'trophy':
      return (
        <g fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
          <path d="M 39 32 H 57 V 41 C 57 46 53 49.5 48 49.5 C 43 49.5 39 46 39 41 Z" />
          <path d="M 39 34 H 34.5 C 34.5 39 36.2 41.5 39 41.5" />
          <path d="M 57 34 H 61.5 C 61.5 39 59.8 41.5 57 41.5" />
          <path d="M 48 49.5 V 54.5 M 42 54.5 H 54" />
        </g>
      )
    default:
      return (
        <g fill="none" stroke="currentColor" strokeWidth="3.1" strokeLinecap="round" strokeLinejoin="round">
          <rect x="36" y="31" width="24" height="22" rx="4" />
          <line x1="36" y1="42" x2="60" y2="42" strokeOpacity="0.6" />
          <line x1="48" y1="31" x2="48" y2="53" strokeOpacity="0.6" />
        </g>
      )
  }
}

/**
 * Crisp, anti-aliased Brilliant-evolved 3D circular medallion node.
 * Built with pure vector geometry (shapeRendering="geometricPrecision") so edges
 * stay razor-sharp on 1x, 2x, and 3x displays with zero raster aliasing.
 */
function BrilliantNodeMedallion({
  tone,
  glyph,
  selected,
  compact = false,
  inProgress = false,
}: {
  tone: NodeTone
  glyph: GlyphKind
  selected: boolean
  compact?: boolean
  inProgress?: boolean
}) {
  const w = compact ? 74 : 88
  const h = compact ? 68 : 80
  return (
    <span className={`br-medallion is-${tone}${selected ? ' is-selected' : ''}${compact ? ' is-compact' : ''}`}>
      <svg
        width={w}
        height={h}
        viewBox="0 0 96 86"
        fill="none"
        shapeRendering="geometricPrecision"
        aria-hidden="true"
      >
        {/* Active selection halo ring (Brilliant signature current indicator) */}
        {(selected || tone === 'active') && (
          <ellipse
            className="br-med-halo"
            cx="48"
            cy="46"
            rx="43.5"
            ry="34.5"
            fill="none"
            strokeWidth="3"
          />
        )}
        {/* Subtle Brilliant progress arc when a lesson is in progress */}
        {inProgress && !selected && tone !== 'active' && (
          <ellipse
            className="br-med-progress-arc"
            cx="48"
            cy="46"
            rx="43.5"
            ry="34.5"
            fill="none"
            stroke="#456dff"
            strokeWidth="3"
            strokeLinecap="round"
            strokeDasharray="112 136"
          />
        )}

        {/* Soft ambient ground shadow */}
        <ellipse cx="48" cy="54" rx="37" ry="28.5" fill="var(--med-shadow)" />

        {/* 3D cylindrical pedestal wall */}
        <path
          d="M 12 42 L 12 51 A 36 28 0 0 0 84 51 L 84 42 Z"
          fill="var(--med-base)"
        />
        <ellipse cx="48" cy="51" rx="36" ry="28" fill="var(--med-base)" />

        {/* Pressable top disc face */}
        <g className="br-med-cap">
          <ellipse
            cx="48"
            cy="42"
            rx="36"
            ry="28"
            fill="var(--med-face)"
            stroke="var(--med-rim)"
            strokeWidth="2.2"
          />
          {/* Subtle crisp top specular bevel */}
          <path
            d="M 21 34 A 31 23 0 0 1 75 34"
            fill="none"
            stroke="var(--med-sheen)"
            strokeWidth="2.2"
            strokeLinecap="round"
          />
          {/* Crisp geometric math glyph */}
          <g className="br-med-glyph">
            <MedallionGlyph kind={glyph} />
          </g>
        </g>
      </svg>
    </span>
  )
}

type PlacedNode = {
  id: string
  route: 'main' | 'catchup'
  x: number
  y: number
  title: string
  shortTitle: string
  subtitle: string
  eyebrow: string
  ctaLabel: string
  tone: NodeTone
  glyph: GlyphKind
  stat?: PathLessonStat
  inProgress: boolean
  isTrophy?: boolean
  compact?: boolean
}

type PathCurve = {
  id: string
  route: 'main' | 'catchup'
  d: string
  done?: boolean
}

function cubicPath(x1: number, y1: number, x2: number, y2: number): string {
  const midY = (y1 + y2) * 0.5
  return `M ${x1.toFixed(1)} ${y1.toFixed(1)} C ${x1.toFixed(1)} ${midY.toFixed(1)}, ${x2.toFixed(1)} ${midY.toFixed(1)}, ${x2.toFixed(1)} ${y2.toFixed(1)}`
}

export function DivergingLevelPath({
  levelNumber,
  lessons,
  catchups,
  showCatchupPaths,
  selectedId,
  popoverOpenId: _popoverOpenId,
  getStat,
  hasResume,
  onSelect,
  onTogglePopover: _onTogglePopover,
  onOpen,
  registerNodeRef,
}: {
  levelNumber: number
  lessons: GeoLesson[]
  catchups: CatchupLesson[]
  showCatchupPaths: boolean
  selectedId: string
  popoverOpenId: string | null
  getStat: (lessonId: string) => PathLessonStat | undefined
  hasResume: (lessonId: string) => boolean
  onSelect: (lessonId: string) => void
  onTogglePopover: (lessonId: string) => void
  onOpen: (lessonId: string) => void
  registerNodeRef: (lessonId: string, el: HTMLButtonElement | null) => void
}) {
  const [hoveredRoute, setHoveredRoute] = useState<'main' | 'catchup' | null>(null)
  const hasInterwovenCatchups = showCatchupPaths && catchups.length > 0

  const layout = useMemo(() => {
    const W = 420
    const center = W / 2
    const flip = levelNumber % 2 === 1 ? 1 : -1

    const firstUnfinishedIdx = lessons.findIndex(l => {
      const st = getStat(l.id)
      return !st || (st.tier !== 'mastered' && st.tier !== 'good')
    })

    const catchupsByTarget = new Map<string, CatchupLesson[]>()
    if (hasInterwovenCatchups) {
      for (const c of catchups) {
        const list = catchupsByTarget.get(c.supportsLessonId) ?? []
        list.push(c)
        catchupsByTarget.set(c.supportsLessonId, list)
      }
    }

    const nodes: PlacedNode[] = []
    const curves: PathCurve[] = []

    const mainCoords: Array<{ id: string; x: number; y: number; done: boolean }> = []
    let cursorY = 58

    lessons.forEach((lesson, idx) => {
      const st = getStat(lesson.id)
      const isDone = st?.tier === 'mastered' || st?.tier === 'good'
      const isActive = idx === firstUnfinishedIdx || (firstUnfinishedIdx === -1 && idx === lessons.length - 1)
      const resume = hasResume(lesson.id)

      const attachedCatchups = catchupsByTarget.get(lesson.id) ?? []

      // If interwoven catch-ups precede this main lesson, branch them cleanly along the right lane
      if (hasInterwovenCatchups && attachedCatchups.length > 0) {
        const anchorPrev = mainCoords[mainCoords.length - 1]
        const branchStartX = anchorPrev ? anchorPrev.x : 126
        const branchStartY = anchorPrev ? anchorPrev.y : Math.max(24, cursorY - 34)

        let prevCx = branchStartX
        let prevCy = branchStartY

        attachedCatchups.forEach((c, cIdx) => {
          const cst = getStat(c.id)
          const cDone = cst?.tier === 'mastered' || cst?.tier === 'good'
          const cx = cIdx % 2 === 0 ? 302 : 272
          const cy = cursorY + 8
          cursorY += 108

          nodes.push({
            id: c.id,
            route: 'catchup',
            x: cx,
            y: cy,
            title: c.title,
            shortTitle: c.shortTitle,
            subtitle: c.subtitle,
            eyebrow: `Catch-up · ~${c.minutes} min`,
            ctaLabel: cDone ? 'Review' : hasResume(c.id) ? 'Continue' : 'Start catch-up',
            tone: cDone ? 'done' : 'catchup',
            glyph: cDone ? 'done' : 'catchup',
            stat: cst,
            inProgress: hasResume(c.id) && !cDone,
            compact: true,
          })

          curves.push({
            id: `c-in-${c.id}`,
            route: 'catchup',
            d: cubicPath(prevCx, prevCy, cx, cy),
            done: cDone,
          })

          prevCx = cx
          prevCy = cy
        })

        // Place main lesson on the left-center spine right below its catch-up spur, and merge back in!
        const mx = idx % 2 === 0 ? 124 : 158
        const my = cursorY + 4
        cursorY += 126

        nodes.push({
          id: lesson.id,
          route: 'main',
          x: mx,
          y: my,
          title: lesson.title,
          shortTitle: lesson.shortTitle,
          subtitle: lesson.subtitle,
          eyebrow: `Lesson ${lesson.number}`,
          ctaLabel: isDone ? 'Review' : resume ? 'Continue' : 'Start',
          tone: isDone ? 'done' : isActive ? 'active' : 'ready',
          glyph: glyphForLesson(lesson, isDone),
          stat: st,
          inProgress: resume && !isDone,
        })

        // Merge catch-up spur back into the supported main lesson
        curves.push({
          id: `c-merge-${lesson.id}`,
          route: 'catchup',
          d: cubicPath(prevCx, prevCy, mx, my),
        })

        if (anchorPrev) {
          curves.push({
            id: `m-${anchorPrev.id}-${lesson.id}`,
            route: 'main',
            d: cubicPath(anchorPrev.x, anchorPrev.y, mx, my),
            done: anchorPrev.done && (isDone || isActive),
          })
        }
        mainCoords.push({ id: lesson.id, x: mx, y: my, done: isDone })
      } else {
        // Pure clean winding main course path
        const pattern = [0, 56, 0, -56]
        const offset = lessons.length <= 1 ? 0 : pattern[idx % 4]! * flip
        const mx = hasInterwovenCatchups ? (idx % 2 === 0 ? 124 : 158) : center + offset
        const my = cursorY
        cursorY += 132

        nodes.push({
          id: lesson.id,
          route: 'main',
          x: mx,
          y: my,
          title: lesson.title,
          shortTitle: lesson.shortTitle,
          subtitle: lesson.subtitle,
          eyebrow: `Lesson ${lesson.number}`,
          ctaLabel: isDone ? 'Review' : resume ? 'Continue' : 'Start',
          tone: isDone ? 'done' : isActive ? 'active' : 'ready',
          glyph: glyphForLesson(lesson, isDone),
          stat: st,
          inProgress: resume && !isDone,
        })

        const prevMain = mainCoords[mainCoords.length - 1]
        if (prevMain) {
          curves.push({
            id: `m-${prevMain.id}-${lesson.id}`,
            route: 'main',
            d: cubicPath(prevMain.x, prevMain.y, mx, my),
            done: prevMain.done && (isDone || isActive),
          })
        }
        mainCoords.push({ id: lesson.id, x: mx, y: my, done: isDone })
      }
    })

    // Level Mastery Trophy node at the bottom of levels with >= 2 lessons
    if (lessons.length >= 2) {
      const allMastered = lessons.every(l => {
        const st = getStat(l.id)
        return st?.tier === 'mastered' || st?.tier === 'good'
      })
      const tx = hasInterwovenCatchups ? 142 : center
      const ty = cursorY + 4
      cursorY += 116
      const prevMain = mainCoords[mainCoords.length - 1]
      if (prevMain) {
        curves.push({
          id: `m-trophy-${levelNumber}`,
          route: 'main',
          d: cubicPath(prevMain.x, prevMain.y, tx, ty),
          done: allMastered,
        })
      }
      nodes.push({
        id: `trophy-level-${levelNumber}`,
        route: 'main',
        x: tx,
        y: ty,
        title: `Level ${levelNumber} Mastery`,
        shortTitle: allMastered ? 'Level Mastered' : `Level ${levelNumber} Goal`,
        subtitle: allMastered
          ? `Every lesson in Level ${levelNumber} is complete.`
          : `Complete all ${lessons.length} lessons in Level ${levelNumber} to unlock this badge.`,
        eyebrow: `Level ${levelNumber} Milestone`,
        ctaLabel: allMastered ? 'Review first lesson' : 'Jump to next lesson',
        tone: allMastered ? 'trophy-done' : 'trophy-locked',
        glyph: 'trophy',
        inProgress: false,
        isTrophy: true,
      })
    }

    return { width: W, height: Math.max(160, cursorY + 12), nodes, curves }
  }, [lessons, catchups, hasInterwovenCatchups, levelNumber, getStat, hasResume])

  // Determine which route is currently spotlighted when interwoven catch-up paths are ON:
  // - If user hovers a route, spotlight that route and gray out the other.
  // - If a popover is open, keep that node's route spotlighted.
  // - Otherwise when Filter ("Show catch-up paths") is ON, highlight Catch-up by default and gray Main until hovered!
  const selectedNode = layout.nodes.find(n => n.id === selectedId)
  const activeRouteFocus: 'main' | 'catchup' | null = !hasInterwovenCatchups
    ? null
    : hoveredRoute ?? selectedNode?.route ?? 'catchup'

  return (
    <div
      className="br-journey-stage"
      data-interwoven={hasInterwovenCatchups || undefined}
      data-route-focus={activeRouteFocus ?? undefined}
      style={{ height: layout.height }}
      onPointerLeave={() => setHoveredRoute(null)}
    >
      {/* Crisp vector SVG ribbons connecting nodes */}
      <svg
        className="br-journey-svg"
        width={layout.width}
        height={layout.height}
        viewBox={`0 0 ${layout.width} ${layout.height}`}
        fill="none"
        shapeRendering="geometricPrecision"
        aria-hidden="true"
      >
        {layout.curves.map(c => (
          <path
            key={c.id}
            d={c.d}
            className={`br-journey-curve is-${c.route}${c.done ? ' is-done' : ''}`}
          />
        ))}
      </svg>

      {/* Positioned Brilliant 3D Medallion Nodes */}
      {layout.nodes.map(item => {
        const isSelected = selectedId === item.id

        return (
          <div
            key={item.id}
            className={`br-journey-node-wrap is-${item.route}${isSelected ? ' is-open' : ''}`}
            style={{ left: `${(item.x / layout.width) * 100}%`, top: item.y }}
            onPointerEnter={() => {
              if (hasInterwovenCatchups) setHoveredRoute(item.route)
            }}
            onFocus={() => {
              if (hasInterwovenCatchups) setHoveredRoute(item.route)
            }}
          >
            <button
              ref={el => {
                if (!item.isTrophy) registerNodeRef(item.id, el)
              }}
              type="button"
              className={`br-node-btn${isSelected ? ' is-selected' : ''}${item.compact ? ' is-compact' : ''}`}
              aria-pressed={isSelected}
              aria-label={item.title}
              onClick={e => {
                e.stopPropagation()
                if (item.isTrophy) {
                  const next = lessons.find(l => {
                    const st = getStat(l.id)
                    return !st || (st.tier !== 'mastered' && st.tier !== 'good')
                  })
                  if (next) onSelect(next.id)
                  return
                }
                if (isSelected) {
                  onOpen(item.id)
                } else {
                  onSelect(item.id)
                }
              }}
              onDoubleClick={e => {
                e.stopPropagation()
                if (!item.isTrophy) onOpen(item.id)
              }}
            >
              <BrilliantNodeMedallion
                tone={item.tone}
                glyph={item.glyph}
                selected={isSelected}
                compact={item.compact}
                inProgress={item.inProgress}
              />
            </button>

            <span className={`br-node-caption is-${item.route}${item.tone === 'trophy-locked' ? ' is-muted' : ''}`}>
              {item.shortTitle}
            </span>
          </div>
        )
      })}
    </div>
  )
}
