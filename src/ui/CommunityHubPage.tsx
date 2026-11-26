import { useEffect, useMemo, useRef, useState } from 'react'
import MiniSearch from 'minisearch'
import {
  AlertTriangle,
  ArrowLeft,
  BadgeCheck,
  Check,
  Copy,
  Download,
  ExternalLink,
  RefreshCw,
  Search,
  Shield,
  Sparkles,
  Trash2,
  X,
  XCircle,
} from 'lucide-react'
import { toast } from 'sonner'
import { useAccount } from '../core/account'
import { exportSytxArchive } from '../core/archive'
import { COMMUNITY_HUB_WEB_URL } from '../core/community'
import { evaluateCompatibility } from '../core/compatibility'
import { SyntaxErrorBoundary } from '../core/ErrorBoundary'
import {
  PACKAGE_LABEL_BY_KIND,
  PERMISSION_LABELS,
  RESERVED_HOST_IDS,
  SYNTAX_HOST_VERSION,
  getCompatibility,
  getEffectivePermissions,
  type PackageKind,
  type SyntaxPackageManifest,
} from '../core/packages'
import { getVaultArchive } from '../core/packageVault'
import { useInstalledPackages, useRegistryStore } from '../core/registry'
import { PluginSandboxFrame } from '../core/sandbox'
import { CoreTouchIcon, CoreTouchWarning } from './CoreTouchWarning'
import { PackageIcon } from './PackageIcon'

type HubFilter = 'all' | PackageKind
type HubSort = 'featured' | 'name' | 'installed'

