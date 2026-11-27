import { useEffect, useMemo, useRef, useState } from 'react'
import {
  AlertTriangle,
  Compass,
  Download,
  ExternalLink,
  FileText,
  Puzzle,
  RefreshCw,
  Search,
  Trash2,
  Upload,
  X,
} from 'lucide-react'
import { toast } from 'sonner'
import { useContributionStore } from '../extensions/contributions.ts'
import {
  documentStore,
  exportDocumentFilename,
  notifyDocumentsChanged,
  parseImportedDocumentJson,
  subscribeDocumentsChanged,
  type DocumentEnvelope,
} from '../extensions/documents.ts'
import { ExtensionViewFrame } from '../extensions/ExtensionViewFrame.tsx'
import { extensionManager } from '../extensions/manager.ts'
import { resolveExtensionAssets } from '../extensions/manifest.ts'
import { useExtensionStore } from '../extensions/store.ts'
import { ExtensionIcon } from './ExtensionIcon'

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
  const [docQuery, setDocQuery] = useState('')
  const importInputRef = useRef<HTMLInputElement | null>(null)

  useEffect(() => {
    let cancelled = false
    const refresh = () => {
      void documentStore.list().then(list => {
        if (!cancelled) setDocuments(list)
      })
    }
    refresh()
    const unsubscribe = subscribeDocumentsChanged(refresh)
    return () => {
      cancelled = true
      unsubscribe()
    }
  }, [records.length, views.length])

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
  const ownersWithPageView = new Set(
    nonEmbedViews.filter(v => v.placement === 'page').map(v => v.ownerId),
  )
  // Primary launch cards: show 'page' views, falling back to 'tab' views only if an extension has no 'page' view.
  const pageViews = nonEmbedViews.filter(
    v => v.placement === 'page' || !ownersWithPageView.has(v.ownerId),
  )
  const courseViews = pageViews.filter(v => kindById.get(v.ownerId) === 'course')
  const extensionViews = pageViews.filter(v => kindById.get(v.ownerId) !== 'course')
  const embedViews = views.filter(v => v.placement === 'embed')
  const nameById = new Map(records.map(r => [r.id, r.manifest.name]))

  const filteredDocuments = useMemo(() => {
    const q = docQuery.trim().toLowerCase()
    if (!q) return documents
    return documents.filter(doc => {
      const owner = nameById.get(doc.createdByExtensionId) ?? doc.createdByExtensionId
      return `${doc.title} ${doc.type} ${owner}`.toLowerCase().includes(q)
    })
  }, [documents, docQuery, records])

  function handleExportDocument(doc: DocumentEnvelope) {
    const blob = new Blob([JSON.stringify(doc, null, 2)], { type: 'application/json' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = exportDocumentFilename(doc)
    a.click()
    window.setTimeout(() => URL.revokeObjectURL(url), 1000)
  }

  async function handleImportFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    e.target.value = ''
    if (!file) return
    try {
      const text = await file.text()
      const parsed = parseImportedDocumentJson(text)
      const created = await documentStore.create(parsed)
      setDocuments(prev => [created, ...prev])
      notifyDocumentsChanged()
      toast.success(`Imported "${created.title}"`)
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Could not import document file.')
    }
  }

  function openDocument(doc: DocumentEnvelope) {
    const ownerViews = nonEmbedViews.filter(v => v.ownerId === doc.createdByExtensionId)
    const matchingView =
      ownerViews.find(v => v.docTypes.includes(doc.type)) ?? ownerViews[0]

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
      notifyDocumentsChanged()
      toast(`Deleted "${doc.title}"`, {
        duration: 6000,
        action: {
          label: 'Undo',
          onClick: () => {
            void documentStore
              .restore(doc)
              .then(() => {
                notifyDocumentsChanged()
                toast.success(`Restored "${doc.title}"`)
              })
              .catch(() => {
                toast.error(`Could not restore "${doc.title}"`)
              })
          },
        },
      })
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
          <input
            ref={importInputRef}
            type="file"
            accept=".json,.syntaxdoc.json,application/json"
            className="sx-sr-only"
            aria-label="Import document backup file"
            onChange={e => void handleImportFile(e)}
          />
          <button
            type="button"
            className="sx-btn-ghost sx-btn-sm"
            onClick={() => importInputRef.current?.click()}
          >
            <Upload size={14} strokeWidth={2} aria-hidden="true" />
            <span>Import doc</span>
          </button>
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
                {courseViews.map(v => {
                  const extName = nameById.get(v.ownerId) ?? v.ownerId
                  return (
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
                      <span className="sx-ext-launch-head">
                        <ExtensionIcon
                          src={iconUrlById.get(v.ownerId)}
                          name={extName}
                          kind="course"
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

          {extensionViews.length > 0 && (
            <section className="sx-plugins-section" aria-label="Extension views">
              <div className="sx-plugins-section-head">
                <h2>Extensions</h2>
                <span>{extensionViews.length}</span>
              </div>
              <div className="sx-ext-card-grid">
                {extensionViews.map(v => {
                  const extName = nameById.get(v.ownerId) ?? v.ownerId
                  return (
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
                      <span className="sx-ext-launch-head">
                        <ExtensionIcon
                          src={iconUrlById.get(v.ownerId)}
                          name={extName}
                          kind="extension"
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

          {documents.length > 0 && (
            <section className="sx-plugins-section" aria-label="Saved documents">
              <div className="sx-plugins-section-head">
                <h2>Documents</h2>
                <span>{filteredDocuments.length === documents.length ? documents.length : `${filteredDocuments.length} / ${documents.length}`}</span>
              </div>
              {documents.length > 1 && (
                <div className="sx-search-field">
                  <Search size={15} className="sx-search-icon" aria-hidden="true" />
                  <input
                    type="search"
                    placeholder="Filter saved documents..."
                    aria-label="Filter saved documents"
                    value={docQuery}
                    onChange={e => setDocQuery(e.target.value)}
                  />
                  {docQuery && (
                    <button
                      type="button"
                      className="sx-search-clear"
                      aria-label="Clear document filter"
                      onClick={() => setDocQuery('')}
                    >
                      <X size={14} aria-hidden="true" />
                    </button>
                  )}
                </div>
              )}
              <div className="sx-ext-doc-list">
                {filteredDocuments.map(doc => (
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
                      aria-label={`Export ${doc.title}`}
                      title={`Export ${doc.title} backup`}
                      onClick={() => handleExportDocument(doc)}
                    >
                      <Download size={14} aria-hidden="true" />
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
