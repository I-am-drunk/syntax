import { useEffect, useRef, useState } from 'react'
import { Frac, Sqrt } from './MathText'
import { WinBoxWindow } from './WinBoxWindow'

type SheetTab = 'formulas' | 'lines' | 'shapes' | 'plans' | 'traps'

const TABS: { id: SheetTab; label: string }[] = [
  { id: 'formulas', label: 'Formulas' },
  { id: 'lines', label: 'Lines' },
  { id: 'shapes', label: 'Shapes' },
  { id: 'plans', label: 'Plans' },
  { id: 'traps', label: 'Traps' },
]

function MiniSlopeSvg() {
  return (
    <svg className="fm-svg" viewBox="0 0 88 64" fill="none" aria-hidden="true">
      <path d="M10 54H78M14 58V8" stroke="var(--geo-grid)" strokeWidth="1.5" />
      <path d="M22 44H66V18" stroke="var(--geo-amber)" strokeWidth="1.6" strokeDasharray="3 3" />
      <line x1="16" y1="47.5" x2="74" y2="13.5" stroke="var(--geo-blue)" strokeWidth="2.4" strokeLinecap="round" />
      <circle cx="22" cy="44" r="3.4" fill="var(--geo-blue)" />
      <circle cx="66" cy="18" r="3.4" fill="var(--geo-blue)" />
    </svg>
  )
}

function MiniMidpointSvg() {
  return (
    <svg className="fm-svg" viewBox="0 0 88 64" fill="none" aria-hidden="true">
      <line x1="16" y1="46" x2="72" y2="18" stroke="var(--geo-blue)" strokeWidth="2.4" strokeLinecap="round" />
      <line x1="27" y1="36" x2="31" y2="44" stroke="var(--geo-teal)" strokeWidth="2" strokeLinecap="round" />
      <line x1="57" y1="21" x2="61" y2="29" stroke="var(--geo-teal)" strokeWidth="2" strokeLinecap="round" />
      <circle cx="16" cy="46" r="3.4" fill="var(--geo-blue)" />
      <circle cx="72" cy="18" r="3.4" fill="var(--geo-blue)" />
      <circle cx="44" cy="32" r="4.5" fill="var(--geo-amber)" stroke="var(--geo-bg)" strokeWidth="1.5" />
    </svg>
  )
}

function MiniLengthSvg() {
  return (
    <svg className="fm-svg" viewBox="0 0 88 64" fill="none" aria-hidden="true">
      <polygon points="18,48 70,48 70,16" fill="var(--geo-blue)" fillOpacity="0.08" />
      <path d="M18 48H70V16" stroke="var(--geo-amber)" strokeWidth="1.6" strokeDasharray="3 3" />
      <path d="M62 48V40H70" stroke="var(--geo-green)" strokeWidth="1.6" />
      <line x1="18" y1="48" x2="70" y2="16" stroke="var(--geo-blue)" strokeWidth="2.5" strokeLinecap="round" />
      <circle cx="18" cy="48" r="3.4" fill="var(--geo-blue)" />
      <circle cx="70" cy="16" r="3.4" fill="var(--geo-blue)" />
    </svg>
  )
}

function MiniLineEqSvg() {
  return (
    <svg className="fm-svg" viewBox="0 0 88 64" fill="none" aria-hidden="true">
      <path d="M8 46H80M30 58V6" stroke="var(--geo-axis)" strokeWidth="1.2" opacity="0.6" />
      <line x1="12" y1="43" x2="76" y2="15" stroke="var(--geo-blue)" strokeWidth="2.4" strokeLinecap="round" />
      <circle cx="30" cy="35" r="4" fill="var(--geo-teal)" stroke="var(--geo-bg)" strokeWidth="1.5" />
    </svg>
  )
}

function MiniCircleSvg() {
  return (
    <svg className="fm-svg" viewBox="0 0 88 64" fill="none" aria-hidden="true">
      <path d="M12 32H76M44 4V60" stroke="var(--geo-axis)" strokeWidth="1.2" opacity="0.55" />
      <circle cx="44" cy="32" r="22" stroke="var(--geo-violet)" strokeWidth="2.3" fill="var(--geo-violet)" fillOpacity="0.08" />
      <line x1="44" y1="32" x2="61" y2="18" stroke="var(--geo-amber)" strokeWidth="2.2" strokeLinecap="round" />
      <circle cx="44" cy="32" r="3" fill="var(--geo-ink)" />
      <circle cx="61" cy="18" r="3.4" fill="var(--geo-amber)" />
    </svg>
  )
}

