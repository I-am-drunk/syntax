import { useEffect, useState } from 'react'
import {
  AlertTriangle,
  Check,
  Compass,
  Copy,
  Download,
  ExternalLink,
  FileText,
  Link2,
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
import {
  fetchExtensionManifest,
  resolveExtensionAssets,
  type ExtensionManifest,
  type ResolvedExtensionAssets,
} from '../extensions/manifest.ts'
import { useExtensionStore, type ExtensionRecord } from '../extensions/store.ts'
import { Segmented } from './Controls'
import { ExtensionIcon } from './ExtensionIcon'
import { ExtensionInstallModal } from './ExtensionInstallModal'

export interface ExtensionsPageProps {
  onOpenCommunityHub: () => void
  onNavigate: (path: string) => void
}

type ExtensionsViewMode = 'extensions' | 'courses'

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

  const [viewMode, setViewMode] = useState<ExtensionsViewMode>('extensions')
  const [manifestUrl, setManifestUrl] = useState('')
  const [fetchingManifest, setFetchingManifest] = useState(false)
  const [pendingInstall, setPendingInstall] = useState<{
    manifest: ExtensionManifest
    assets: ResolvedExtensionAssets
  } | null>(null)
  const [installing, setInstalling] = useState(false)
  const [installError, setInstallError] = useState<string | null>(null)
  const [modalError, setModalError] = useState<string | null>(null)
  const [confirmUninstallId, setConfirmUninstallId] = useState<string | null>(null)
  const [busyById, setBusyById] = useState<Record<string, boolean>>({})
  const [openLogsId, setOpenLogsId] = useState<string | null>(null)
  const [openSettingsId, setOpenSettingsId] = useState<string | null>(null)
  const [updatingAll, setUpdatingAll] = useState(false)
  const [logsVersion, setLogsVersion] = useState(0)
  const [copiedId, setCopiedId] = useState<string | null>(null)

  const extensionRecords = records.filter(r => r.manifest.kind !== 'course')
  const courseRecords = records.filter(r => r.manifest.kind === 'course')
  const visibleRecords = viewMode === 'courses' ? courseRecords : extensionRecords

  useEffect(() => {
    return extensionDiagnostics.subscribe(() => setLogsVersion(v => v + 1))
  }, [])

  // Support shareable 1-click install review links: #/extensions?install=https://.../extension.json
  useEffect(() => {
    const checkInstallParam = () => {
      let rawInstall: string | null = null
      try {
        const hash = window.location.hash || ''
        const qIdx = hash.indexOf('?')
        if (qIdx >= 0) {
          rawInstall = new URLSearchParams(hash.slice(qIdx + 1)).get('install')
        }
        if (!rawInstall && window.location.search) {
          rawInstall = new URLSearchParams(window.location.search).get('install')
        }
      } catch {
        return
      }
      const candidate = rawInstall?.trim()
      if (!candidate || (!candidate.startsWith('https://') && !candidate.startsWith('http://'))) {
        return
      }
      // Strip install param immediately so refresh never re-prompts
      try {
        const url = new URL(window.location.href)
        url.searchParams.delete('install')
        const [hashPath, hashQuery] = (url.hash || '#/extensions').split('?')
        if (hashQuery) {
          const params = new URLSearchParams(hashQuery)
          params.delete('install')
          const qs = params.toString()
          url.hash = qs ? `${hashPath}?${qs}` : hashPath
        }
        window.history.replaceState(null, '', url.toString())
      } catch {
        // ignore URL cleanup error
      }
      setManifestUrl(candidate)
      setFetchingManifest(true)
      setInstallError(null)
      setModalError(null)
      void fetchExtensionManifest(candidate)
        .then(inspected => {
          setPendingInstall(inspected)
        })
        .catch(err => {
          setInstallError(
            err instanceof Error ? err.message : 'Failed to read extension manifest from link.',
          )
        })
        .finally(() => {
          setFetchingManifest(false)
        })
    }

    checkInstallParam()
    window.addEventListener('hashchange', checkInstallParam)
    return () => window.removeEventListener('hashchange', checkInstallParam)
  }, [])

  async function handleCopyShareLink(rec: ExtensionRecord) {
    try {
      const base = `${window.location.origin}${window.location.pathname}`
      const link = `${base}#/extensions?install=${encodeURIComponent(rec.manifestUrl)}`
      await navigator.clipboard.writeText(link)
      toast.success(`Copied install link for ${rec.manifest.name}`)
    } catch {
      toast.error('Clipboard is unavailable in this browser context.')
    }
  }

  function setBusy(id: string, busy: boolean) {
    setBusyById(prev => ({ ...prev, [id]: busy }))
  }

  async function handleInspectInstall(e: React.FormEvent) {
    e.preventDefault()
    const trimmed = manifestUrl.trim()
    if (!trimmed) return
    setFetchingManifest(true)
    setInstallError(null)
    setModalError(null)
    try {
      const inspected = await fetchExtensionManifest(trimmed)
      setPendingInstall(inspected)
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Failed to read extension manifest.'
      setInstallError(msg)
    } finally {
      setFetchingManifest(false)
    }
  }

  async function handleConfirmInstall() {
    if (!pendingInstall) return
    setInstalling(true)
    setModalError(null)
    try {
      const rec = await extensionManager.installFromManifest(
        pendingInstall.manifest,
        pendingInstall.assets,
        { enableImmediately: !safeMode },
      )
      setPendingInstall(null)
      setManifestUrl('')
      setViewMode(rec.manifest.kind === 'course' ? 'courses' : 'extensions')
      toast.success(
        safeMode
          ? `Installed ${rec.manifest.name} (paused while in Safe Mode)`
          : `Installed ${rec.manifest.name} v${rec.manifest.version}`,
      )
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Failed to install extension.'
      setModalError(msg)
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

  async function handleUpdateAll() {
    if (visibleRecords.length === 0) return
    setUpdatingAll(true)
    let updatedCount = 0
    let failedCount = 0
    try {
      for (const rec of visibleRecords) {
        setBusy(rec.id, true)
        try {
          await extensionManager.update(rec.id)
          updatedCount += 1
        } catch {
          failedCount += 1
        } finally {
          setBusy(rec.id, false)
        }
      }
      if (failedCount === 0) {
        toast.success(`Checked and updated ${updatedCount} ${updatedCount === 1 ? 'package' : 'packages'}`)
      } else {
        toast.warning(`Updated ${updatedCount}, kept ${failedCount} on previous working version`)
      }
    } finally {
      setUpdatingAll(false)
    }
  }

  async function handleUninstall(rec: ExtensionRecord) {
    setBusy(rec.id, true)
    try {
      await extensionManager.uninstall(rec.id)
      setConfirmUninstallId(prev => (prev === rec.id ? null : prev))
      toast(`Uninstalled ${rec.manifest.name}. Your saved documents were preserved.`)
    } catch (err) {
      toast.error(err instanceof Error ? err.message : `Failed to uninstall ${rec.manifest.name}`)
    } finally {
      setBusy(rec.id, false)
    }
  }

  async function handleCopyReport(extId?: string) {
    try {
      const report = extensionDiagnostics.buildBugReport({ extensionId: extId, safeMode })
      await navigator.clipboard.writeText(JSON.stringify(report, null, 2))
      const tag = extId ?? '__all__'
      setCopiedId(tag)
      window.setTimeout(() => setCopiedId(prev => (prev === tag ? null : prev)), 1800)
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

  // Subscribe logs and live counters cleanly to logsVersion updates
  const openLogs: ExtensionLogEntry[] =
    openLogsId && logsVersion >= 0 ? extensionDiagnostics.getLogs(openLogsId) : []
  const liveCounters = logsVersion >= 0 ? extensionDiagnostics.getResourceCounters() : extensionDiagnostics.getResourceCounters()

  return (
    <main className="sx-workspace-page sx-plugins-page" aria-label="Extensions">
      <header className="sx-plugins-header">
        <div className="sx-plugins-title-row">
          <div className="sx-workspace-head">
            <h1>{viewMode === 'courses' ? 'Courses' : 'Extensions'}</h1>
            <span className="sx-hub-count">
              {viewMode === 'courses'
                ? 'Installable interactive courses'
                : 'Standalone and embedded Syntax extensions'}
            </span>
          </div>
          <div className="sx-plugins-cta-group">
            <div className="sx-ext-mode-toggle" data-testid="extensions-mode-toggle">
              <Segmented
                label="Show extensions or courses"
                value={viewMode}
                onChange={setViewMode}
                options={[
                  { value: 'extensions', label: `Extensions (${extensionRecords.length})` },
                  { value: 'courses', label: `Courses (${courseRecords.length})` },
                ]}
              />
            </div>
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
        <form className="sx-ext-install-form" onSubmit={e => void handleInspectInstall(e)}>
          <input
            type="url"
            className="sx-ext-url-input"
            placeholder="https://example.com/my-extension/extension.json"
            aria-label="Extension manifest URL"
            value={manifestUrl}
            onChange={e => setManifestUrl(e.target.value)}
            disabled={fetchingManifest || installing}
            required
          />
          <button
            type="submit"
            className="sx-btn-primary"
            disabled={fetchingManifest || installing || !manifestUrl.trim()}
          >
            <Plus size={15} strokeWidth={2.2} aria-hidden="true" />
            <span>{fetchingManifest ? 'Checking...' : 'Install'}</span>
          </button>
        </form>
        {installError && (
          <div className="sx-ext-inline-error" role="alert">
            <AlertTriangle size={15} aria-hidden="true" />
            <span>{installError}</span>
          </div>
        )}
      </section>

      <section
        className="sx-plugins-section"
        aria-label={viewMode === 'courses' ? 'Installed courses' : 'Installed extensions'}
      >
        <div className="sx-plugins-section-head">
          <h2>{viewMode === 'courses' ? 'Installed Courses' : 'Installed Extensions'}</h2>
          <div className="sx-ext-section-head-actions">
            {visibleRecords.length > 1 && (
              <button
                type="button"
                className="sx-btn-ghost sx-btn-sm"
                disabled={updatingAll}
                onClick={() => void handleUpdateAll()}
              >
                <Download size={13} aria-hidden="true" />
                <span>{updatingAll ? 'Updating...' : 'Update all'}</span>
              </button>
            )}
            <span data-testid="installed-extensions-count">{visibleRecords.length}</span>
          </div>
        </div>

        {visibleRecords.length === 0 ? (
          <div className="sx-hub-empty">
            <p>
              {viewMode === 'courses'
                ? 'No courses installed yet.'
                : 'No extensions installed yet.'}
            </p>
            <p className="sx-profile-handle">
              {viewMode === 'courses' ? (
                <>
                  Install a course by pasting its <code>extension.json</code> URL above, or browse{' '}
                  <button type="button" className="sx-link-btn" onClick={onOpenCommunityHub}>
                    Community Hub
                  </button>
                  .
                </>
              ) : (
                <>
                  Paste any extension&apos;s <code>extension.json</code> URL above, or browse{' '}
                  <button type="button" className="sx-link-btn" onClick={onOpenCommunityHub}>
                    Community Hub
                  </button>
                  .
                </>
              )}
            </p>
          </div>
        ) : (
          <div className="sx-ext-list">
            {visibleRecords.map(rec => {
              const rt = runtimeById[rec.id]
              const status = rt?.status ?? (rec.enabled ? 'loading' : 'disabled')
              const busy = Boolean(busyById[rec.id])
              const extViews = views.filter(v => v.ownerId === rec.id)
              const optionalIssues = Object.entries(rt?.unavailableOptionalServices ?? {})
              const isLogsOpen = openLogsId === rec.id
              const isSettingsOpen = openSettingsId === rec.id
              const declaredSettings = rec.manifest.settings
              const savedSettings = settingsById[rec.id] ?? {}
              const isConfirmingUninstall = confirmUninstallId === rec.id
              let iconUrl: string | null = null
              try {
                iconUrl = resolveExtensionAssets(rec.manifestUrl, rec.manifest).iconUrl
              } catch {
                iconUrl = null
              }

              return (
                <article
                  key={rec.id}
                  className={`sx-ext-card is-${status}`}
                  data-extension-id={rec.id}
                  data-extension-status={status}
                >
                  <div className="sx-ext-card-top">
                    <div className="sx-ext-card-id sx-ext-card-id-with-icon">
                      <ExtensionIcon
                        src={iconUrl}
                        name={rec.manifest.name}
                        kind={rec.manifest.kind}
                        size={38}
                      />
                      <div className="sx-ext-card-id-copy">
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
                        title="Copy shareable install link"
                        onClick={() => void handleCopyShareLink(rec)}
                      >
                        <Link2 size={13} aria-hidden="true" />
                        <span>Share</span>
                      </button>

                      <button
                        type="button"
                        className="sx-btn-ghost sx-btn-sm"
                        onClick={() => setOpenLogsId(isLogsOpen ? null : rec.id)}
                      >
                        <FileText size={13} aria-hidden="true" />
                        <span>{isLogsOpen ? 'Hide logs' : 'Logs'}</span>
                      </button>

                      {isConfirmingUninstall ? (
                        <span className="sx-ext-confirm-group">
                          <button
                            type="button"
                            className="sx-btn-danger-ghost sx-btn-sm is-confirming"
                            disabled={busy}
                            onClick={() => void handleUninstall(rec)}
                          >
                            <Trash2 size={13} aria-hidden="true" />
                            <span>Confirm uninstall</span>
                          </button>
                          <button
                            type="button"
                            className="sx-btn-ghost sx-btn-sm"
                            disabled={busy}
                            onClick={() => setConfirmUninstallId(null)}
                          >
                            Cancel
                          </button>
                        </span>
                      ) : (
                        <button
                          type="button"
                          className="sx-btn-danger-ghost sx-btn-sm"
                          disabled={busy}
                          title="Uninstall extension (your documents are kept)"
                          onClick={() => setConfirmUninstallId(rec.id)}
                        >
                          <Trash2 size={13} aria-hidden="true" />
                          <span>Uninstall</span>
                        </button>
                      )}
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
                        <div className="sx-ext-section-head-actions">
                          {openLogs.length > 0 && (
                            <button
                              type="button"
                              className="sx-btn-ghost sx-btn-sm"
                              onClick={() => extensionDiagnostics.clear(rec.id)}
                            >
                              <span>Clear</span>
                            </button>
                          )}
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

      <footer className="sx-ext-runtime-footer" aria-label="Extension runtime diagnostics">
        <span className="sx-ext-runtime-stats">
          {liveCounters.workers} {liveCounters.workers === 1 ? 'worker' : 'workers'}
          {' · '}
          {liveCounters.views} {liveCounters.views === 1 ? 'view' : 'views'}
          {' · '}
          {liveCounters.commands} {liveCounters.commands === 1 ? 'command' : 'commands'}
          {' · '}
          {liveCounters.services} {liveCounters.services === 1 ? 'service' : 'services'}
          {' · '}
          {liveCounters.blobUrls} active blobs
        </span>
        <button
          type="button"
          className="sx-btn-ghost sx-btn-sm"
          onClick={() => void handleCopyReport()}
        >
          {copiedId === '__all__' ? <Check size={13} aria-hidden="true" /> : <Copy size={13} aria-hidden="true" />}
          <span>{copiedId === '__all__' ? 'Copied' : 'Copy runtime report'}</span>
        </button>
      </footer>

      <ExtensionInstallModal
        open={Boolean(pendingInstall)}
        manifest={pendingInstall?.manifest ?? null}
        assets={pendingInstall?.assets ?? null}
        existingRecord={
          pendingInstall ? records.find(r => r.id === pendingInstall.manifest.id) ?? null : null
        }
        safeMode={safeMode}
        installing={installing}
        error={modalError}
        onCancel={() => {
          setPendingInstall(null)
          setModalError(null)
        }}
        onConfirm={() => void handleConfirmInstall()}
      />
    </main>
  )
}
