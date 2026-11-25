import { useEffect, useState } from 'react'
import type { SyntaxPackageManifest } from '../core/packages'
import { useAccount } from '../core/account'
import { useInstalledPackages, useRegistryStore } from '../core/registry'
import { PluginSandboxFrame } from '../core/sandbox'
import { PackageIcon } from './PackageIcon'
import { CoreTouchWarning } from './CoreTouchWarning'

interface InstallModalProps {
  manifest: SyntaxPackageManifest | null
  allKnownPackages: SyntaxPackageManifest[]
  theme: 'light' | 'dark'
  source?: 'official' | 'community' | 'local-file'
  onClose: () => void
  onRequireSignIn: (pending: SyntaxPackageManifest) => void
  onInstalled?: (manifest: SyntaxPackageManifest) => void
  onOpenCourse?: (courseId: string) => void
}

export function InstallModal({
  manifest,
  allKnownPackages,
  theme,
  source = 'community',
  onClose,
  onRequireSignIn,
  onInstalled,
  onOpenCourse,
}: InstallModalProps) {
  const account = useAccount()
  const records = useInstalledPackages()
  const installPackage = useRegistryStore(s => s.installPackage)
  const uninstallPackage = useRegistryStore(s => s.uninstallPackage)
  const setPackageEnabled = useRegistryStore(s => s.setPackageEnabled)
  const [showSandbox, setShowSandbox] = useState(false)
  const [installError, setInstallError] = useState('')

  useEffect(() => {
    setShowSandbox(false)
    setInstallError('')
  }, [manifest?.id])

  useEffect(() => {
    if (!manifest) return
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && !e.defaultPrevented) {
        e.preventDefault()
        onClose()
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [manifest, onClose])

  if (!manifest) return null

  const entry = records.find(r => r.manifest.id === manifest.id)
  const isInstalled = Boolean(entry)
  const isEnabled = Boolean(entry?.enabled)
  const requires = manifest.requires ?? []

  function handleAdd() {
    if (!manifest) return
    setInstallError('')
    if (!account) {
      onRequireSignIn(manifest)
      return
    }
    const res = installPackage(manifest, {
      source,
      catalogPool: allKnownPackages,
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
    onClose()
  }

  return (
    <div
      className="sx-modal-backdrop"
      role="dialog"
      aria-modal="true"
      aria-label={manifest.name}
      onClick={e => {
        if (e.target === e.currentTarget) onClose()
      }}
    >
      <div className="sx-modal">
        <div className="sx-modal-head">
          <div className="sx-modal-identity">
            <PackageIcon svg={manifest.iconSvg} size={46} />
            <div className="sx-modal-titles">
              <h2>{manifest.name}</h2>
              <span className="sx-modal-meta">
                @{manifest.author.handle} · v{manifest.version}
              </span>
            </div>
          </div>
          <button type="button" className="sx-icon-close" onClick={onClose} aria-label="Close">
            ✕
          </button>
        </div>

        <p className="sx-modal-copy">{manifest.description}</p>

        {manifest.touchesCore && <CoreTouchWarning reason={manifest.coreTouchReason} />}

        {manifest.kind === 'embedded-plugin' && (
          <div className="sx-account-status-row">
            <span>Embedded plugin</span>
            <span className={`sx-status-pill${isInstalled ? ' is-ok' : ''}`}>
              {isInstalled ? 'Installed on your account' : 'Not installed yet'}
            </span>
          </div>
        )}

        {requires.length > 0 && (
          <div className="sx-dep-list">
            <span className="sx-dep-heading">Required embedded plugins</span>
            {requires.map(dep => {
              const depInstalled = records.some(r => r.manifest.id === dep.id)
              return (
                <div key={dep.id} className="sx-dep-item">
                  <span>{dep.name}</span>
                  <span className={`sx-status-pill${depInstalled ? ' is-ok' : ''}`}>
                    {depInstalled ? 'Installed on your account' : 'Will install automatically'}
                  </span>
                </div>
              )
            })}
          </div>
        )}

        {manifest.aiUsage && (
          <details className="sx-disclosure">
            <summary>AI usage (MCP)</summary>
            <div className="sx-disclosure-body">
              <p>{manifest.aiUsage.summary}</p>
              <pre>{manifest.aiUsage.example}</pre>
            </div>
          </details>
        )}

        {isInstalled && isEnabled && manifest.sandboxHtml && (
          <div className="sx-sandbox-section">
            <button
              type="button"
              className="sx-btn-ghost"
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
              />
            )}
          </div>
        )}

        {installError && <p className="sx-field-error">{installError}</p>}

        <div className="sx-modal-actions">
          {isInstalled && !manifest.builtIn && (
            <button
              type="button"
              className="sx-btn-danger-ghost"
              onClick={() => {
                uninstallPackage(manifest.id)
                onClose()
              }}
            >
              Remove
            </button>
          )}
          <div className="sx-modal-actions-right">
            {isInstalled ? (
              manifest.kind === 'course' && onOpenCourse ? (
                <button
                  type="button"
                  className="sx-btn-primary"
                  onClick={() => {
                    onOpenCourse(manifest.id)
                    onClose()
                  }}
                >
                  Open course
                </button>
              ) : (
                <button
                  type="button"
                  className="sx-btn-primary"
                  onClick={() => {
                    setPackageEnabled(manifest.id, !isEnabled)
                    onClose()
                  }}
                >
                  {isEnabled ? 'Disable' : 'Enable'}
                </button>
              )
            ) : (
              <button type="button" className="sx-btn-primary" onClick={handleAdd}>
                {account ? 'Add to Syntax' : 'Sign in to add'}
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
