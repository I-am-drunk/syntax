import { useEffect, useMemo, useRef, useState } from 'react'
import MiniSearch from 'minisearch'
import {
  ArrowLeft,
  Check,
  Copy,
  Download,
  ExternalLink,
  RefreshCw,
  Search,
  Sparkles,
  Trash2,
} from 'lucide-react'
import { toast } from 'sonner'
import { useAccount } from '../core/account'
import { COMMUNITY_HUB_WEB_URL } from '../core/community'
import { SyntaxErrorBoundary } from '../core/ErrorBoundary'
import {
  PACKAGE_LABEL_BY_KIND,
  compareSemver,
  exportPackageFile,
  type PackageKind,
  type SyntaxPackageManifest,
} from '../core/packages'
import { useInstalledPackages, useRegistryStore } from '../core/registry'
import { PluginSandboxFrame } from '../core/sandbox'
import { CoreTouchIcon, CoreTouchWarning } from './CoreTouchWarning'
import { PackageIcon } from './PackageIcon'

type HubFilter = 'all' | PackageKind
type HubSort = 'featured' | 'name' | 'installed'

interface CommunityHubPageProps {
  packages: SyntaxPackageManifest[]
  source: 'live' | 'cached' | 'offline-official'
  warning?: string
  isRefreshing: boolean
  selectedPackageId?: string | null
  theme: 'light' | 'dark'
  onRefresh: () => void
  onSelectPackage: (id: string | null) => void
  onOpenCourse: (courseId: string) => void
  onRequireSignIn: (pkg: SyntaxPackageManifest) => void
}