function MiniPerpSvg() {
  return (
    <svg className="fm-svg" viewBox="0 0 88 64" fill="none" aria-hidden="true">
      <line x1="14" y1="48" x2="74" y2="18" stroke="var(--geo-blue)" strokeWidth="2.4" strokeLinecap="round" />
      <line x1="30" y1="8" x2="58" y2="58" stroke="var(--geo-teal)" strokeWidth="2.4" strokeLinecap="round" />
      <path d="M40 35L44 43L52 39" stroke="var(--geo-green)" strokeWidth="1.8" fill="none" />
    </svg>
  )
}

function TriLineSvg({ kind }: { kind: 'median' | 'altitude' | 'rb' }) {
  return (
    <svg className="fm-tri-svg" viewBox="0 0 156 108" fill="none" aria-hidden="true">
      <polygon
        points="42,16 16,92 140,92"
        fill="var(--geo-blue)"
        fillOpacity="0.06"
        stroke="var(--geo-blue)"
        strokeWidth="2"
        strokeLinejoin="round"
      />
      {kind === 'median' && (
        <>
          <line x1="42" y1="16" x2="78" y2="92" stroke="var(--geo-teal)" strokeWidth="2.8" strokeLinecap="round" />
          <line x1="45" y1="87" x2="45" y2="97" stroke="var(--geo-teal)" strokeWidth="2" strokeLinecap="round" />
          <line x1="109" y1="87" x2="109" y2="97" stroke="var(--geo-teal)" strokeWidth="2" strokeLinecap="round" />
          <circle cx="42" cy="16" r="4.2" fill="var(--geo-teal)" />
          <circle cx="78" cy="92" r="4.5" fill="var(--geo-teal)" stroke="var(--geo-bg)" strokeWidth="1.5" />
        </>
      )}
      {kind === 'altitude' && (
        <>
          <line x1="42" y1="16" x2="42" y2="92" stroke="var(--geo-amber)" strokeWidth="2.8" strokeLinecap="round" />
          <path d="M42 81H53V92" stroke="var(--geo-amber)" strokeWidth="2" fill="var(--geo-amber)" fillOpacity="0.14" />
          <circle cx="42" cy="16" r="4.2" fill="var(--geo-amber)" />
        </>
      )}
      {kind === 'rb' && (
        <>
          <line x1="78" y1="12" x2="78" y2="102" stroke="var(--geo-violet)" strokeWidth="2.8" strokeDasharray="5 4" strokeLinecap="round" />
          <line x1="45" y1="87" x2="45" y2="97" stroke="var(--geo-violet)" strokeWidth="2" strokeLinecap="round" />
          <line x1="109" y1="87" x2="109" y2="97" stroke="var(--geo-violet)" strokeWidth="2" strokeLinecap="round" />
          <path d="M78 81H89V92" stroke="var(--geo-violet)" strokeWidth="2" fill="var(--geo-violet)" fillOpacity="0.14" />
          <circle cx="78" cy="92" r="4.5" fill="var(--geo-violet)" stroke="var(--geo-bg)" strokeWidth="1.5" />
        </>
      )}
    </svg>
  )
}

