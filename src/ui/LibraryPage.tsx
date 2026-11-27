import { useEffect, useState } from 'react'
import { Compass, ExternalLink, FileText, Puzzle } from 'lucide-react'
import { useContributionStore } from '../extensions/contributions.ts'
import { documentStore, type DocumentEnvelope } from '../extensions/documents.ts'
import { ExtensionViewFrame } from '../extensions/ExtensionViewFrame.tsx'
import { extensionManager } from '../extensions/manager.ts'
import { useExtensionStore } from '../extensions/store.ts'

export interface LibraryPageProps {
  onOpenExtensions: () => void
  onOpenCommunityHub: () => void
  onNavigate: (path: string) => void
}

export function LibraryPage({
  onOpenExtensions,
  onOpenCommunityHub,
  onNavigate,
}: LibraryPageProps) {
  const records = useExtensionStore(s => s.records)
  const runtimeById = useExtensionStore(s => s.runtime)
  const views = useContributionStore(s => s.views)
  const [documents, setDocuments] = useState<DocumentEnvelope[]>([])

  useEffect(() => {
    let cancelled = false
    const refresh = () => {
      void documentStore.list().then(list => {
        if (!cancelled) setDocuments(list)
      })
    }
    refresh()
    window.addEventListener('syntax:documents-changed', refresh)
    return () => {
      cancelled = true
      window.removeEventListener('syntax:documents-changed', refresh)
    }
  }, [records.length, views.length])

  const pageViews = views.filter(v => v.placement !== 'embed')
  const embedViews = views.filter(v => v.placement === 'embed')
  const nameById = new Map(records.map(r => [r.id, r.manifest.name]))

  function openDocument(doc: DocumentEnvelope) {
    const matchingView =
      pageViews.find(v => v.docTypes.includes(doc.type)) ??
      pageViews.find(v => v.ownerId === doc.createdByExtensionId)

    const ownerId = matchingView?.ownerId ?? doc.createdByExtensionId
    const viewId = matchingView?.id ?? 'main'
    onNavigate(
      `/ext/${encodeURIComponent(ownerId)}/${encodeURIComponent(viewId)}/${encodeURIComponent(doc.id)}`,
    )
  }

  return (
    <main className="sx-workspace-page sx-library-page" aria-label="Library">
      <header className="sx-library-head">
        <div className="sx-library-head-copy">
          <h1>Library</h1>
          <span className="sx-library-count">
            {pageViews.length} {pageViews.length === 1 ? 'extension view' : 'extension views'}
            {documents.length > 0
              ? ` · ${documents.length} ${documents.length === 1 ? 'document' : 'documents'}`
              : ''}
          </span>
        </div>

        <div className="sx-library-controls">
          <button type="button" className="sx-btn-secondary" onClick={onOpenExtensions}>
            <Puzzle size={15} strokeWidth={2} aria-hidden="true" />
            <span>Extensions</span>
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
      </header>

      {pageViews.length === 0 && embedViews.length === 0 && documents.length === 0 ? (
        <div className="sx-library-empty">
          <p>No extensions or documents yet.</p>
          <p className="sx-profile-handle">
            Install standalone or embedded extensions from Extensions or Community Hub to add new
            screens, commands, and tools.
          </p>
          <div className="sx-library-empty-actions">
            <button type="button" className="sx-btn-secondary" onClick={onOpenExtensions}>
              <Puzzle size={15} strokeWidth={2} aria-hidden="true" />
              <span>Extensions</span>
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
      ) : (
        <>
          {pageViews.length > 0 && (
            <section className="sx-plugins-section" aria-label="Extension views">
              <div className="sx-plugins-section-head">
                <h2>Extensions</h2>
                <span>{pageViews.length}</span>
              </div>
              <div className="sx-ext-card-grid">
                {pageViews.map(v => (
                  <button
                    key={v.key}
                    type="button"
                    className="sx-ext-launch-card"
                    onClick={() =>
                      onNavigate(
                        `/ext/${encodeURIComponent(v.ownerId)}/${encodeURIComponent(v.id)}`,
                      )
                    }
                  >
                    <span className="sx-ext-launch-title">
                      <strong>{v.title}</strong>
                      <ExternalLink size={14} aria-hidden="true" />
                    </span>
                    <small>{nameById.get(v.ownerId) ?? v.ownerId}</small>
                  </button>
                ))}
              </div>
            </section>
          )}

          {documents.length > 0 && (
            <section className="sx-plugins-section" aria-label="Saved documents">
              <div className="sx-plugins-section-head">
                <h2>Documents</h2>
                <span>{documents.length}</span>
              </div>
              <div className="sx-ext-doc-list">
                {documents.map(doc => (
                  <button
                    key={doc.id}
                    type="button"
                    className="sx-ext-doc-row"
                    data-doc-id={doc.id}
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

          {embedViews.length > 0 && (
            <section className="sx-plugins-section" aria-label="Embedded extensions">
              <div className="sx-plugins-section-head">
                <h2>Embedded Extensions</h2>
                <span>{embedViews.length}</span>
              </div>
              <div className="sx-ext-embed-grid">
                {embedViews.map(v => {
                  const rt = runtimeById[v.ownerId]
                  if (!rt?.activationId) return null
                  return (
                    <ExtensionViewFrame
                      key={v.key}
                      extensionId={v.ownerId}
                      extensionName={nameById.get(v.ownerId) ?? v.ownerId}
                      viewId={v.id}
                      entryUrl={v.entryUrl}
                      activationId={rt.activationId}
                      title={v.title}
                      placement="embed"
                      onReloadExtension={() => void extensionManager.reload(v.ownerId)}
                      onOpenExtensions={onOpenExtensions}
                    />
                  )
                })}
              </div>
            </section>
          )}
        </>
      )}
    </main>
  )
}
