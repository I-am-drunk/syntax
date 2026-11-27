import { useEffect, useRef, useState } from 'react'
import { Check, Palette, Trash2, Upload } from 'lucide-react'
import { Segmented, Toggle } from '../../settings/Controls'
import { useRegistryStore } from '../../core/registry'
import {
  getAllThemePacks,
  getThemeContrastSummary,
  useThemePackStore,
} from '../../core/themePacks'
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

const CORE_WORKSPACE_TOOLS = [
  {
    id: 'pen-studio',
    label: 'Pen Studio scratchpad',
    description: 'Split-screen handwriting canvas beside math problems with graph, dot, and lined paper',
  },
  {
    id: 'walkthrough-player',
    label: 'Guided video walkthroughs',
    description: 'Manim-rendered Guided Hints and Full Solution videos directly inside lessons',
  },
  {
    id: 'floating-windows',
    label: 'Floating study windows',
    description: 'Draggable, resizable WinBox frames for Playbook and Hints beside your work',
  },
  {
    id: 'formula-playbook',
    label: 'Formula Playbook (F)',
    description: 'Instant searchable formula sheet accessible anytime with the F key',
  },
] as const

type StudioTab = 'shape' | 'semicolon' | 'expression' | 'motion'

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
  const [themeImportError, setThemeImportError] = useState('')
  const themeFileRef = useRef<HTMLInputElement>(null)
  const records = useRegistryStore(s => s.records)
  const setPackageEnabled = useRegistryStore(s => s.setPackageEnabled)
  const activeThemeId = useThemePackStore(s => s.activeThemeId)
  const customThemes = useThemePackStore(s => s.customThemes)
  const setActiveThemeId = useThemePackStore(s => s.setActiveThemeId)
  const importThemeJson = useThemePackStore(s => s.importThemeJson)
  const removeCustomTheme = useThemePackStore(s => s.removeCustomTheme)
  const allThemes = getAllThemePacks(customThemes)

  useEffect(() => {
    window.scrollTo({ top: 0 })
  }, [])

  async function handleThemeImport(file: File) {
    setThemeImportError('')
    const text = await file.text()
    const res = importThemeJson(text)
    if (!res.ok) {
      setThemeImportError(res.error)
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
    <main className="sx-workspace-page sx-settings-single" aria-label="Settings">
      <header className="sx-workspace-head">
        <h1>Settings</h1>
        <span className="sx-hub-count">Appearance, study workspace, and companion preferences</span>
      </header>

      <article className="preferences syntax-settings-article" aria-label="Preferences" data-ready="true">
        <section id="pref-appearance" aria-labelledby="pref-appearance-h">
          <h2 id="pref-appearance-h">Appearance &amp; Navigation</h2>
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

            <div className="preference-row preference-choices">
              <div className="syntax-pref-copy">
                <p>Clicking the Syntax logo opens</p>
                <span>Choose whether clicking Syntax returns to your Library or Home</span>
              </div>
              <Segmented
                label="Syntax logo destination"
                value={prefs.logoClickTarget}
                onChange={v => onPatchPrefs({ logoClickTarget: v })}
                options={[
                  { value: 'library', label: 'Library' },
                  { value: 'home', label: 'Home' },
                ]}
              />
            </div>

            <div className="preference-row">
              <div className="syntax-pref-copy">
                <p>Window momentum slide</p>
                <span>Glide dragged pop-up windows smoothly at high refresh rates when released</span>
              </div>
              <Toggle
                label="Window momentum slide"
                checked={prefs.windowInertia}
                onChange={v => onPatchPrefs({ windowInertia: v })}
              />
            </div>

            <div className="sx-theme-packs-block">
              <div className="sx-theme-packs-head">
                <div className="syntax-pref-copy">
                  <p className="sx-inline-icon-label">
                    <Palette size={15} aria-hidden="true" />
                    <span>Theme Packs (WCAG-verified)</span>
                  </p>
                  <span>Pure JSON color palettes validated for at least 4.5:1 text contrast</span>
                </div>
                <button
                  type="button"
                  className="sx-btn-secondary sx-btn-sm"
                  onClick={() => themeFileRef.current?.click()}
                >
                  <Upload size={13} aria-hidden="true" />
                  <span>Import .syntaxtheme</span>
                </button>
                <input
                  ref={themeFileRef}
                  type="file"
                  accept=".syntaxtheme,.json"
                  style={{ display: 'none' }}
                  onChange={e => {
                    const file = e.target.files?.[0]
                    if (file) void handleThemeImport(file)
                    e.target.value = ''
                  }}
                />
              </div>

              {themeImportError && <p className="sx-field-error">{themeImportError}</p>}

              <div className="sx-theme-pack-grid">
                {allThemes.map(pack => {
                  const palette = theme === 'dark' ? pack.dark : pack.light
                  const active = activeThemeId === pack.id
                  return (
                    <div
                      key={pack.id}
                      className={`sx-theme-pack-card${active ? ' is-active' : ''}`}
                    >
                      <button
                        type="button"
                        className="sx-theme-pack-hit"
                        aria-pressed={active}
                        onClick={() => setActiveThemeId(pack.id)}
                      >
                        <span className="sx-theme-swatches" aria-hidden="true">
                          <span style={{ background: palette.canvas }} />
                          <span style={{ background: palette.surface }} />
                          <span style={{ background: palette.accent }} />
                          <span style={{ background: palette.ink }} />
                        </span>
                        <span className="sx-theme-pack-meta">
                          <strong>{pack.name}</strong>
                          <small>{getThemeContrastSummary(pack, theme)}</small>
                        </span>
                        {active && (
                          <span className="sx-theme-active-check" aria-hidden="true">
                            <Check size={14} strokeWidth={2.5} />
                          </span>
                        )}
                      </button>
                      {!pack.builtIn && (
                        <button
                          type="button"
                          className="sx-theme-remove-btn"
                          aria-label={`Remove ${pack.name} theme`}
                          onClick={() => removeCustomTheme(pack.id)}
                        >
                          <Trash2 size={13} aria-hidden="true" />
                        </button>
                      )}
                    </div>
                  )
                })}
              </div>
            </div>
          </div>
        </section>

        <hr />

        <section id="pref-workspace-tools" aria-labelledby="pref-workspace-tools-h">
          <h2 id="pref-workspace-tools-h">Core Workspace Tools</h2>
          <div className="preference-rows">
            {CORE_WORKSPACE_TOOLS.map(tool => {
              const rec = records.find(r => r.manifest.id === tool.id)
              const enabled = Boolean(rec?.enabled)
              return (
                <div key={tool.id} className="preference-row">
                  <div className="syntax-pref-copy">
                    <p>{tool.label}</p>
                    <span>{tool.description}</span>
                  </div>
                  <Toggle
                    label={tool.label}
                    checked={enabled}
                    onChange={next => setPackageEnabled(tool.id, next)}
                  />
                </div>
              )
            })}
          </div>
        </section>

        <hr />

        <section id="pref-learning" aria-labelledby="pref-learning-h">
          <h2 id="pref-learning-h">Learning &amp; Pen Workspace</h2>
          <div className="preference-rows">
            <div className="preference-row">
              <div className="syntax-pref-copy">
                <p>Show step plan in Pen Studio</p>
                <span>Off by default so you plan steps yourself; turn on to pre-load guided step boards</span>
              </div>
              <Toggle
                label="Show step plan in Pen Studio"
                checked={prefs.showStepPlan}
                onChange={v => onPatchPrefs({ showStepPlan: v })}
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
                <span>Weave prerequisite stepping-stone chapters into the course path</span>
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

            <div
              className="sema-studio-tabs"
              role="tablist"
              aria-label="Sema customization"
              onKeyDown={e => {
                const order: StudioTab[] = ['shape', 'semicolon', 'expression', 'motion']
                const idx = order.indexOf(studioTab)
                if (e.key === 'ArrowRight') {
                  e.preventDefault()
                  const next = order[(idx + 1) % order.length]!
                  setStudioTab(next)
                  document.getElementById(`sema-tab-${next}`)?.focus()
                } else if (e.key === 'ArrowLeft') {
                  e.preventDefault()
                  const next = order[(idx - 1 + order.length) % order.length]!
                  setStudioTab(next)
                  document.getElementById(`sema-tab-${next}`)?.focus()
                }
              }}
            >
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
                  id={`sema-tab-${t.id}`}
                  type="button"
                  role="tab"
                  aria-selected={studioTab === t.id}
                  aria-controls="sema-studio-tabpanel"
                  tabIndex={studioTab === t.id ? 0 : -1}
                  className={`sema-studio-tab${studioTab === t.id ? ' is-active' : ''}`}
                  onClick={() => setStudioTab(t.id)}
                >
                  {t.label}
                </button>
              ))}
            </div>

            <div id="sema-studio-tabpanel" className="sema-studio-panel" role="tabpanel" aria-labelledby={`sema-tab-${studioTab}`}>
              {studioTab === 'shape' && (
                <div className="sema-studio-chips">
                  {SEMA_SHAPES.map(sh => (
                    <button
                      key={sh.id}
                      type="button"
                      aria-pressed={prefs.semaShape === sh.id}
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
                      aria-pressed={prefs.semaTail === tl.id}
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
                      aria-pressed={prefs.semaExpression === ex.id}
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
                      aria-pressed={previewAnim === an.id}
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
          <h2 id="pref-sounds-h">Sounds &amp; Voice</h2>
          <div className="preference-rows">
            <div className="preference-row">
              <div className="syntax-pref-copy">
                <p>Enable Sema narration in walkthroughs</p>
                <span>Spoken guidance synced to Sema&rsquo;s live animations</span>
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
                <span>Re-open theme and welcome setup anytime</span>
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
