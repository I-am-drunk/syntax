import { useEffect, useMemo, useState } from 'react'
import { Dialog } from '@base-ui/react/dialog'
import {
  AlertTriangle,
  Archive,
  Check,
  CheckCircle2,
  Copy,
  Download,
  FileCode2,
  Shield,
  X,
  XCircle,
} from 'lucide-react'
import { toast } from 'sonner'
import { useAccount } from '../core/account'
import {
  exportSytxArchive,
  formatBytes,
  upgradeV1ManifestToSytx,
  type UnpackedSytx,
} from '../core/archive'
import { evaluateCompatibility } from '../core/compatibility'
import {
  PERMISSION_LABELS,
  SYNTAX_HOST_VERSION,
  getCompatibility,
  getEffectivePermissions,
  type SyntaxPackageManifest,
} from '../core/packages'
import { getVaultArchive } from '../core/packageVault'
import { useInstalledPackages, useRegistryStore } from '../core/registry'
import { PluginSandboxFrame } from '../core/sandbox'
import { PackageIcon } from './PackageIcon'

interface InstallModalProps {
  manifest: SyntaxPackageManifest | null
  archive?: UnpackedSytx | null
  allKnownPackages: SyntaxPackageManifest[]
  theme: 'light' | 'dark'
  source?: 'official' | 'community' | 'local-file'
  onClose: () => void
  onRequireSignIn: (pending: SyntaxPackageManifest) => void
  onInstalled?: (manifest: SyntaxPackageManifest) => void
  onOpenCourse?: (courseId: string) => void
}

