import { useRef, useState } from 'react'
import { Check, Compass, Palette, Trash2, Upload } from 'lucide-react'
import { toast } from 'sonner'
import {
  getAllThemePacks,
  getThemeContrastSummary,
  useThemePackStore,
} from '../core/themePacks'

interface PluginsPageProps {
  onOpenCommunityHub: () => void
}

export function PluginsPage({ onOpenCommunityHub }: PluginsPageProps) {
  const activeThemeId = useThemePackStore(s => s.activeThemeId)
  const customThemes = useThemePackStore(s => s.customThemes)
  const setActiveThemeId = useThemePackStore(s => s.setActiveThemeId)
  const importThemeJson = useThemePackStore(s => s.importThemeJson)
  const removeCustomTheme = useThemePackStore(s => s.removeCustomTheme)
  const allThemes = getAllThemePacks(customThemes)
  const currentMode: 'light' | 'dark' =
    typeof document !== 'undefined' && document.documentElement.dataset.theme === 'dark'
      ? 'dark'
      : 'light'

  const [importError, setImportError] = useState('')
  const fileInputRef = useRef<HTMLInputElement>(null)

  async function handleThemeImport(file: File) {
    setImportError('')
    const text = await file.text()
    const res = importThemeJson(text)
    if (!res.ok) {
      setImportError(res.error)
    } else {
      toast.success(`Applied theme pack "${res.theme.name}"`)
    }
  }

  return (
    <main className="sx-workspace-page sx-plugins-page" aria-label="Plugins">
      <header className="sx-plugins-header">
        <div className="sx-plugins-title-row">
          <div className="sx-workspace-head">
            <h1>Plugins</h1>
            <span className="sx-hub-count">Theme packs and plugin runtime</span>
          </div>
          <div className="sx-plugins-cta-group">
            <button
              type="button"
              className="sx-btn-secondary"
              onClick={() => fileInputRef.current?.click()}
            >
              <Upload size={14} strokeWidth={2} aria-hidden="true" />
              <span>Import .syntaxtheme</span>
            </button>
            <button
              type="button"
              className="sx-browse-hub-btn"
              onClick={onOpenCommunityHub}
            >
              <Compass size={15} strokeWidth={2} aria-hidden="true" />
              <span>Community Hub</span>
            </button>
          </div>
        </div>

        <input
          ref={fileInputRef}
          type="file"
          accept=".syntaxtheme,.json"
          style={{ display: 'none' }}
          onChange={e => {
            const file = e.target.files?.[0]
            if (file) void handleThemeImport(file)
            e.target.value = ''
          }}
        />
        {importError && <p className="sx-field-error">{importError}</p>}
      </header>

      <section id="plugins-themes" className="sx-plugins-section">
        <div className="sx-plugins-section-head">
          <h2 className="sx-inline-icon-label">
            <Palette size={17} aria-hidden="true" />
            <span>Theme Packs</span>
          </h2>
          <span>{allThemes.length}</span>
        </div>
        <div className="sx-theme-pack-grid">
          {allThemes.map(pack => {
            const palette = currentMode === 'dark' ? pack.dark : pack.light
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
                    <small>{getThemeContrastSummary(pack, currentMode)}</small>
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
      </section>

      <section className="sx-plugins-section" aria-label="Plugin runtime">
        <div className="sx-plugins-section-head">
          <h2>Installed Plugins &amp; Courses</h2>
          <span>0</span>
        </div>
        <div className="sx-hub-empty">
          <p>The plugin runtime is being rebuilt around self-contained package archives.</p>
          <p className="sx-profile-handle">
            Official courses and workspace tools have been moved to{' '}
            <a
              href="https://github.com/syntax-platform/syntax-official-plugins"
              target="_blank"
              rel="noreferrer"
            >
              syntax-official-plugins
            </a>
            .
          </p>
        </div>
      </section>
    </main>
  )
}
