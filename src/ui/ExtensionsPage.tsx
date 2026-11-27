import { useEffect, useState } from 'react'
import {
  AlertTriangle,
  Check,
  Compass,
  Copy,
  Download,
  ExternalLink,
  FileText,
  Play,
  Plus,
  Power,
  RefreshCw,
  RotateCcw,
  ShieldAlert,
  SlidersHorizontal,
  Square,
  Trash2,
} from 'lucide-react'
import { toast } from 'sonner'
import { useContributionStore } from '../extensions/contributions.ts'
import { extensionDiagnostics, type ExtensionLogEntry } from '../extensions/diagnostics.ts'
import { extensionManager } from '../extensions/manager.ts'
import { useExtensionStore, type ExtensionRecord } from '../extensions/store.ts'

export interface ExtensionsPageProps {
  onOpenCommunityHub: () => void
  onNavigate: (path: string) => void
}

function statusLabel(status: string | undefined, enabled: boolean): string {
  if (status === 'active') return 'Active'
  if (status === 'loading') return 'Loading'
  if (status === 'failed') return 'Failed'
  if (status === 'safe-mode') return 'Safe Mode'
  return enabled ? 'Idle' : 'Disabled'
}

function safeOrigin(url: string): string {
  try {
    return new URL(url).origin
  } catch {
    return url
  }
}

