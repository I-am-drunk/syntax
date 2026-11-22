import { useEffect, useState } from 'react'
import { Segmented, Toggle } from '../../settings/Controls'
import { Sema } from '../mascot/Sema'
import {
  SEMA_ANIMATIONS,
  SEMA_EXPRESSIONS,
  SEMA_SHAPES,
  type StateId,
} from '../mascot/bloub'
import type { SyntaxPrefs } from '../storage'

type SettingsSectionId = 'appearance' | 'learning' | 'sema' | 'sounds' | 'guide'

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
  const [activeSection, setActiveSection] = useState<SettingsSectionId>('appearance')

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

  // Scroll-spy so the sidebar highlights whichever section is currently in view
  useEffect(() => {
    const handleScroll = () => {
      const targetY = 140
      let bestId: SettingsSectionId = 'appearance'
      let bestDist = Infinity
      for (const sec of NAV_SECTIONS) {
        const el = document.getElementById(`pref-${sec.id}`)
        if (!el) continue
        const rect = el.getBoundingClientRect()
        const dist = Math.abs(rect.top - targetY)
        if (rect.top <= targetY + 80 && dist < bestDist) {
          bestDist = dist
          bestId = sec.id
        }
      }
      setActiveSection(bestId)
    }
    window.addEventListener('scroll', handleScroll, { passive: true })
    return () => window.removeEventListener('scroll', handleScroll)
  }, [])

  function scrollToSection(id: SettingsSectionId) {
    setActiveSection(id)
    const el = document.getElementById(`pref-${id}`)
    if (el) {
      const top = el.getBoundingClientRect().top + window.scrollY - 88
      window.scrollTo({ top: Math.max(0, top), behavior: 'smooth' })
    }
  }

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
            <div className="sema-studio-stage">
              <Sema
                state={previewAnim}
                expression={prefs.semaExpression}
                shape={prefs.semaShape}
                size={104}
                interactive
                ariaLabel="Sema live studio preview"
              />
              <span className="sema-studio-hint">
                Poke or drag Sema · Active: <strong>{previewAnim}</strong>
              </span>
            </div>

            <div className="sema-studio-group">
              <span className="sema-studio-label">Shape ({SEMA_SHAPES.length})</span>
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
            </div>

            <div className="sema-studio-group">
              <span className="sema-studio-label">Expression ({SEMA_EXPRESSIONS.length})</span>
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
            </div>

            <div className="sema-studio-group">
              <span className="sema-studio-label">Test Animation ({SEMA_ANIMATIONS.length})</span>
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
