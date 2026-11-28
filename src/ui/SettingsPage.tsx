import { useEffect, useRef, useState } from 'react'
import { Download, RotateCcw, Upload } from 'lucide-react'
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

  const defaultTheme: 'light' | 'dark' =
    typeof window !== 'undefined' &&
    window.matchMedia &&
    window.matchMedia('(prefers-color-scheme: dark)').matches
      ? 'dark'
      : 'light'
  const isSemaDefault =
    prefs.semaShape === 'jenson' &&
    prefs.semaTail === 'jenson' &&
    prefs.semaExpression === 'neutral' &&
    previewAnim === 'idle'

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
              <div className="syntax-pref-copy">
                <p>Color mode</p>
                <span>Choose between Light and Dark appearance</span>
              </div>
              <div className="sx-pref-control-group">
                <Segmented
                  label="Color mode"
                  value={theme}
                  onChange={onChangeTheme}
                  options={[
                    { value: 'light', label: 'Light' },
                    { value: 'dark', label: 'Dark' },
                  ]}
                />
                <button
                  type="button"
                  className="sx-pref-reset-btn"
                  disabled={theme === defaultTheme}
                  aria-label="Reset color mode to default"
                  title="Reset to default"
                  onClick={() => onChangeTheme(defaultTheme)}
                >
                  <RotateCcw size={14} strokeWidth={1.9} aria-hidden="true" />
                </button>
              </div>
            </div>

            <div className="preference-row preference-choices">
              <div className="syntax-pref-copy">
                <p>Navigation bar style</p>
                <span>Switch between the classic bottom bar and the sliding pill indicator</span>
              </div>
              <div className="sx-pref-control-group">
                <Segmented
                  label="Navigation bar style"
                  value={prefs.navStyle}
                  onChange={v => onPatchPrefs({ navStyle: v })}
                  options={[
                    { value: 'underline', label: 'Bottom bar' },
                    { value: 'pill', label: 'Sliding pill' },
                  ]}
                />
                <button
                  type="button"
                  className="sx-pref-reset-btn"
                  disabled={prefs.navStyle === 'underline'}
                  aria-label="Reset navigation bar style to default"
                  title="Reset to default"
                  onClick={() => onPatchPrefs({ navStyle: 'underline' })}
                >
                  <RotateCcw size={14} strokeWidth={1.9} aria-hidden="true" />
                </button>
              </div>
            </div>

            <div className="preference-row preference-choices">
              <div className="syntax-pref-copy">
                <p>Clicking the Syntax logo opens</p>
                <span>Choose whether clicking Syntax returns to your Library or Home</span>
              </div>
              <div className="sx-pref-control-group">
                <Segmented
                  label="Syntax logo destination"
                  value={prefs.logoClickTarget}
                  onChange={v => onPatchPrefs({ logoClickTarget: v })}
                  options={[
                    { value: 'library', label: 'Library' },
                    { value: 'home', label: 'Home' },
                  ]}
                />
                <button
                  type="button"
                  className="sx-pref-reset-btn"
                  disabled={prefs.logoClickTarget === 'library'}
                  aria-label="Reset logo destination to default"
                  title="Reset to default"
                  onClick={() => onPatchPrefs({ logoClickTarget: 'library' })}
                >
                  <RotateCcw size={14} strokeWidth={1.9} aria-hidden="true" />
                </button>
              </div>
            </div>
          </div>
        </section>

        <hr />

        <section id="pref-sema" aria-labelledby="pref-sema-h">
          <div className="sx-sema-section-head">
            <div>
              <h2 id="pref-sema-h">Sema Companion</h2>
              <span className="sx-sema-section-sub">
                {activeShapeLabel} · {activeTailLabel} · {activeExprLabel}
                {previewAnim !== 'idle' ? ` · ${activeAnimLabel}` : ''}
              </span>
            </div>
            <button
              type="button"
              className="sx-btn-secondary sx-btn-sm"
              disabled={isSemaDefault}
              onClick={() => {
                setPreviewAnim('idle')
                onPatchPrefs({ semaShape: 'jenson', semaTail: 'jenson', semaExpression: 'neutral' })
              }}
            >
              <RotateCcw size={13} strokeWidth={1.9} aria-hidden="true" />
              <span>Reset</span>
            </button>
          </div>

          <div className="sx-sema-studio">
            <div className="sx-sema-stage-panel">
              <div className="sx-sema-stage-canvas">
                <Sema
                  state={previewAnim}
                  expression={prefs.semaExpression}
                  shape={prefs.semaShape}
                  tail={prefs.semaTail}
                  size={120}
                  interactive
                  followCursor={false}
                  ariaLabel="Sema live studio preview"
                />
              </div>
              <p className="sx-sema-stage-hint">
                Poke or pull Sema to test elastic reactions
              </p>
            </div>

            <div className="sx-sema-controls-panel">
              <div
                className="sx-pill-switch sx-sema-pill-tabs"
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
                    { id: 'shape', label: 'Shape' },
                    { id: 'semicolon', label: 'Tail' },
                    { id: 'expression', label: 'Expression' },
                    { id: 'motion', label: 'Motion' },
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
                    className={`sx-pill-switch-btn${studioTab === t.id ? ' is-active' : ''}`}
                    onClick={() => setStudioTab(t.id)}
                  >
                    {t.label}
                  </button>
                ))}
              </div>

              <div
                id="sema-studio-tabpanel"
                className="sx-sema-option-grid"
                role="tabpanel"
                aria-labelledby={`sema-tab-${studioTab}`}
              >
                {studioTab === 'shape' &&
                  SEMA_SHAPES.map(sh => (
                    <button
                      key={sh.id}
                      type="button"
                      aria-pressed={prefs.semaShape === sh.id}
                      className={`sx-sema-opt-btn${prefs.semaShape === sh.id ? ' is-active' : ''}`}
                      onClick={() => {
                        setPreviewAnim('idle')
                        onPatchPrefs({ semaShape: sh.id })
                      }}
                    >
                      {sh.label}
                    </button>
                  ))}

                {studioTab === 'semicolon' &&
                  SEMA_TAILS.map(tl => (
                    <button
                      key={tl.id}
                      type="button"
                      aria-pressed={prefs.semaTail === tl.id}
                      className={`sx-sema-opt-btn${prefs.semaTail === tl.id ? ' is-active' : ''}`}
                      onClick={() => {
                        setPreviewAnim('idle')
                        onPatchPrefs({ semaTail: tl.id })
                      }}
                    >
                      <svg
                        className="sema-chip-glyph"
                        width="11"
                        height="15"
                        viewBox="-74 126 148 176"
                        fill="none"
                        aria-hidden="true"
                      >
                        <path d={SEMA_REST_COMMA_PATHS[tl.id]} fill="currentColor" />
                      </svg>
                      <span>{tl.label}</span>
                    </button>
                  ))}

                {studioTab === 'expression' &&
                  SEMA_EXPRESSIONS.map(ex => (
                    <button
                      key={ex.id}
                      type="button"
                      aria-pressed={prefs.semaExpression === ex.id}
                      className={`sx-sema-opt-btn${prefs.semaExpression === ex.id ? ' is-active' : ''}`}
                      onClick={() => {
                        setPreviewAnim('idle')
                        onPatchPrefs({ semaExpression: ex.id })
                      }}
                    >
                      {ex.label}
                    </button>
                  ))}

                {studioTab === 'motion' &&
                  SEMA_ANIMATIONS.map(an => (
                    <button
                      key={an.id}
                      type="button"
                      aria-pressed={previewAnim === an.id}
                      className={`sx-sema-opt-btn${previewAnim === an.id ? ' is-active' : ''}`}
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
