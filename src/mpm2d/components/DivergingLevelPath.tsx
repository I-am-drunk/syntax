import { useEffect, useRef } from 'react'
import type { GeoLesson } from '../pageTypes'
import type { CatchupLesson } from '../data/catchupCourses'
import './divergingPath.css'

export type PathLessonStat = {
  correct: number
  total: number
  tier: 'none' | 'attempted' | 'good' | 'mastered'
}

type NodeTone = 'done' | 'active' | 'ready' | 'catchup' | 'trophy-done' | 'trophy-locked'

// Exact Coddy 3-layer isometric hex geometry (72x68 base + 58x42 recessed shadow + 58x42 pressable cap)
function HexLayers({ tone }: { tone: NodeTone }) {
  return (
    <span className={`coddy-hex-stack is-${tone}`} aria-hidden="true">
      <svg className="coddy-hex-base" width="76" height="72" viewBox="0 0 72 68" fill="none">
        <path
          d="M30.8829 10.9944C32.4387 10.343 34.2035 10 36 10C37.7965 10 39.5613 10.343 41.1171 10.9944L66.8829 21.781C68.4386 22.4325 69.7306 23.3694 70.6288 24.4978C71.527 25.6261 72 26.9061 72 28.209V49.788C72 51.091 71.527 52.3709 70.6288 53.4992C69.7306 54.6276 68.4386 55.5646 66.8829 56.216L41.1171 67.0056C39.5613 67.657 37.7965 68 36 68C34.2035 68 32.4387 67.657 30.8829 67.0056L5.11712 56.216C3.56136 55.5646 2.26944 54.6276 1.3712 53.4992C0.472955 52.3709 4.63549e-05 51.091 7.181e-07 49.788V28.212C-0.00067241 26.9085 0.471895 25.628 1.37017 24.4991C2.26845 23.3702 3.56076 22.4327 5.11712 21.781L30.8829 10.9944Z"
          fill="var(--node-side)"
        />
        <path
          d="M31.269 1.91687L31.2691 1.91684C32.6948 1.31987 34.3274 1 36 1C37.6726 1 39.3052 1.31987 40.7309 1.91684L40.731 1.91687L66.4966 12.7034C67.9237 13.301 69.0695 14.1446 69.8464 15.1206C70.6198 16.092 71 17.1568 71 18.209V39.788C71 40.8403 70.6198 41.905 69.8464 42.8764C69.0694 43.8525 67.9237 44.6961 66.4966 45.2936L40.7309 56.0832C39.3052 56.6801 37.6726 57 36 57C34.3274 57 32.6948 56.6801 31.2691 56.0832L5.50338 45.2936C4.07632 44.6961 2.93056 43.8525 2.15356 42.8764C1.38023 41.905 1.00004 40.8403 1 39.788L1 18.212C0.999457 17.1588 1.37935 16.0936 2.15268 15.1217C2.92967 14.1452 4.07573 13.3012 5.50329 12.7034L31.269 1.91687Z"
          fill="var(--node-face)"
          stroke="var(--node-edge)"
          strokeWidth="2"
        />
      </svg>
      <svg className="coddy-hex-shadow" width="60" height="44" viewBox="0 0 58 42" fill="none">
        <path
          d="M24.8779 0.720114C26.1312 0.248359 27.5528 0 29 0C30.4472 0 31.8688 0.248359 33.1221 0.720114L53.8779 8.53107C55.1311 9.00281 56.1718 9.68132 56.8954 10.4984C57.619 11.3155 58 12.2423 58 13.1858V28.812C58 29.7555 57.619 30.6824 56.8954 31.4995C56.1718 32.3165 55.1311 32.995 53.8779 33.4668L33.1221 41.2799C31.8688 41.7516 30.4472 42 29 42C27.5528 42 26.1312 41.7516 24.8779 41.2799L4.12213 33.4668C2.86887 32.995 1.82816 32.3165 1.10457 31.4995C0.380991 30.6824 3.73414e-05 29.7555 5.78469e-07 28.812V13.188C-0.000541663 12.2441 0.380137 11.3168 1.10375 10.4993C1.82736 9.68184 2.86839 9.00299 4.12213 8.53107L24.8779 0.720114Z"
          fill="var(--node-side)"
        />
      </svg>
      <span className="coddy-hex-top-wrap">
        <svg className="coddy-hex-top" width="60" height="44" viewBox="0 0 58 42" fill="none">
          <path
            d="M25.2301 1.65603C26.3621 1.22994 27.6634 1 29 1C30.3366 1 31.6379 1.22994 32.7698 1.65601L53.5256 9.46696C54.6606 9.89419 55.553 10.4908 56.1468 11.1614C56.7354 11.8261 57 12.5245 57 13.1859V28.812C57 29.4734 56.7354 30.1718 56.1468 30.8365C55.553 31.507 54.6606 32.1037 53.5256 32.5309L32.7698 40.344C31.6379 40.7701 30.3366 41 29 41C27.6634 41 26.3621 40.7701 25.2302 40.344L4.47443 32.5309C3.3394 32.1037 2.44704 31.507 1.85321 30.8365C1.26459 30.1718 1.00004 29.4734 1 28.812L1 13.188C0.99962 12.5258 1.26393 11.8271 1.85254 11.1621C2.44634 10.4913 3.33892 9.89439 4.47434 9.46699L25.2301 1.65603Z"
            fill="var(--node-face)"
            stroke="var(--node-edge)"
            strokeWidth="2"
          />
        </svg>
      </span>
    </span>
  )
}

