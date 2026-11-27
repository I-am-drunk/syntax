import { useCallback, useEffect, useRef, useState } from 'react'
import { AlertTriangle, Check, Download, ExternalLink, Puzzle, RefreshCw } from 'lucide-react'
import { toast } from 'sonner'
import {
  COMMUNITY_HUB_WEB_URL,
  OFFICIAL_EXTENSIONS_REPO_URL,
  fetchExtensionCatalog,
  type CatalogEntry,
  type CatalogState,
} from '../extensions/catalog.ts'
import { extensionManager } from '../extensions/manager.ts'
import { useExtensionStore } from '../extensions/store.ts'

export interface CommunityHubPageProps {
  onOpenExtensions: () => void
}

export function CommunityHubPage({ onOpenExtensions }: CommunityHubPageProps) {
  const records = useExtensionStore(s => s.records)
  const safeMode = useExtensionStore(s => s.safeMode)
  const [catalog, setCatalog] = useState<CatalogState>({
    status: 'loading',
    entries: [],
    updatedAt: null,
    error: null,
  })
  const [installingId, setInstallingId] = useState<string | null>(null)
  const abortRef = useRef<AbortController | null>(null)

  const loadCatalog = useCallback(() => {
    abortRef.current?.abort()
    const controller = new AbortController()
    abortRef.current = controller
    setCatalog({ status: 'loading', entries: [], updatedAt: null, error: null })
    void fetchExtensionCatalog(undefined, controller.signal).then(state => {
      if (!controller.signal.aborted) setCatalog(state)
    })
  }, [])

  useEffect(() => {
    loadCatalog()
    return () => {
      abortRef.current?.abort()
    }
  }, [loadCatalog])

  async function handleInstall(entry: CatalogEntry) {
    setInstallingId(entry.id)
    try {
      const rec = await extensionManager.installFromUrl(entry.manifestUrl, {
        enableImmediately: !safeMode,
      })
      toast.success(`Installed ${rec.manifest.name} v${rec.manifest.version}`)
    } catch (err) {
      toast.error(err instanceof Error ? err.message : `Failed to install ${entry.name}`)
    } finally {
      setInstallingId(null)
    }
  }

  const installedIds = new Set(records.map(r => r.id))

  return (
    <main className="sx-hub-page" aria-label="Community Hub">
      <header className="sx-hub-head">
        <div className="sx-workspace-head">
          <h1>Community Hub</h1>
          <span className="sx-hub-count">
            {catalog.status === 'ready'
              ? `${catalog.entries.length} ${catalog.entries.length === 1 ? 'extension' : 'extensions'}`
              : 'Extension catalog'}
          </span>
        </div>

        <div className="sx-hub-head-actions">
          <button
            type="button"
            className="sx-btn-ghost sx-btn-sm"
            onClick={() => loadCatalog()}
            disabled={catalog.status === 'loading'}
          >
            <RefreshCw
              size={14}
              className={catalog.status === 'loading' ? 'sx-spin' : undefined}
              aria-hidden="true"
            />
            <span>Refresh</span>
          </button>
          <button type="button" className="sx-btn-secondary" onClick={onOpenExtensions}>
            <Puzzle size={14} aria-hidden="true" />
            <span>Extensions</span>
          </button>
          <a
            href={COMMUNITY_HUB_WEB_URL}
            target="_blank"
            rel="noreferrer"
            className="sx-btn-secondary"
          >
            <span>Web Hub</span>
            <ExternalLink size={13} aria-hidden="true" />
          </a>
        </div>
      </header>

      {catalog.status === 'loading' && (
        <div className="sx-hub-empty">
          <p>Loading extension catalog...</p>
        </div>
      )}

      {catalog.status === 'error' && (
        <div className="sx-hub-empty" role="alert">
          <p className="sx-inline-icon-label">
            <AlertTriangle size={16} aria-hidden="true" />
            <span>Could not load the community catalog.</span>
          </p>
          <p className="sx-profile-handle">{catalog.error}</p>
          <div className="sx-library-empty-actions">
            <button type="button" className="sx-btn-primary" onClick={() => loadCatalog()}>
              Retry
            </button>
            <button type="button" className="sx-btn-secondary" onClick={onOpenExtensions}>
              Install from URL
            </button>
          </div>
        </div>
      )}

      {catalog.status === 'ready' && catalog.entries.length === 0 && (
        <div className="sx-hub-empty">
          <p>No published extensions in the community catalog yet.</p>
          <p className="sx-profile-handle">
            You can install any extension directly by URL from the Extensions page.
          </p>
          <div className="sx-library-empty-actions">
            <button type="button" className="sx-btn-primary" onClick={onOpenExtensions}>
              <Puzzle size={14} aria-hidden="true" />
              <span>Install from URL</span>
            </button>
            <a
              href={OFFICIAL_EXTENSIONS_REPO_URL}
              target="_blank"
              rel="noreferrer"
              className="sx-btn-secondary"
            >
              <span>Official Extensions Repo</span>
              <ExternalLink size={13} aria-hidden="true" />
            </a>
          </div>
        </div>
      )}

      {catalog.status === 'ready' && catalog.entries.length > 0 && (
        <div className="sx-ext-list">
          {catalog.entries.map(entry => {
            const installed = installedIds.has(entry.id)
            const busy = installingId === entry.id
            return (
              <article key={entry.id} className="sx-ext-card">
                <div className="sx-ext-card-top">
                  <div className="sx-ext-card-id">
                    <div className="sx-ext-card-title-row">
                      <h3>{entry.name}</h3>
                      {entry.kind === 'course' && (
                        <span className="sx-ext-status-badge">Course</span>
                      )}
                      <span className="sx-ext-version-tag">v{entry.version}</span>
                    </div>
                    <p className="sx-ext-meta-line">
                      <code>{entry.id}</code>
                      {entry.author ? ` · ${entry.author}` : ''}
                    </p>
                    {entry.description && <p className="sx-ext-description">{entry.description}</p>}
                  </div>
                  <div className="sx-ext-card-actions">
                    <button
                      type="button"
                      className={installed ? 'sx-btn-secondary sx-btn-sm' : 'sx-btn-primary sx-btn-sm'}
                      disabled={busy}
                      onClick={() => void handleInstall(entry)}
                    >
                      {installed ? <Check size={13} aria-hidden="true" /> : <Download size={13} aria-hidden="true" />}
                      <span>{busy ? 'Installing...' : installed ? 'Reinstall' : 'Install'}</span>
                    </button>
                  </div>
                </div>
              </article>
            )
          })}
        </div>
      )}
    </main>
  )
}
