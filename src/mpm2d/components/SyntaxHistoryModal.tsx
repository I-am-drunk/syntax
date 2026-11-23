import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { MathText } from './MathText'
import {
  loadWorkHistory,
  type WorkHistoryCategory,
  type WorkHistoryEntry,
  type WorkHistoryVersion,
} from '../historyStore'
import { UNIT2_LESSONS } from '../data/unit2Course'

const FILTER_TABS: { id: WorkHistoryCategory; label: string; badge: string }[] = [
  { id: 'all', label: 'All History', badge: '∞' },
  { id: 'multi-step', label: 'Worked Chains', badge: '①②' },
  { id: 'math-input', label: 'Equations & Slopes', badge: 'y=' },
  { id: 'checks', label: 'Mastery Checks', badge: '✓' },
  { id: 'conference', label: 'Conference Plans', badge: '⇄' },
  { id: 'choice', label: 'Concept Checks', badge: '◈' },
  { id: 'scratchpad', label: 'Pen Scratchpads', badge: '✎' },
]

// Crisp iPhone-style mechanical scroll wheel tick synthesizer via Web Audio API
let sharedAudioCtx: AudioContext | null = null
function playScrollWheelTick(soundOn: boolean, pitchMultiplier = 1) {
  if (!soundOn || typeof window === 'undefined') return
  try {
    const Ctx = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext
    if (!Ctx) return
    if (!sharedAudioCtx) sharedAudioCtx = new Ctx()
    const ctx = sharedAudioCtx
    if (ctx.state === 'suspended') void ctx.resume()

    const now = ctx.currentTime
    const osc = ctx.createOscillator()
    const gain = ctx.createGain()
    osc.type = 'triangle'
    osc.frequency.setValueAtTime(1150 * pitchMultiplier, now)
    osc.frequency.exponentialRampToValueAtTime(310, now + 0.014)

    gain.gain.setValueAtTime(0.085, now)
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.015)

    osc.connect(gain)
    gain.connect(ctx.destination)
    osc.start(now)
    osc.stop(now + 0.016)
  } catch {
    // ignore audio context restrictions
  }
}

function formatRelativeTime(ts: number): string {
  if (!ts || ts <= 0) return 'Saved'
  const diffSec = Math.max(1, Math.floor((Date.now() - ts) / 1000))
  if (diffSec < 60) return 'Just now'
  const diffMin = Math.floor(diffSec / 60)
  if (diffMin < 60) return `${diffMin}m ago`
  const diffHr = Math.floor(diffMin / 60)
  if (diffHr < 24) return `${diffHr}h ago`
  const diffDay = Math.floor(diffHr / 24)
  return `${diffDay}d ago`
}

