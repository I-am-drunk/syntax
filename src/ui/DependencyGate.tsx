import type { CourseDependencyStatus } from '../core/registry'
import type { SyntaxPackageManifest } from '../core/packages'
import { PackageIcon } from './PackageIcon'

type DependencyGateProps = {
  course: SyntaxPackageManifest
  status: CourseDependencyStatus
  signedIn: boolean
  onEnableAll: () => void
  onInstallMissing: () => void
  onBack: () => void
}

export function DependencyGate({
  course,
  status,
  signedIn,
  onEnableAll,
  onInstallMissing,
  onBack,
}: DependencyGateProps) {
  const hasMissing = status.missing.length > 0

  return (
    <main className="sx-dep-gate">
      <div className="sx-modal-identity">
        <PackageIcon svg={course.iconSvg} size={46} />
        <div className="sx-modal-titles">
          <h2>Embedded plugin required</h2>
          <span className="sx-modal-meta">{course.name}</span>
        </div>
      </div>

      <div className="sx-dep-list">
        {status.disabled.map(d => (
          <div key={d.id} className="sx-dep-item">
            <span>{d.name}</span>
            <span className="sx-status-pill">Disabled</span>
          </div>
        ))}
        {status.missing.map(d => (
          <div key={d.id} className="sx-dep-item">
            <span>{d.name}</span>
            <span className="sx-status-pill">Not installed</span>
          </div>
        ))}
      </div>

      <div className="sx-modal-actions">
        <button type="button" className="sx-btn-ghost" onClick={onBack}>
          Back
        </button>
        {hasMissing ? (
          <button type="button" className="sx-btn-primary" onClick={onInstallMissing}>
            {signedIn ? 'Install & Open' : 'Sign in & Install'}
          </button>
        ) : (
          <button type="button" className="sx-btn-primary" onClick={onEnableAll}>
            Enable & Open
          </button>
        )}
      </div>
    </main>
  )
}
