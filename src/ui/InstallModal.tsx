import { useEffect } from 'react'
import { PACKAGE_LABEL_BY_KIND, type SyntaxPackageManifest } from '../core/packages'
import { useIsPackageInstalled } from '../core/registry'
import { CoreTouchWarning } from './CoreTouchWarning'
import { PackageIcon } from './PackageIcon'

type InstallModalProps = {
  pkg: SyntaxPackageManifest | null
  signedIn: boolean
  onClose: () => void
  onConfirmInstall: (pkg: SyntaxPackageManifest) => void
}

export function InstallModal({
  pkg,
  signedIn,
  onClose,
  onConfirmInstall,
}: InstallModalProps) {
  const alreadyInstalled = useIsPackageInstalled(pkg?.id ?? '')

  useEffect(() => {
    if (!pkg) return
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose()
    }
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [pkg, onClose])

  if (!pkg) return null

  const requiredDeps = pkg.requires ?? []

  return (
    <div
      className="sx-modal-backdrop"
      role="dialog"
      aria-modal="true"
      aria-labelledby="sx-install-title"
      onClick={e => {
        if (e.target === e.currentTarget) onClose()
      }}
    >
      <div className="sx-modal">
        <div className="sx-modal-head">
          <div className="sx-card-top">
            <PackageIcon svg={pkg.iconSvg} name={pkg.name} size="lg" />
            <div>
              <h2 id="sx-install-title">{pkg.name}</h2>
              <div className="sx-card-author">
                by @{pkg.author.handle} · v{pkg.version} · <code>{pkg.extension}</code>
              </div>
              <div className="sx-pill-row" style={{ marginTop: 6 }}>
                <span className="sx-pill">{PACKAGE_LABEL_BY_KIND[pkg.kind]}</span>
                {pkg.author.official && (
                  <span className="sx-pill sx-pill-official">Official</span>
                )}
              </div>
            </div>
          </div>
          <button type="button" className="sx-btn sx-btn-sm sx-btn-ghost" onClick={onClose}>
            Close
          </button>
        </div>

        <p className="sx-card-tagline">{pkg.description}</p>

        {pkg.touchesCore && <CoreTouchWarning variant="banner" reason={pkg.coreTouchReason} />}

        <div className="sx-scorecard" aria-label="Safety scorecard">
          <div className="sx-score-item">
            <span>Automated Scan</span>
            <strong>
              {pkg.safety.automatedScan === 'passed'
                ? 'Passed'
                : pkg.safety.automatedScan === 'warning'
                  ? 'Review Warning'
                  : 'Unverified'}
            </strong>
          </div>
          <div className="sx-score-item">
            <span>Isolation</span>
            <strong>{pkg.touchesCore ? 'Core Integration' : 'Sandboxed'}</strong>
          </div>
          <div className="sx-score-item">
            <span>Network Access</span>
            <strong>{pkg.safety.networkAccess === 'none' ? 'None' : 'Allowlisted'}</strong>
          </div>
        </div>

        {requiredDeps.length > 0 && (
          <div className="sx-inline-note">
            <strong>Required embedded plugins included automatically:</strong>{' '}
            {requiredDeps.map(d => `${d.name} (.syntaxembeddedplugin)`).join(', ')}.
          </div>
        )}

        {pkg.aiUsage && (
          <div className="sx-ai-card">
            <span className="sx-ai-card-title">AI Usage Card (MCP Discovery)</span>
            <p className="sx-card-tagline">{pkg.aiUsage.summary}</p>
            <div className="sx-pill-row">
              {pkg.aiUsage.blocks.map(b => (
                <span key={b} className="sx-pill sx-pill-ext">
                  {b}
                </span>
              ))}
            </div>
            <pre className="sx-code">{pkg.aiUsage.example}</pre>
          </div>
        )}

        {!signedIn && (
          <div className="sx-inline-note">
            You need to sign in to your Syntax account before installing packages. Clicking{' '}
            <strong>Sign in &amp; Install</strong> will open sign-in and finish this install
            automatically.
          </div>
        )}

        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8 }}>
          <button type="button" className="sx-btn sx-btn-ghost" onClick={onClose}>
            Cancel
          </button>
          <button
            type="button"
            className="sx-btn sx-btn-primary"
            onClick={() => onConfirmInstall(pkg)}
          >
            {alreadyInstalled
              ? 'Reinstall / Update'
              : signedIn
                ? `Install ${PACKAGE_LABEL_BY_KIND[pkg.kind]}`
                : 'Sign in & Install'}
          </button>
        </div>
      </div>
    </div>
  )
}