const KIND_SHORT_LABEL: Record<PackageKind, string> = {
  course: 'Course',
  plugin: 'App Plugin',
  'embedded-plugin': 'Embedded Engine',
}

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

  const allPackages = useMemo(() => {
    const map = new Map<string, SyntaxPackageManifest>()
    for (const pkg of packages) map.set(pkg.id, pkg)
    for (const rec of records) {
      if (!map.has(rec.manifest.id)) map.set(rec.manifest.id, rec.manifest)
    }
    return Array.from(map.values())
  }, [packages, records])

  const allById = useMemo(
    () => new Map(allPackages.map(p => [p.id, p])),
    [allPackages],
  )

  const counts = useMemo(() => {
    const out = { all: allPackages.length, course: 0, plugin: 0, 'embedded-plugin': 0 }
    for (const p of allPackages) {
      if (p.kind === 'course') out.course += 1
      else if (p.kind === 'plugin') out.plugin += 1
      else if (p.kind === 'embedded-plugin') out['embedded-plugin'] += 1
    }
    return out
  }, [allPackages])

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
    () => (selectedPackageId ? allById.get(selectedPackageId) ?? null : null),
    [allById, selectedPackageId],
  )

  const visiblePackages = useMemo(() => {
    let list = allPackages
    const trimmed = query.trim()
    if (trimmed) {
      const qLower = trimmed.toLowerCase().replace(/^@/, '')
      let hitOrder: Map<string, number> | null = null
      try {
        const hits = searchIndex.search(trimmed)
        if (hits.length > 0) {
          hitOrder = new Map(hits.map((h, i) => [String(h.id), i]))
        }
      } catch {
        hitOrder = null
      }
      if (hitOrder) {
        list = list
          .filter(
            p =>
              hitOrder!.has(p.id) ||
              p.name.toLowerCase().includes(qLower) ||
              p.id.toLowerCase().includes(qLower) ||
              p.author.handle.toLowerCase().includes(qLower),
          )
          .sort((a, b) => (hitOrder!.get(a.id) ?? 999) - (hitOrder!.get(b.id) ?? 999))
      } else {
        list = list.filter(
          p =>
            p.name.toLowerCase().includes(qLower) ||
            p.tagline.toLowerCase().includes(qLower) ||
            p.id.toLowerCase().includes(qLower) ||
            p.author.handle.toLowerCase().includes(qLower) ||
            p.tags.some(t => t.toLowerCase().includes(qLower)),
        )
      }
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
        list = [...list].sort((a, b) => {
          const aComm = a.builtIn ? 1 : 0
          const bComm = b.builtIn ? 1 : 0
          if (aComm !== bComm) return aComm - bComm
          return a.name.localeCompare(b.name)
        })
      }
    }

    return list
  }, [allPackages, query, searchIndex, filter, sort, installedById])

  const showSpotlight =
    !query.trim() && filter === 'all' && sort === 'featured' && visiblePackages.length >= 4
  const spotlightPackages = useMemo(
    () => (showSpotlight ? visiblePackages.slice(0, 2) : []),
    [showSpotlight, visiblePackages],
  )
  const directoryPackages = useMemo(
    () => (showSpotlight ? visiblePackages.slice(2) : visiblePackages),
    [showSpotlight, visiblePackages],
  )

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
        ? `Added ${pkg.name} (+${autoCount} required ${autoCount === 1 ? 'engine' : 'engines'})`
        : `Added ${pkg.name} to Syntax`,
    )
  }

  async function handleDownloadSytx(pkg: SyntaxPackageManifest) {
    const vaultRec = await getVaultArchive(pkg.id)
    exportSytxArchive(pkg, vaultRec?.rawBytes)
    toast.success(`Downloaded ${pkg.id}-${pkg.version}.sytx`)
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
  // DEDICATED PACKAGE DETAIL PAGE
  // =========================================================================
  if (selectedPackageId) {
    if (!selectedPkg) {
      return (
        <main className="sx-hub-page" aria-label="Package detail">
          <button
            type="button"
            className="sx-hub-crumb"
            onClick={() => onSelectPackage(null)}
          >
            <ArrowLeft size={15} aria-hidden="true" />
            <span>Community Hub</span>
          </button>
          <div className="sx-hub-empty">
            {isRefreshing ? (
              <p>Loading package details&hellip;</p>
            ) : (
              <>
                <h2>Package not found</h2>
                <p>
                  Could not find <code>{selectedPackageId}</code> in the current catalog.
                </p>
                <button type="button" className="sx-btn-secondary" onClick={onRefresh}>
                  Refresh catalog
                </button>
              </>
            )}
          </div>
        </main>
      )
    }

    const installed = installedById.get(selectedPkg.id)
    const isInstalled = Boolean(installed)
    const isEnabled = Boolean(installed?.enabled)
    const compat = getCompatibility(selectedPkg)
    const permissions = getEffectivePermissions(selectedPkg)
    const report = evaluateCompatibility(
      selectedPkg,
      records.filter(r => r.manifest.id !== selectedPkg.id),
      allPackages,
    )
    const isIncompatible = report.verdict === 'incompatible'
    const needsDeps = report.installPlan.length > 0 || report.enablePlan.length > 0
    const depEntries = Object.entries(compat.depends).filter(([k]) => !RESERVED_HOST_IDS.has(k))

    return (
      <main className="sx-hub-page sx-hub-detail-page" aria-label={selectedPkg.name}>
        <nav className="sx-hub-crumb-bar" aria-label="Breadcrumb">
          <button
            type="button"
            className="sx-hub-crumb"
            onClick={() => onSelectPackage(null)}
          >
            <ArrowLeft size={15} aria-hidden="true" />
            <span>Community Hub</span>
          </button>
          <span className="sx-hub-crumb-sep" aria-hidden="true">
            /
          </span>
          <span className="sx-hub-crumb-current">{selectedPkg.name}</span>
        </nav>

        <div className="sx-hub-detail-grid">
          <div className="sx-hub-detail-main">
            <header className="sx-hub-detail-hero">
              <PackageIcon
                id={selectedPkg.id}
                kind={selectedPkg.kind}
                svg={selectedPkg.iconSvg}
                size={68}
              />
              <div className="sx-hub-detail-titles">
                <div className="sx-hub-detail-title-row">
                  <h1>{selectedPkg.name}</h1>
                  {selectedPkg.builtIn && (
                    <span className="sx-verified-badge" title="Official Syntax package">
                      <BadgeCheck size={18} aria-hidden="true" />
                    </span>
                  )}
                </div>
                <p className="sx-hub-detail-tagline">{selectedPkg.tagline}</p>
                <div className="sx-hub-detail-actions">
                  {!isInstalled ? (
                    <button
                      type="button"
                      className="sx-btn-primary"
                      disabled={isIncompatible}
                      onClick={() => handleInstall(selectedPkg)}
                    >
                      {isIncompatible
                        ? 'Incompatible'
                        : account
                          ? needsDeps
                            ? 'Add with dependencies'
                            : 'Add to Syntax'
                          : 'Sign in to add'}
                    </button>
                  ) : selectedPkg.kind === 'course' ? (
                    needsDeps ? (
                      <button
                        type="button"
                        className="sx-btn-primary"
                        disabled={isIncompatible}
                        onClick={() => handleInstall(selectedPkg)}
                      >
                        Install required engines &amp; open
                      </button>
                    ) : (
                      <button
                        type="button"
                        className="sx-btn-primary"
                        onClick={() => {
                          if (!isEnabled) {
                            const res = setPackageEnabled(selectedPkg.id, true)
                            if (!res.ok) {
                              toast.error(res.error)
                              return
                            }
                          }
                          onOpenCourse(selectedPkg.id)
                        }}
                      >
                        {isEnabled ? 'Open course' : 'Enable & open'}
                      </button>
                    )
                  ) : (
                    <button
                      type="button"
                      className={isEnabled ? 'sx-btn-secondary' : 'sx-btn-primary'}
                      disabled={!isEnabled && isIncompatible}
                      onClick={() => {
                        const res = setPackageEnabled(selectedPkg.id, !isEnabled)
                        if (!res.ok) {
                          toast.error(res.error)
                          return
                        }
                        toast.success(`${isEnabled ? 'Disabled' : 'Enabled'} ${selectedPkg.name}`)
                      }}
                    >
                      {isEnabled ? 'Disable' : 'Enable'}
                    </button>
                  )}

                  {isInstalled && !selectedPkg.builtIn && (
                    <button
                      type="button"
                      className="sx-btn-danger"
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

            {report.issues.length > 0 && (
              <div className="sx-compat-card">
                {report.issues.map((issue, idx) => (
                  <div
                    key={`${issue.code}:${issue.targetId}:${idx}`}
                    className={`sx-compat-issue is-${issue.severity}`}
                  >
                    {issue.severity === 'error' ? (
                      <XCircle size={15} aria-hidden="true" />
                    ) : (
                      <AlertTriangle size={15} aria-hidden="true" />
                    )}
                    <span>{issue.message}</span>
                  </div>
                ))}
              </div>
            )}

            {selectedPkg.touchesCore && (
              <CoreTouchWarning reason={selectedPkg.coreTouchReason} />
            )}

            <section className="sx-hub-detail-section">
              <h2>Overview</h2>
              <p className="sx-hub-detail-desc">{selectedPkg.description}</p>
            </section>

            {permissions.length > 0 && (
              <section className="sx-hub-detail-section">
                <h2>Permissions</h2>
                <div className="sx-perm-card">
                  <div className="sx-perm-head">
                    <Shield size={14} aria-hidden="true" />
                    <span>Declared capabilities</span>
                  </div>
                  <ul className="sx-perm-list">
                    {permissions.map(perm => {
                      const info = PERMISSION_LABELS[perm]
                      return (
                        <li key={perm} className={info.sensitive ? 'is-sensitive' : undefined}>
                          <strong>{info.title}</strong>
                          <span>{info.detail}</span>
                        </li>
                      )
                    })}
                  </ul>
                </div>
              </section>
            )}

            {depEntries.length > 0 && (
              <section className="sx-hub-detail-section">
                <h2>Dependencies</h2>
                <div className="sx-dep-list">
                  {depEntries.map(([depId, range]) => {
                    const depPkg = allById.get(depId)
                    const depRec = installedById.get(depId)
                    const isReady = Boolean(depRec?.enabled)
                    const statusLabel = isReady
                      ? 'Active'
                      : depRec
                        ? 'Disabled (will enable)'
                        : depPkg
                          ? 'Auto-installs'
                          : 'Missing from catalog'
                    return (
                      <div key={depId} className="sx-dep-item">
                        <button
                          type="button"
                          className="sx-dep-link-rich"
                          onClick={() => depPkg && onSelectPackage(depPkg.id)}
                        >
                          <PackageIcon
                            id={depId}
                            kind={depPkg?.kind ?? 'embedded-plugin'}
                            svg={depPkg?.iconSvg}
                            size={30}
                          />
                          <span className="sx-dep-link-copy">
                            <strong>{depPkg?.name ?? depId}</strong>
                            <small>{range}</small>
                          </span>
                        </button>
                        <span className={`sx-hub-inline-state${isReady ? ' is-ok' : ''}`}>
                          {isReady && <Check size={13} strokeWidth={2.4} aria-hidden="true" />}
                          <span>{statusLabel}</span>
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
                    permissions={permissions}
                    networkAccess={selectedPkg.safety.networkAccess}
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
                    <Sparkles size={14} aria-hidden="true" /> Authoring schema
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
                <code>.sytx</code>
              </div>
              <div className="sx-hub-meta-row">
                <span>Compatibility</span>
                <strong className={isIncompatible ? 'is-err' : 'is-ok'}>
                  Syntax {compat.depends.syntax ?? `^${SYNTAX_HOST_VERSION}`}
                </strong>
              </div>
              <div className="sx-hub-meta-row">
                <span>Status</span>
                <strong className={isInstalled && isEnabled ? 'is-ok' : undefined}>
                  {isInstalled ? (isEnabled ? 'Active' : 'Disabled') : 'Available'}
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
                        setFilter('all')
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
                  className="sx-btn-secondary sx-btn-full"
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
                  className="sx-btn-secondary sx-btn-full"
                  onClick={() => void handleDownloadSytx(selectedPkg)}
                >
                  <Download size={14} aria-hidden="true" />
                  <span>Download .sytx</span>
                </button>
              </div>
            </div>
          </aside>
        </div>
      </main>
    )
  }

  function renderCard(pkg: SyntaxPackageManifest, featured = false) {
    const installed = installedById.get(pkg.id)
    const isInstalled = Boolean(installed)
    const isEnabled = Boolean(installed?.enabled)
    const report = evaluateCompatibility(
      pkg,
      records.filter(r => r.manifest.id !== pkg.id),
      allPackages,
    )
    const isIncompatible = report.verdict === 'incompatible'

    return (
      <article key={pkg.id} className={`sx-hub-card${featured ? ' is-featured' : ''}`}>
        <button
          type="button"
          className="sx-hub-card-hit"
          onClick={() => onSelectPackage(pkg.id)}
        >
          <div className="sx-hub-card-top">
            <PackageIcon
              id={pkg.id}
              kind={pkg.kind}
              svg={pkg.iconSvg}
              size={featured ? 52 : 44}
            />
            <div className="sx-hub-card-id">
              <div className="sx-hub-card-name-row">
                <h3>{pkg.name}</h3>
                {pkg.builtIn && (
                  <span className="sx-verified-badge" title="Official Syntax package">
                    <BadgeCheck size={15} aria-hidden="true" />
                  </span>
                )}
                {pkg.touchesCore && <CoreTouchIcon />}
              </div>
              <span className="sx-hub-card-author">
                @{pkg.author.handle} &middot; v{pkg.version}
              </span>
            </div>
          </div>
          <p className="sx-hub-card-tagline">{pkg.tagline}</p>
        </button>

        <div className="sx-hub-card-foot">
          <span className="sx-hub-kind-label">{KIND_SHORT_LABEL[pkg.kind]}</span>
          {isInstalled ? (
            pkg.kind === 'course' ? (
              <button
                type="button"
                className="sx-btn-secondary sx-btn-sm"
                onClick={e => {
                  e.stopPropagation()
                  onOpenCourse(pkg.id)
                }}
              >
                {isEnabled ? 'Open' : 'Enable'}
              </button>
            ) : (
              <span className={`sx-hub-inline-state${isEnabled ? ' is-ok' : ''}`}>
                {isEnabled && <Check size={14} strokeWidth={2.4} aria-hidden="true" />}
                <span>{isEnabled ? 'Installed' : 'Disabled'}</span>
              </span>
            )
          ) : isIncompatible ? (
            <span className="sx-health-flag is-error">
              <XCircle size={12} aria-hidden="true" />
              <span>Incompatible</span>
            </span>
          ) : (
            <button
              type="button"
              className="sx-btn-add-cta"
              onClick={e => {
                e.stopPropagation()
                handleInstall(pkg)
              }}
            >
              Add
            </button>
          )}
        </div>
      </article>
    )
  }

  return (
    <main className="sx-hub-page" aria-label="Community Hub">
      <header className="sx-hub-head">
        <div className="sx-workspace-head">
          <h1>Community Hub</h1>
          <span className="sx-hub-count">
            {allPackages.length} packages
            {source === 'cached' ? ' (cached)' : ''}
          </span>
        </div>

        <div className="sx-hub-head-actions">
          <button
            type="button"
            className="sx-btn-secondary"
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
            className="sx-btn-secondary"
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

      <div className="sx-hub-controls">
        <div className="sx-search-field sx-hub-search-bar">
          <Search size={16} className="sx-search-icon" aria-hidden="true" />
          <input
            ref={searchInputRef}
            type="text"
            value={query}
            onChange={e => setQuery(e.target.value)}
            placeholder="Search courses, plugins, embedded engines, authors..."
            aria-label="Search Community Hub"
          />
          {query ? (
            <button
              type="button"
              className="sx-search-clear"
              aria-label="Clear search"
              onClick={() => setQuery('')}
            >
              <X size={14} aria-hidden="true" />
            </button>
          ) : (
            <kbd className="sx-hub-kbd">/</kbd>
          )}
        </div>

        <div className="sx-hub-tabs-row">
          <div className="sx-hub-underline-tabs" role="tablist" aria-label="Filter packages">
            {(
              [
                { id: 'all', label: 'All', count: counts.all },
                { id: 'course', label: 'Courses', count: counts.course },
                { id: 'plugin', label: 'Plugins', count: counts.plugin },
                { id: 'embedded-plugin', label: 'Embedded', count: counts['embedded-plugin'] },
              ] as const
            ).map(tab => (
              <button
                key={tab.id}
                type="button"
                role="tab"
                aria-selected={filter === tab.id}
                className={`sx-hub-tab${filter === tab.id ? ' is-active' : ''}`}
                onClick={() => setFilter(tab.id)}
              >
                <span>{tab.label}</span>
                <span className="sx-hub-tab-count">{tab.count}</span>
              </button>
            ))}
          </div>

          <div className="sx-hub-sort-group" role="group" aria-label="Sort packages">
            {(
              [
                { id: 'featured', label: 'Featured' },
                { id: 'name', label: 'A-Z' },
                { id: 'installed', label: 'Installed' },
              ] as const
            ).map(opt => (
              <button
                key={opt.id}
                type="button"
                className={`sx-hub-sort-btn${sort === opt.id ? ' is-active' : ''}`}
                aria-pressed={sort === opt.id}
                onClick={() => setSort(opt.id)}
              >
                {opt.label}
              </button>
            ))}
          </div>
        </div>
      </div>

      {visiblePackages.length > 0 ? (
        <div className="sx-hub-catalog-body">
          {spotlightPackages.length > 0 && (
            <section className="sx-hub-section" aria-label="Featured packages">
              <div className="sx-hub-section-head">
                <h2>Featured</h2>
              </div>
              <div className="sx-hub-spotlight-grid">
                {spotlightPackages.map(pkg => renderCard(pkg, true))}
              </div>
            </section>
          )}

          <section className="sx-hub-section" aria-label="All packages">
            {spotlightPackages.length > 0 && (
              <div className="sx-hub-section-head">
                <h2>Directory</h2>
                <span>{directoryPackages.length}</span>
              </div>
            )}
            <div className="sx-hub-grid">
              {directoryPackages.map(pkg => renderCard(pkg, false))}
            </div>
          </section>
        </div>
      ) : (
        <div className="sx-hub-empty">
          <p>No packages match &ldquo;{query}&rdquo;.</p>
          <button
            type="button"
            className="sx-btn-secondary"
            onClick={() => {
              setQuery('')
              setFilter('all')
            }}
          >
            Reset filters
          </button>
        </div>
      )}
    </main>
  )
}
