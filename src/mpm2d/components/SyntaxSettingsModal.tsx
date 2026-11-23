import { useEffect, useRef, useState } from 'react'
import { Segmented, Toggle } from '../../settings/Controls'
import { Sema } from '../mascot/Sema'
import {
  SEMA_ANIMATIONS,
  SEMA_EXPRESSIONS,
  SEMA_REST_COMMA_PATHS,
  SEMA_SHAPES,
  SEMA_TAILS,
  type StateId,
} from '../mascot/bloub'
import type { SyntaxPrefs } from '../storage'

type SettingsSectionId = 'appearance' | 'learning' | 'sema' | 'sounds' | 'guide'
type StudioTab = 'shape' | 'semicolon' | 'expression' | 'motion'

const NAV_SECTIONS: { id: SettingsSectionId; label: string }[] = [
  { id: 'appearance', label: 'Appearance' },
  { id: 'learning', label: 'Learning & Pen' },
  { id: 'sema', label: 'Sema Companion' },
  { id: 'sounds', label: 'Sounds & Voice' },
  { id: 'guide', label: 'Getting Started' },
]

export function SyntaxSettingsPage({
  onClose,
  theme,
  onChangeTheme,
  soundOn,
  onChangeSound,
  prefs,
  onPatchPrefs,
  onReplayWelcome,
}: {
  onClose: () => void
  theme: 'light' | 'dark'
  onChangeTheme: (t: 'light' | 'dark') => void
  soundOn: boolean
  onChangeSound: (v: boolean) => void
  prefs: SyntaxPrefs
  onPatchPrefs: (patch: Partial<SyntaxPrefs>) => void
  onReplayWelcome: () => void
}) {
  const [previewAnim, setPreviewAnim] = useState<StateId>('idle')
  const [studioTab, setStudioTab] = useState<StudioTab>('shape')
  const [activeSection, setActiveSection] = useState<SettingsSectionId>('appearance')
  const scrollLockUntilRef = useRef<number>(0)

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.preventDefault()
        onClose()
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [onClose])

  // Reliable scroll-spy with programmatic scroll lock and bottom-of-page detection
  useEffect(() => {
    let raf = 0
    const computeActive = () => {
      raf = 0
      if (Date.now() < scrollLockUntilRef.current) return

      const scrollBottom = window.innerHeight + window.scrollY
      const docHeight = document.documentElement.scrollHeight
      if (docHeight - scrollBottom <= 24) {
        setActiveSection(NAV_SECTIONS[NAV_SECTIONS.length - 1]!.id)
        return
      }

      const anchorY = 132
      let current: SettingsSectionId = NAV_SECTIONS[0]!.id
      for (const sec of NAV_SECTIONS) {
        const el = document.getElementById(`pref-${sec.id}`)
        if (!el) continue
        const rect = el.getBoundingClientRect()
        if (rect.top <= anchorY) {
          current = sec.id
        }
      }
      setActiveSection(current)
    }

    const onScroll = () => {
      if (!raf) raf = window.requestAnimationFrame(computeActive)
    }

    window.addEventListener('scroll', onScroll, { passive: true })
    window.addEventListener('resize', onScroll, { passive: true })
    return () => {
      if (raf) window.cancelAnimationFrame(raf)
      window.removeEventListener('scroll', onScroll)
      window.removeEventListener('resize', onScroll)
    }
  }, [])

  function scrollToSection(id: SettingsSectionId) {
    setActiveSection(id)
    scrollLockUntilRef.current = Date.now() + 750
    const el = document.getElementById(`pref-${id}`)
    if (el) {
      const top = Math.max(0, el.getBoundingClientRect().top + window.scrollY - 88)
      window.scrollTo({ top, behavior: 'smooth' })
    }
  }

  const activeShapeLabel =
    SEMA_SHAPES.find(s => s.id === prefs.semaShape)?.label ?? prefs.semaShape
  const activeTailLabel =
    SEMA_TAILS.find(t => t.id === prefs.semaTail)?.label ?? prefs.semaTail
  const activeExprLabel =
    SEMA_EXPRESSIONS.find(e => e.id === prefs.semaExpression)?.label ?? prefs.semaExpression
  const activeAnimLabel =
    SEMA_ANIMATIONS.find(a => a.id === previewAnim)?.label ?? previewAnim

  return (
    <main className="settings-layout syntax-settings-page" aria-label="Settings">
      <nav className="settings-nav" aria-label="Settings">
        <a
          href="#back-to-course"
          className="settings-nav-back-link"
          onClick={e => {
            e.preventDefault()
            onClose()
          }}
        >
          ← Back to Unit 2
        </a>
        {NAV_SECTIONS.map(sec => (
          <a
            key={sec.id}
            href={`#pref-${sec.id}`}
            aria-current={activeSection === sec.id ? 'page' : undefined}
            onClick={e => {
              e.preventDefault()
              scrollToSection(sec.id)
            }}
          >
            {sec.label}
          </a>
        ))}
      </nav>

      <a
        className="settings-back"
        href="#back-to-course"
        aria-label="Back to Unit 2"
        onClick={e => {
          e.preventDefault()
          onClose()
        }}
      >
        <svg width="24" height="24" viewBox="0 0 24 24" fill="none" aria-hidden="true">
          <path d="m14.5 3-9 9 9 9" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      </a>

      <article className="preferences syntax-settings-article" aria-label="Preferences" data-ready="true">
        <section id="pref-appearance" aria-labelledby="pref-appearance-h">
          <h2 id="pref-appearance-h">Appearance</h2>
          <div className="preference-rows">
            <div className="preference-row preference-choices">
              <p>Choose your preferred color mode</p>
              <Segmented
                label="Color mode"
                value={theme}
                onChange={onChangeTheme}
                options={[
                  { value: 'light', label: 'Light' },
                  { value: 'dark', label: 'Dark' },
                ]}
              />
            </div>
          </div>
        </section>

        <hr />

        <section id="pref-learning" aria-labelledby="pref-learning-h">
          <h2 id="pref-learning-h">Learning &amp; Pen Workspace</h2>
          <div className="preference-rows">
            <div className="preference-row">
              <div className="syntax-pref-copy">
                <p>Enable Draw Mode</p>
                <span>Draw a checkmark anywhere on the page to submit &amp; continue</span>
              </div>
              <Toggle
                label="Enable Draw Mode"
                checked={prefs.drawMode}
                onChange={v => onPatchPrefs({ drawMode: v })}
              />
            </div>

            <div className="preference-row">
              <div className="syntax-pref-copy">
                <p>Collapse pen controls by default</p>
                <span>Keep the top-left pen tip size &amp; color drawer tucked away until tapped</span>
              </div>
              <Toggle
                label="Collapse pen controls by default"
                checked={prefs.penControlsCollapsed}
                onChange={v => onPatchPrefs({ penControlsCollapsed: v })}
              />
            </div>

            <div className="preference-row">
              <div className="syntax-pref-copy">
                <p>Show catch-up paths</p>
                <span>Weave prerequisite stepping-stone chapters into the Level path</span>
              </div>
              <Toggle
                label="Show catch-up paths"
                checked={prefs.showCatchupPaths}
                onChange={v => onPatchPrefs({ showCatchupPaths: v })}
              />
            </div>
          </div>
        </section>

        <hr />

        <section id="pref-sema" aria-labelledby="pref-sema-h">
          <h2 id="pref-sema-h">Sema Companion</h2>
          <div className="sema-studio-card">
            <div className="sema-studio-hero">
              <div className="sema-studio-stage">
                <Sema
                  state={previewAnim}
                  expression={prefs.semaExpression}
                  shape={prefs.semaShape}
                  tail={prefs.semaTail}
                  size={104}
                  interactive
                  followCursor={false}
                  ariaLabel="Sema live studio preview"
                />
              </div>
              <div className="sema-studio-summary">
                <div className="sema-studio-badges">
                  <span className="sema-studio-badge">{activeShapeLabel}</span>
                  <span className="sema-studio-badge is-tail">{activeTailLabel}</span>
                  <span className="sema-studio-badge is-expr">{activeExprLabel}</span>
                  <span className="sema-studio-badge is-motion">{activeAnimLabel}</span>
                </div>
                <p className="sema-studio-hint">
                  Poke Sema to cycle reactions, or pull to test elastic stretch physics.
                </p>
                <div className="sema-studio-quick-actions">
                  <button
                    type="button"
                    className="sema-studio-action-btn"
                    onClick={() => {
                      setPreviewAnim('idle')
                      onPatchPrefs({ semaShape: 'jenson', semaTail: 'jenson', semaExpression: 'neutral' })
                    }}
                  >
                    Reset defaults
                  </button>
                </div>
              </div>
            </div>

            <div className="sema-studio-tabs" role="tablist" aria-label="Sema customization">
              {(
                [
                  { id: 'shape', label: `Shape (${SEMA_SHAPES.length})` },
                  { id: 'semicolon', label: `Semicolon (${SEMA_TAILS.length})` },
                  { id: 'expression', label: `Expression (${SEMA_EXPRESSIONS.length})` },
                  { id: 'motion', label: `Motion (${SEMA_ANIMATIONS.length})` },
                ] as const
              ).map(t => (
                <button
                  key={t.id}
                  type="button"
                  role="tab"
                  aria-selected={studioTab === t.id}
                  className={`sema-studio-tab${studioTab === t.id ? ' is-active' : ''}`}
                  onClick={() => setStudioTab(t.id)}
                >
                  {t.label}
                </button>
              ))}
            </div>

            <div className="sema-studio-panel" role="tabpanel">
              {studioTab === 'shape' && (
                <div className="sema-studio-chips">
                  {SEMA_SHAPES.map(sh => (
                    <button
                      key={sh.id}
                      type="button"
                      className={`sema-chip${prefs.semaShape === sh.id ? ' is-active' : ''}`}
                      onClick={() => {
                        setPreviewAnim('idle')
                        onPatchPrefs({ semaShape: sh.id })
                      }}
                    >
                      {sh.label}
                    </button>
                  ))}
                </div>
              )}

              {studioTab === 'semicolon' && (
                <div className="sema-studio-chips">
                  {SEMA_TAILS.map(tl => (
                    <button
                      key={tl.id}
                      type="button"
                      className={`sema-chip is-tail-chip${prefs.semaTail === tl.id ? ' is-active' : ''}`}
                      onClick={() => {
                        setPreviewAnim('idle')
                        onPatchPrefs({ semaTail: tl.id })
                      }}
                    >
                      <svg
                        className="sema-chip-glyph"
                        width="12"
                        height="16"
                        viewBox="-74 126 148 176"
                        fill="none"
                        aria-hidden="true"
                      >
                        <path d={SEMA_REST_COMMA_PATHS[tl.id]} fill="currentColor" />
                      </svg>
                      <span>{tl.label}</span>
                    </button>
                  ))}
                </div>
              )}

              {studioTab === 'expression' && (
                <div className="sema-studio-chips">
                  {SEMA_EXPRESSIONS.map(ex => (
                    <button
                      key={ex.id}
                      type="button"
                      className={`sema-chip${prefs.semaExpression === ex.id ? ' is-active' : ''}`}
                      onClick={() => {
                        setPreviewAnim('idle')
                        onPatchPrefs({ semaExpression: ex.id })
                      }}
                    >
                      {ex.label}
                    </button>
                  ))}
                </div>
              )}

              {studioTab === 'motion' && (
                <div className="sema-studio-chips">
                  {SEMA_ANIMATIONS.map(an => (
                    <button
                      key={an.id}
                      type="button"
                      className={`sema-chip is-anim${previewAnim === an.id ? ' is-active' : ''}`}
                      onClick={() => setPreviewAnim(an.id)}
                    >
                      {an.label}
                    </button>
                  ))}
                </div>
              )}
            </div>
          </div>
        </section>

        <hr />

        <section id="pref-sounds" aria-labelledby="pref-sounds-h">
          <h2 id="pref-sounds-h">Sounds &amp; Narration</h2>
          <div className="preference-rows">
            <div className="preference-row">
              <div className="syntax-pref-copy">
                <p>Enable Sema narration in walkthroughs</p>
                <span>Spoken guidance synced to Sema’s live animations</span>
              </div>
              <Toggle
                label="Enable Sema narration"
                checked={prefs.voiceOn}
                onChange={v => onPatchPrefs({ voiceOn: v })}
              />
            </div>
            <div className="preference-row">
              <div className="syntax-pref-copy">
                <p>Enable sound effects in lessons</p>
                <span>Subtle tactile audio for checks, hints, and completions</span>
              </div>
              <Toggle
                label="Enable sound effects"
                checked={soundOn}
                onChange={onChangeSound}
              />
            </div>
          </div>
        </section>

        <hr />

        <section id="pref-guide" aria-labelledby="pref-guide-h">
          <h2 id="pref-guide-h">Getting Started</h2>
          <div className="preference-rows">
            <div className="preference-row">
              <div className="syntax-pref-copy">
                <p>Welcome tour with Sema</p>
                <span>Re-open theme and Draw Mode setup anytime</span>
              </div>
              <button
                type="button"
                className="plain-button syntax-pref-btn"
                onClick={() => {
                  onClose()
                  onReplayWelcome()
                }}
              >
                Replay tour
              </button>
            </div>
          </div>
        </section>
      </article>
    </main>
  )
}
