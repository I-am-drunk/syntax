import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { AlertTriangle, Check, Compass, Download, ExternalLink, Puzzle, RefreshCw, Search, ShieldAlert, X } from 'lucide-react'
import { toast } from 'sonner'
import {
  COMMUNITY_HUB_WEB_URL,
  OFFICIAL_EXTENSIONS_REPO_URL,
  fetchExtensionCatalog,
  type CatalogEntry,
  type CatalogState,
} from '../extensions/catalog.ts'
import { useContributionStore } from '../extensions/contributions.ts'
import { extensionManager } from '../extensions/manager.ts'
import {
  compareSemver,
  fetchExtensionManifest,
  type ExtensionManifest,
  type ResolvedExtensionAssets,
} from '../extensions/manifest.ts'
import {
  getNativeDevHost,
  nativeDevMode,
  refreshNativeDevInstalls,
  useNativeDevStore,
} from '../extensions/native/devHost.ts'
import type { NativePackage } from '../extensions/native/package.ts'
import { useExtensionStore } from '../extensions/store.ts'
import { Segmented } from './Controls'
import { ExtensionIcon } from './ExtensionIcon'
import { ExtensionInstallModal } from './ExtensionInstallModal'

export interface CommunityHubPageProps {
  highlightedId?: string
  onOpenExtensions: () => void
  onNavigate?: (path: string) => void
}

type HubFilter = 'all' | 'extension' | 'course'

function safeDecode(value: string): string {
  try {
    return decodeURIComponent(value)
  } catch {
    return value
  }
}

