import { useEffect, useRef, useState, type DragEvent } from 'react'
import { toast } from 'sonner'
import {
  exportPackageFile,
  parsePackageFile,
  type SyntaxPackageManifest,
} from '../core/packages'
import {
  getDependentsOf,
  resetOfficialDefaults,
  setPackageEnabled,
  uninstallPackage,
  useInstalledPackages,
} from '../core/registry'
import { PluginSandboxFrame } from '../core/sandbox'
import { CoreTouchWarning } from './CoreTouchWarning'
import { PackageIcon } from './PackageIcon'

type PluginsPageProps = {
  theme: 'light' | 'dark'
  onRequestInstall: (pkg: SyntaxPackageManifest, source: 'local-file') => void
}

export function PluginsPage({ theme, onRequestInstall }: PluginsPageProps) {
  const installed = useInstalledPackages()
  const [dragOver, setDragOver] = useState(false)
  const [importError, setImportError] = useState<string | null>(null)
  const [previewPlugin, setPreviewPlugin] = useState<SyntaxPackageManifest | null>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    if (!previewPlugin) return
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setPreviewPlugin(null)
    }
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [previewPlugin])

  const appPlugins = installed.filter(r => r.manifest.kind === 'plugin')
  const embeddedPlugins = installed.filter(r => r.manifest.kind === 'embedded-plugin')

  async function handleFiles(files: FileList | null) {
    if (!files || files.length === 0) return
    setImportError(null)
    const file = files[0]
    const result = await parsePackageFile(file)
    if (!result.ok) {
      setImportError(result.errors.join(' '))
      return
    }
    onRequestInstall(result.manifest, 'local-file')
  }

  function handleDrop(e: DragEvent<HTMLDivElement>) {
    e.preventDefault()
    setDragOver(false)
    void handleFiles(e.dataTransfer.files)
  }

  function handleUninstall(pkg: SyntaxPackageManifest) {
    const deps = getDependentsOf(pkg.id)
    if (deps.length > 0) {
      toast.warning(
        `${pkg.name} is required by ${deps.map(d => d.manifest.name).join(', ')}. Removing it will pause those courses until reinstalled.`,
      )
    }
    const res = uninstallPackage(pkg.id)
    if (res.ok) {
      toast.success(`Removed ${pkg.name}`)
    }
  }

  return (
    <main className="sx-page">
      <div className="sx-page-header">
        <div>
          <h1>Plugins &amp; Embedded Libraries</h1>
          <p className="sx-page-subtitle">
            Toggle global app plugins (<code>.syntaxplugin</code>) or manage course libraries (
            <code>.syntaxembeddedplugin</code>). Sema stays in Syntax Core and cannot break your
            plugins.
          </p>
        </div>
        <button
          type="button"
          className="sx-btn sx-btn-sm"
          onClick={() => {
            resetOfficialDefaults()
            toast.success('Restored official Syntax packages')
          }}
        >
          Restore official defaults
        </button>
      </div>

      {/* Drag & Drop Local Package Importer */}
      <div
        className={`sx-dropzone${dragOver ? ' is-dragover' : ''}`}
        onDragOver={e => {
          e.preventDefault()
          setDragOver(true)
        }}
        onDragLeave={() => setDragOver(false)}
        onDrop={handleDrop}
      >
        <strong>Import a Syntax package file</strong>
        <p className="sx-card-tagline" style={{ marginTop: 6 }}>
          Drop a <code>.syntaxcourse</code>, <code>.syntaxplugin</code>, or{' '}
          <code>.syntaxembeddedplugin</code> file here, or choose one from your device.
        </p>
        <div style={{ marginTop: 12 }}>
          <input
            ref={fileInputRef}
            type="file"
            accept=".syntaxcourse,.syntaxplugin,.syntaxembeddedplugin"
            style={{ display: 'none' }}
            onChange={e => {
              void handleFiles(e.target.files)
              e.target.value = ''
            }}
          />
          <button
            type="button"
            className="sx-btn sx-btn-sm sx-btn-primary"
            onClick={() => fileInputRef.current?.click()}
          >
            Choose package file
          </button>
        </div>
        {importError && (
          <div className="sx-error-badge" style={{ marginTop: 12, display: 'inline-block' }}>
            {importError}
          </div>
        )}
      </div>

      {/* Global App Plugins */}
      <div className="sx-section-title">
        <span>App Plugins (.syntaxplugin) · {appPlugins.length}</span>
      </div>
      <div className="sx-grid">
        {appPlugins.map(({ manifest, enabled }) => (
          <article key={manifest.id} className="sx-card">
            <div className="sx-card-top">
              <PackageIcon svg={manifest.iconSvg} name={manifest.name} />
              <div className="sx-card-meta">
                <div className="sx-card-title-row">
                  <h2 className="sx-card-title">{manifest.name}</h2>
                  {manifest.author.official && (
                    <span className="sx-pill sx-pill-official">Official</span>
                  )}
                </div>
                <div className="sx-card-author">
                  v{manifest.version} · <code>{manifest.extension}</code>
                </div>
              </div>
              <button
                type="button"
                role="switch"
                aria-checked={enabled}
                aria-label={`Toggle ${manifest.name}`}
                className={`sx-switch${enabled ? ' is-on' : ''}`}
                onClick={() => {
                  setPackageEnabled(manifest.id, !enabled)
                  toast(`${manifest.name} ${!enabled ? 'enabled' : 'turned off'}`)
                }}
              />
            </div>

            <p className="sx-card-tagline">{manifest.tagline}</p>

            {manifest.touchesCore && (
              <CoreTouchWarning variant="banner" reason={manifest.coreTouchReason} />
            )}

            <div className="sx-card-footer">
              <div style={{ display: 'flex', gap: 6 }}>
                <button
                  type="button"
                  className="sx-btn sx-btn-sm sx-btn-ghost"
                  onClick={() => exportPackageFile(manifest)}
                >
                  Export
                </button>
                {manifest.sandboxHtml && (
                  <button
                    type="button"
                    className="sx-btn sx-btn-sm"
                    onClick={() => setPreviewPlugin(manifest)}
                  >
                    Preview sandbox
                  </button>
                )}
              </div>
              <button
                type="button"
                className="sx-btn sx-btn-sm sx-btn-danger"
                onClick={() => handleUninstall(manifest)}
              >
                Remove
              </button>
            </div>
          </article>
        ))}
      </div>

      {/* Embedded Course Plugins */}
      <div className="sx-section-title">
        <span>Embedded Course Plugins (.syntaxembeddedplugin) · {embeddedPlugins.length}</span>
      </div>
      <div className="sx-grid">
        {embeddedPlugins.map(({ manifest, enabled }) => {
          const usedBy = getDependentsOf(manifest.id)
          return (
            <article key={manifest.id} className="sx-card">
              <div className="sx-card-top">
                <PackageIcon svg={manifest.iconSvg} name={manifest.name} />
                <div className="sx-card-meta">
                  <div className="sx-card-title-row">
                    <h2 className="sx-card-title">{manifest.name}</h2>
                    {manifest.author.official && (
                      <span className="sx-pill sx-pill-official">Official</span>
                    )}
                  </div>
                  <div className="sx-card-author">
                    v{manifest.version} · <code>{manifest.extension}</code>
                  </div>
                </div>
                <button
                  type="button"
                  role="switch"
                  aria-checked={enabled}
                  aria-label={`Toggle ${manifest.name}`}
                  className={`sx-switch${enabled ? ' is-on' : ''}`}
                  onClick={() => {
                    setPackageEnabled(manifest.id, !enabled)
                    toast(`${manifest.name} ${!enabled ? 'enabled' : 'turned off'}`)
                  }}
                />
              </div>

              <p className="sx-card-tagline">{manifest.tagline}</p>

              {usedBy.length > 0 && (
                <div className="sx-inline-note" style={{ fontSize: 12.5, padding: '8px 10px' }}>
                  Required by: <strong>{usedBy.map(d => d.manifest.name).join(', ')}</strong>
                </div>
              )}

              {manifest.aiUsage && (
                <div className="sx-ai-card">
                  <span className="sx-ai-card-title">AI Usage Card</span>
                  <div className="sx-pill-row">
                    {manifest.aiUsage.blocks.map(block => (
                      <span key={block} className="sx-pill sx-pill-ext">
                        {block}
                      </span>
                    ))}
                  </div>
                  <pre className="sx-code">{manifest.aiUsage.example}</pre>
                </div>
              )}

              <div className="sx-card-footer">
                <div style={{ display: 'flex', gap: 6 }}>
                  <button
                    type="button"
                    className="sx-btn sx-btn-sm sx-btn-ghost"
                    onClick={() => exportPackageFile(manifest)}
                  >
                    Export
                  </button>
                  {manifest.sandboxHtml && (
                    <button
                      type="button"
                      className="sx-btn sx-btn-sm"
                      onClick={() => setPreviewPlugin(manifest)}
                    >
                      Run Sandbox
                    </button>
                  )}
                </div>
                <button
                  type="button"
                  className="sx-btn sx-btn-sm sx-btn-danger"
                  onClick={() => handleUninstall(manifest)}
                >
                  Remove
                </button>
              </div>
            </article>
          )
        })}
      </div>

      {/* Sandboxed Plugin Preview Modal */}
      {previewPlugin && previewPlugin.sandboxHtml && (
        <div
          className="sx-modal-backdrop"
          role="dialog"
          aria-modal="true"
          onClick={e => {
            if (e.target === e.currentTarget) setPreviewPlugin(null)
          }}
        >
          <div className="sx-modal is-wide">
            <div className="sx-modal-head">
              <div>
                <h2>{previewPlugin.name}</h2>
                <div className="sx-card-author">
                  Isolated iframe sandbox · network access: {previewPlugin.safety.networkAccess}
                </div>
              </div>
              <button
                type="button"
                className="sx-btn sx-btn-sm sx-btn-ghost"
                onClick={() => setPreviewPlugin(null)}
              >
                Close
              </button>
            </div>
            <PluginSandboxFrame
              pluginId={previewPlugin.id}
              title={previewPlugin.name}
              html={previewPlugin.sandboxHtml}
              theme={theme}
            />
          </div>
        </div>
      )}
    </main>
  )
}