function NodeGlyph({ kind }: { kind: 'done' | 'lesson' | 'catchup' | 'trophy' }) {
  if (kind === 'done') {
    return (
      <svg className="coddy-hex-glyph" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
        <path d="M5 13l4.2 4.2L19 7.5" />
      </svg>
    )
  }
  if (kind === 'catchup') {
    // Clean geometric spark / stepping-stone compass icon (never a PR branch icon)
    return (
      <svg className="coddy-hex-glyph" width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
        <path d="M12 3l2.4 6.1L20.5 11.5l-6.1 2.4L12 20l-2.4-6.1L3.5 11.5l6.1-2.4L12 3z" />
      </svg>
    )
  }
  if (kind === 'trophy') {
    return (
      <svg className="coddy-hex-glyph" width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.1" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
        <path d="M6 9H4.5a2.5 2.5 0 0 1 0-5H6" />
        <path d="M18 9h1.5a2.5 2.5 0 0 0 0-5H18" />
        <path d="M4 22h16" />
        <path d="M10 14.66V17c0 .55-.47.98-.97 1.21C7.85 18.75 7 20.24 7 22" />
        <path d="M14 14.66V17c0 .55.47.98.97 1.21C16.15 18.75 17 20.24 17 22" />
        <path d="M18 2H6v7a6 6 0 0 0 12 0V2Z" />
      </svg>
    )
  }
  // Clean open-book / coordinate lesson glyph
  return (
    <svg className="coddy-hex-glyph" width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M2 6.5C4.5 5 8.5 5 12 7c3.5-2 7.5-2 10-0.5V19c-2.5-1.5-6.5-1.5-10 .5-3.5-2-7.5-2-10-.5V6.5z" />
      <path d="M12 7v12.5" />
    </svg>
  )
}

function WindingConnector({
  fromOffset,
  toOffset,
  done,
  catchup = false,
}: {
  fromOffset: number
  toOffset: number
  done: boolean
  catchup?: boolean
}) {
  // SVG coordinate space centered at x = 160, height = 56
  const x1 = 160 + fromOffset
  const x2 = 160 + toOffset
  const d = `M ${x1} 0 C ${x1} 28, ${x2} 28, ${x2} 56`
  return (
    <div className="coddy-path-connector" aria-hidden="true">
      <svg width="320" height="56" viewBox="0 0 320 56" fill="none">
        <path
          d={d}
          className={`coddy-trail-path${done ? ' is-done' : ''}${catchup ? ' is-catchup' : ''}`}
        />
      </svg>
    </div>
  )
}

function stepOffset(index: number, count: number, flip: number): number {
  if (count <= 1) return 0
  if (index === count - 1) return 0
  const pattern = [0, 88, 0, -88]
  return pattern[index % 4]! * flip
}

type TrackItem = {
  id: string
  title: string
  shortTitle: string
  subtitle: string
  eyebrow: string
  ctaLabel: string
  isCatchup: boolean
  tone: NodeTone
  glyph: 'done' | 'lesson' | 'catchup' | 'trophy'
  stat?: PathLessonStat
  inProgress: boolean
  isTrophy?: boolean
}