export function CommunityHubPage({
  highlightedId: rawHighlightedId,
  onOpenExtensions,
  onNavigate,
}: CommunityHubPageProps) {
  const highlightedId = rawHighlightedId ? safeDecode(rawHighlightedId) : null
  const records = useExtensionStore(s => s.records)
  const views = useContributionStore(s => s.views)
  const safeMode = useExtensionStore(s => s.safeMode)
  const nativeInstalls = useNativeDevStore(s => s.installs)
  const nativePhase = useNativeDevStore(s => s.phase)
  const nativeEnabled = nativeDevMode !== 'disabled'
  const [catalog, setCatalog] = useState<CatalogState>({
    status: 'loading',
    entries: [],
    updatedAt: null,
    error: null,
  })
  const [filter, setFilter] = useState<HubFilter>('all')
  const [query, setQuery] = useState('')
  const [checkingId, setCheckingId] = useState<string | null>(null)
  const [pendingInstall, setPendingInstall] = useState<{
    manifest: ExtensionManifest
    assets: ResolvedExtensionAssets
  } | null>(null)
  const [pendingNative, setPendingNative] = useState<{
    entry: CatalogEntry
    pkg: NativePackage
  } | null>(null)
  const [installing, setInstalling] = useState(false)
  const [modalError, setModalError] = useState<string | null>(null)
  const abortRef = useRef<AbortController | null>(null)

  const visibleEntries = useMemo(
    () => catalog.entries.filter(entry => entry.manifestVersion === 1 || nativeEnabled),
    [catalog.entries, nativeEnabled],
  )

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

  const filteredEntries = useMemo(() => {
    const q = query.trim().toLowerCase()
    const matched = visibleEntries.filter(entry => {
      if (filter !== 'all' && entry.kind !== filter) return false
      if (!q) return true
      const hay = [
        entry.name,
        entry.id,
        entry.description ?? '',
        entry.author ?? '',
        ...entry.tags,
      ]
        .join(' ')
        .toLowerCase()
      return hay.includes(q)
    })
    if (highlightedId) {
      matched.sort((a, b) => (a.id === highlightedId ? -1 : b.id === highlightedId ? 1 : 0))
    }
    return matched
  }, [visibleEntries, filter, query, highlightedId])

  const highlightedMissing = Boolean(
    highlightedId &&
      catalog.status === 'ready' &&
      !visibleEntries.some(entry => entry.id === highlightedId),
  )

  async function handleInspectEntry(entry: CatalogEntry) {
    setCheckingId(entry.id)
    setModalError(null)
    try {
      if (entry.manifestVersion === 2) {
        if (!nativeEnabled) {
          toast.error('Native v2 packages are available on Syntax Dev, Beta, and Preview builds.')
          return
        }
        if (useNativeDevStore.getState().phase !== 'ready') return
        const inspected = await getNativeDevHost().inspect(entry.manifestUrl)
        if (useNativeDevStore.getState().phase !== 'ready') return
        if (inspected.manifest.id !== entry.id || inspected.manifest.version !== entry.version ||
          (entry.sha256 && inspected.manifest.sha256 !== entry.sha256)) {
          throw new Error('The downloaded package does not match the Community Hub listing.')
        }
        setPendingNative({ entry, pkg: inspected })
        return
      }
      const inspected = await fetchExtensionManifest(entry.manifestUrl)
      setPendingInstall(inspected)
    } catch (err) {
      toast.error(err instanceof Error ? err.message : `Could not inspect ${entry.name}`)
    } finally {
      setCheckingId(null)
    }
  }

  async function handleConfirmNativeInstall() {
    if (!pendingNative || useNativeDevStore.getState().phase !== 'ready') return
    setInstalling(true)
    setModalError(null)
    try {
      const host = getNativeDevHost()
      const installed = await host.installInspected(pendingNative.pkg)
      await refreshNativeDevInstalls(true)
      const firstScreen = host.runtime.listScreens(installed.package.manifest.id)[0]
      const installedName = installed.package.manifest.name
      const installedId = installed.package.manifest.id
      const isCourse = pendingNative.entry.kind === 'course' || firstScreen?.kind === 'course'
      setPendingNative(null)
      toast.success(`Installed ${installedName} v${installed.package.manifest.version}`, {
        action: onNavigate
          ? {
              label: isCourse ? 'Open in Library' : 'Open',
              onClick: () => {
                if (firstScreen) {
                  onNavigate(`/native-extension/${encodeURIComponent(installedId)}/${encodeURIComponent(firstScreen.id)}`)
                } else {
                  onNavigate(isCourse ? '/library' : '/extensions')
                }
              },
            }
          : undefined,
      })
    } catch (err) {
      setModalError(err instanceof Error ? err.message : 'Failed to install native package.')
    } finally {
      setInstalling(false)
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
      toast.success(
        safeMode
          ? `Installed ${rec.manifest.name} (paused while in Safe Mode)`
          : `Installed ${rec.manifest.name} v${rec.manifest.version}`,
      )
    } catch (err) {
      setModalError(err instanceof Error ? err.message : 'Failed to install extension.')
    } finally {
      setInstalling(false)
    }
  }

  const installedById = new Map(records.map(r => [r.id, r]))
  const nativeInstalledById = new Map(nativeInstalls.map(r => [r.package.manifest.id, r]))
  const extensionCount = visibleEntries.filter(e => e.kind !== 'course').length
  const courseCount = visibleEntries.filter(e => e.kind === 'course').length

  return (
    <main className="sx-hub-page" aria-label="Community Hub">
      <header className="sx-hub-head">
        <div className="sx-workspace-head">
          <h1>Community Hub</h1>
          <span className="sx-hub-count">
            {catalog.status === 'ready'
              ? `${visibleEntries.length} ${visibleEntries.length === 1 ? 'package' : 'packages'}`
              : 'Extension and course catalog'}
          </span>
        </div>

        <div className="sx-hub-head-actions">
          <button
            type="button"
            className="sx-btn-secondary"
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

      {highlightedMissing && (
        <div className="sx-ext-inline-note" role="status">
          <p>
            Package <code>{highlightedId}</code> is not listed in the community catalog yet. If you
            have its direct link, you can install it from{' '}
            <button type="button" className="sx-link-btn" onClick={onOpenExtensions}>
              Extensions
            </button>
            .
          </p>
        </div>
      )}

      {pendingNative && (
        <section
          className="sx-hub-native-review"
          aria-label={`Confirm install for ${pendingNative.pkg.manifest.name}`}
          data-native-hub-review={pendingNative.pkg.manifest.id}
        >
          <div className="sx-hub-native-review-head">
            <ShieldAlert size={18} aria-hidden="true" />
            <div>
              <h2>Install {pendingNative.pkg.manifest.name} v{pendingNative.pkg.manifest.version}?</h2>
              <p>This code runs with the same browser access as Syntax.</p>
            </div>
          </div>
          <dl className="sx-hub-native-review-meta">
            <div><dt>ID</dt><dd><code>{pendingNative.pkg.manifest.id}</code></dd></div>
            <div><dt>Source</dt><dd><code>{pendingNative.pkg.sourceUrl}</code></dd></div>
            <div><dt>SHA-256</dt><dd><code>{pendingNative.pkg.manifest.sha256}</code></dd></div>
          </dl>
          {modalError && (
            <p role="alert" className="sx-ext-error-banner">{modalError}</p>
          )}
          <div className="sx-hub-native-review-actions">
            <button
              type="button"
              className="sx-btn-primary"
              disabled={installing || nativePhase !== 'ready'}
              onClick={() => void handleConfirmNativeInstall()}
            >
              {installing ? 'Installing...' : 'Install native package'}
            </button>
            <button
              type="button"
              className="sx-btn-secondary"
              disabled={installing}
              onClick={() => {
                setPendingNative(null)
                setModalError(null)
              }}
            >
              Cancel
            </button>
          </div>
        </section>
      )}

      {catalog.status === 'ready' && visibleEntries.length > 0 && (
        <div className="sx-hub-filter-bar">
          <div className="sx-ext-mode-toggle">
            <Segmented
              label="Filter catalog packages"
              value={filter}
              onChange={setFilter}
              options={[
                { value: 'all', label: `All (${visibleEntries.length})` },
                { value: 'extension', label: `Extensions (${extensionCount})` },
                { value: 'course', label: `Courses (${courseCount})` },
              ]}
            />
          </div>

          <div className="sx-search-field">
            <Search size={15} className="sx-search-icon" aria-hidden="true" />
            <input
              type="search"
              placeholder="Search packages, authors, or tags..."
              aria-label="Search community catalog"
              value={query}
              onChange={e => setQuery(e.target.value)}
            />
            {query && (
              <button
                type="button"
                className="sx-search-clear"
                aria-label="Clear search"
                onClick={() => setQuery('')}
              >
                <X size={14} aria-hidden="true" />
              </button>
            )}
          </div>
        </div>
      )}

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

      {catalog.status === 'ready' && visibleEntries.length === 0 && (
        <div className="sx-hub-empty">
          <span className="sx-empty-icon" aria-hidden="true">
            <Compass size={20} strokeWidth={1.9} />
          </span>
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

      {catalog.status === 'ready' && visibleEntries.length > 0 && filteredEntries.length === 0 && (
        <div className="sx-hub-empty">
          <p>No packages match your current filter.</p>
          <div className="sx-library-empty-actions">
            <button
              type="button"
              className="sx-btn-secondary"
              onClick={() => {
                setFilter('all')
                setQuery('')
              }}
            >
              Clear filters
            </button>
          </div>
        </div>
      )}

      {catalog.status === 'ready' && filteredEntries.length > 0 && (
        <div className="sx-ext-list">
          {filteredEntries.map(entry => {
            const isNative = entry.manifestVersion === 2
            const installedRec = isNative ? undefined : installedById.get(entry.id)
            const nativeRec = isNative ? nativeInstalledById.get(entry.id) : undefined
            const installed = Boolean(installedRec || nativeRec)
            const installedVersion = nativeRec?.package.manifest.version ?? installedRec?.manifest.version
            const hasUpdate = Boolean(
              installedVersion && compareSemver(entry.version, installedVersion) > 0,
            )
            const primaryView = !isNative && installed
              ? views.find(v => v.ownerId === entry.id && v.placement !== 'embed')
              : undefined
            const nativeScreen = isNative && nativeRec?.enabled && nativeEnabled
              ? getNativeDevHost().runtime.listScreens(entry.id)[0]
              : undefined
            const busy = checkingId === entry.id
            const isHighlighted = highlightedId === entry.id
            return (
              <article
                key={entry.id}
                className={`sx-ext-card${isHighlighted ? ' is-highlighted' : ''}`}
                data-catalog-id={entry.id}
                data-catalog-manifest-version={entry.manifestVersion}
              >
                <div className="sx-ext-card-top">
                  <div className="sx-ext-card-id sx-ext-card-id-with-icon">
                    <ExtensionIcon
                      src={entry.icon}
                      name={entry.name}
                      kind={entry.kind}
                      size={38}
                    />
                    <div className="sx-ext-card-id-copy">
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
                      {entry.tags.length > 0 && (
                        <div className="sx-hub-tag-row">
                          {entry.tags.slice(0, 6).map(tag => (
                            <span key={tag} className="sx-hub-tag">
                              {tag}
                            </span>
                          ))}
                        </div>
                      )}
                    </div>
                  </div>
                  <div className="sx-ext-card-actions">
                    {installed && primaryView && onNavigate && !hasUpdate && (
                      <button
                        type="button"
                        className="sx-btn-primary sx-btn-sm"
                        onClick={() =>
                          onNavigate(
                            `/ext/${encodeURIComponent(entry.id)}/${encodeURIComponent(primaryView.id)}`,
                          )
                        }
                      >
                        <ExternalLink size={13} aria-hidden="true" />
                        <span>Open</span>
                      </button>
                    )}
                    {installed && nativeScreen && onNavigate && !hasUpdate && (
                      <button
                        type="button"
                        className="sx-btn-primary sx-btn-sm"
                        onClick={() =>
                          onNavigate(
                            `/native-extension/${encodeURIComponent(entry.id)}/${encodeURIComponent(nativeScreen.id)}`,
                          )
                        }
                      >
                        <ExternalLink size={13} aria-hidden="true" />
                        <span>Open</span>
                      </button>
                    )}
                    <button
                      type="button"
                      className={
                        !installed || hasUpdate
                          ? 'sx-btn-primary sx-btn-sm'
                          : 'sx-btn-secondary sx-btn-sm'
                      }
                      disabled={busy || (entry.manifestVersion === 2 && nativePhase !== 'ready')}
                      onClick={() => void handleInspectEntry(entry)}
                    >
                      {installed && !hasUpdate ? (
                        <Check size={13} aria-hidden="true" />
                      ) : (
                        <Download size={13} aria-hidden="true" />
                      )}
                      <span>
                        {busy
                          ? 'Checking...'
                          : hasUpdate
                            ? `Update v${entry.version}`
                            : installed
                              ? 'Reinstall'
                              : 'Install'}
                      </span>
                    </button>
                  </div>
                </div>
                {entry.previewImages.length > 0 && (
                  <div
                    className="sx-hub-previews"
                    data-catalog-previews={entry.id}
                  >
                    {entry.previewImages.map((src, index) => (
                      <img
                        key={src}
                        src={src}
                        alt={`${entry.name} preview ${index + 1}`}
                        loading="lazy"
                        className="sx-hub-preview-img"
                      />
                    ))}
                  </div>
                )}
              </article>
            )
          })}
        </div>
      )}

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
