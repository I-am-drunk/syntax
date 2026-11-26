import { useMemo, useRef, useState, type DragEvent } from 'react'
import {
  AlertTriangle,
  Compass,
  Download,
  Hammer,
  Search,
  Upload,
  X,
  XCircle,
} from 'lucide-react'
import { toast } from 'sonner'
import { Toggle } from '../settings/Controls'
import { OFFICIAL_BY_ID } from '../packages/catalog'
import {
  exportSytxArchive,
  parsePackageFile,
  type UnpackedSytx,
} from '../core/archive'
import { evaluateInstalledHealth } from '../core/compatibility'
import {
  SYNTAX_API_VERSION,
  SYNTAX_HOST_VERSION,
  normalizeExternalManifest,
  type SyntaxPackageManifest,
} from '../core/packages'
import { getVaultArchive } from '../core/packageVault'
import { usePluginRuntimeStore } from '../core/pluginRuntime'
import { useInstalledPackages, useRegistryStore } from '../core/registry'
import { BuildPluginModal } from './BuildPluginModal'
import { CoreTouchIcon } from './CoreTouchWarning'
import { PackageIcon } from './PackageIcon'

const OFFICIAL_ID_SET = new Set(OFFICIAL_BY_ID.keys())

interface PluginsPageProps {
  onSelectPackage: (pkg: SyntaxPackageManifest) => void
  onOpenCourse: (courseId: string) => void
  onOpenCommunityHub: () => void
  onImportArchive: (archive: UnpackedSytx) => void
}