export function InstallModal({
  manifest: propManifest,
  archive: propArchive = null,
  allKnownPackages,
  theme,
  source = 'community',
  onClose,
  onRequireSignIn,
  onInstalled,
  onOpenCourse,
}: InstallModalProps) {
  const manifest = propArchive?.manifest ?? propManifest
  const account = useAccount()
  const records = useInstalledPackages()
  const installPackage = useRegistryStore(s => s.installPackage)
  const uninstallPackage = useRegistryStore(s => s.uninstallPackage)
  const setPackageEnabled = useRegistryStore(s => s.setPackageEnabled)

  const [showSandbox, setShowSandbox] = useState(false)
  const [installError, setInstallError] = useState('')
  const [inspectedArchive, setInspectedArchive] = useState<UnpackedSytx | null>(propArchive)
  const [copiedSha, setCopiedSha] = useState(false)

  useEffect(() => {
    setShowSandbox(false)
    setInstallError('')
    setCopiedSha(false)
    setInspectedArchive(propArchive)

    if (!propArchive && propManifest) {
      let cancelled = false
      void (async () => {
        const fromVault = await getVaultArchive(propManifest.id)
        if (!cancelled && fromVault) {
          setInspectedArchive({
            manifest: propManifest,
            entries: fromVault.entries,
            files: {},
            rawBytes: fromVault.rawBytes,
            sha256: fromVault.sha256,
            sizeBytes: fromVault.sizeBytes,
            upgradedFromV1: propManifest.schemaVersion === 1,
          })
          return
        }
        const synthesized = await upgradeV1ManifestToSytx(propManifest)
        if (!cancelled) setInspectedArchive(synthesized)
      })()
      return () => {
        cancelled = true
      }
    }
  }, [propManifest, propArchive])

  const entry = manifest ? records.find(r => r.manifest.id === manifest.id) : undefined
  const isInstalled = Boolean(entry)
  const isEnabled = Boolean(entry?.enabled)

  const report = useMemo(() => {
    if (!manifest) return null
    const others = records.filter(r => r.manifest.id !== manifest.id)
    return evaluateCompatibility(manifest, others, allKnownPackages)
  }, [manifest, records, allKnownPackages])

  const compat = useMemo(() => (manifest ? getCompatibility(manifest) : null), [manifest])
  const permissions = useMemo(() => (manifest ? getEffectivePermissions(manifest) : []), [manifest])

  const canInstallLocallyWithoutAuth = source === 'local-file'
  const needsAuth = !account && !canInstallLocallyWithoutAuth

  const hasBlockers = report?.verdict === 'incompatible'
  const hasWarnings = Boolean(report?.issues.some(i => i.severity === 'warning'))
  const hasDepActions = Boolean(
    report && (report.installPlan.length > 0 || report.enablePlan.length > 0),
  )

  function handleAddOrRepair() {
    if (!manifest) return
    setInstallError('')
    if (needsAuth) {
      onRequireSignIn(manifest)
      return
    }
    const res = installPackage(manifest, {
      source,
      catalogPool: allKnownPackages,
      archive: inspectedArchive ?? undefined,
    })
    if (!res.ok) {
      if (res.needsSignIn) {
        onRequireSignIn(manifest)
        return
      }
      setInstallError(res.error)
      return
    }
    onInstalled?.(manifest)
    if (manifest.kind === 'course' && onOpenCourse) {
      onOpenCourse(manifest.id)
    }
    onClose()
  }

  async function handleCopySha(sha: string) {
    try {
      await navigator.clipboard.writeText(sha)
      setCopiedSha(true)
      window.setTimeout(() => setCopiedSha(false), 1500)
    } catch {
      toast.error('Could not copy SHA-256')
    }
  }

  return (
    <Dialog.Root
      open={Boolean(manifest)}
      onOpenChange={nextOpen => {
        if (!nextOpen) onClose()
      }}
    >
      <Dialog.Portal>
        <Dialog.Backdrop className="sx-modal-backdrop" />
        {manifest && report && compat && (
          <Dialog.Popup className="sx-modal sx-dialog-popup sx-inspector-modal">
            <div className="sx-modal-head">
              <div className="sx-modal-identity">
                <PackageIcon
                  id={manifest.id}
                  kind={manifest.kind}
                  svg={manifest.iconSvg}
                  size={48}
                />
                <div className="sx-modal-titles">
                  <Dialog.Title className="sx-dialog-title">{manifest.name}</Dialog.Title>
                  <span className="sx-modal-meta">
                    @{manifest.author.handle} &middot; v{manifest.version} &middot;{' '}
                    <code>.sytx</code>
                    {inspectedArchive ? ` (${formatBytes(inspectedArchive.sizeBytes)})` : ''}
                  </span>
                </div>
              </div>
              <Dialog.Close className="sx-icon-close" aria-label="Close">
                <X size={18} aria-hidden="true" />
              </Dialog.Close>
            </div>

            <Dialog.Description className="sx-modal-copy">
              {manifest.description}
            </Dialog.Description>

            {/* Pre-Flight Compatibility Verdict Banner */}
            <div
              className={`sx-verdict-banner is-${
                hasBlockers ? 'error' : hasWarnings ? 'warning' : 'ready'
              }`}
              role="status"
            >
              {hasBlockers ? (
                <XCircle size={16} aria-hidden="true" />
              ) : hasWarnings ? (
                <AlertTriangle size={16} aria-hidden="true" />
              ) : (
                <CheckCircle2 size={16} aria-hidden="true" />
              )}
              <div>
                <strong>
                  {hasBlockers
                    ? 'Cannot install yet'
                    : hasWarnings
                      ? 'Review before installing'
                      : 'Ready to install'}
                </strong>
                <span>
                  {hasBlockers
                    ? 'Resolve the compatibility blocker below before installing.'
                    : hasWarnings
                      ? 'Compatible with Syntax, with one or more warnings to review.'
                      : `Compatible with Syntax v${SYNTAX_HOST_VERSION}${
                          inspectedArchive?.upgradedFromV1 ? ' (upgraded from legacy JSON)' : ''
                        }.`}
                </span>
              </div>
            </div>

            {/* Compatibility Matrix: Host + Dependencies + Issues */}
            <div className="sx-compat-card">
              <div className="sx-compat-row">
                <span>Syntax host</span>
                <span className="sx-compat-val">
                  <code>{compat.depends.syntax ?? `^${SYNTAX_HOST_VERSION}`}</code>
                  <span className="sx-compat-host-now">running v{SYNTAX_HOST_VERSION}</span>
                </span>
              </div>

              {report.installPlan.map(dep => (
                <div key={`inst:${dep.id}`} className="sx-compat-row">
                  <span>Requires {dep.name}</span>
                  <span className="sx-hub-inline-state">Will auto-install v{dep.version}</span>
                </div>
              ))}

              {report.enablePlan.map(dep => (
                <div key={`en:${dep.id}`} className="sx-compat-row">
                  <span>Requires {dep.name}</span>
                  <span className="sx-hub-inline-state">Disabled (will enable)</span>
                </div>
              ))}

              {report.issues.map((issue, idx) => {
                const canDisableTarget =
                  (issue.code === 'breaks-installed' ||
                    issue.code === 'broken-by-installed' ||
                    issue.code === 'conflict') &&
                  records.some(
                    r =>
                      r.enabled &&
                      (r.manifest.id === issue.targetId || r.manifest.id === issue.sourceId) &&
                      r.manifest.id !== manifest.id,
                  )
                const disableId =
                  issue.code === 'broken-by-installed' ? issue.sourceId : issue.targetId
                return (
                  <div
                    key={`${issue.code}:${issue.targetId}:${idx}`}
                    className={`sx-compat-issue is-${issue.severity}`}
                  >
                    <span>{issue.message}</span>
                    {canDisableTarget && (
                      <button
                        type="button"
                        className="sx-btn-secondary sx-btn-xs"
                        onClick={() => {
                          setPackageEnabled(disableId, false)
                          toast.message(`Disabled ${issue.targetName ?? disableId}`)
                        }}
                      >
                        Disable {issue.targetName ?? disableId}
                      </button>
                    )}
                  </div>
                )
              })}
            </div>

            {/* Plain-English Permissions */}
            <div className="sx-perm-card">
              <div className="sx-perm-head">
                <Shield size={14} aria-hidden="true" />
                <span>Permissions</span>
              </div>
              {permissions.length === 0 ? (
                <p className="sx-perm-empty">
                  Sandboxed package with no extra host permissions.
                </p>
              ) : (
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
              )}
              {manifest.touchesCore && manifest.coreTouchReason && (
                <p className="sx-perm-core-note">{manifest.coreTouchReason}</p>
              )}
            </div>

            {/* Collapsible Archive File Tree & SHA-256 */}
            {inspectedArchive && (
              <details className="sx-disclosure">
                <summary>
                  <Archive size={14} aria-hidden="true" /> Inside this .sytx archive (
                  {inspectedArchive.entries.length}{' '}
                  {inspectedArchive.entries.length === 1 ? 'file' : 'files'})
                </summary>
                <div className="sx-disclosure-body">
                  <div className="sx-archive-tree">
                    {inspectedArchive.entries.map(item => (
                      <div key={item.path} className="sx-archive-entry">
                        <span className="sx-archive-path">
                          <FileCode2 size={13} aria-hidden="true" />
                          <code>{item.path}</code>
                        </span>
                        <span className="sx-archive-size">{formatBytes(item.sizeBytes)}</span>
                      </div>
                    ))}
                  </div>
                  <div className="sx-archive-sha">
                    <span>
                      SHA-256 <code>{inspectedArchive.sha256.slice(0, 16)}&hellip;</code>
                    </span>
                    <button
                      type="button"
                      className="sx-btn-ghost sx-btn-xs"
                      onClick={() => void handleCopySha(inspectedArchive.sha256)}
                    >
                      {copiedSha ? (
                        <Check size={12} aria-hidden="true" />
                      ) : (
                        <Copy size={12} aria-hidden="true" />
                      )}
                      <span>{copiedSha ? 'Copied' : 'Copy'}</span>
                    </button>
                  </div>
                </div>
              </details>
            )}

            {isInstalled && isEnabled && manifest.sandboxHtml && (
              <div className="sx-sandbox-section">
                <button
                  type="button"
                  className="sx-btn-secondary"
                  onClick={() => setShowSandbox(v => !v)}
                >
                  {showSandbox ? 'Hide preview' : 'Open preview'}
                </button>
                {showSandbox && (
                  <PluginSandboxFrame
                    key={manifest.id}
                    pluginId={manifest.id}
                    title={manifest.name}
                    html={manifest.sandboxHtml}
                    theme={theme}
                    permissions={permissions}
                    networkAccess={manifest.safety.networkAccess}
                    onDisablePlugin={() => setPackageEnabled(manifest.id, false)}
                  />
                )}
              </div>
            )}

            {installError && <p className="sx-field-error">{installError}</p>}

            <div className="sx-modal-actions">
              <div className="sx-modal-actions-left">
                {isInstalled && !manifest.builtIn && (
                  <button
                    type="button"
                    className="sx-btn-danger"
                    onClick={() => {
                      uninstallPackage(manifest.id)
                      toast.success(`Removed ${manifest.name}`)
                      onClose()
                    }}
                  >
                    Remove
                  </button>
                )}
                <button
                  type="button"
                  className="sx-btn-ghost sx-btn-sm"
                  onClick={() => exportSytxArchive(manifest, inspectedArchive?.rawBytes)}
                >
                  <Download size={14} aria-hidden="true" />
                  <span>Export .sytx</span>
                </button>
              </div>
              <div className="sx-modal-actions-right">
                {isInstalled && !hasDepActions && source !== 'local-file' ? (
                  manifest.kind === 'course' && onOpenCourse ? (
                    <button
                      type="button"
                      className="sx-btn-primary"
                      disabled={hasBlockers}
                      onClick={() => {
                        if (!isEnabled) {
                          const res = setPackageEnabled(manifest.id, true)
                          if (!res.ok) {
                            setInstallError(res.error)
                            return
                          }
                        }
                        onOpenCourse(manifest.id)
                        onClose()
                      }}
                    >
                      {isEnabled ? 'Open course' : 'Enable & open'}
                    </button>
                  ) : (
                    <button
                      type="button"
                      className={isEnabled ? 'sx-btn-secondary' : 'sx-btn-primary'}
                      disabled={!isEnabled && hasBlockers}
                      onClick={() => {
                        const res = setPackageEnabled(manifest.id, !isEnabled)
                        if (!res.ok) {
                          setInstallError(res.error)
                          return
                        }
                        onClose()
                      }}
                    >
                      {isEnabled ? 'Disable' : 'Enable'}
                    </button>
                  )
                ) : (
                  <button
                    type="button"
                    className="sx-btn-primary"
                    disabled={hasBlockers}
                    onClick={handleAddOrRepair}
                  >
                    {needsAuth
                      ? 'Sign in to add'
                      : isInstalled && source === 'local-file'
                        ? `Update to v${manifest.version}`
                        : hasDepActions
                          ? 'Install with dependencies'
                          : 'Install .sytx'}
                  </button>
                )}
              </div>
            </div>
          </Dialog.Popup>
        )}
      </Dialog.Portal>
    </Dialog.Root>
  )
}
