import { useEffect, useRef, useState } from 'react'
import { Download, Upload } from 'lucide-react'
import { toast } from 'sonner'
import { Segmented, Toggle } from './Controls'
import {
  collectLocalCloudSnapshot,
  mergeCloudIntoLocal,
  SyntaxCloudPayloadSchema,
} from '../core/clerkSync'
import type { SyntaxPrefs } from '../core/prefs'
import { Sema } from '../mascot/Sema'
import {
  SEMA_ANIMATIONS,
  SEMA_EXPRESSIONS,
  SEMA_REST_COMMA_PATHS,
  SEMA_SHAPES,
  SEMA_TAILS,
  type StateId,
} from '../mascot/bloub'

type StudioTab = 'shape' | 'semicolon' | 'expression' | 'motion'

export function SettingsPage({
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
  const backupInputRef = useRef<HTMLInputElement | null>(null)

  function handleExportWorkspace() {
    const snapshot = collectLocalCloudSnapshot()
    const blob = new Blob([JSON.stringify(snapshot, null, 2)], { type: 'application/json' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = 'syntax-workspace-backup.json'
    a.click()
    window.setTimeout(() => URL.revokeObjectURL(url), 1000)
    toast.success('Exported workspace backup')
  }

  async function handleImportWorkspace(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    e.target.value = ''
    if (!file) return
    try {
      const text = await file.text()
      const parsed = SyntaxCloudPayloadSchema.safeParse(JSON.parse(text))
      if (!parsed.success) {
        toast.error('That file is not a valid Syntax workspace backup.')
        return
      }
      mergeCloudIntoLocal(parsed.data)
      toast.success('Workspace backup restored')
    } catch {
      toast.error('Could not read workspace backup file.')
    }
  }

  useEffect(() => {
    window.scrollTo({ top: 0 })
  }, [])

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
        <span className="sx-hub-count">Appearance, sound, and Sema companion preferences</span>
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

            <div
              id="sema-studio-tabpanel"
              className="sema-studio-panel"
              role="tabpanel"
              aria-labelledby={`sema-tab-${studioTab}`}
            >
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
          <h2 id="pref-sounds-h">Sound</h2>
          <div className="preference-rows">
            <div className="preference-row">
              <div className="syntax-pref-copy">
                <p>Enable interface sound effects</p>
                <span>Subtle tactile audio for interactions and feedback</span>
              </div>
              <Toggle
                label="Enable interface sound effects"
                checked={soundOn}
                onChange={onChangeSound}
              />
            </div>
          </div>
        </section>

        <hr />

        <section id="pref-backup" aria-labelledby="pref-backup-h">
          <h2 id="pref-backup-h">Backup &amp; Restore</h2>
          <div className="preference-rows">
            <div className="preference-row">
              <div className="syntax-pref-copy">
                <p>Export workspace backup</p>
                <span>
                  Download your theme, sound, Sema style, installed extensions, and settings as a
                  portable file
                </span>
              </div>
              <button
                type="button"
                className="sx-btn-secondary sx-btn-sm"
                onClick={handleExportWorkspace}
              >
                <Download size={14} aria-hidden="true" />
                <span>Export</span>
              </button>
            </div>

            <div className="preference-row">
              <div className="syntax-pref-copy">
                <p>Import workspace backup</p>
                <span>Restore preferences and extensions from a saved backup file</span>
              </div>
              <input
                ref={backupInputRef}
                type="file"
                accept=".json,application/json"
                className="sx-sr-only"
                aria-label="Import workspace backup file"
                onChange={e => void handleImportWorkspace(e)}
              />
              <button
                type="button"
                className="sx-btn-secondary sx-btn-sm"
                onClick={() => backupInputRef.current?.click()}
              >
                <Upload size={14} aria-hidden="true" />
                <span>Import</span>
              </button>
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
                className="sx-btn-secondary sx-btn-sm"
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