export function PluginsPage({
  onSelectPackage,
  onOpenCourse,
  onOpenCommunityHub,
  onImportArchive,
}: PluginsPageProps) {
  const entries = useInstalledPackages()
  const setPackageEnabled = useRegistryStore(s => s.setPackageEnabled)
  const runtimeHealthById = usePluginRuntimeStore(s => s.healthById)

  const [query, setQuery] = useState('')
  const [importError, setImportError] = useState('')
  const [buildModalOpen, setBuildModalOpen] = useState(false)
  const [isDraggingFile, setIsDraggingFile] = useState(false)
  const dragDepthRef = useRef(0)
  const fileInputRef = useRef<HTMLInputElement>(null)

  const healthById = useMemo(() => {
    const map = new Map<
      string,
      { state: 'healthy' | 'warning' | 'error'; label?: string; detail?: string }
    >()
    for (const rec of entries) {
      const rt = runtimeHealthById[rec.manifest.id]
      if (rt?.quarantined) {
        map.set(rec.manifest.id, {
          state: 'error',
          label: 'Quarantined',
          detail: rt.lastError ?? 'Disabled after repeated crashes.',
        })
        continue
      }
      const health = evaluateInstalledHealth(rec, entries)
      if (health.state !== 'healthy') {
        const first = health.issues[0]
        const label =
          first?.code === 'host-incompatible'
            ? 'Incompatible'
            : first?.code === 'breaks-installed'
              ? 'Conflict'
              : first?.code === 'missing-dep'
                ? 'Missing dep'
                : first?.code === 'disabled-dep'
                  ? 'Dep disabled'
                  : 'Warning'
        map.set(rec.manifest.id, {
          state: health.state,
          label,
          detail: first?.message,
        })
      } else {
        map.set(rec.manifest.id, { state: 'healthy' })
      }
    }
    return map
  }, [entries, runtimeHealthById])

  const activeCount = useMemo(() => entries.filter(e => e.enabled).length, [entries])
  const issueCount = useMemo(
    () => [...healthById.values()].filter(h => h.state !== 'healthy').length,
    [healthById],
  )

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
    const res = setPackageEnabled(manifest.id, next)
    if (!res.ok) {
      toast.error(res.error)
      return
    }
    if (!next && res.impact && !res.impact.safe) {
      toast.message(`Disabled ${manifest.name}`, {
        description: res.impact.summary,
      })
    }
  }

  async function handleExport(manifest: SyntaxPackageManifest) {
    const vaultRec = await getVaultArchive(manifest.id)
    exportSytxArchive(manifest, vaultRec?.rawBytes)
    toast.success(`Exported ${manifest.id}-${manifest.version}.sytx`)
  }

  async function handleImportFile(file: File) {
    setImportError('')
    const parsed = await parsePackageFile(file)
    if (!parsed.ok) {
      setImportError(parsed.errors[0] || 'Invalid package file.')
      return
    }
    const normalized = normalizeExternalManifest(parsed.archive.manifest, OFFICIAL_ID_SET)
    onImportArchive({ ...parsed.archive, manifest: normalized })
  }

  function handleDragEnter(e: DragEvent<HTMLElement>) {
    if (!e.dataTransfer.types.includes('Files')) return
    e.preventDefault()
    dragDepthRef.current += 1
    setIsDraggingFile(true)
  }

  function handleDragOver(e: DragEvent<HTMLElement>) {
    if (!e.dataTransfer.types.includes('Files')) return
    e.preventDefault()
    e.dataTransfer.dropEffect = 'copy'
  }

  function handleDragLeave(e: DragEvent<HTMLElement>) {
    if (!e.dataTransfer.types.includes('Files')) return
    e.preventDefault()
    dragDepthRef.current = Math.max(0, dragDepthRef.current - 1)
    if (dragDepthRef.current === 0) {
      setIsDraggingFile(false)
    }
  }

  function handleDrop(e: DragEvent<HTMLElement>) {
    e.preventDefault()
    dragDepthRef.current = 0
    setIsDraggingFile(false)
    const file = e.dataTransfer.files?.[0]
    if (file) {
      void handleImportFile(file)
    }
  }

  function renderHealthFlag(id: string) {
    const health = healthById.get(id)
    if (!health || health.state === 'healthy') return null
    return (
      <span
        className={`sx-health-flag is-${health.state}`}
        title={health.detail}
      >
        {health.state === 'error' ? (
          <XCircle size={12} aria-hidden="true" />
        ) : (
          <AlertTriangle size={12} aria-hidden="true" />
        )}
        <span>{health.label}</span>
      </span>
    )
  }

  return (
    <main
      className={`sx-workspace-page sx-plugins-page${isDraggingFile ? ' is-dragging' : ''}`}
      aria-label="Plugins"
      onDragEnter={handleDragEnter}
      onDragOver={handleDragOver}
      onDragLeave={handleDragLeave}
      onDrop={handleDrop}
    >
      {isDraggingFile && (
        <div className="sx-drop-overlay" aria-live="polite">
          <div className="sx-drop-overlay-card">
            <Upload size={26} aria-hidden="true" />
            <strong>Drop .sytx archive to inspect</strong>
            <span>Syntax verifies compatibility, permissions, and files before installing.</span>
          </div>
        </div>
      )}

      <header className="sx-plugins-header">
        <div className="sx-plugins-title-row">
          <div className="sx-workspace-head">
            <h1>Plugins</h1>
            <span className="sx-hub-count">
              Syntax {SYNTAX_HOST_VERSION} &middot; API v{SYNTAX_API_VERSION.split('.')[0]} &middot;{' '}
              {activeCount} active
            </span>
            {issueCount > 0 && (
              <span className="sx-health-flag is-warning">
                <AlertTriangle size={12} aria-hidden="true" />
                <span>
                  {issueCount} {issueCount === 1 ? 'issue' : 'issues'}
                </span>
              </span>
            )}
          </div>
          <div className="sx-plugins-cta-group">
            <button
              type="button"
              className="sx-btn-secondary"
              onClick={() => fileInputRef.current?.click()}
            >
              <Upload size={14} strokeWidth={2} aria-hidden="true" />
              <span>Import .sytx</span>
            </button>
            <button
              type="button"
              className="sx-btn-secondary"
              onClick={() => setBuildModalOpen(true)}
            >
              <Hammer size={14} strokeWidth={2} aria-hidden="true" />
              <span>Build a plugin</span>
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
            placeholder="Filter installed plugins, engines, and courses..."
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

        <p className="sx-drop-hint">
          Drop a <code>.sytx</code> archive anywhere on this page to inspect and install locally.
        </p>

        <input
          ref={fileInputRef}
          type="file"
          accept=".sytx,.zip,.syntaxcourse,.syntaxplugin,.syntaxembeddedplugin,.json"
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
                      {renderHealthFlag(manifest.id)}
                    </div>
                    <span className="sx-plugin-sub">{manifest.tagline}</span>
                  </div>
                </button>
                <div className="sx-plugin-row-controls">
                  <button
                    type="button"
                    className="sx-row-export-btn"
                    title={`Export ${manifest.name} as .sytx`}
                    aria-label={`Export ${manifest.name} as .sytx`}
                    onClick={() => void handleExport(manifest)}
                  >
                    <Download size={14} aria-hidden="true" />
                  </button>
                  <Toggle
                    label={`Enable ${manifest.name}`}
                    checked={enabled}
                    onChange={next => handleToggle(manifest, next)}
                  />
                </div>
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
                      {!enabled && (
                        <span className="sx-hub-inline-state sx-embedded-flag">
                          <span>Disabled</span>
                        </span>
                      )}
                      {renderHealthFlag(manifest.id)}
                    </div>
                    <span className="sx-plugin-sub">{manifest.tagline}</span>
                  </div>
                </button>
                <div className="sx-plugin-row-controls">
                  <button
                    type="button"
                    className="sx-row-export-btn"
                    title={`Export ${manifest.name} as .sytx`}
                    aria-label={`Export ${manifest.name} as .sytx`}
                    onClick={() => void handleExport(manifest)}
                  >
                    <Download size={14} aria-hidden="true" />
                  </button>
                  <Toggle
                    label={`Enable ${manifest.name}`}
                    checked={enabled}
                    onChange={next => handleToggle(manifest, next)}
                  />
                </div>
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
                      {renderHealthFlag(manifest.id)}
                    </div>
                    <span className="sx-plugin-sub">{manifest.tagline}</span>
                  </div>
                </button>
                <div className="sx-plugin-row-controls">
                  <button
                    type="button"
                    className="sx-row-export-btn"
                    title={`Export ${manifest.name} as .sytx`}
                    aria-label={`Export ${manifest.name} as .sytx`}
                    onClick={() => void handleExport(manifest)}
                  >
                    <Download size={14} aria-hidden="true" />
                  </button>
                  <button
                    type="button"
                    className="sx-btn-secondary sx-btn-sm"
                    onClick={() => onOpenCourse(manifest.id)}
                  >
                    {enabled ? 'Open' : 'Enable'}
                  </button>
                </div>
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

      <BuildPluginModal
        open={buildModalOpen}
        onClose={() => setBuildModalOpen(false)}
        onTestInstall={archive => onImportArchive(archive)}
      />
    </main>
  )
}
