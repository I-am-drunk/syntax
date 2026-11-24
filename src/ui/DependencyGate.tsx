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
  const hasDisabled = status.disabled.length > 0

  return (
    <main className="sx-page">
      <div className="sx-card" style={{ maxWidth: 640, margin: '28px auto', padding: 26 }}>
        <div className="sx-card-top">
          <PackageIcon svg={course.iconSvg} name={course.name} size="lg" />
          <div>
            <h1 style={{ margin: 0, fontSize: 22 }}>Required embedded plugin needed</h1>
            <p className="sx-page-subtitle" style={{ marginTop: 6, fontSize: 14 }}>
              <strong>{course.name}</strong> depends on the following{' '}
              <code>.syntaxembeddedplugin</code>{' '}
              {status.missing.length + status.disabled.length === 1 ? 'library' : 'libraries'} to
              render its interactive lessons.
            </p>
          </div>
        </div>

        {hasDisabled && (
          <div className="sx-inline-note">
            <strong>Currently turned off:</strong>{' '}
            {status.disabled.map(d => `${d.name} (${d.extension})`).join(', ')}.
          </div>
        )}

        {hasMissing && (
          <div className="sx-inline-note">
            <strong>Not installed yet:</strong>{' '}
            {status.missing.map(d => `${d.name} (v${d.minVersion}+)`).join(', ')}.
          </div>
        )}

        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 10, justifyContent: 'flex-end' }}>
          <button type="button" className="sx-btn sx-btn-ghost" onClick={onBack}>
            Back to Library
          </button>
          {hasMissing ? (
            <button type="button" className="sx-btn sx-btn-primary" onClick={onInstallMissing}>
              {signedIn ? 'Install & Open Course' : 'Sign in, Install & Open Course'}
            </button>
          ) : (
            <button type="button" className="sx-btn sx-btn-primary" onClick={onEnableAll}>
              Turn On &amp; Open Course
            </button>
          )}
        </div>
      </div>
    </main>
  )
}