function WindingSection({
  items,
  flip,
  selectedId,
  popoverOpenId,
  onTogglePopover,
  onOpen,
  registerNodeRef,
}: {
  items: TrackItem[]
  flip: number
  selectedId: string
  popoverOpenId: string | null
  onTogglePopover: (id: string) => void
  onOpen: (id: string) => void
  registerNodeRef: (id: string, el: HTMLButtonElement | null) => void
}) {
  return (
    <div className="coddy-winding-path">
      {items.map((item, idx) => {
        const here = stepOffset(idx, items.length, flip)
        const prev = idx > 0 ? stepOffset(idx - 1, items.length, flip) : 0
        const isOpen = popoverOpenId === item.id
        const isSelected = selectedId === item.id
        const prevDone = idx > 0 && (items[idx - 1]?.tone === 'done' || items[idx - 1]?.tone === 'trophy-done')
        const arrowShift = here > 24 ? 'is-right' : here < -24 ? 'is-left' : 'is-center'

        return (
          <div key={item.id} className="coddy-node-slot">
            {idx > 0 && (
              <WindingConnector
                fromOffset={prev}
                toOffset={here}
                done={prevDone && (item.tone === 'done' || item.tone === 'active' || item.tone === 'trophy-done')}
                catchup={item.isCatchup}
              />
            )}

            <div
              className={`coddy-node-wrap${isOpen ? ' is-open' : ''}`}
              style={{ transform: `translateX(${here}px)` }}
            >
              <button
                ref={el => {
                  if (!item.isTrophy) registerNodeRef(item.id, el)
                }}
                type="button"
                className={`coddy-hex-btn${isSelected ? ' is-selected' : ''}${
                  item.tone === 'active' ? ' is-active-pulse' : ''
                }`}
                aria-expanded={isOpen}
                aria-label={item.title}
                onClick={() => onTogglePopover(item.id)}
                onDoubleClick={() => {
                  if (!item.isTrophy) onOpen(item.id)
                }}
              >
                <HexLayers tone={item.tone} />
                <NodeGlyph kind={item.glyph} />
              </button>

              <span className="coddy-node-caption">
                <span className="coddy-node-caption-title">{item.shortTitle}</span>
                {item.stat && item.stat.total > 0 && (
                  <span className={`coddy-node-pill is-${item.stat.tier}`}>
                    {item.stat.correct}/{item.stat.total}
                  </span>
                )}
                {item.inProgress && <span className="coddy-node-pill is-progress">Resume</span>}
              </span>

              {/* Coddy Floating Popover Card */}
              {isOpen && (
                <div
                  className={`coddy-popover ${arrowShift}`}
                  role="dialog"
                  aria-label={item.title}
                  style={{ transform: `translateX(calc(-50% - ${here * 0.45}px))` }}
                >
                  <div
                    className="coddy-popover-arrow"
                    style={{ left: `calc(50% + ${here * 0.45}px)` }}
                    aria-hidden="true"
                  />
                  <div className="coddy-popover-eyebrow">{item.eyebrow}</div>
                  <h3 className="coddy-popover-title">{item.title}</h3>
                  <p className="coddy-popover-sub">{item.subtitle}</p>
                  {item.isTrophy ? (
                    <div className="coddy-popover-trophy-note">
                      {item.tone === 'trophy-done'
                        ? 'Level mastered — every core lesson complete!'
                        : 'Master the core lessons above to light up this trophy.'}
                    </div>
                  ) : (
                    <button
                      type="button"
                      className={`coddy-popover-cta${item.isCatchup ? ' is-catchup' : ''}`}
                      onClick={() => onOpen(item.id)}
                    >
                      {item.ctaLabel}
                    </button>
                  )}
                </div>
              )}
            </div>
          </div>
        )
      })}
    </div>
  )
}