function buildFallbackDemoEntries(): WorkHistoryEntry[] {
  // If the student hasn't answered questions yet, populate a clear preview from Unit 2 lessons so the dial & versioning are immediately interactive
  const l1 = UNIT2_LESSONS[0]
  const l2 = UNIT2_LESSONS[1]
  const l3 = UNIT2_LESSONS[3] ?? UNIT2_LESSONS[2]
  const entries: WorkHistoryEntry[] = []
  const now = Date.now()
  if (l1 && l1.pages[2]) {
    entries.push({
      id: `${l1.id}:${l1.pages[2].id}`,
      lessonId: l1.id,
      lessonTitle: l1.title,
      lessonShortTitle: l1.shortTitle,
      level: l1.level,
      pageId: l1.pages[2].id,
      pageIndex: 2,
      pageKind: l1.pages[2].kind,
      isCheck: false,
      promptSnippet: 'Find the equation of the line perpendicular to 3x + y = −3 passing through P(6, 1).',
      category: 'multi-step',
      isDemo: true,
      latestTimestamp: now - 180_000,
      versions: [
        {
          versionId: 'demo-v1',
          versionNum: 1,
          timestamp: now - 420_000,
          answerSummary: 'Step 1: m = −3  →  Step 2: m⊥ = −1/3 (sign slip)',
          evaluation: 'retry',
          hasPenInk: true,
        },
        {
          versionId: 'demo-v2',
          versionNum: 2,
          timestamp: now - 180_000,
          answerSummary: 'Step 1: m = −3  →  Step 2: m⊥ = 1/3  →  Step 3: y = 1/3 x − 1',
          subSteps: [
            { label: 'Given slope m', value: '−3', outcome: 'correct' },
            { label: 'Perpendicular slope m⊥', value: '1/3', outcome: 'correct' },
            { label: 'Final equation', value: 'y = 1/3 x − 1', outcome: 'correct' },
          ],
          evaluation: 'correct',
          hasPenInk: true,
        },
      ],
    })
  }
  if (l2 && l2.pages[1]) {
    entries.push({
      id: `${l2.id}:${l2.pages[1].id}`,
      lessonId: l2.id,
      lessonTitle: l2.title,
      lessonShortTitle: l2.shortTitle,
      level: l2.level,
      pageId: l2.pages[1].id,
      pageIndex: 1,
      pageKind: l2.pages[1].kind,
      isCheck: false,
      promptSnippet: 'Midpoint & endpoint backwards solver: M = ((x1 + x2)/2, (y1 + y2)/2).',
      category: 'math-input',
      isDemo: true,
      latestTimestamp: now - 540_000,
      versions: [
        {
          versionId: 'demo-l2-v1',
          versionNum: 1,
          timestamp: now - 540_000,
          answerSummary: 'M(2, −1)  ·  Doubled midpoint minus known endpoint',
          evaluation: 'correct',
          hasPenInk: true,
        },
      ],
    })
  }
  if (l3 && l3.pages[0]) {
    entries.push({
      id: `${l3.id}:${l3.pages[0].id}`,
      lessonId: l3.id,
      lessonTitle: l3.title,
      lessonShortTitle: l3.shortTitle,
      level: l3.level,
      pageId: l3.pages[0].id,
      pageIndex: 0,
      pageKind: l3.pages[0].kind,
      isCheck: false,
      promptSnippet: 'Exact radical distance & Pythagorean right-triangle verification.',
      category: 'scratchpad',
      isDemo: true,
      latestTimestamp: now - 920_000,
      versions: [
        {
          versionId: 'demo-l3-v1',
          versionNum: 1,
          timestamp: now - 920_000,
          answerSummary: 'd = √45 = 3√5  ·  Saved tldraw scratchpad sheet',
          evaluation: 'scratchpad',
          hasPenInk: true,
        },
      ],
    })
  }
  return entries
}