export function CommunityHubPage({
  packages,
  source,
  warning,
  isRefreshing,
  selectedPackageId,
  theme,
  onRefresh,
  onSelectPackage,
  onOpenCourse,
  onRequireSignIn,
}: CommunityHubPageProps) {
  const account = useAccount()
  const records = useInstalledPackages()
  const installPackage = useRegistryStore(s => s.installPackage)
  const uninstallPackage = useRegistryStore(s => s.uninstallPackage)
  const setPackageEnabled = useRegistryStore(s => s.setPackageEnabled)

  const [query, setQuery] = useState('')
  const [filter, setFilter] = useState<HubFilter>('all')
  const [sort, setSort] = useState<HubSort>('featured')
  const [copiedId, setCopiedId] = useState<string | null>(null)
  const searchInputRef = useRef<HTMLInputElement>(null)

  const installedById = useMemo(
    () => new Map(records.map(r => [r.manifest.id, r])),
    [records],
  )

  // Merge remote catalog with any locally-imported packages so every installed package has a detail page
  const allPackages = useMemo(() => {
    const map = new Map<string, SyntaxPackageManifest>()
    for (const pkg of packages) map.set(pkg.id, pkg)
    for (const rec of records) {
      if (!map.has(rec.manifest.id)) map.set(rec.manifest.id, rec.manifest)
    }
    return Array.from(map.values())
  }, [packages, records])

  const searchIndex = useMemo(() => {
    const ms = new MiniSearch<SyntaxPackageManifest & { tagsText: string; authorText: string }>({
      fields: ['name', 'tagline', 'description', 'tagsText', 'authorText', 'id'],
      storeFields: ['id'],
      searchOptions: {
        boost: { name: 3.5, tagsText: 2.2, tagline: 1.8, authorText: 1.4 },
        prefix: true,
        fuzzy: 0.2,
      },
    })
    ms.addAll(
      allPackages.map(p => ({
        ...p,
        tagsText: p.tags.join(' '),
        authorText: `${p.author.handle} ${p.author.displayName}`,
      })),
    )
    return ms
  }, [allPackages])

  // Press '/' to focus search while browsing
  useEffect(() => {
    if (selectedPackageId) return
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== '/' || e.metaKey || e.ctrlKey || e.altKey) return
      const tag = (e.target as HTMLElement | null)?.tagName
      if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT') return
      e.preventDefault()
      searchInputRef.current?.focus()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [selectedPackageId])

  const selectedPkg = useMemo(
    () => (selectedPackageId ? allPackages.find(p => p.id === selectedPackageId) ?? null : null),
    [allPackages, selectedPackageId],
  )

  const visiblePackages = useMemo(() => {
    let list = allPackages
    const trimmed = query.trim()
    if (trimmed) {
      const hits = searchIndex.search(trimmed)
      const hitOrder = new Map(hits.map((h, i) => [String(h.id), i]))
      list = list
        .filter(p => hitOrder.has(p.id))
        .sort((a, b) => (hitOrder.get(a.id) ?? 999) - (hitOrder.get(b.id) ?? 999))
    }

    if (filter !== 'all') {
      list = list.filter(p => p.kind === filter)
    }

    if (!trimmed) {
      if (sort === 'name') {
        list = [...list].sort((a, b) => a.name.localeCompare(b.name))
      } else if (sort === 'installed') {
        list = [...list].sort((a, b) => {
          const ai = installedById.has(a.id) ? 0 : 1
          const bi = installedById.has(b.id) ? 0 : 1
          if (ai !== bi) return ai - bi
          return a.name.localeCompare(b.name)
        })
      } else {
        // Featured: community packages first so discovery shines, then official
        list = [...list].sort((a, b) => {
          const aOff = a.builtIn ? 1 : 0
          const bOff = b.builtIn ? 1 : 0
          if (aOff !== bOff) return aOff - bOff
          return a.name.localeCompare(b.name)
        })
      }
    }

    return list
  }, [allPackages, query, searchIndex, filter, sort, installedById])

  function handleInstall(pkg: SyntaxPackageManifest) {
    if (!account) {
      onRequireSignIn(pkg)
      return
    }
    const res = installPackage(pkg, {
      source: pkg.builtIn ? 'official' : 'community',
      catalogPool: allPackages,
    })
    if (!res.ok) {
      if (res.needsSignIn) {
        onRequireSignIn(pkg)
        return
      }
      toast.error(res.error)
      return
    }
    const autoCount = res.installedIds.filter(id => id !== pkg.id).length
    toast.success(
      autoCount > 0
        ? `Added ${pkg.name} (+${autoCount} embedded ${autoCount === 1 ? 'plugin' : 'plugins'})`
        : `Added ${pkg.name} to Syntax`,
    )
  }

  async function handleCopyInstallLink(pkg: SyntaxPackageManifest) {
    const shareUrl = `${window.location.origin}${import.meta.env.BASE_URL || '/'}#/?install=${encodeURIComponent(pkg.id)}`
    try {
      await navigator.clipboard.writeText(shareUrl)
      setCopiedId(pkg.id)
      toast.success('Copied install link')
      window.setTimeout(() => setCopiedId(null), 1600)
    } catch {
      toast.error('Could not copy link')
    }
  }

  // =========================================================================
  // FULL DEDICATED DETAIL PAGE (Raycast Store x Obsidian Detail Layout)
  // =========================================================================
  if (selectedPackageId) {
    if (!selectedPkg) {
      return (
        <main className="sx-hub-page" aria-label="Package not found">
          <button
            type="button"
            className="sx-hub-crumb"
            onClick={() => onSelectPackage(null)}
          >
            <ArrowLeft size={15} aria-hidden="true" />
            <span>Back to Community Hub</span>
          </button>
          <div className="sx-hub-empty">
            <h2>Package not found</h2>
            <p>
              Could not find <code>{selectedPackageId}</code> in the current catalog.
            </p>
            <button type="button" className="sx-btn-ghost" onClick={onRefresh}>
              Refresh catalog
            </button>
          </div>
        </main>
      )
    }

    const installed = installedById.get(selectedPkg.id)
    const isInstalled = Boolean(installed)
    const isEnabled = Boolean(installed?.enabled)
    const requires = selectedPkg.requires ?? []
    const hasMissingOrDisabledDeps = requires.some(dep => {
      const rec = installedById.get(dep.id)
      return (
        !rec ||
        !rec.enabled ||
        rec.manifest.kind !== dep.kind ||
        compareSemver(rec.manifest.version, dep.minVersion) < 0
      )
    })

    return (
      <main className="sx-hub-page sx-hub-detail-page" aria-label={selectedPkg.name}>
        <button
          type="button"
          className="sx-hub-crumb"
          onClick={() => onSelectPackage(null)}
        >
          <ArrowLeft size={15} aria-hidden="true" />
          <span>Community Hub</span>
          <span className="sx-hub-crumb-sep">/</span>
          <span className="sx-hub-crumb-current">{selectedPkg.name}</span>
        </button>

        <div className="sx-hub-detail-grid">
          <div className="sx-hub-detail-main">
            <header className="sx-hub-detail-hero">
              <PackageIcon svg={selectedPkg.iconSvg} size={64} />
              <div className="sx-hub-detail-titles">
                <div className="sx-hub-detail-title-row">
                  <h1>{selectedPkg.name}</h1>
                  {selectedPkg.builtIn && <span className="sx-hub-pill-official">Official</span>}
                </div>
                <p className="sx-hub-detail-tagline">{selectedPkg.tagline}</p>
                <div className="sx-hub-detail-actions">
                  {!isInstalled ? (
                    <button
                      type="button"
                      className="sx-btn-primary"
                      onClick={() => handleInstall(selectedPkg)}
                    >
                      {account ? 'Add to Syntax' : 'Sign in to add'}
                    </button>
                  ) : selectedPkg.kind === 'course' ? (
                    hasMissingOrDisabledDeps ? (
                      <button
                        type="button"
                        className="sx-btn-primary"
                        onClick={() => handleInstall(selectedPkg)}
                      >
                        Install required plugins &amp; open
                      </button>
                    ) : (
                      <button
                        type="button"
                        className="sx-btn-primary"
                        onClick={() => onOpenCourse(selectedPkg.id)}
                      >
                        Open course
                      </button>
                    )
                  ) : (
                    <button
                      type="button"
                      className={isEnabled ? 'sx-btn-ghost' : 'sx-btn-primary'}
                      onClick={() => {
                        setPackageEnabled(selectedPkg.id, !isEnabled)
                        toast.success(`${isEnabled ? 'Disabled' : 'Enabled'} ${selectedPkg.name}`)
                      }}
                    >
                      {isEnabled ? 'Disable' : 'Enable'}
                    </button>
                  )}

                  {isInstalled && !selectedPkg.builtIn && (
                    <button
                      type="button"
                      className="sx-btn-danger-ghost"
                      onClick={() => {
                        uninstallPackage(selectedPkg.id)
                        toast.success(`Removed ${selectedPkg.name}`)
                      }}
                    >
                      <Trash2 size={14} aria-hidden="true" />
                      <span>Remove</span>
                    </button>
                  )}
                </div>
              </div>
            </header>

            {selectedPkg.touchesCore && (
              <CoreTouchWarning reason={selectedPkg.coreTouchReason} />
            )}

            <section className="sx-hub-detail-section">
              <h2>Overview</h2>
              <p className="sx-hub-detail-desc">{selectedPkg.description}</p>
            </section>

            {selectedPkg.kind === 'embedded-plugin' && (
              <section className="sx-hub-detail-section">
                <div className="sx-account-status-row">
                  <span>Account status</span>
                  <span className={`sx-status-pill${isInstalled ? ' is-ok' : ''}`}>
                    {isInstalled
                      ? isEnabled
                        ? 'Installed on your account'
                        : 'Installed on your account (disabled)'
                      : 'Not installed yet'}
                  </span>
                </div>
              </section>
            )}

            {requires.length > 0 && (
              <section className="sx-hub-detail-section">
                <h2>Required embedded plugins</h2>
                <div className="sx-dep-list">
                  {requires.map(dep => {
                    const depRec = installedById.get(dep.id)
                    const depOk =
                      depRec &&
                      depRec.manifest.kind === dep.kind &&
                      compareSemver(depRec.manifest.version, dep.minVersion) >= 0
                    const statusLabel = depOk
                      ? depRec.enabled
                        ? 'Installed on your account'
                        : 'Installed (disabled)'
                      : 'Will install automatically'
                    return (
                      <div key={dep.id} className="sx-dep-item">
                        <button
                          type="button"
                          className="sx-dep-link"
                          onClick={() => onSelectPackage(dep.id)}
                        >
                          {dep.name} <small>v{dep.minVersion}+</small>
                        </button>
                        <span className={`sx-status-pill${depOk && depRec.enabled ? ' is-ok' : ''}`}>
                          {statusLabel}
                        </span>
                      </div>
                    )
                  })}
                </div>
              </section>
            )}

            {selectedPkg.sandboxHtml && (
              <section className="sx-hub-detail-section">
                <h2>Interactive preview</h2>
                <SyntaxErrorBoundary
                  scope={`plugin-preview:${selectedPkg.id}`}
                  pluginName={selectedPkg.name}
                  resetKeys={[selectedPkg.id]}
                >
                  <PluginSandboxFrame
                    pluginId={selectedPkg.id}
                    title={selectedPkg.name}
                    html={selectedPkg.sandboxHtml}
                    theme={theme}
                    onDisablePlugin={
                      isInstalled ? () => setPackageEnabled(selectedPkg.id, false) : undefined
                    }
                  />
                </SyntaxErrorBoundary>
              </section>
            )}

            {selectedPkg.aiUsage && (
              <section className="sx-hub-detail-section">
                <details className="sx-disclosure">
                  <summary>
                    <Sparkles size={14} aria-hidden="true" /> AI &amp; course authoring usage
                  </summary>
                  <div className="sx-disclosure-body">
                    <p>{selectedPkg.aiUsage.summary}</p>
                    <pre>{selectedPkg.aiUsage.example}</pre>
                  </div>
                </details>
              </section>
            )}
          </div>

          <aside className="sx-hub-detail-aside" aria-label="Package metadata">
            <div className="sx-hub-meta-card">
              <div className="sx-hub-meta-row">
                <span>Type</span>
                <strong>{PACKAGE_LABEL_BY_KIND[selectedPkg.kind]}</strong>
              </div>
              <div className="sx-hub-meta-row">
                <span>Author</span>
                <strong>@{selectedPkg.author.handle}</strong>
              </div>
              <div className="sx-hub-meta-row">
                <span>Version</span>
                <strong>v{selectedPkg.version}</strong>
              </div>
              <div className="sx-hub-meta-row">
                <span>Format</span>
                <code>{selectedPkg.extension}</code>
              </div>
              <div className="sx-hub-meta-row">
                <span>Status</span>
                <strong className={isInstalled && isEnabled ? 'is-ok' : undefined}>
                  {isInstalled ? (isEnabled ? 'Installed' : 'Disabled') : 'Available'}
                </strong>
              </div>

              {selectedPkg.tags.length > 0 && (
                <div className="sx-hub-meta-tags">
                  {selectedPkg.tags.map(tag => (
                    <button
                      key={tag}
                      type="button"
                      className="sx-hub-tag"
                      onClick={() => {
                        setQuery(tag)
                        onSelectPackage(null)
                      }}
                    >
                      {tag}
                    </button>
                  ))}
                </div>
              )}

              <div className="sx-hub-meta-actions">
                <button
                  type="button"
                  className="sx-btn-ghost sx-btn-full"
                  onClick={() => void handleCopyInstallLink(selectedPkg)}
                >
                  {copiedId === selectedPkg.id ? (
                    <Check size={14} aria-hidden="true" />
                  ) : (
                    <Copy size={14} aria-hidden="true" />
                  )}
                  <span>{copiedId === selectedPkg.id ? 'Link copied' : 'Copy install link'}</span>
                </button>
                <button
                  type="button"
                  className="sx-btn-ghost sx-btn-full"
                  onClick={() => exportPackageFile(selectedPkg)}
                >
                  <Download size={14} aria-hidden="true" />
                  <span>Download {selectedPkg.extension}</span>
                </button>
              </div>
            </div>
          </aside>
        </div>
      </main>
    )
  }

  // =========================================================================
  // BROWSE VIEW (Raycast Store Clarity x Obsidian Community Utility)
  // =========================================================================
  return (
    <main className="sx-hub-page" aria-label="Community Hub">
      <header className="sx-hub-head">
        <div className="sx-hub-head-copy">
          <h1>Community Hub</h1>
          <span className="sx-hub-count">
            {allPackages.length} packages
            {source === 'cached' ? ' (cached)' : ''}
          </span>
        </div>

        <div className="sx-hub-head-actions">
          <button
            type="button"
            className="sx-btn-ghost"
            onClick={onRefresh}
            disabled={isRefreshing}
          >
            <RefreshCw size={14} className={isRefreshing ? 'sx-spin' : undefined} aria-hidden="true" />
            <span>{isRefreshing ? 'Syncing' : 'Refresh'}</span>
          </button>
          <a
            href={COMMUNITY_HUB_WEB_URL}
            target="_blank"
            rel="noreferrer"
            className="sx-btn-ghost"
          >
            <span>Web Hub</span>
            <ExternalLink size={13} aria-hidden="true" />
          </a>
        </div>
      </header>

      {warning && (
        <div className="sx-hub-notice" role="status">
          {warning}
        </div>
      )}

      <div className="sx-hub-toolbar">
        <div className="sx-hub-search">
          <Search size={16} className="sx-hub-search-icon" aria-hidden="true" />
          <input
            ref={searchInputRef}
            type="search"
            value={query}
            onChange={e => setQuery(e.target.value)}
            placeholder="Search courses, plugins, authors, tags..."
            aria-label="Search Community Hub"
          />
          {!query && <kbd className="sx-hub-kbd">/</kbd>}
        </div>

        <div className="sx-hub-toolbar-right">
          <div className="sx-library-filters" role="tablist" aria-label="Filter packages">
            {(
              [
                { id: 'all', label: 'All' },
                { id: 'course', label: 'Courses' },
                { id: 'plugin', label: 'Plugins' },
                { id: 'embedded-plugin', label: 'Embedded' },
              ] as const
            ).map(tab => (
              <button
                key={tab.id}
                type="button"
                role="tab"
                aria-selected={filter === tab.id}
                className={`sx-lib-filter-pill${filter === tab.id ? ' is-active' : ''}`}
                onClick={() => setFilter(tab.id)}
              >
                {tab.label}
              </button>
            ))}
          </div>

          <select
            aria-label="Sort packages"
            className="sx-hub-sort"
            value={sort}
            onChange={e => setSort(e.target.value as HubSort)}
          >
            <option value="featured">Featured</option>
            <option value="name">Name (A-Z)</option>
            <option value="installed">Installed first</option>
          </select>
        </div>
      </div>

      {visiblePackages.length > 0 ? (
        <div className="sx-hub-grid">
          {visiblePackages.map(pkg => {
            const installed = installedById.get(pkg.id)
            const isInstalled = Boolean(installed)
            const isEnabled = Boolean(installed?.enabled)

            return (
              <article key={pkg.id} className="sx-hub-card">
                <button
                  type="button"
                  className="sx-hub-card-hit"
                  onClick={() => onSelectPackage(pkg.id)}
                >
                  <div className="sx-hub-card-top">
                    <PackageIcon svg={pkg.iconSvg} size={42} />
                    <div className="sx-hub-card-id">
                      <div className="sx-hub-card-name-row">
                        <h3>{pkg.name}</h3>
                        {pkg.touchesCore && <CoreTouchIcon />}
                      </div>
                      <span className="sx-hub-card-author">
                        @{pkg.author.handle} · v{pkg.version}
                      </span>
                    </div>
                  </div>
                  <p className="sx-hub-card-tagline">{pkg.tagline}</p>
                </button>

                <div className="sx-hub-card-foot">
                  <span className="sx-hub-kind-label">{PACKAGE_LABEL_BY_KIND[pkg.kind]}</span>
                  {isInstalled ? (
                    pkg.kind === 'embedded-plugin' ? (
                      <span className={`sx-status-pill${isEnabled ? ' is-ok' : ''}`}>
                        {isEnabled ? 'Installed on account' : 'Disabled'}
                      </span>
                    ) : pkg.kind === 'course' ? (
                      <button
                        type="button"
                        className="sx-btn-ghost sx-btn-xs"
                        onClick={() => onOpenCourse(pkg.id)}
                      >
                        Open
                      </button>
                    ) : (
                      <span className={`sx-status-pill${isEnabled ? ' is-ok' : ''}`}>
                        {isEnabled ? 'Installed' : 'Disabled'}
                      </span>
                    )
                  ) : (
                    <button
                      type="button"
                      className="sx-btn-primary sx-btn-xs"
                      onClick={() => handleInstall(pkg)}
                    >
                      Add
                    </button>
                  )}
                </div>
              </article>
            )
          })}
        </div>
      ) : (
        <div className="sx-hub-empty">
          <p>No packages match "{query}".</p>
          <button
            type="button"
            className="sx-btn-ghost"
            onClick={() => {
              setQuery('')
              setFilter('all')
            }}
          >
            Clear filters
          </button>
        </div>
      )}
    </main>
  )
}
