import { useMemo, useRef, useState } from 'react'
import { Check, Compass, Palette, Search, Trash2, Upload, X } from 'lucide-react'
import { toast } from 'sonner'
import { Toggle } from '../settings/Controls'
import { OFFICIAL_BY_ID, RETIRED_OFFICIAL_IDS } from '../packages/catalog'
import {
  normalizeExternalManifest,
  parsePackageFile,
  type SyntaxPackageManifest,
} from '../core/packages'
import { getDependentsOf, useInstalledPackages, useRegistryStore } from '../core/registry'
import {
  getAllThemePacks,
  getThemeContrastSummary,
  useThemePackStore,
} from '../core/themePacks'
import { PackageIcon } from './PackageIcon'
import { CoreTouchIcon } from './CoreTouchWarning'

const OFFICIAL_ID_SET = new Set(OFFICIAL_BY_ID.keys())

interface PluginsPageProps {
  onSelectPackage: (pkg: SyntaxPackageManifest) => void
  onOpenCourse: (courseId: string) => void
  onOpenCommunityHub: () => void
  onImportPackage: (pkg: SyntaxPackageManifest) => void
}

export function PluginsPage({
  onSelectPackage,
  onOpenCourse,
  onOpenCommunityHub,
  onImportPackage,
}: PluginsPageProps) {
  const entries = useInstalledPackages()
  const setPackageEnabled = useRegistryStore(s => s.setPackageEnabled)
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
  const [query, setQuery] = useState('')
  const [importError, setImportError] = useState('')
  const fileInputRef = useRef<HTMLInputElement>(null)

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase()
    if (!q) return entries
    return entries.filter(
      e =>
        e.manifest.name.toLowerCase().includes(q) ||
        e.manifest.tagline.toLowerCase().includes(q) ||
        e.manifest.id.toLowerCase().includes(q) ||
        e.manifest.author.handle.toLowerCase().includes(q),
    )
  }, [entries, query])

  const appPlugins = useMemo(
    () => filtered.filter(e => e.manifest.kind === 'plugin'),
    [filtered],
  )
  const embeddedPlugins = useMemo(
    () => filtered.filter(e => e.manifest.kind === 'embedded-plugin'),
    [filtered],
  )
  const courses = useMemo(
    () => filtered.filter(e => e.manifest.kind === 'course'),
    [filtered],
  )

  function handleToggle(manifest: SyntaxPackageManifest, next: boolean) {
    if (!next && manifest.kind === 'embedded-plugin') {
      const dependents = getDependentsOf(manifest.id)
      if (dependents.length > 0) {
        toast.message(`Disabled ${manifest.name}`, {
          description: `Required by ${dependents.map(d => d.manifest.name).join(', ')}.`,
        })
      }
    }
    setPackageEnabled(manifest.id, next)
  }

  async function handleImportFile(file: File) {
    setImportError('')
    if (file.name.toLowerCase().endsWith('.syntaxtheme')) {
      const text = await file.text()
      const res = importThemeJson(text)
      if (!res.ok) {
        setImportError(res.error)
      } else {
        toast.success(`Applied theme pack "${res.theme.name}"`)
      }
      return
    }
    const parsed = await parsePackageFile(file)
    if (!parsed.ok) {
      // Also allow .json files that declare syntax.theme.v1
      if (file.name.toLowerCase().endsWith('.json')) {
        const text = await file.text()
        if (text.includes('"syntax.theme.v1"')) {
          const themeRes = importThemeJson(text)
          if (themeRes.ok) {
            toast.success(`Applied theme pack "${themeRes.theme.name}"`)
            return
          }
          setImportError(themeRes.error)
          return
        }
      }
      setImportError(parsed.errors[0] || 'Invalid package file.')
      return
    }
    if (OFFICIAL_ID_SET.has(parsed.manifest.id)) {
      setImportError(
        `Package ID "${parsed.manifest.id}" is reserved for a built-in official package and cannot be imported from a file.`,
      )
      return
    }
    if (RETIRED_OFFICIAL_IDS.has(parsed.manifest.id)) {
      setImportError(
        `Package ID "${parsed.manifest.id}" is a retired built-in ID and cannot be imported.`,
      )
      return
    }
    onImportPackage(normalizeExternalManifest(parsed.manifest, OFFICIAL_ID_SET))
  }

  return (
    <main className="sx-workspace-page sx-plugins-page" aria-label="Plugins">
      <header className="sx-plugins-header">
        <div className="sx-plugins-title-row">
          <div className="sx-workspace-head">
            <h1>Plugins</h1>
            <span className="sx-hub-count">
              {entries.length} installed {entries.length === 1 ? 'package' : 'packages'}
            </span>
          </div>
          <div className="sx-plugins-cta-group">
            <button
              type="button"
              className="sx-btn-secondary"
              onClick={() => fileInputRef.current?.click()}
            >
              <Upload size={14} strokeWidth={2} aria-hidden="true" />
              <span>Import file</span>
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

        <div className="sx-search-field sx-plugins-search">
          <Search size={15} className="sx-search-icon" aria-hidden="true" />
          <input
            type="text"
            value={query}
            onChange={e => setQuery(e.target.value)}
            placeholder="Filter installed plugins and courses..."
            aria-label="Filter installed plugins"
          />
          {query && (
            <button
              type="button"
              className="sx-search-clear"
              aria-label="Clear filter"
              onClick={() => setQuery('')}
            >
              <X size={14} aria-hidden="true" />
            </button>
          )}
        </div>

        <input
          ref={fileInputRef}
          type="file"
          accept=".syntaxcourse,.syntaxplugin,.syntaxembeddedplugin,.syntaxtheme,.json"
          style={{ display: 'none' }}
          onChange={e => {
            const file = e.target.files?.[0]
            if (file) void handleImportFile(file)
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

      {appPlugins.length > 0 && (
        <section id="plugins-app-plugins" className="sx-plugins-section">
          <div className="sx-plugins-section-head">
            <h2>App Plugins</h2>
            <span>{appPlugins.length}</span>
          </div>
          <div className="sx-plugin-list">
            {appPlugins.map(({ manifest, enabled }) => (
              <div key={manifest.id} className="sx-plugin-item">
                <button
                  type="button"
                  className="sx-plugin-row-main"
                  onClick={() => onSelectPackage(manifest)}
                >
                  <PackageIcon
                    id={manifest.id}
                    kind={manifest.kind}
                    svg={manifest.iconSvg}
                    size={40}
                  />
                  <div className="sx-plugin-copy">
                    <div className="sx-plugin-name-line">
                      <span className="sx-plugin-name">{manifest.name}</span>
                      {manifest.touchesCore && <CoreTouchIcon />}
                      <span className="sx-plugin-ver">v{manifest.version}</span>
                    </div>
                    <span className="sx-plugin-sub">{manifest.tagline}</span>
                  </div>
                </button>
                <Toggle
                  label={`Enable ${manifest.name}`}
                  checked={enabled}
                  onChange={next => handleToggle(manifest, next)}
                />
              </div>
            ))}
          </div>
        </section>
      )}

      {embeddedPlugins.length > 0 && (
        <section id="plugins-embedded" className="sx-plugins-section">
          <div className="sx-plugins-section-head">
            <h2>Embedded Engines</h2>
            <span>{embeddedPlugins.length}</span>
          </div>
          <div className="sx-plugin-list">
            {embeddedPlugins.map(({ manifest, enabled }) => (
              <div key={manifest.id} className="sx-plugin-item">
                <button
                  type="button"
                  className="sx-plugin-row-main"
                  onClick={() => onSelectPackage(manifest)}
                >
                  <PackageIcon
                    id={manifest.id}
                    kind={manifest.kind}
                    svg={manifest.iconSvg}
                    size={40}
                  />
                  <div className="sx-plugin-copy">
                    <div className="sx-plugin-name-line">
                      <span className="sx-plugin-name">{manifest.name}</span>
                      <span className="sx-plugin-ver">v{manifest.version}</span>
                      <span className={`sx-hub-inline-state sx-embedded-flag${enabled ? ' is-ok' : ''}`}>
                        {enabled && <Check size={12} strokeWidth={2.5} aria-hidden="true" />}
                        <span>{enabled ? 'Installed' : 'Disabled'}</span>
                      </span>
                    </div>
                    <span className="sx-plugin-sub">{manifest.tagline}</span>
                  </div>
                </button>
                <Toggle
                  label={`Enable ${manifest.name}`}
                  checked={enabled}
                  onChange={next => handleToggle(manifest, next)}
                />
              </div>
            ))}
          </div>
        </section>
      )}

      {courses.length > 0 && (
        <section id="plugins-courses" className="sx-plugins-section">
          <div className="sx-plugins-section-head">
            <h2>Installed Courses</h2>
            <span>{courses.length}</span>
          </div>
          <div className="sx-plugin-list">
            {courses.map(({ manifest, enabled }) => (
              <div key={manifest.id} className="sx-plugin-item">
                <button
                  type="button"
                  className="sx-plugin-row-main"
                  onClick={() => onSelectPackage(manifest)}
                >
                  <PackageIcon
                    id={manifest.id}
                    kind={manifest.kind}
                    svg={manifest.iconSvg}
                    size={40}
                  />
                  <div className="sx-plugin-copy">
                    <div className="sx-plugin-name-line">
                      <span className="sx-plugin-name">{manifest.name}</span>
                      <span className="sx-plugin-ver">@{manifest.author.handle}</span>
                      {!enabled && (
                        <span className="sx-hub-inline-state sx-embedded-flag">
                          <span>Disabled</span>
                        </span>
                      )}
                    </div>
                    <span className="sx-plugin-sub">{manifest.tagline}</span>
                  </div>
                </button>
                <button
                  type="button"
                  className="sx-btn-secondary sx-btn-sm"
                  onClick={() => onOpenCourse(manifest.id)}
                >
                  {enabled ? 'Open' : 'Enable'}
                </button>
              </div>
            ))}
          </div>
        </section>
      )}

      {filtered.length === 0 && (
        <div className="sx-hub-empty">
          <p>No installed packages match &ldquo;{query}&rdquo;.</p>
          <button type="button" className="sx-btn-secondary" onClick={() => setQuery('')}>
            Clear filter
          </button>
        </div>
      )}
    </main>
  )
}
