import { useEffect, useMemo, useRef, useState } from 'react'
import { COMMUNITY_HUB_WEB_URL, type CommunityCatalogState } from '../core/community'
import {
  PACKAGE_LABEL_BY_KIND,
  exportPackageFile,
  type PackageKind,
  type SyntaxPackageManifest,
} from '../core/packages'
import { useInstalledPackages } from '../core/registry'
import { CoreTouchWarning } from './CoreTouchWarning'
import { PackageIcon } from './PackageIcon'

type CommunityHubPageProps = {
  catalog: CommunityCatalogState
  loading: boolean
  onRefresh: () => void
  onRequestInstall: (pkg: SyntaxPackageManifest) => void
  onOpenCourse: (courseId: string) => void
}

type KindFilter = 'all' | PackageKind

export function CommunityHubPage({
  catalog,
  loading,
  onRefresh,
  onRequestInstall,
  onOpenCourse,
}: CommunityHubPageProps) {
  const installed = useInstalledPackages()
  const [kindFilter, setKindFilter] = useState<KindFilter>('all')
  const [onlyOfficial, setOnlyOfficial] = useState(false)
  const [onlyCoreTouch, setOnlyCoreTouch] = useState(false)
  const [query, setQuery] = useState('')
  const searchRef = useRef<HTMLInputElement>(null)

  const installedIds = useMemo(() => new Set(installed.map(r => r.manifest.id)), [installed])

  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key !== '/' || e.metaKey || e.ctrlKey || e.altKey) return
      const el = e.target as HTMLElement | null
      if (el && (el.tagName === 'INPUT' || el.tagName === 'TEXTAREA' || el.isContentEditable)) {
        return
      }
      e.preventDefault()
      searchRef.current?.focus()
    }
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [])

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase()
    return catalog.items.filter(item => {
      if (kindFilter !== 'all' && item.kind !== kindFilter) return false
      if (onlyOfficial && !item.author.official) return false
      if (onlyCoreTouch && !item.touchesCore) return false
      if (!q) return true
      return (
        item.name.toLowerCase().includes(q) ||
        item.tagline.toLowerCase().includes(q) ||
        item.id.toLowerCase().includes(q) ||
        item.extension.toLowerCase().includes(q) ||
        item.tags.some(t => t.toLowerCase().includes(q)) ||
        item.author.handle.toLowerCase().includes(q)
      )
    })
  }, [catalog.items, kindFilter, onlyOfficial, onlyCoreTouch, query])

  return (
    <main className="sx-page">
      <div className="sx-page-header">
        <div>
          <h1>Community Hub</h1>
          <p className="sx-page-subtitle">
            Browse verified courses (<code>.syntaxcourse</code>), app plugins (
            <code>.syntaxplugin</code>), and reusable embedded libraries (
            <code>.syntaxembeddedplugin</code>). Hosted free via GitHub Pages.
          </p>
        </div>
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
          <button type="button" className="sx-btn sx-btn-sm" onClick={onRefresh} disabled={loading}>
            {loading ? 'Refreshing...' : 'Refresh catalog'}
          </button>
          <a
            className="sx-btn sx-btn-sm"
            href={COMMUNITY_HUB_WEB_URL}
            target="_blank"
            rel="noreferrer"
          >
            Open Hub Website ↗
          </a>
        </div>
      </div>

      {catalog.warning && (
        <div className="sx-inline-note" style={{ marginBottom: 16 }}>
          {catalog.warning}
        </div>
      )}

      <div className="sx-toolbar">
        <div className="sx-tabs" role="tablist" aria-label="Filter package types">
          {(
            [
              ['all', 'All'],
              ['course', 'Courses'],
              ['plugin', 'App Plugins'],
              ['embedded-plugin', 'Embedded Plugins'],
            ] as const
          ).map(([key, label]) => (
            <button
              key={key}
              type="button"
              role="tab"
              aria-selected={kindFilter === key}
              className={`sx-tab${kindFilter === key ? ' is-active' : ''}`}
              onClick={() => setKindFilter(key)}
            >
              {label}
            </button>
          ))}
        </div>

        <div className="sx-search-wrap">
          <input
            ref={searchRef}
            type="search"
            className="sx-search-input"
            value={query}
            onChange={e => setQuery(e.target.value)}
            placeholder="Search courses, plugins, tags..."
            aria-label="Search Community Hub"
          />
          <span className="sx-kbd" aria-hidden="true">
            /
          </span>
        </div>
      </div>

      <div className="sx-pill-row" style={{ marginBottom: 18 }}>
        <button
          type="button"
          className={`sx-btn sx-btn-sm${onlyOfficial ? ' sx-btn-primary' : ' sx-btn-ghost'}`}
          onClick={() => setOnlyOfficial(v => !v)}
        >
          Official only
        </button>
        <button
          type="button"
          className={`sx-btn sx-btn-sm${onlyCoreTouch ? ' sx-btn-primary' : ' sx-btn-ghost'}`}
          onClick={() => setOnlyCoreTouch(v => !v)}
        >
          Touches core only
        </button>
        <span className="sx-pill" style={{ marginLeft: 'auto' }}>
          {filtered.length} {filtered.length === 1 ? 'package' : 'packages'} · source:{' '}
          {catalog.source}
        </span>
      </div>

      {filtered.length === 0 ? (
        <div className="sx-inline-note">
          No packages match your current search or filters.
        </div>
      ) : (
        <div className="sx-grid">
          {filtered.map(pkg => {
            const isInstalled = installedIds.has(pkg.id)
            return (
              <article key={pkg.id} className="sx-card">
                <div className="sx-card-top">
                  <PackageIcon svg={pkg.iconSvg} name={pkg.name} />
                  <div className="sx-card-meta">
                    <div className="sx-card-title-row">
                      <h2 className="sx-card-title">{pkg.name}</h2>
                      {pkg.author.official && (
                        <span className="sx-pill sx-pill-official">Official</span>
                      )}
                    </div>
                    <div className="sx-card-author">
                      @{pkg.author.handle} · v{pkg.version}
                    </div>
                  </div>
                </div>

                <p className="sx-card-tagline">{pkg.tagline}</p>

                <div className="sx-pill-row">
                  <span className="sx-pill">{PACKAGE_LABEL_BY_KIND[pkg.kind]}</span>
                  <span className="sx-pill sx-pill-ext">{pkg.extension}</span>
                  <span className="sx-pill">
                    Scan: {pkg.safety.automatedScan}
                  </span>
                </div>

                {pkg.touchesCore && (
                  <CoreTouchWarning variant="badge" reason={pkg.coreTouchReason} />
                )}

                {pkg.aiUsage && (
                  <div className="sx-inline-note" style={{ fontSize: 12.5, padding: '8px 10px' }}>
                    <strong>AI Library:</strong> {pkg.aiUsage.blocks.join(', ')}
                  </div>
                )}

                <div className="sx-card-footer">
                  <button
                    type="button"
                    className="sx-btn sx-btn-sm sx-btn-ghost"
                    onClick={() => exportPackageFile(pkg)}
                    title={`Download ${pkg.id}${pkg.extension}`}
                  >
                    Download file
                  </button>
                  <div style={{ display: 'flex', gap: 6 }}>
                    {isInstalled && pkg.kind === 'course' && (
                      <button
                        type="button"
                        className="sx-btn sx-btn-sm"
                        onClick={() => onOpenCourse(pkg.id)}
                      >
                        Open
                      </button>
                    )}
                    <button
                      type="button"
                      className={`sx-btn sx-btn-sm${isInstalled ? '' : ' sx-btn-primary'}`}
                      onClick={() => onRequestInstall(pkg)}
                    >
                      {isInstalled ? 'Details' : 'Install'}
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