export function ExtensionsPage({ onOpenCommunityHub, onNavigate }: ExtensionsPageProps) {
  const records = useExtensionStore(s => s.records)
  const runtimeById = useExtensionStore(s => s.runtime)
  const settingsById = useExtensionStore(s => s.settings)
  const setSetting = useExtensionStore(s => s.setSetting)
  const clearSettings = useExtensionStore(s => s.clearSettings)
  const safeMode = useExtensionStore(s => s.safeMode)
  const views = useContributionStore(s => s.views)

  const [manifestUrl, setManifestUrl] = useState('')
  const [installing, setInstalling] = useState(false)
  const [installError, setInstallError] = useState<string | null>(null)
  const [busyById, setBusyById] = useState<Record<string, boolean>>({})
  const [openLogsId, setOpenLogsId] = useState<string | null>(null)
  const [openSettingsId, setOpenSettingsId] = useState<string | null>(null)
  const [logsVersion, setLogsVersion] = useState(0)
  const [copiedId, setCopiedId] = useState<string | null>(null)

  useEffect(() => {
    return extensionDiagnostics.subscribe(() => setLogsVersion(v => v + 1))
  }, [])

  function setBusy(id: string, busy: boolean) {
    setBusyById(prev => ({ ...prev, [id]: busy }))
  }

  async function handleInstall(e: React.FormEvent) {
    e.preventDefault()
    const trimmed = manifestUrl.trim()
    if (!trimmed) return
    setInstalling(true)
    setInstallError(null)
    try {
      const rec = await extensionManager.installFromUrl(trimmed, {
        enableImmediately: !safeMode,
      })
      setManifestUrl('')
      toast.success(
        safeMode
          ? `Installed ${rec.manifest.name} (paused while in Safe Mode)`
          : `Installed ${rec.manifest.name} v${rec.manifest.version}`,
      )
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Failed to install extension.'
      setInstallError(msg)
    } finally {
      setInstalling(false)
    }
  }

  async function handleToggle(rec: ExtensionRecord) {
    setBusy(rec.id, true)
    try {
      if (rec.enabled) {
        await extensionManager.disable(rec.id)
        toast(`Disabled ${rec.manifest.name}`)
      } else {
        await extensionManager.enable(rec.id)
        toast.success(`Enabled ${rec.manifest.name}`)
      }
    } catch (err) {
      toast.error(err instanceof Error ? err.message : `Failed to update ${rec.manifest.name}`)
    } finally {
      setBusy(rec.id, false)
    }
  }

  async function handleReload(rec: ExtensionRecord) {
    setBusy(rec.id, true)
    try {
      await extensionManager.reload(rec.id)
      toast.success(`Reloaded ${rec.manifest.name}`)
    } catch (err) {
      toast.error(err instanceof Error ? err.message : `Failed to reload ${rec.manifest.name}`)
    } finally {
      setBusy(rec.id, false)
    }
  }

  async function handleUpdate(rec: ExtensionRecord) {
    setBusy(rec.id, true)
    try {
      const updated = await extensionManager.update(rec.id)
      toast.success(`Updated ${updated.manifest.name} to v${updated.manifest.version}`)
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Update failed'
      toast.error(`Update rejected (${rec.manifest.name} kept running): ${msg}`)
    } finally {
      setBusy(rec.id, false)
    }
  }

  async function handleUninstall(rec: ExtensionRecord) {
    setBusy(rec.id, true)
    try {
      await extensionManager.uninstall(rec.id)
      toast(`Uninstalled ${rec.manifest.name}. Your saved documents were preserved.`)
    } catch (err) {
      toast.error(err instanceof Error ? err.message : `Failed to uninstall ${rec.manifest.name}`)
    } finally {
      setBusy(rec.id, false)
    }
  }

  async function handleCopyReport(extId: string) {
    try {
      const report = extensionDiagnostics.buildBugReport({ extensionId: extId, safeMode })
      await navigator.clipboard.writeText(JSON.stringify(report, null, 2))
      setCopiedId(extId)
      window.setTimeout(() => setCopiedId(prev => (prev === extId ? null : prev)), 1800)
    } catch {
      toast.error('Clipboard is unavailable in this browser context.')
    }
  }

  function handleExitSafeMode() {
    const url = new URL(window.location.href)
    url.searchParams.delete('safeMode')
    if (url.hash.includes('safeMode=')) {
      const [hashPath, hashQuery] = url.hash.split('?')
      const params = new URLSearchParams(hashQuery ?? '')
      params.delete('safeMode')
      const qs = params.toString()
      url.hash = qs ? `${hashPath}?${qs}` : hashPath || '#/extensions'
    }
    window.history.replaceState(null, '', url.toString())
    window.location.reload()
  }

  // Subscribe logs render cleanly to logsVersion updates
  const openLogs: ExtensionLogEntry[] =
    openLogsId && logsVersion >= 0 ? extensionDiagnostics.getLogs(openLogsId) : []

  return (
    <main className="sx-workspace-page sx-plugins-page" aria-label="Extensions">
      <header className="sx-plugins-header">
        <div className="sx-plugins-title-row">
          <div className="sx-workspace-head">
            <h1>Extensions</h1>
            <span className="sx-hub-count">
              Standalone and embedded Syntax extensions
            </span>
          </div>
          <div className="sx-plugins-cta-group">
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
      </header>

      {safeMode && (
        <section className="sx-ext-safemode-banner" role="alert">
          <div className="sx-ext-safemode-copy">
            <ShieldAlert size={18} aria-hidden="true" />
            <div>
              <strong>Safe Mode is active</strong>
              <p>
                No extensions were started on load. Disable or uninstall any misbehaving extension
                below, then exit Safe Mode.
              </p>
            </div>
          </div>
          <button type="button" className="sx-btn-primary sx-btn-sm" onClick={handleExitSafeMode}>
            Exit Safe Mode
          </button>
        </section>
      )}

      <section className="sx-plugins-section" aria-label="Install extension from URL">
        <div className="sx-plugins-section-head">
          <h2>Install from URL</h2>
        </div>
        <form className="sx-ext-install-form" onSubmit={e => void handleInstall(e)}>
          <input
            type="url"
            className="sx-ext-url-input"
            placeholder="https://example.com/my-extension/extension.json"
            aria-label="Extension manifest URL"
            value={manifestUrl}
            onChange={e => setManifestUrl(e.target.value)}
            disabled={installing}
            required
          />
          <button type="submit" className="sx-btn-primary" disabled={installing || !manifestUrl.trim()}>
            <Plus size={15} strokeWidth={2.2} aria-hidden="true" />
            <span>{installing ? 'Installing...' : 'Install'}</span>
          </button>
        </form>
        {installError && (
          <div className="sx-ext-inline-error" role="alert">
            <AlertTriangle size={15} aria-hidden="true" />
            <span>{installError}</span>
          </div>
        )}
      </section>

      <section className="sx-plugins-section" aria-label="Installed extensions">
        <div className="sx-plugins-section-head">
          <h2>Installed Extensions</h2>
          <span data-testid="installed-extensions-count">{records.length}</span>
        </div>

        {records.length === 0 ? (
          <div className="sx-hub-empty">
            <p>No extensions installed yet.</p>
            <p className="sx-profile-handle">
              Paste any extension&apos;s <code>extension.json</code> URL above, or browse{' '}
              <button type="button" className="sx-link-btn" onClick={onOpenCommunityHub}>
                Community Hub
              </button>
              .
            </p>
          </div>
        ) : (
          <div className="sx-ext-list">
            {records.map(rec => {
              const rt = runtimeById[rec.id]
              const status = rt?.status ?? (rec.enabled ? 'loading' : 'disabled')
              const busy = Boolean(busyById[rec.id])
              const extViews = views.filter(v => v.ownerId === rec.id)
              const optionalIssues = Object.entries(rt?.unavailableOptionalServices ?? {})
              const isLogsOpen = openLogsId === rec.id
              const isSettingsOpen = openSettingsId === rec.id
              const declaredSettings = rec.manifest.settings
              const savedSettings = settingsById[rec.id] ?? {}

              return (
                <article
                  key={rec.id}
                  className={`sx-ext-card is-${status}`}
                  data-extension-id={rec.id}
                  data-extension-status={status}
                >
                  <div className="sx-ext-card-top">
                    <div className="sx-ext-card-id">
                      <div className="sx-ext-card-title-row">
                        <h3>{rec.manifest.name}</h3>
                        <span className={`sx-ext-status-badge is-${status}`}>
                          {statusLabel(rt?.status, rec.enabled)}
                        </span>
                        <span className="sx-ext-version-tag">v{rec.manifest.version}</span>
                      </div>
                      <p className="sx-ext-meta-line">
                        <code>{rec.id}</code>
                        {' · '}
                        <span>{safeOrigin(rec.manifestUrl)}</span>
                        {rec.manifest.author ? ` · ${rec.manifest.author}` : ''}
                      </p>
                      {rec.manifest.description && (
                        <p className="sx-ext-description">{rec.manifest.description}</p>
                      )}
                    </div>

                    <div className="sx-ext-card-actions">
                      {extViews
                        .filter(v => v.placement !== 'embed')
                        .map(v => (
                          <button
                            key={v.key}
                            type="button"
                            className="sx-btn-primary sx-btn-sm"
                            onClick={() =>
                              onNavigate(
                                `/ext/${encodeURIComponent(rec.id)}/${encodeURIComponent(v.id)}`,
                              )
                            }
                          >
                            <ExternalLink size={13} aria-hidden="true" />
                            <span>Open {v.title}</span>
                          </button>
                        ))}

                      {rt?.hasLiveWorker && (
                        <button
                          type="button"
                          className="sx-btn-ghost sx-btn-sm"
                          onClick={() => {
                            extensionManager.stopWorker(rec.id)
                            toast.warning(`Stopped ${rec.manifest.name} worker`)
                          }}
                        >
                          <Square size={13} aria-hidden="true" />
                          <span>Stop worker</span>
                        </button>
                      )}

                      {!safeMode && (
                        <button
                          type="button"
                          className="sx-btn-secondary sx-btn-sm"
                          disabled={busy}
                          onClick={() => void handleToggle(rec)}
                        >
                          {rec.enabled ? (
                            <Power size={13} aria-hidden="true" />
                          ) : (
                            <Play size={13} aria-hidden="true" />
                          )}
                          <span>{rec.enabled ? 'Disable' : 'Enable'}</span>
                        </button>
                      )}

                      {rec.enabled && !safeMode && (
                        <button
                          type="button"
                          className="sx-btn-ghost sx-btn-sm"
                          disabled={busy}
                          onClick={() => void handleReload(rec)}
                        >
                          <RefreshCw size={13} aria-hidden="true" />
                          <span>Reload</span>
                        </button>
                      )}

                      <button
                        type="button"
                        className="sx-btn-ghost sx-btn-sm"
                        disabled={busy}
                        onClick={() => void handleUpdate(rec)}
                      >
                        <Download size={13} aria-hidden="true" />
                        <span>Update</span>
                      </button>

                      {declaredSettings.length > 0 && (
                        <button
                          type="button"
                          className="sx-btn-ghost sx-btn-sm"
                          onClick={() => setOpenSettingsId(isSettingsOpen ? null : rec.id)}
                        >
                          <SlidersHorizontal size={13} aria-hidden="true" />
                          <span>{isSettingsOpen ? 'Hide settings' : 'Settings'}</span>
                        </button>
                      )}

                      <button
                        type="button"
                        className="sx-btn-ghost sx-btn-sm"
                        onClick={() => setOpenLogsId(isLogsOpen ? null : rec.id)}
                      >
                        <FileText size={13} aria-hidden="true" />
                        <span>{isLogsOpen ? 'Hide logs' : 'Logs'}</span>
                      </button>

                      <button
                        type="button"
                        className="sx-btn-danger-ghost sx-btn-sm"
                        disabled={busy}
                        title="Uninstall extension (your documents are kept)"
                        onClick={() => void handleUninstall(rec)}
                      >
                        <Trash2 size={13} aria-hidden="true" />
                        <span>Uninstall</span>
                      </button>
                    </div>
                  </div>

                  {rt?.lastError && (
                    <div className="sx-ext-inline-error" role="alert">
                      <AlertTriangle size={14} aria-hidden="true" />
                      <span>
                        <strong>{rt.lastError.code}</strong>: {rt.lastError.message}
                      </span>
                    </div>
                  )}

                  {optionalIssues.length > 0 && (
                    <div className="sx-ext-inline-note">
                      {optionalIssues.map(([svc, reason]) => (
                        <p key={svc}>
                          Optional integration unavailable (<code>{svc}</code>): {reason}
                        </p>
                      ))}
                    </div>
                  )}

                  {isSettingsOpen && declaredSettings.length > 0 && (
                    <div
                      className="sx-ext-settings-panel"
                      data-extension-settings-panel={rec.id}
                    >
                      <div className="sx-ext-logs-head">
                        <strong>Extension Settings</strong>
                        <button
                          type="button"
                          className="sx-btn-ghost sx-btn-sm"
                          onClick={() => {
                            clearSettings(rec.id)
                            toast(`Reset ${rec.manifest.name} settings to defaults`)
                          }}
                        >
                          <RotateCcw size={13} aria-hidden="true" />
                          <span>Reset defaults</span>
                        </button>
                      </div>
                      <div className="sx-ext-settings-list">
                        {declaredSettings.map(def => {
                          const rawSaved = savedSettings[def.id]
                          const currentVal =
                            rawSaved !== undefined &&
                            typeof rawSaved === def.type &&
                            (def.type !== 'number' || Number.isFinite(rawSaved))
                              ? rawSaved
                              : def.default
                          const inputId = `ext-setting-${rec.id}-${def.id}`
                          return (
                            <label key={def.id} htmlFor={inputId} className="sx-ext-setting-row">
                              <span className="sx-ext-setting-copy">
                                <span>{def.label}</span>
                                <small>{def.id}</small>
                              </span>
                              {def.type === 'boolean' ? (
                                <input
                                  id={inputId}
                                  type="checkbox"
                                  className="sx-ext-setting-checkbox"
                                  data-setting-id={def.id}
                                  checked={Boolean(currentVal)}
                                  onChange={e => setSetting(rec.id, def.id, e.target.checked)}
                                />
                              ) : def.type === 'number' ? (
                                <input
                                  id={inputId}
                                  type="number"
                                  className="sx-ext-setting-input"
                                  data-setting-id={def.id}
                                  value={String(currentVal)}
                                  onChange={e => {
                                    const num = Number(e.target.value)
                                    if (e.target.value.trim() !== '' && Number.isFinite(num)) {
                                      setSetting(rec.id, def.id, num)
                                    }
                                  }}
                                />
                              ) : (
                                <input
                                  id={inputId}
                                  type="text"
                                  className="sx-ext-setting-input"
                                  data-setting-id={def.id}
                                  value={String(currentVal)}
                                  onChange={e => setSetting(rec.id, def.id, e.target.value)}
                                />
                              )}
                            </label>
                          )
                        })}
                      </div>
                    </div>
                  )}

                  {isLogsOpen && (
                    <div className="sx-ext-logs-panel">
                      <div className="sx-ext-logs-head">
                        <strong>Diagnostics ({openLogs.length})</strong>
                        <button
                          type="button"
                          className="sx-btn-ghost sx-btn-sm"
                          onClick={() => void handleCopyReport(rec.id)}
                        >
                          {copiedId === rec.id ? (
                            <Check size={13} aria-hidden="true" />
                          ) : (
                            <Copy size={13} aria-hidden="true" />
                          )}
                          <span>{copiedId === rec.id ? 'Copied' : 'Copy bug report'}</span>
                        </button>
                      </div>
                      {openLogs.length === 0 ? (
                        <p className="sx-ext-logs-empty">No log entries recorded yet.</p>
                      ) : (
                        <ul className="sx-ext-logs-list">
                          {openLogs.map((entry, idx) => (
                            <li key={`${entry.ts}-${idx}`} className={`is-${entry.level}`}>
                              <span className="sx-ext-log-meta">
                                [{entry.source}/{entry.level}]
                              </span>{' '}
                              <span>{entry.message}</span>
                            </li>
                          ))}
                        </ul>
                      )}
                    </div>
                  )}
                </article>
              )
            })}
          </div>
        )}
      </section>
    </main>
  )
}
