import { useEffect, useState } from 'react'
import { AlertTriangle, ArrowLeft, Download, Play, Puzzle, RefreshCw, Square } from 'lucide-react'
import { toast } from 'sonner'
import { SyntaxErrorBoundary } from '../core/ErrorBoundary.tsx'
import { useContributionStore } from './contributions.ts'
import { documentStore, type DocumentEnvelope } from './documents.ts'
import { ExtensionViewFrame } from './ExtensionViewFrame.tsx'
import { extensionManager } from './manager.ts'
import { useExtensionStore } from './store.ts'

export interface ExtensionPageProps {
  extensionId: string
  viewId: string
  docId?: string | null
  onBackToLibrary: () => void
  onOpenExtensions: () => void
}

function safeDecode(value: string): string {
  try {
    return decodeURIComponent(value)
  } catch {
    return value
  }
}

export function ExtensionPage({
  extensionId: rawExtensionId,
  viewId: rawViewId,
  docId: rawDocId,
  onBackToLibrary,
  onOpenExtensions,
}: ExtensionPageProps) {
  const extensionId = safeDecode(rawExtensionId)
  const viewId = safeDecode(rawViewId)
  const docId = rawDocId ? safeDecode(rawDocId) : null

  const safeMode = useExtensionStore(s => s.safeMode)
  const record = useExtensionStore(s => s.records.find(r => r.id === extensionId))
  const runtime = useExtensionStore(s => s.runtime[extensionId])
  const view = useContributionStore(s =>
    s.views.find(v => v.ownerId === extensionId && v.id === viewId),
  )

  const [doc, setDoc] = useState<DocumentEnvelope | null>(null)
  const [busy, setBusy] = useState(false)

  useEffect(() => {
    let cancelled = false
    if (!docId) {
      setDoc(null)
      return
    }
    void documentStore.get(docId).then(found => {
      if (!cancelled) setDoc(found)
    })
    return () => {
      cancelled = true
    }
  }, [docId, runtime?.status])

  async function handleEnable() {
    setBusy(true)
    try {
      await extensionManager.enable(extensionId)
      toast.success(`Enabled ${record?.manifest.name ?? extensionId}`)
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to enable extension')
    } finally {
      setBusy(false)
    }
  }

  async function handleReload() {
    setBusy(true)
    try {
      await extensionManager.reload(extensionId)
      toast.success(`Reloaded ${record?.manifest.name ?? extensionId}`)
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to reload extension')
    } finally {
      setBusy(false)
    }
  }

  function handleStopWorker() {
    extensionManager.stopWorker(extensionId)
    toast.warning(`Stopped ${record?.manifest.name ?? extensionId} worker`)
  }

  function handleExportDocument() {
    if (!doc) return
    const blob = new Blob([JSON.stringify(doc, null, 2)], { type: 'application/json' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `${doc.title.replace(/[^a-z0-9-_]+/gi, '-').toLowerCase() || doc.id}.syntaxdoc.json`
    a.click()
    window.setTimeout(() => URL.revokeObjectURL(url), 1000)
  }

  const extName = record?.manifest.name ?? extensionId

  if (!view || runtime?.status !== 'active' || !runtime.activationId) {
    return (
      <main className="sx-workspace-page sx-ext-page" aria-label="Extension recovery">
        <div className="sx-ext-page-bar">
          <button type="button" className="sx-btn-ghost sx-btn-sm" onClick={onBackToLibrary}>
            <ArrowLeft size={14} aria-hidden="true" />
            <span>Library</span>
          </button>
          <button type="button" className="sx-btn-secondary sx-btn-sm" onClick={onOpenExtensions}>
            <Puzzle size={14} aria-hidden="true" />
            <span>Extensions</span>
          </button>
        </div>

        <div className="sx-error-card" role="status">
          <div className="sx-error-badge">
            <AlertTriangle size={14} aria-hidden="true" />
            <span>{safeMode ? 'Safe Mode' : runtime?.status ?? 'Not installed'}</span>
          </div>
          <h3>
            {doc
              ? `This document opens with ${extName}`
              : safeMode
                ? 'Extensions are paused in Safe Mode'
                : !record
                  ? `Extension "${extensionId}" is not installed`
                  : !record.enabled
                    ? `${extName} is disabled`
                    : `${extName} is not currently active`}
          </h3>
          <p className="sx-error-summary">
            {doc
              ? `Your document "${doc.title}" (type: ${doc.type}, revision ${doc.revision}) is safely stored in Syntax.`
              : runtime?.lastError?.message ??
                'Enable, reload, or install this extension to open its view.'}
          </p>

          {runtime?.lastError && (
            <pre className="sx-error-message">
              [{runtime.lastError.code}] {runtime.lastError.message}
            </pre>
          )}

          <div className="sx-error-actions">
            {record && !record.enabled && !safeMode && (
              <button
                type="button"
                className="sx-btn-primary"
                disabled={busy}
                onClick={() => void handleEnable()}
              >
                <Play size={14} aria-hidden="true" />
                <span>Enable {extName}</span>
              </button>
            )}
            {record && record.enabled && !safeMode && (
              <button
                type="button"
                className="sx-btn-primary"
                disabled={busy}
                onClick={() => void handleReload()}
              >
                <RefreshCw size={14} aria-hidden="true" />
                <span>Reload {extName}</span>
              </button>
            )}
            <button type="button" className="sx-btn-secondary" onClick={onOpenExtensions}>
              <Puzzle size={14} aria-hidden="true" />
              <span>Open Extensions</span>
            </button>
            {doc && (
              <button type="button" className="sx-btn-ghost" onClick={handleExportDocument}>
                <Download size={14} aria-hidden="true" />
                <span>Export document JSON</span>
              </button>
            )}
          </div>
        </div>
      </main>
    )
  }

  return (
    <main className="sx-workspace-page sx-ext-page" aria-label={`${extName} view`}>
      <div className="sx-ext-page-bar">
        <div className="sx-ext-page-meta">
          <button type="button" className="sx-btn-ghost sx-btn-sm" onClick={onBackToLibrary}>
            <ArrowLeft size={14} aria-hidden="true" />
            <span>Library</span>
          </button>
          <span className="sx-ext-page-title">
            <strong>{view.title}</strong>
            <small>
              {extName}
              {doc ? ` · ${doc.title}` : ''}
            </small>
          </span>
        </div>

        <div className="sx-ext-page-actions">
          {runtime.hasLiveWorker && (
            <button
              type="button"
              className="sx-btn-ghost sx-btn-sm"
              onClick={handleStopWorker}
            >
              <Square size={13} aria-hidden="true" />
              <span>Stop worker</span>
            </button>
          )}
          <button
            type="button"
            className="sx-btn-secondary sx-btn-sm"
            disabled={busy}
            onClick={() => void handleReload()}
          >
            <RefreshCw size={13} aria-hidden="true" />
            <span>Reload</span>
          </button>
          <button type="button" className="sx-btn-ghost sx-btn-sm" onClick={onOpenExtensions}>
            <Puzzle size={13} aria-hidden="true" />
            <span>Extensions</span>
          </button>
        </div>
      </div>

      <SyntaxErrorBoundary
        scope={`extension:${extensionId}:${viewId}`}
        extensionName={extName}
        onDisableExtension={() => void extensionManager.disable(extensionId)}
        onExitScope={onBackToLibrary}
        resetKeys={[extensionId, viewId, runtime.activationId, docId]}
      >
        <ExtensionViewFrame
          extensionId={extensionId}
          extensionName={extName}
          viewId={viewId}
          entryUrl={view.entryUrl}
          activationId={runtime.activationId}
          docId={docId}
          title={view.title}
          placement={view.placement}
          onReloadExtension={() => void handleReload()}
          onOpenExtensions={onOpenExtensions}
        />
      </SyntaxErrorBoundary>
    </main>
  )
}
