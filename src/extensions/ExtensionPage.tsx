import { useEffect, useMemo, useState } from 'react'
import {
  AlertTriangle,
  ArrowLeft,
  Download,
  Maximize2,
  Minimize2,
  Play,
  Puzzle,
  RefreshCw,
  Square,
} from 'lucide-react'
import { toast } from 'sonner'
import { SyntaxErrorBoundary } from '../core/ErrorBoundary.tsx'
import { useContributionStore } from './contributions.ts'
import {
  documentStore,
  exportDocumentFilename,
  subscribeDocumentsChanged,
  type DocumentEnvelope,
} from './documents.ts'
import { ExtensionViewFrame } from './ExtensionViewFrame.tsx'
import { extensionManager } from './manager.ts'
import { resolveExtensionAssets } from './manifest.ts'
import { useExtensionStore } from './store.ts'
import { ExtensionIcon } from '../ui/ExtensionIcon'

export interface ExtensionPageProps {
  extensionId: string
  viewId: string
  docId?: string | null
  onBackToLibrary: () => void
  onOpenExtensions: () => void
  onNavigate: (path: string) => void
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
  onNavigate,
}: ExtensionPageProps) {
  const extensionId = safeDecode(rawExtensionId)
  const viewId = safeDecode(rawViewId)
  const docId = rawDocId ? safeDecode(rawDocId) : null

  const safeMode = useExtensionStore(s => s.safeMode)
  const record = useExtensionStore(s => s.records.find(r => r.id === extensionId))
  const runtime = useExtensionStore(s => s.runtime[extensionId])
  const allViews = useContributionStore(s => s.views)
  const siblingViews = useMemo(
    () => allViews.filter(v => v.ownerId === extensionId && v.placement !== 'embed'),
    [allViews, extensionId],
  )
  const view = useMemo(
    () => allViews.find(v => v.ownerId === extensionId && v.id === viewId),
    [allViews, extensionId, viewId],
  )

  const [doc, setDoc] = useState<DocumentEnvelope | null>(null)
  const [busy, setBusy] = useState(false)
  const [focused, setFocused] = useState(false)

  useEffect(() => {
    if (!focused) return
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setFocused(false)
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [focused])

  useEffect(() => {
    let cancelled = false
    if (!docId) {
      setDoc(null)
      return
    }
    const loadDoc = () => {
      void documentStore.get(docId).then(found => {
        if (!cancelled) setDoc(found)
      })
    }
    loadDoc()
    const unsubscribe = subscribeDocumentsChanged(loadDoc)
    return () => {
      cancelled = true
      unsubscribe()
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
    a.download = exportDocumentFilename(doc)
    a.click()
    window.setTimeout(() => URL.revokeObjectURL(url), 1000)
  }

  const extName = record?.manifest.name ?? extensionId
  const extIconUrl = useMemo(() => {
    if (!record) return null
    try {
      return resolveExtensionAssets(record.manifestUrl, record.manifest).iconUrl
    } catch {
      return null
    }
  }, [record])

  if (!view || runtime?.status !== 'active' || !runtime.activationId) {
    const missingViewOnActive = Boolean(!view && runtime?.status === 'active' && runtime.activationId)
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
            <span>
              {safeMode
                ? 'Safe Mode'
                : missingViewOnActive
                  ? 'View not found'
                  : (runtime?.status ?? 'Not installed')}
            </span>
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
                    : missingViewOnActive
                      ? `View "${viewId}" was not found in ${extName}`
                      : `${extName} is not currently active`}
          </h3>
          <p className="sx-error-summary">
            {doc
              ? `Your document "${doc.title}" (type: ${doc.type}, revision ${doc.revision}) is safely stored in Syntax.`
              : missingViewOnActive
                ? `${extName} is active, but it does not declare a view with id "${viewId}".`
                : (runtime?.lastError?.message ??
                  'Enable, reload, or install this extension to open its view.')}
          </p>

          {runtime?.lastError && !missingViewOnActive && (
            <pre className="sx-error-message">
              [{runtime.lastError.code}] {runtime.lastError.message}
            </pre>
          )}

          <div className="sx-error-actions">
            {missingViewOnActive && siblingViews[0] && (
              <button
                type="button"
                className="sx-btn-primary"
                onClick={() =>
                  onNavigate(
                    docId
                      ? `/ext/${encodeURIComponent(extensionId)}/${encodeURIComponent(siblingViews[0]!.id)}/${encodeURIComponent(docId)}`
                      : `/ext/${encodeURIComponent(extensionId)}/${encodeURIComponent(siblingViews[0]!.id)}`,
                  )
                }
              >
                <span>Open {siblingViews[0].title}</span>
              </button>
            )}
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
    <main
      className={`sx-workspace-page sx-ext-page${focused ? ' is-focused' : ''}`}
      aria-label={`${extName} view`}
    >
      <div className="sx-ext-page-bar">
        <div className="sx-ext-page-meta">
          <button type="button" className="sx-btn-ghost sx-btn-sm" onClick={onBackToLibrary}>
            <ArrowLeft size={14} aria-hidden="true" />
            <span>Library</span>
          </button>
          <ExtensionIcon
            src={extIconUrl}
            name={extName}
            kind={record?.manifest.kind ?? 'extension'}
            size={28}
          />
          <span className="sx-ext-page-title">
            <strong>{view.title}</strong>
            <small>
              {extName}
              {doc ? ` · ${doc.title}` : ''}
            </small>
          </span>
        </div>

        <div className="sx-ext-page-actions">
          {doc && (
            <button
              type="button"
              className="sx-btn-ghost sx-btn-sm"
              title="Export document backup (.syntaxdoc.json)"
              onClick={handleExportDocument}
            >
              <Download size={13} aria-hidden="true" />
              <span>Export</span>
            </button>
          )}
          <button
            type="button"
            className="sx-btn-ghost sx-btn-sm"
            aria-pressed={focused}
            title={focused ? 'Exit focus view (Esc)' : 'Expand to full screen'}
            onClick={() => setFocused(v => !v)}
          >
            {focused ? (
              <Minimize2 size={13} aria-hidden="true" />
            ) : (
              <Maximize2 size={13} aria-hidden="true" />
            )}
            <span>{focused ? 'Exit focus' : 'Focus'}</span>
          </button>
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

      {siblingViews.length > 1 && (
        <div className="sx-ext-view-tabs" role="tablist" aria-label={`${extName} views`}>
          {siblingViews.map(tab => {
            const active = tab.id === view.id
            const tabPath = docId
              ? `/ext/${encodeURIComponent(extensionId)}/${encodeURIComponent(tab.id)}/${encodeURIComponent(docId)}`
              : `/ext/${encodeURIComponent(extensionId)}/${encodeURIComponent(tab.id)}`
            return (
              <button
                key={tab.key}
                type="button"
                role="tab"
                aria-selected={active}
                className={`sx-ext-view-tab${active ? ' is-active' : ''}`}
                data-extension-tab-id={tab.id}
                onClick={() => onNavigate(tabPath)}
              >
                {tab.title}
              </button>
            )
          })}
        </div>
      )}

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