export function SyntaxHistoryPage({
  soundOn,
  onClose,
  onJumpToQuestion,
}: {
  soundOn: boolean
  onClose: () => void
  onJumpToQuestion: (lessonId: string, pageIndex: number, pageId: string) => void
}) {
  const [filter, setFilter] = useState<WorkHistoryCategory>('all')
  const [rawEntries] = useState<WorkHistoryEntry[]>(() => {
    const loaded = loadWorkHistory()
    return loaded.length > 0 ? loaded : buildFallbackDemoEntries()
  })
  const onCloseRef = useRef(onClose)
  onCloseRef.current = onClose

  useEffect(() => {
    window.scrollTo({ top: 0 })
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== 'Escape' || e.defaultPrevented) return
      if (document.querySelector('[role="dialog"], [role="menu"]')) return
      e.preventDefault()
      onCloseRef.current()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [])

  const filteredEntries = useMemo(() => {
    if (filter === 'all') return rawEntries
    return rawEntries.filter(e => e.category === filter)
  }, [rawEntries, filter])

  // Continuous wheel notch angle / index (supports infinite wrap-around scrolling with tick-tick-tick detents!)
  const [wheelNotch, setWheelNotch] = useState(0)
  const [selectedVerIdx, setSelectedVerIdx] = useState<Record<string, number>>({})
  const filterStripRef = useRef<HTMLDivElement>(null)
  const wheelColRef = useRef<HTMLDivElement>(null)
  const wheelDragRef = useRef<{ startY: number; startNotch: number; lastIntNotch: number } | null>(null)
  const wheelAccumRef = useRef(0)

  const count = filteredEntries.length
  const activeIndex = count > 0 ? ((wheelNotch % count) + count) % count : 0
  const activeEntry = filteredEntries[activeIndex] ?? null

  const stepWheelBy = useCallback(
    (deltaNotches: number) => {
      if (deltaNotches === 0 || count <= 1) return
      setWheelNotch(prev => prev + deltaNotches)
      playScrollWheelTick(soundOn, deltaNotches > 0 ? 1.04 : 0.96)
    },
    [soundOn, count],
  )

  const handleSelectFilter = (next: WorkHistoryCategory) => {
    setFilter(next)
    setWheelNotch(0)
    wheelAccumRef.current = 0
    playScrollWheelTick(soundOn, 1.12)
  }

  const cycleFilter = (dir: -1 | 1) => {
    const idx = FILTER_TABS.findIndex(t => t.id === filter)
    const nextIdx = (idx + dir + FILTER_TABS.length) % FILTER_TABS.length
    const nextTab = FILTER_TABS[nextIdx]!
    handleSelectFilter(nextTab.id)
    const container = filterStripRef.current
    const el = container?.querySelector(`[data-filter-id="${nextTab.id}"]`) as HTMLElement | null
    el?.scrollIntoView({ behavior: 'smooth', inline: 'center', block: 'nearest' })
  }

  useEffect(() => {
    const el = wheelColRef.current
    if (!el) return
    const onWheel = (e: WheelEvent) => {
      if (count <= 1) return
      e.preventDefault()
      wheelAccumRef.current += e.deltaY
      const threshold = 28
      if (Math.abs(wheelAccumRef.current) >= threshold) {
        const steps = Math.trunc(wheelAccumRef.current / threshold)
        wheelAccumRef.current -= steps * threshold
        stepWheelBy(steps)
      }
    }
    el.addEventListener('wheel', onWheel, { passive: false })
    return () => el.removeEventListener('wheel', onWheel)
  }, [count, stepWheelBy])

  const onWheelPointerDown = (e: React.PointerEvent) => {
    if (count <= 1) return
    e.preventDefault()
    try {
      ;(e.currentTarget as HTMLElement).setPointerCapture(e.pointerId)
    } catch {
      // ignore
    }
    wheelDragRef.current = {
      startY: e.clientY,
      startNotch: wheelNotch,
      lastIntNotch: wheelNotch,
    }
  }

  const onWheelPointerMove = (e: React.PointerEvent) => {
    const d = wheelDragRef.current
    if (!d || count <= 1) return
    const dy = d.startY - e.clientY
    const rawNotch = d.startNotch + Math.round(dy / 22)
    if (rawNotch !== d.lastIntNotch) {
      const diff = rawNotch - d.lastIntNotch
      d.lastIntNotch = rawNotch
      setWheelNotch(rawNotch)
      playScrollWheelTick(soundOn, diff > 0 ? 1.05 : 0.95)
    }
  }

  const onWheelPointerUp = () => {
    wheelDragRef.current = null
  }

  // Generate 21 curved dash bars around the left iPhone-style cylinder wheel (-10..+10 from current notch)
  const dialTicks = useMemo(() => {
    const ticks: { offset: number; absNotch: number; angleDeg: number; yPx: number; xCurvePx: number; opacity: number; isMajor: boolean; isCenter: boolean }[] = []
    for (let offset = -10; offset <= 10; offset++) {
      const absNotch = wheelNotch + offset
      const angleDeg = offset * 8.2 // -82deg to +82deg along cylinder curvature
      const rad = (angleDeg * Math.PI) / 180
      const radius = 148
      const yPx = Math.sin(rad) * radius
      // Curvature bowing outward to the right along a circular arc
      const xCurvePx = Math.cos(rad) * 26 - 6
      const opacity = Math.max(0.12, Math.cos(rad) ** 1.7)
      const isMajor = ((absNotch % 5) + 5) % 5 === 0
      ticks.push({
        offset,
        absNotch,
        angleDeg,
        yPx,
        xCurvePx,
        opacity,
        isMajor,
        isCenter: offset === 0,
      })
    }
    return ticks
  }, [wheelNotch])

  // Build visible stack of history cards around activeIndex (infinite wrap-around!)
  const visibleCards = useMemo(() => {
    if (count === 0) return []
    const span = Math.min(count, 7)
    const start = -Math.floor((span - 1) / 2)
    const end = Math.ceil((span - 1) / 2)
    const cards: { entry: WorkHistoryEntry; relOffset: number; entryIdx: number }[] = []
    for (let rel = start; rel <= end; rel++) {
      const idx = ((activeIndex + rel) % count + count) % count
      const entry = filteredEntries[idx]
      if (entry) {
        cards.push({ entry, relOffset: rel, entryIdx: idx })
      }
    }
    return cards
  }, [count, activeIndex, filteredEntries])

  const activeVersions: WorkHistoryVersion[] = activeEntry?.versions ?? []
  const currentVerIdx = activeEntry
    ? selectedVerIdx[activeEntry.id] ?? Math.max(0, activeVersions.length - 1)
    : 0
  const activeVersion = activeVersions[currentVerIdx] ?? activeVersions[activeVersions.length - 1]

  return (
    <section className="syntax-history-page" aria-label="Work History and Versioning">
      <div className="syntax-history-container">
        {/* Top Bar: Title + Single Tactile Filter Bar with Side Arrows + Back button */}
        <header className="syntax-history-header">
          <div className="syntax-history-title-row">
            <div>
              <span className="syntax-history-eyebrow">Time Machine · Saved Work &amp; Ink</span>
              <h1 className="syntax-history-title">Work History &amp; Versions</h1>
            </div>
            <button
              type="button"
              className="syntax-history-back-btn"
              onClick={onClose}
            >
              ← Back to Unit 2
            </button>
          </div>

          {/* Single tactile filter bar with left/right arrows */}
          <div className="syntax-history-filter-bar" role="toolbar" aria-label="Filter history by question type">
            <button
              type="button"
              className="syntax-history-filter-arrow"
              aria-label="Previous category"
              onClick={() => cycleFilter(-1)}
            >
              ‹
            </button>

            <div className="syntax-history-filter-track" ref={filterStripRef}>
              {FILTER_TABS.map(tab => {
                const active = filter === tab.id
                const tabCount =
                  tab.id === 'all'
                    ? rawEntries.length
                    : rawEntries.filter(e => e.category === tab.id).length
                return (
                  <button
                    key={tab.id}
                    type="button"
                    data-filter-id={tab.id}
                    className={`syntax-history-filter-pill${active ? ' is-active' : ''}`}
                    onClick={() => handleSelectFilter(tab.id)}
                  >
                    <span className="syntax-history-filter-glyph">{tab.badge}</span>
                    <span>{tab.label}</span>
                    <span className="syntax-history-filter-count">{tabCount}</span>
                  </button>
                )
              })}
            </div>

            <button
              type="button"
              className="syntax-history-filter-arrow"
              aria-label="Next category"
              onClick={() => cycleFilter(1)}
            >
              ›
            </button>
          </div>
        </header>

        {/* Main Split: Left iPhone Curved Tick-Tick-Tick Scroll Wheel + Scroll Rectangle Stack + Right Version Inspector */}
        <div className="syntax-history-stage">
          {/* Left Curved Tactile Scroll Wheel + Rectangular Thumb Drum */}
          <div className="syntax-history-wheel-column" ref={wheelColRef}>
            <div
              className="syntax-iphone-wheel"
              role="slider"
              tabIndex={0}
              aria-label="Tactile history scroll wheel"
              aria-valuemin={1}
              aria-valuemax={Math.max(1, count)}
              aria-valuenow={count > 0 ? activeIndex + 1 : 0}
              onPointerDown={onWheelPointerDown}
              onPointerMove={onWheelPointerMove}
              onPointerUp={onWheelPointerUp}
              onPointerCancel={onWheelPointerUp}
              onKeyDown={e => {
                if (e.key === 'ArrowDown' || e.key === 'ArrowRight') {
                  e.preventDefault()
                  stepWheelBy(1)
                } else if (e.key === 'ArrowUp' || e.key === 'ArrowLeft') {
                  e.preventDefault()
                  stepWheelBy(-1)
                }
              }}
            >
              {/* Curved SVG rim silhouette showing visible curvature */}
              <svg className="syntax-wheel-arc-svg" viewBox="0 0 110 340" fill="none" aria-hidden="true">
                <path
                  d="M 18 14 Q 88 170 18 326"
                  stroke="currentColor"
                  strokeWidth="2"
                  strokeDasharray="3 5"
                  opacity="0.24"
                />
                <path
                  d="M 34 22 Q 104 170 34 318"
                  stroke="currentColor"
                  strokeWidth="2.5"
                  opacity="0.32"
                />
              </svg>

              {/* Center selection bezel indicator */}
              <div className="syntax-wheel-center-bezel" aria-hidden="true">
                <span className="syntax-wheel-bezel-dot" />
              </div>

              {/* Rotating curved dash bars */}
              <div className="syntax-wheel-ticks-layer" aria-hidden="true">
                {dialTicks.map(t => (
                  <div
                    key={t.offset}
                    className={`syntax-wheel-dash${t.isCenter ? ' is-center' : ''}${t.isMajor ? ' is-major' : ''}`}
                    style={{
                      transform: `translate3d(${t.xCurvePx.toFixed(1)}px, ${t.yPx.toFixed(1)}px, 0) rotate(${(t.angleDeg * 0.28).toFixed(1)}deg)`,
                      opacity: t.opacity,
                    }}
                  >
                    <span className="syntax-wheel-dash-bar" />
                    {t.isMajor && count > 0 && (
                      <span className="syntax-wheel-dash-num">
                        #{(((t.absNotch % count) + count) % count) + 1}
                      </span>
                    )}
                  </div>
                ))}
              </div>

              <div className="syntax-wheel-caption">
                <span>Drag or scroll</span>
                <strong>{count > 0 ? `${activeIndex + 1} / ${count}` : '0 / 0'}</strong>
              </div>
            </div>

            {/* Rectangular TLDraw-style side drum cards synchronized with the curved wheel */}
            <div className="syntax-history-drum-list" role="listbox" aria-label="History items">
              {visibleCards.map(({ entry, relOffset, entryIdx }) => {
                const isSelected = relOffset === 0
                const latest = entry.versions[entry.versions.length - 1]
                return (
                  <button
                    key={`${entry.id}:${relOffset}`}
                    type="button"
                    role="option"
                    aria-selected={isSelected}
                    className={`syntax-drum-rect-card${isSelected ? ' is-selected' : ''}`}
                    data-eval={latest?.evaluation ?? 'correct'}
                    style={{
                      transform: `translate3d(${Math.abs(relOffset) * -6}px, 0, 0) scale(${1 - Math.abs(relOffset) * 0.035})`,
                      opacity: Math.max(0.35, 1 - Math.abs(relOffset) * 0.22),
                    }}
                    onClick={() => stepWheelBy(relOffset)}
                  >
                    <div className="syntax-drum-rect-top">
                      <span className="syntax-drum-level-pill">L{entry.level}</span>
                      <span className="syntax-drum-lesson-name">{entry.lessonShortTitle}</span>
                      <span className="syntax-drum-ver-count">
                        v{entry.versions.length}
                      </span>
                    </div>
                    <div className="syntax-drum-rect-answer">
                      <MathText text={latest?.answerSummary ?? entry.promptSnippet} />
                    </div>
                    <div className="syntax-drum-rect-meta">
                      <span>Q{entry.pageIndex + 1} · {entry.category}</span>
                      {latest?.hasPenInk && <span className="syntax-drum-ink-badge">✎ Ink saved</span>}
                      <span>#{entryIdx + 1}</span>
                    </div>
                  </button>
                )
              })}
            </div>
          </div>

          {/* Right Detailed Answer & Versioning Inspector */}
          <div className="syntax-history-inspector">
            {activeEntry && activeVersion ? (
              <div className="syntax-inspector-card">
                <div className="syntax-inspector-head">
                  <div>
                    <div className="syntax-inspector-kicker">
                      {activeEntry.isDemo ? 'Sample Preview · ' : ''}Level {activeEntry.level} · {activeEntry.lessonTitle} · Question {activeEntry.pageIndex + 1}
                    </div>
                    <h2 className="syntax-inspector-prompt">
                      <MathText text={activeEntry.promptSnippet} />
                    </h2>
                  </div>
                  <span
                    className="syntax-inspector-status-badge"
                    data-eval={activeVersion.evaluation}
                  >
                    {activeVersion.evaluation === 'correct'
                      ? '✓ Verified Correct'
                      : activeVersion.evaluation === 'scratchpad'
                        ? '✎ Pen Studio Sheet'
                        : '↺ Attempt Snapshot'}
                  </span>
                </div>

                {/* Versioning Timeline Switcher */}
                <div className="syntax-version-strip">
                  <span className="syntax-version-strip-label">
                    Version History ({activeVersions.length})
                  </span>
                  <div className="syntax-version-pills">
                    {activeVersions.map((ver, vIdx) => {
                      const isCurr = vIdx === currentVerIdx
                      return (
                        <button
                          key={ver.versionId}
                          type="button"
                          className={`syntax-version-pill${isCurr ? ' is-active' : ''}`}
                          onClick={() => {
                            playScrollWheelTick(soundOn, 1.08)
                            setSelectedVerIdx(prev => ({ ...prev, [activeEntry.id]: vIdx }))
                          }}
                        >
                          <strong>v{ver.versionNum}</strong>
                          <span>{formatRelativeTime(ver.timestamp)}</span>
                        </button>
                      )
                    })}
                  </div>
                </div>

                {/* Complete Answer & Chained Algebra Steps Breakdown */}
                <div className="syntax-inspector-answer-box">
                  <div className="syntax-inspector-answer-label">
                    Saved Solution Snapshot (v{activeVersion.versionNum})
                  </div>
                  <div className="syntax-inspector-answer-main">
                    <MathText text={activeVersion.answerSummary} />
                  </div>

                  {activeVersion.subSteps && activeVersion.subSteps.length > 0 && (
                    <div className="syntax-inspector-substeps">
                      {activeVersion.subSteps.map((st, idx) => (
                        <div key={idx} className="syntax-inspector-substep-row">
                          <span className="syntax-inspector-substep-num">Step {idx + 1}</span>
                          <span className="syntax-inspector-substep-lbl">{st.label}</span>
                          <strong className="syntax-inspector-substep-val">
                            <MathText text={st.value} />
                          </strong>
                        </div>
                      ))}
                    </div>
                  )}
                </div>

                {/* Pen Studio / TLDraw Ink Persistence Status */}
                <div className="syntax-inspector-ink-row">
                  <div className="syntax-inspector-ink-info">
                    <strong>
                      {activeVersion.hasPenInk
                        ? 'Handwritten Pen Studio canvas & scratchpads preserved'
                        : 'Interactive response snapshot preserved'}
                    </strong>
                    <p>
                      Jumping to this question restores your exact step progress and tldraw ink sheets right where you left off.
                    </p>
                  </div>

                  <button
                    type="button"
                    className="syntax-inspector-jump-btn"
                    onClick={() => {
                      playScrollWheelTick(soundOn, 1.15)
                      onJumpToQuestion(
                        activeEntry.lessonId,
                        activeEntry.isDemo ? 0 : activeEntry.pageIndex,
                        activeEntry.pageId,
                      )
                    }}
                  >
                    {activeEntry.isDemo ? 'Open Lesson →' : 'Resume Question & Ink →'}
                  </button>
                </div>
              </div>
            ) : (
              <div className="syntax-inspector-empty">
                <h3>No saved history in this filter yet</h3>
                <p>Switch the top filter bar or solve a question in Unit 2 to see your versioned solutions here.</p>
              </div>
            )}
          </div>
        </div>
      </div>
    </section>
  )
}
