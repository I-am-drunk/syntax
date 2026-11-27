import { useEffect, useState } from 'react'
import {
  AlertTriangle,
  Compass,
  ExternalLink,
  FileText,
  Library,
  Puzzle,
  Search,
  Settings,
  ShieldAlert,
} from 'lucide-react'
import { useAccount } from '../core/account'
import type { SyntaxPrefs } from '../core/prefs'
import { useContributionStore } from '../extensions/contributions.ts'
import { documentStore, type DocumentEnvelope } from '../extensions/documents.ts'
import { resolveExtensionAssets } from '../extensions/manifest.ts'
import { useExtensionStore } from '../extensions/store.ts'
import { Sema } from '../mascot/Sema'
import { ExtensionIcon } from './ExtensionIcon'

export interface HomePageProps {
  prefs: SyntaxPrefs
  onNavigate: (path: string) => void
  onOpenCommandPalette: () => void
  onOpenLibrary: () => void
  onOpenExtensions: () => void
  onOpenCommunityHub: () => void
  onOpenSettings: () => void
}

export function HomePage({
  prefs,
  onNavigate,
  onOpenCommandPalette,
  onOpenLibrary,
  onOpenExtensions,
  onOpenCommunityHub,
  onOpenSettings,
}: HomePageProps) {
  const account = useAccount()
  const records = useExtensionStore(s => s.records)
  const runtimeById = useExtensionStore(s => s.runtime)
  const safeMode = useExtensionStore(s => s.safeMode)
  const views = useContributionStore(s => s.views)
  const [recentDocs, setRecentDocs] = useState<DocumentEnvelope[]>([])

  useEffect(() => {
    let cancelled = false
    const refresh = () => {
      void documentStore.list().then(list => {
        if (!cancelled) setRecentDocs(list.slice(0, 4))
      })
    }
    refresh()
    window.addEventListener('syntax:documents-changed', refresh)
    return () => {
      cancelled = true
      window.removeEventListener('syntax:documents-changed', refresh)
    }
  }, [records.length, views.length])

  const greetingName = account?.displayName?.split(' ')[0]
  const nameById = new Map(records.map(r => [r.id, r.manifest.name]))
  const kindById = new Map(records.map(r => [r.id, r.manifest.kind]))
  const iconUrlById = new Map(
    records.map(r => {
      try {
        return [r.id, resolveExtensionAssets(r.manifestUrl, r.manifest).iconUrl] as const
      } catch {
        return [r.id, null] as const
      }
    }),
  )

  const nonEmbedViews = views.filter(v => v.placement !== 'embed')
  const ownersWithPage = new Set(
    nonEmbedViews.filter(v => v.placement === 'page').map(v => v.ownerId),
  )
  const launchViews = nonEmbedViews.filter(
    v => v.placement === 'page' || !ownersWithPage.has(v.ownerId),
  )

  const courseCount = records.filter(r => r.manifest.kind === 'course').length
  const extCount = records.length - courseCount
  const failedCount = records.filter(r => runtimeById[r.id]?.status === 'failed').length

  function openDocument(doc: DocumentEnvelope) {
    const ownerViews = nonEmbedViews.filter(v => v.ownerId === doc.createdByExtensionId)
    const matchingView =
      ownerViews.find(v => v.docTypes.includes(doc.type)) ?? ownerViews[0]
    const viewId = matchingView?.id ?? 'main'
    onNavigate(
      `/ext/${encodeURIComponent(doc.createdByExtensionId)}/${encodeURIComponent(viewId)}/${encodeURIComponent(doc.id)}`,
    )
  }

  const summaryLine =
    records.length === 0 && recentDocs.length === 0
      ? 'Install courses and tools from Community Hub or by link to build your workspace.'
      : [
          courseCount > 0 ? `${courseCount} ${courseCount === 1 ? 'course' : 'courses'}` : null,
          extCount > 0 ? `${extCount} ${extCount === 1 ? 'extension' : 'extensions'}` : null,
          recentDocs.length > 0
            ? `${recentDocs.length}${recentDocs.length === 4 ? '+' : ''} saved ${recentDocs.length === 1 ? 'document' : 'documents'}`
            : null,
        ]
          .filter(Boolean)
          .join(' · ')

  return (
    <main className="sx-workspace-page" aria-label="Home">
      <section className="sx-profile-hero">
        <div className="sx-profile-identity">
          <div
            style={{
              width: 72,
              height: 72,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              flexShrink: 0,
            }}
          >
            <Sema
              state="idle"
              shape={prefs.semaShape}
              tail={prefs.semaTail}
              expression={prefs.semaExpression}
              size={58}
              interactive
              ariaLabel="Sema companion"
            />
          </div>
          <div className="sx-profile-titles">
            <h1>{greetingName ? `Welcome back, ${greetingName}` : 'Welcome to Syntax'}</h1>
            <p className="sx-profile-handle">{summaryLine}</p>
          </div>
        </div>

        <div className="sx-profile-hero-actions">
          <button type="button" className="sx-btn-secondary" onClick={onOpenCommandPalette}>
            <Search size={14} strokeWidth={2} aria-hidden="true" />
            <span>Quick Search</span>
            <kbd className="sx-kbd">Ctrl+K</kbd>
          </button>
          <button type="button" className="sx-btn-primary" onClick={onOpenLibrary}>
            <Library size={15} strokeWidth={2} aria-hidden="true" />
            <span>Open Library</span>
          </button>
        </div>
      </section>

      {safeMode && (
        <section className="sx-ext-safemode-banner" role="alert">
          <div className="sx-ext-safemode-copy">
            <ShieldAlert size={18} aria-hidden="true" />
            <div>
              <strong>Safe Mode is active</strong>
              <p>All extensions are paused. Open Extensions to manage them or exit Safe Mode.</p>
            </div>
          </div>
          <button type="button" className="sx-btn-primary sx-btn-sm" onClick={onOpenExtensions}>
            Open Extensions
          </button>
        </section>
      )}

      {!safeMode && failedCount > 0 && (
        <div className="sx-ext-inline-error" role="alert">
          <AlertTriangle size={15} aria-hidden="true" />
          <span>
            {failedCount} {failedCount === 1 ? 'extension failed' : 'extensions failed'} to start.{' '}
            <button type="button" className="sx-link-btn" onClick={onOpenExtensions}>
              Inspect in Extensions
            </button>
          </span>
        </div>
      )}

      {launchViews.length > 0 && (
        <section className="sx-profile-section" aria-label="Quick launch">
          <div className="sx-profile-section-head">
            <h2>Quick Launch</h2>
            <button type="button" className="sx-link-btn" onClick={onOpenLibrary}>
              View all in Library
            </button>
          </div>
          <div className="sx-ext-card-grid">
            {launchViews.slice(0, 6).map(v => {
              const extName = nameById.get(v.ownerId) ?? v.ownerId
              const kind = kindById.get(v.ownerId) ?? 'extension'
              return (
                <button
                  key={v.key}
                  type="button"
                  className="sx-ext-launch-card"
                  onClick={() =>
                    onNavigate(`/ext/${encodeURIComponent(v.ownerId)}/${encodeURIComponent(v.id)}`)
                  }
                >
                  <span className="sx-ext-launch-head">
                    <ExtensionIcon
                      src={iconUrlById.get(v.ownerId)}
                      name={extName}
                      kind={kind}
                      size={32}
                    />
                    <span className="sx-ext-launch-copy">
                      <span className="sx-ext-launch-title">
                        <strong>{v.title}</strong>
                        <ExternalLink size={14} aria-hidden="true" />
                      </span>
                      <small>{extName}</small>
                    </span>
                  </span>
                </button>
              )
            })}
          </div>
        </section>
      )}

      {recentDocs.length > 0 && (
        <section className="sx-profile-section" aria-label="Recent documents">
          <div className="sx-profile-section-head">
            <h2>Continue Working</h2>
            <button type="button" className="sx-link-btn" onClick={onOpenLibrary}>
              All documents
            </button>
          </div>
          <div className="sx-ext-doc-list">
            {recentDocs.map(doc => (
              <button
                key={doc.id}
                type="button"
                className="sx-ext-doc-row"
                onClick={() => openDocument(doc)}
              >
                <span className="sx-ext-doc-main">
                  <FileText size={16} aria-hidden="true" />
                  <span>
                    <strong>{doc.title}</strong>
                    <small>
                      {doc.type} · rev {doc.revision} ·{' '}
                      {nameById.get(doc.createdByExtensionId) ?? doc.createdByExtensionId}
                    </small>
                  </span>
                </span>
                <span className="sx-ext-doc-open">Open</span>
              </button>
            ))}
          </div>
        </section>
      )}

      <section className="sx-profile-section" aria-label="Workspace shortcuts">
        <div className="sx-profile-section-head">
          <h2>Workspace</h2>
        </div>
        <div className="preference-rows">
          <div className="preference-row">
            <div className="syntax-pref-copy">
              <p>Library</p>
              <span>Your courses, extension screens, embedded widgets, and saved documents</span>
            </div>
            <button type="button" className="sx-btn-secondary sx-btn-sm" onClick={onOpenLibrary}>
              <Library size={14} aria-hidden="true" />
              <span>Library</span>
            </button>
          </div>

          <div className="preference-row">
            <div className="syntax-pref-copy">
              <p>Extensions &amp; Courses</p>
              <span>Install by link, update, configure settings, and inspect logs</span>
            </div>
            <button type="button" className="sx-btn-secondary sx-btn-sm" onClick={onOpenExtensions}>
              <Puzzle size={14} aria-hidden="true" />
              <span>Extensions</span>
            </button>
          </div>

          <div className="preference-row">
            <div className="syntax-pref-copy">
              <p>Community Hub</p>
              <span>Browse published extensions and interactive courses</span>
            </div>
            <button
              type="button"
              className="sx-btn-secondary sx-btn-sm"
              onClick={onOpenCommunityHub}
            >
              <Compass size={14} aria-hidden="true" />
              <span>Browse</span>
            </button>
          </div>

          <div className="preference-row">
            <div className="syntax-pref-copy">
              <p>Settings &amp; Sema</p>
              <span>Customize Light or Dark mode, sound effects, and Sema companion style</span>
            </div>
            <button type="button" className="sx-btn-secondary sx-btn-sm" onClick={onOpenSettings}>
              <Settings size={14} aria-hidden="true" />
              <span>Settings</span>
            </button>
          </div>
        </div>
      </section>
    </main>
  )
}
