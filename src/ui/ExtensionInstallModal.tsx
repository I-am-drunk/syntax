import { Dialog } from '@base-ui/react/dialog'
import { AlertTriangle, Cpu, Globe, Layers, ShieldCheck, Terminal, X } from 'lucide-react'
import type { ExtensionManifest, ResolvedExtensionAssets } from '../extensions/manifest.ts'
import type { ExtensionRecord } from '../extensions/store.ts'
import { ExtensionIcon } from './ExtensionIcon'

export interface ExtensionInstallModalProps {
  open: boolean
  manifest: ExtensionManifest | null
  assets: ResolvedExtensionAssets | null
  existingRecord?: ExtensionRecord | null
  safeMode: boolean
  installing: boolean
  error: string | null
  onCancel: () => void
  onConfirm: () => void
}

export function ExtensionInstallModal({
  open,
  manifest,
  assets,
  existingRecord,
  safeMode,
  installing,
  error,
  onCancel,
  onConfirm,
}: ExtensionInstallModalProps) {
  if (!manifest || !assets) return null

  const isCourse = manifest.kind === 'course'
  const pageViews = manifest.views.filter(v => v.placement !== 'embed')
  const embedViews = manifest.views.filter(v => v.placement === 'embed')
  const requiredServices = Object.entries(manifest.services.requires)
  const optionalServices = Object.entries(manifest.services.optional)
  const providedServices = Object.entries(manifest.services.provides)

  return (
    <Dialog.Root
      open={open}
      onOpenChange={nextOpen => {
        if (!nextOpen && !installing) onCancel()
      }}
    >
      <Dialog.Portal>
        <Dialog.Backdrop className="sx-modal-backdrop" />
        <Dialog.Popup
          className="sx-modal sx-ext-install-modal sx-dialog-popup"
          data-testid="extension-install-modal"
        >
          <div className="sx-modal-head">
            <Dialog.Title className="sx-dialog-title">
              {existingRecord
                ? `Review update for ${manifest.name}`
                : isCourse
                  ? 'Review course before installing'
                  : 'Review extension before installing'}
            </Dialog.Title>
            <Dialog.Close
              className="sx-icon-close"
              aria-label="Close"
              disabled={installing}
            >
              <X size={18} aria-hidden="true" />
            </Dialog.Close>
          </div>

          <div className="sx-install-summary-card">
            <ExtensionIcon
              src={assets.iconUrl}
              name={manifest.name}
              kind={manifest.kind}
              size={44}
            />
            <div className="sx-install-summary-copy">
              <div className="sx-ext-card-title-row">
                <strong>{manifest.name}</strong>
                {isCourse && <span className="sx-ext-status-badge">Course</span>}
                <span className="sx-ext-version-tag">v{manifest.version}</span>
                {existingRecord && (
                  <span className="sx-ext-version-tag">
                    replaces v{existingRecord.manifest.version}
                  </span>
                )}
              </div>
              <p className="sx-ext-meta-line">
                <code>{manifest.id}</code>
                {manifest.author ? ` · ${manifest.author}` : ''}
              </p>
              {manifest.description && (
                <p className="sx-ext-description">{manifest.description}</p>
              )}
            </div>
          </div>

          <div className="sx-install-origin-row" title={assets.manifestUrl}>
            <Globe size={15} aria-hidden="true" />
            <span>
              Hosted by <strong>{assets.origin}</strong>
            </span>
          </div>

          <div className="sx-install-caps">
            <h3>What this adds</h3>
            <ul className="sx-install-cap-list">
              <li>
                <Cpu size={14} aria-hidden="true" />
                <span>
                  {manifest.worker
                    ? 'Runs background code inside an isolated browser worker'
                    : 'Screens only (no background worker code)'}
                </span>
              </li>

              {(pageViews.length > 0 || embedViews.length > 0) && (
                <li>
                  <Layers size={14} aria-hidden="true" />
                  <span>
                    {pageViews.length > 0
                      ? `${pageViews.length} ${pageViews.length === 1 ? 'screen' : 'screens'} (${pageViews.map(v => v.title).join(', ')})`
                      : ''}
                    {pageViews.length > 0 && embedViews.length > 0 ? ' · ' : ''}
                    {embedViews.length > 0
                      ? `${embedViews.length} embedded ${embedViews.length === 1 ? 'widget' : 'widgets'} in Library`
                      : ''}
                  </span>
                </li>
              )}

              {(manifest.toolbar.length > 0 || manifest.commands.length > 0) && (
                <li>
                  <Terminal size={14} aria-hidden="true" />
                  <span>
                    {manifest.toolbar.length > 0
                      ? `${manifest.toolbar.length} top-bar ${manifest.toolbar.length === 1 ? 'button' : 'buttons'}`
                      : ''}
                    {manifest.toolbar.length > 0 && manifest.commands.length > 0 ? ' · ' : ''}
                    {manifest.commands.length > 0
                      ? `${manifest.commands.length} menu ${manifest.commands.length === 1 ? 'command' : 'commands'}`
                      : ''}
                    {manifest.settings.length > 0
                      ? ` · ${manifest.settings.length} configurable ${manifest.settings.length === 1 ? 'setting' : 'settings'}`
                      : ''}
                  </span>
                </li>
              )}

              {(requiredServices.length > 0 ||
                optionalServices.length > 0 ||
                providedServices.length > 0) && (
                <li>
                  <ShieldCheck size={14} aria-hidden="true" />
                  <span>
                    {requiredServices.length > 0
                      ? `Requires: ${requiredServices.map(([name, range]) => `${name} (${range})`).join(', ')}`
                      : ''}
                    {requiredServices.length > 0 &&
                    (optionalServices.length > 0 || providedServices.length > 0)
                      ? ' · '
                      : ''}
                    {optionalServices.length > 0
                      ? `Optional: ${optionalServices.map(([name]) => name).join(', ')}`
                      : ''}
                    {optionalServices.length > 0 && providedServices.length > 0 ? ' · ' : ''}
                    {providedServices.length > 0
                      ? `Shares: ${providedServices.map(([name, ver]) => `${name} v${ver}`).join(', ')}`
                      : ''}
                  </span>
                </li>
              )}
            </ul>
          </div>

          <p className="sx-install-trust-note">
            <ShieldCheck size={14} aria-hidden="true" />
            <span>
              Runs in an isolated sandbox. It cannot read your Syntax account or other extensions&apos;
              saved documents. Only install code from sources you trust.
            </span>
          </p>

          {error && (
            <div className="sx-ext-inline-error" role="alert">
              <AlertTriangle size={14} aria-hidden="true" />
              <span>{error}</span>
            </div>
          )}

          <div className="sx-modal-actions">
            <button
              type="button"
              className="sx-btn-ghost"
              disabled={installing}
              onClick={onCancel}
            >
              Cancel
            </button>
            <button
              type="button"
              className="sx-btn-primary"
              disabled={installing}
              data-testid="confirm-install-extension"
              onClick={onConfirm}
            >
              {installing
                ? 'Installing...'
                : safeMode
                  ? 'Install (Paused in Safe Mode)'
                  : existingRecord
                    ? 'Update & Enable'
                    : 'Install & Enable'}
            </button>
          </div>
        </Dialog.Popup>
      </Dialog.Portal>
    </Dialog.Root>
  )
}
