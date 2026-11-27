import { useEffect, useState } from 'react'
import { AlertTriangle, Compass, ExternalLink, FileText, Puzzle, RefreshCw, Trash2 } from 'lucide-react'
import { toast } from 'sonner'
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

  const kindById = new Map(records.map(r => [r.id, r.manifest.kind]))
  const pageViews = views.filter(v => v.placement !== 'embed')
  const courseViews = pageViews.filter(v => kindById.get(v.ownerId) === 'course')
  const extensionViews = pageViews.filter(v => kindById.get(v.ownerId) !== 'course')
  const embedViews = views.filter(v => v.placement === 'embed')
  const nameById = new Map(records.map(r => [r.id, r.manifest.name]))

  function openDocument(doc: DocumentEnvelope) {
    const matchingView =
      pageViews.find(v => v.ownerId === doc.createdByExtensionId && v.docTypes.includes(doc.type)) ??
      pageViews.find(v => v.docTypes.includes(doc.type)) ??
      pageViews.find(v => v.ownerId === doc.createdByExtensionId)

    const ownerId = matchingView?.ownerId ?? doc.createdByExtensionId
    const viewId = matchingView?.id ?? 'main'
    onNavigate(
      `/ext/${encodeURIComponent(ownerId)}/${encodeURIComponent(viewId)}/${encodeURIComponent(doc.id)}`,
    )
  }

  async function handleDeleteDocument(doc: DocumentEnvelope) {
    try {
      await documentStore.delete(doc.id)
      setDocuments(prev => prev.filter(d => d.id !== doc.id))
      toast(`Deleted "${doc.title}"`)
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to delete document')
    }
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
          {courseViews.length > 0 && (
            <section className="sx-plugins-section" aria-label="Course views">
              <div className="sx-plugins-section-head">
                <h2>Courses</h2>
                <span>{courseViews.length}</span>
              </div>
              <div className="sx-ext-card-grid">
                {courseViews.map(v => (
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

          {extensionViews.length > 0 && (
            <section className="sx-plugins-section" aria-label="Extension views">
              <div className="sx-plugins-section-head">
                <h2>Extensions</h2>
                <span>{extensionViews.length}</span>
              </div>
              <div className="sx-ext-card-grid">
                {extensionViews.map(v => (
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
                  <div key={doc.id} className="sx-ext-doc-item" data-doc-id={doc.id}>
                    <button
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
                    <button
                      type="button"
                      className="sx-btn-ghost sx-btn-sm sx-ext-doc-delete"
                      aria-label={`Delete ${doc.title}`}
                      title={`Delete ${doc.title}`}
                      onClick={() => void handleDeleteDocument(doc)}
                    >
                      <Trash2 size={14} aria-hidden="true" />
                    </button>
                  </div>
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
                  const extName = nameById.get(v.ownerId) ?? v.ownerId
                  if (rt?.status !== 'active' || !rt.activationId) {
                    return (
                      <div
                        key={v.key}
                        className="sx-ext-view-frame is-embed"
                        data-extension-id={v.ownerId}
                        data-view-id={v.id}
                        data-view-ready="false"
                      >
                        <div className="sx-ext-embed-bar">
                          <span className="sx-ext-embed-title">
                            <strong>{v.title}</strong>
                            <small>{extName} · Embedded Extension</small>
                          </span>
                          <button
                            type="button"
                            className="sx-btn-secondary sx-btn-sm"
                            onClick={() => {
                              void extensionManager.reload(v.ownerId).catch(err => {
                                toast.error(
                                  err instanceof Error ? err.message : `Failed to reload ${extName}`,
                                )
                              })
                            }}
                          >
                            <RefreshCw size={13} aria-hidden="true" />
                            <span>Reload</span>
                          </button>
                        </div>
                        <div className="sx-ext-embed-recovery" role="alert">
                          <AlertTriangle size={16} aria-hidden="true" />
                          <span>
                            {rt?.lastError?.message ?? `${extName} is currently paused or stopped.`}
                          </span>
                        </div>
                      </div>
                    )
                  }
                  return (
                    <ExtensionViewFrame
                      key={v.key}
                      extensionId={v.ownerId}
                      extensionName={extName}
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