function ShapeMiniSvg({ kind }: { kind: string }) {
  switch (kind) {
    case 'right-tri':
      return (
        <svg className="fm-shape-svg" viewBox="0 0 56 44" fill="none" aria-hidden="true">
          <polygon points="10,36 46,36 10,8" fill="var(--geo-green)" fillOpacity="0.1" stroke="var(--geo-green)" strokeWidth="2" strokeLinejoin="round" />
          <path d="M10 27H19V36" stroke="var(--geo-green)" strokeWidth="1.8" />
        </svg>
      )
    case 'isosceles':
      return (
        <svg className="fm-shape-svg" viewBox="0 0 56 44" fill="none" aria-hidden="true">
          <polygon points="28,7 10,37 46,37" fill="var(--geo-blue)" fillOpacity="0.1" stroke="var(--geo-blue)" strokeWidth="2" strokeLinejoin="round" />
          <line x1="16" y1="21" x2="22" y2="24" stroke="var(--geo-amber)" strokeWidth="2" />
          <line x1="40" y1="21" x2="34" y2="24" stroke="var(--geo-amber)" strokeWidth="2" />
        </svg>
      )
    case 'parallelogram':
      return (
        <svg className="fm-shape-svg" viewBox="0 0 56 44" fill="none" aria-hidden="true">
          <polygon points="16,10 48,10 40,34 8,34" fill="var(--geo-blue)" fillOpacity="0.1" stroke="var(--geo-blue)" strokeWidth="2" strokeLinejoin="round" />
        </svg>
      )
    case 'rhombus':
      return (
        <svg className="fm-shape-svg" viewBox="0 0 56 44" fill="none" aria-hidden="true">
          <polygon points="28,6 48,22 28,38 8,22" fill="var(--geo-violet)" fillOpacity="0.1" stroke="var(--geo-violet)" strokeWidth="2" strokeLinejoin="round" />
          <line x1="28" y1="6" x2="28" y2="38" stroke="var(--geo-violet)" strokeWidth="1.3" strokeDasharray="3 3" />
          <line x1="8" y1="22" x2="48" y2="22" stroke="var(--geo-violet)" strokeWidth="1.3" strokeDasharray="3 3" />
        </svg>
      )
    case 'rectangle':
      return (
        <svg className="fm-shape-svg" viewBox="0 0 56 44" fill="none" aria-hidden="true">
          <rect x="9" y="11" width="38" height="22" fill="var(--geo-teal)" fillOpacity="0.1" stroke="var(--geo-teal)" strokeWidth="2" />
          <path d="M9 26H16V33" stroke="var(--geo-teal)" strokeWidth="1.7" />
        </svg>
      )
    case 'square':
      return (
        <svg className="fm-shape-svg" viewBox="0 0 56 44" fill="none" aria-hidden="true">
          <rect x="14" y="8" width="28" height="28" fill="var(--geo-green)" fillOpacity="0.12" stroke="var(--geo-green)" strokeWidth="2" />
          <path d="M14 29H21V36" stroke="var(--geo-green)" strokeWidth="1.7" />
        </svg>
      )
    case 'trapezoid':
      return (
        <svg className="fm-shape-svg" viewBox="0 0 56 44" fill="none" aria-hidden="true">
          <polygon points="18,10 38,10 47,34 9,34" fill="var(--geo-amber)" fillOpacity="0.1" stroke="var(--geo-amber)" strokeWidth="2" strokeLinejoin="round" />
        </svg>
      )
    default:
      return (
        <svg className="fm-shape-svg" viewBox="0 0 56 44" fill="none" aria-hidden="true">
          <circle cx="28" cy="22" r="15" stroke="var(--geo-blue)" strokeWidth="2" fill="var(--geo-blue)" fillOpacity="0.06" />
          <line x1="17" y1="12" x2="39" y2="12" stroke="var(--geo-amber)" strokeWidth="2.2" />
          <line x1="28" y1="7" x2="28" y2="25" stroke="var(--geo-green)" strokeWidth="1.8" strokeDasharray="3 2" />
          <circle cx="28" cy="22" r="2.6" fill="var(--geo-green)" />
        </svg>
      )
  }
}

