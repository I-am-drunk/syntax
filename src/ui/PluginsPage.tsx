import { useMemo, useRef, useState } from 'react'
import { Compass, Search, Upload } from 'lucide-react'
import { toast } from 'sonner'
import { Toggle } from '../settings/Controls'
import { OFFICIAL_BY_ID } from '../packages/catalog'
import {
  normalizeExternalManifest,
  parsePackageFile,
  type SyntaxPackageManifest,
} from '../core/packages'
import { getDependentsOf, useInstalledPackages, useRegistryStore } from '../core/registry'
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
  const [query, setQuery] = useState('')
  const [importError, setImportError] = useState('')
  const fileInputRef = useRef<HTMLInputElement>(null)

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase()
    if (!q) return entries
    return entries.filter(
      e =>
        e.manifest.name.toLowerCase().includes(q) ||
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
    const parsed = await parsePackageFile(file)
    if (!parsed.ok) {
      setImportError(parsed.errors[0] || 'Invalid package file.')
      return
    }
    onImportPackage(normalizeExternalManifest(parsed.manifest, OFFICIAL_ID_SET))
  }

  return (
    <main className="sx-workspace-page sx-plugins-page" aria-label="Plugins">
      <header className="sx-plugins-header">
        <div className="sx-plugins-title-row">
          <div>
            <h1>Plugins</h1>
            <span className="sx-hub-count">{entries.length} installed on this device</span>
          </div>
          <div className="sx-plugins-cta-group">
            <button
              type="button"
              className="sx-btn-ghost"
              onClick={() => fileInputRef.current?.click()}
            >
              <Upload size={14} aria-hidden="true" />
              <span>Import</span>
            </button>
            <button
              type="button"
              className="sx-browse-hub-btn"
              onClick={onOpenCommunityHub}
            >
              <Compass size={16} aria-hidden="true" />
              <span>Browse Community Hub</span>
            </button>
          </div>
        </div>

        <div className="sx-hub-search sx-plugins-search">
          <Search size={16} className="sx-hub-search-icon" aria-hidden="true" />
          <input
            type="search"
            value={query}
            onChange={e => setQuery(e.target.value)}
            placeholder="Filter installed plugins and courses..."
            aria-label="Filter installed plugins"
          />
        </div>

        <input
          ref={fileInputRef}
          type="file"
          accept=".syntaxcourse,.syntaxplugin,.syntaxembeddedplugin,.json"
          style={{ display: 'none' }}
          onChange={e => {
            const file = e.target.files?.[0]
            if (file) void handleImportFile(file)
            e.target.value = ''
          }}
        />
        {importError && <p className="sx-field-error">{importError}</p>}
      </header>

      {appPlugins.length > 0 && (
        <section id="plugins-app-plugins" className="sx-plugins-section">
          <h3>App Plugins</h3>
          <div className="preference-rows">
            {appPlugins.map(({ manifest, enabled }) => (
              <div key={manifest.id} className="preference-row sx-plugin-row">
                <button
                  type="button"
                  className="sx-plugin-row-main"
                  onClick={() => onSelectPackage(manifest)}
                >
                  <PackageIcon svg={manifest.iconSvg} size={34} />
                  <span className="sx-plugin-name">{manifest.name}</span>
                  {manifest.touchesCore && <CoreTouchIcon />}
                  <span className="sx-plugin-ver">v{manifest.version}</span>
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
          <h3>Embedded Plugins</h3>
          <div className="preference-rows">
            {embeddedPlugins.map(({ manifest, enabled }) => (
              <div key={manifest.id} className="preference-row sx-plugin-row">
                <button
                  type="button"
                  className="sx-plugin-row-main"
                  onClick={() => onSelectPackage(manifest)}
                >
                  <PackageIcon svg={manifest.iconSvg} size={34} />
                  <span className="sx-plugin-name">{manifest.name}</span>
                  <span className={`sx-status-pill${enabled ? ' is-ok' : ''}`}>
                    {enabled ? 'Installed on your account' : 'Disabled'}
                  </span>
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
          <h3>Installed Courses</h3>
          <div className="preference-rows">
            {courses.map(({ manifest }) => (
              <div key={manifest.id} className="preference-row sx-plugin-row">
                <button
                  type="button"
                  className="sx-plugin-row-main"
                  onClick={() => onSelectPackage(manifest)}
                >
                  <PackageIcon svg={manifest.iconSvg} size={34} />
                  <span className="sx-plugin-name">{manifest.name}</span>
                  <span className="sx-plugin-ver">@{manifest.author.handle}</span>
                </button>
                <button
                  type="button"
                  className="sx-btn-ghost"
                  onClick={() => onOpenCourse(manifest.id)}
                >
                  Open
                </button>
              </div>
            ))}
          </div>
        </section>
      )}

      {filtered.length === 0 && (
        <div className="sx-hub-empty">
          <p>No installed packages match "{query}".</p>
          <button type="button" className="sx-btn-ghost" onClick={() => setQuery('')}>
            Clear filter
          </button>
        </div>
      )}
    </main>
  )
}