export function DivergingLevelPath({
  levelNumber,
  lessons,
  catchups,
  showCatchupPaths,
  selectedId,
  popoverOpenId,
  getStat,
  hasResume,
  onSelect,
  onTogglePopover,
  onOpen,
  registerNodeRef,
}: {
  levelNumber: number
  lessons: GeoLesson[]
  catchups: CatchupLesson[]
  showCatchupPaths: boolean
  selectedId: string
  popoverOpenId: string | null
  getStat: (id: string) => PathLessonStat | undefined
  hasResume: (id: string) => boolean
  onSelect: (id: string) => void
  onTogglePopover: (id: string) => void
  onOpen: (id: string) => void
  registerNodeRef: (id: string, el: HTMLButtonElement | null) => void
}) {
  const wrapRef = useRef<HTMLDivElement>(null)

  // Identify first incomplete lesson in this level as the highlighted "active" node
  const firstActiveId = lessons.find(l => getStat(l.id)?.tier !== 'mastered')?.id

  const allMastered =
    lessons.length > 0 && lessons.every(l => getStat(l.id)?.tier === 'mastered')

  const coreItems: TrackItem[] = lessons.map((lesson, i) => {
    const stat = getStat(lesson.id)
    const tier = stat?.tier ?? 'none'
    const inProgress = tier === 'none' && hasResume(lesson.id)
    const isCurrent = lesson.id === firstActiveId
    const tone: NodeTone =
      tier === 'mastered' ? 'done' : isCurrent || inProgress ? 'active' : 'ready'

    return {
      id: lesson.id,
      title: lesson.title,
      shortTitle: lesson.shortTitle,
      subtitle: lesson.subtitle,
      eyebrow: `Lesson ${i + 1} · ${lesson.pages.length} steps`,
      ctaLabel: inProgress
        ? 'Resume lesson'
        : tier === 'mastered'
          ? 'Review lesson'
          : stat
            ? 'Retry checks'
            : 'Start lesson',
      isCatchup: false,
      tone,
      glyph: tier === 'mastered' ? 'done' : 'lesson',
      stat,
      inProgress,
    }
  })

  // Append Level Trophy node at the end of the winding chapter (Coddy pattern)
  coreItems.push({
    id: `trophy-level-${levelNumber}`,
    title: `Level ${levelNumber} Trophy`,
    shortTitle: 'Level Trophy',
    subtitle: allMastered
      ? 'All core lessons in this level are mastered.'
      : 'Complete all core lessons in this level to unlock.',
    eyebrow: `Level ${levelNumber} Milestone`,
    ctaLabel: 'Completed',
    isCatchup: false,
    tone: allMastered ? 'trophy-done' : 'trophy-locked',
    glyph: 'trophy',
    inProgress: false,
    isTrophy: true,
  })

  const catchupItems: TrackItem[] = catchups.map(cu => {
    const stat = getStat(cu.id)
    const tier = stat?.tier ?? 'none'
    const inProgress = tier === 'none' && hasResume(cu.id)
    const targetLesson = lessons.find(l => l.id === cu.supportsLessonId)

    return {
      id: cu.id,
      title: cu.shortTitle,
      shortTitle: cu.shortTitle,
      subtitle: targetLesson
        ? `Prepares you for ${targetLesson.shortTitle}. ${cu.subtitle}`
        : cu.subtitle,
      eyebrow: `Catch-Up · ${cu.minutes} min`,
      ctaLabel: tier === 'mastered' ? 'Review catch-up' : `Start catch-up · ${cu.minutes} min`,
      isCatchup: true,
      tone: tier === 'mastered' ? 'done' : 'catchup',
      glyph: tier === 'mastered' ? 'done' : 'catchup',
      stat,
      inProgress,
    }
  })

  // Close open popover when clicking outside this level's nodes
  useEffect(() => {
    if (!popoverOpenId) return
    const ownsPopover =
      coreItems.some(i => i.id === popoverOpenId) ||
      catchupItems.some(i => i.id === popoverOpenId)
    if (!ownsPopover) return

    const onDown = (e: PointerEvent) => {
      if (wrapRef.current && !wrapRef.current.contains(e.target as Node)) {
        onTogglePopover('')
      }
    }
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onTogglePopover('')
    }
    window.addEventListener('pointerdown', onDown)
    window.addEventListener('keydown', onKey)
    return () => {
      window.removeEventListener('pointerdown', onDown)
      window.removeEventListener('keydown', onKey)
    }
  }, [popoverOpenId, coreItems, catchupItems, onTogglePopover])

  const handleToggle = (id: string) => {
    if (!id.startsWith('trophy-')) {
      onSelect(id)
    }
    onTogglePopover(popoverOpenId === id ? '' : id)
  }

  const flip = levelNumber % 2 === 1 ? 1 : -1

  return (
    <div ref={wrapRef} className="coddy-chapter-root">
      {showCatchupPaths && catchupItems.length > 0 && (
        <div className="coddy-catchup-block">
          <div className="coddy-chapter-divider">
            <span className="coddy-divider-line" />
            <span className="coddy-divider-label">Catch-Up Prerequisites</span>
            <span className="coddy-divider-line" />
          </div>
          <WindingSection
            items={catchupItems}
            flip={-flip}
            selectedId={selectedId}
            popoverOpenId={popoverOpenId}
            onTogglePopover={handleToggle}
            onOpen={onOpen}
            registerNodeRef={registerNodeRef}
          />
          <div className="coddy-chapter-divider is-core">
            <span className="coddy-divider-line" />
            <span className="coddy-divider-label">Core Lessons</span>
            <span className="coddy-divider-line" />
          </div>
        </div>
      )}

      <WindingSection
        items={coreItems}
        flip={flip}
        selectedId={selectedId}
        popoverOpenId={popoverOpenId}
        onTogglePopover={handleToggle}
        onOpen={onOpen}
        registerNodeRef={registerNodeRef}
      />
    </div>
  )
}