export function FormulaSheetContent({
  onClose,
  closeLabel = 'Close',
  compact = false,
  floating = false,
  onToggleFloat,
  onDragStart,
}: {
  onClose: () => void
  closeLabel?: string
  compact?: boolean
  floating?: boolean
  onToggleFloat?: () => void
  onDragStart?: (e: React.PointerEvent) => void
}) {
  const [tab, setTab] = useState<SheetTab>('formulas')

  return (
    <div className={`fm-content-wrap${compact ? ' is-compact' : ''}${floating ? ' is-floating' : ''}`}>
      <header
        className={`fm-header${onDragStart ? ' is-draggable' : ''}`}
        onPointerDown={onDragStart}
      >
        <div className="fm-header-title-group">
          {onDragStart && (
            <span className="wt-drag-grip" aria-hidden="true" title="Drag Playbook window">
              ⋮⋮
            </span>
          )}
          <div>
            <h2 className="fm-title">Unit 2 Playbook</h2>
            <p className="fm-subtitle">MPM2D Open-Notes Reference</p>
          </div>
        </div>
        <div className="fm-header-actions" onPointerDown={e => e.stopPropagation()}>
          {onToggleFloat && (
            <button
              type="button"
              className="fm-print-btn"
              title={floating ? "Dock Playbook to side rail" : "Float Playbook as draggable window"}
              onClick={onToggleFloat}
            >
              {floating ? "Dock" : "Float"}
            </button>
          )}
          <button
            type="button"
            className="fm-print-btn"
            title="Print 1-page open-notes cheat sheet"
            onClick={() => window.print()}
          >
            Print
          </button>
          {!floating && (
            <button
              type="button"
              className="fm-close"
              onClick={onClose}
              aria-label={closeLabel}
              title={closeLabel}
            >
              {compact ? '← Problem' : '✕'}
            </button>
          )}
        </div>
      </header>

      <div className="fm-tabs" role="tablist" aria-label="Formula categories">
        {TABS.map(t => (
          <button
            key={t.id}
            type="button"
            role="tab"
            aria-selected={tab === t.id}
            className={`fm-tab${tab === t.id ? ' is-active' : ''}`}
            onClick={() => setTab(t.id)}
          >
            {t.label}
          </button>
        ))}
      </div>

      <div className="formula-modal-body">
        {tab === 'formulas' && (
          <div className="fm-formula-grid">
            <article className="fm-fcard">
              <div className="fm-fcard-top">
                <span className="fm-fcard-label">Slope</span>
                <MiniSlopeSvg />
              </div>
              <div className="fm-math-display">
                <em>m</em> = <Frac num={<><em>y</em><sub>2</sub> − <em>y</em><sub>1</sub></>} den={<><em>x</em><sub>2</sub> − <em>x</em><sub>1</sub></>} />
              </div>
            </article>

            <article className="fm-fcard">
              <div className="fm-fcard-top">
                <span className="fm-fcard-label">Midpoint</span>
                <MiniMidpointSvg />
              </div>
              <div className="fm-math-display">
                <em>M</em> = <span className="m-paren">(</span>
                <Frac num={<><em>x</em><sub>1</sub> + <em>x</em><sub>2</sub></>} den="2" />
                <span className="m-comma">,</span>
                <Frac num={<><em>y</em><sub>1</sub> + <em>y</em><sub>2</sub></>} den="2" />
                <span className="m-paren">)</span>
              </div>
            </article>

            <article className="fm-fcard">
              <div className="fm-fcard-top">
                <span className="fm-fcard-label">Length / Distance</span>
                <MiniLengthSvg />
              </div>
              <div className="fm-math-display">
                <em>d</em> = <Sqrt>(<em>x</em><sub>2</sub> − <em>x</em><sub>1</sub>)<sup>2</sup> + (<em>y</em><sub>2</sub> − <em>y</em><sub>1</sub>)<sup>2</sup></Sqrt>
              </div>
            </article>

            <article className="fm-fcard">
              <div className="fm-fcard-top">
                <span className="fm-fcard-label">Parallel &amp; 90° Slopes</span>
                <MiniPerpSvg />
              </div>
              <div className="fm-math-stack">
                <div><span>∥</span> <em>m</em><sub>1</sub> = <em>m</em><sub>2</sub></div>
                <div><span>⊥</span> <em>m</em><sub>1</sub> · <em>m</em><sub>2</sub> = −1 <small>(flip &amp; negate)</small></div>
                <div className="fm-math-muted"><em>m</em> = 0 (horiz) ⊥ undefined (vert)</div>
              </div>
            </article>

            <article className="fm-fcard">
              <div className="fm-fcard-top">
                <span className="fm-fcard-label">Equation of a Line</span>
                <MiniLineEqSvg />
              </div>
              <div className="fm-math-stack">
                <div><em>y</em> = <em>mx</em> + <em>b</em></div>
                <div className="fm-math-muted"><em>Ax</em> + <em>By</em> + <em>C</em> = 0 · horiz <em>y</em> = <em>k</em> · vert <em>x</em> = <em>k</em></div>
              </div>
            </article>

            <article className="fm-fcard">
              <div className="fm-fcard-top">
                <span className="fm-fcard-label">Circle at Origin</span>
                <MiniCircleSvg />
              </div>
              <div className="fm-math-stack">
                <div><em>x</em><sup>2</sup> + <em>y</em><sup>2</sup> = <em>r</em><sup>2</sup></div>
                <div className="fm-math-muted">Inside &lt; <em>r</em><sup>2</sup> · On = <em>r</em><sup>2</sup> · Outside &gt; <em>r</em><sup>2</sup></div>
              </div>
            </article>
          </div>
        )}

        {tab === 'lines' && (
          <div className="fm-lines-wrap">
            <div className="fm-tri-grid">
              <article className="fm-tri-card">
                <TriLineSvg kind="median" />
                <h4>Median</h4>
                <div className="fm-tri-spec"><span>Point</span><strong>Vertex + Midpoint</strong></div>
                <div className="fm-tri-spec"><span>Slope</span><strong>Between those 2</strong></div>
              </article>
              <article className="fm-tri-card">
                <TriLineSvg kind="altitude" />
                <h4>Altitude</h4>
                <div className="fm-tri-spec"><span>Point</span><strong>Vertex</strong></div>
                <div className="fm-tri-spec"><span>Slope</span><strong>⊥ opposite side</strong></div>
              </article>
              <article className="fm-tri-card">
                <TriLineSvg kind="rb" />
                <h4>Right Bisector</h4>
                <div className="fm-tri-spec"><span>Point</span><strong>Midpoint</strong></div>
                <div className="fm-tri-spec"><span>Slope</span><strong>⊥ that side</strong></div>
              </article>
            </div>

            <div className="fm-centres-bar">
              <div><strong>Centroid</strong><span>POI of 2 medians (verify with average of 3 vertices)</span></div>
              <div><strong>Orthocentre</strong><span>POI of 2 altitudes</span></div>
              <div><strong>Circumcentre</strong><span>POI of 2 right bisectors (equidistant to all 3 vertices)</span></div>
            </div>
          </div>
        )}

        {tab === 'shapes' && (
          <div className="fm-shapes-grid">
            {[
              { kind: 'right-tri', name: 'Right Triangle', rule: '2 slopes multiply to −1  or  a² + b² = c²' },
              { kind: 'isosceles', name: 'Isosceles / Equilateral', rule: '2 equal side lengths / all 3 equal lengths' },
              { kind: 'parallelogram', name: 'Parallelogram', rule: 'Both pairs of opposite sides have equal slopes' },
              { kind: 'rhombus', name: 'Rhombus', rule: 'All 4 sides have equal length (or diagonals ⊥ bisect)' },
              { kind: 'rectangle', name: 'Rectangle', rule: 'Opposite sides ∥  +  one 90° corner' },
              { kind: 'square', name: 'Square', rule: 'All 4 sides equal  +  one 90° corner' },
              { kind: 'trapezoid', name: 'Trapezoid', rule: '1 pair ∥ AND the other pair NOT ∥' },
              { kind: 'chord', name: 'Chord & Midsegment', rule: 'Chord RB hits (0, 0) · Midsegment ∥ base & ½ length' },
            ].map(item => (
              <div key={item.name} className="fm-shape-card">
                <ShapeMiniSvg kind={item.kind} />
                <div>
                  <div className="fm-shape-name">{item.name}</div>
                  <div className="fm-shape-rule">{item.rule}</div>
                </div>
              </div>
            ))}
          </div>
        )}

        {tab === 'plans' && (
          <div className="fm-plans-list">
            <div className="fm-plan-card">
              <div className="fm-plan-title">Shortest Distance (Point → Line)</div>
              <div className="fm-plan-flow">
                <span>1. Isolate y → read m</span>
                <span>2. Write ⊥ line through P</span>
                <span>3. Solve system → POI</span>
                <span>4. Length(P, POI)</span>
              </div>
            </div>
            <div className="fm-plan-card">
              <div className="fm-plan-title">Equation of a Median (vertex A to BC)</div>
              <div className="fm-plan-flow">
                <span>1. Midpoint M of BC</span>
                <span>2. Slope between A &amp; M</span>
                <span>3. Sub m &amp; A → y = mx + b</span>
              </div>
            </div>
            <div className="fm-plan-card">
              <div className="fm-plan-title">Equation of an Altitude (vertex A to BC)</div>
              <div className="fm-plan-flow">
                <span>1. Slope of BC</span>
                <span>2. Flip &amp; negate → m⊥</span>
                <span>3. Sub m⊥ &amp; A → y = mx + b</span>
              </div>
            </div>
            <div className="fm-plan-card">
              <div className="fm-plan-title">Equation of a Right Bisector (segment AB)</div>
              <div className="fm-plan-flow">
                <span>1. Midpoint M of AB</span>
                <span>2. Slope of AB → m⊥</span>
                <span>3. Sub m⊥ &amp; M → y = mx + b</span>
              </div>
            </div>
            <div className="fm-plan-card">
              <div className="fm-plan-title">Centroid / Circumcentre / Orthocentre</div>
              <div className="fm-plan-flow">
                <span>1. Write 2 line equations</span>
                <span>2. Solve system → POI</span>
                <span>3. (Optional) check 3rd line</span>
              </div>
            </div>
          </div>
        )}

        {tab === 'traps' && (
          <div className="fm-traps-list">
            <div className="fm-trap-item">
              <strong>Add vs Subtract</strong>
              <p>Midpoint <b>adds</b> (x₁ + x₂)/2. Slope and Length <b>subtract</b> (x₂ − x₁).</p>
            </div>
            <div className="fm-trap-item">
              <strong>Horizontal ⊥ Vertical</strong>
              <p>If m = 0 (y = k), the 90° line is vertical: m = undefined, equation x = h.</p>
            </div>
            <div className="fm-trap-item">
              <strong>Right Bisector uses Midpoint, NOT Vertex</strong>
              <p>Sub the midpoint M into y = mx + b. Using the opposite vertex gives an altitude.</p>
            </div>
            <div className="fm-trap-item">
              <strong>Fraction Killer for POI</strong>
              <p>Multiply the whole line equation by the denominator before substituting or eliminating.</p>
            </div>
            <div className="fm-trap-item">
              <strong>Keep Exact Radicals</strong>
              <p>Leave √13 or √50 = 5√2 exact until the very last line. Never round mid-proof.</p>
            </div>
            <div className="fm-trap-item">
              <strong>Trapezoid Needs Both Checks</strong>
              <p>Show 1 pair of opposite sides has equal slope AND the other pair has different slopes.</p>
            </div>
            <div className="fm-trap-item">
              <strong>Centroid on Full-Solution Tests</strong>
              <p>Write 2 median equations and solve their POI. Use the 3-vertex average only to check your work.</p>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}

export function FormulaSheetModal({
  open,
  onClose,
  dockable = false,
  onToggleFloat,
}: {
  open: boolean
  onClose: () => void
  dockable?: boolean
  onToggleFloat?: () => void
}) {
  const [floating, setFloating] = useState(true)

  if (!open) return null

  if (dockable && !floating) {
    return (
      <aside className="formula-dock-rail" aria-label="Unit 2 Playbook">
        <FormulaSheetContent
          onClose={onClose}
          closeLabel="Close Playbook"
          floating={false}
          onToggleFloat={() => setFloating(true)}
        />
      </aside>
    )
  }

  return (
    <WinBoxWindow
      id="syntax-playbook-winbox"
      eyebrow="MPM2D Reference"
      title="Unit 2 Playbook"
      defaultWidth={670}
      defaultHeight={630}
      minWidth={310}
      minHeight={340}
      onClose={onClose}
    >
      <FormulaSheetContent
        onClose={onClose}
        floating
        onToggleFloat={onToggleFloat ?? (dockable ? () => setFloating(false) : undefined)}
      />
    </WinBoxWindow>
  )
}
