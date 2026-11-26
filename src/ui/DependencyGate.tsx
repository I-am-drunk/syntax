import { AlertTriangle, XCircle } from 'lucide-react'
import type { CompatibilityReport } from '../core/compatibility'
import type { SyntaxPackageManifest } from '../core/packages'
import { PackageIcon } from './PackageIcon'

type DependencyGateProps = {
  course: SyntaxPackageManifest
  report: CompatibilityReport
  signedIn: boolean
  onEnableAll: () => void
  onInstallMissing: () => void
  onOpenAnyway?: () => void
  onBack: () => void
}

export function DependencyGate({
  course,
  report,
  signedIn,
  onEnableAll,
  onInstallMissing,
  onOpenAnyway,
  onBack,
}: DependencyGateProps) {
  const isBlocked = report.verdict === 'incompatible'
  const isWarningOnly = report.verdict === 'warning'
  const hasInstallPlan = report.installPlan.length > 0
  const hasEnablePlan = report.enablePlan.length > 0

  const heading = isBlocked
    ? 'Compatibility issue'
    : isWarningOnly
      ? 'Compatibility warning'
      : 'Required engine needed'

  return (
    <main className="sx-dep-gate">
      <div className="sx-modal-identity">
        <PackageIcon id={course.id} kind={course.kind} svg={course.iconSvg} size={46} />
        <div className="sx-modal-titles">
          <h2>{heading}</h2>
          <span className="sx-modal-meta">{course.name}</span>
        </div>
      </div>

      <div className="sx-dep-list">
        {report.enablePlan.map(d => (
          <div key={`en:${d.id}`} className="sx-dep-item">
            <span>{d.name}</span>
            <span className="sx-status-pill">Disabled</span>
          </div>
        ))}
        {report.installPlan.map(d => (
          <div key={`in:${d.id}`} className="sx-dep-item">
            <span>
              {d.name} (v{d.version})
            </span>
            <span className="sx-status-pill">Will install</span>
          </div>
        ))}
        {report.issues.map((issue, idx) => (
          <div
            key={`${issue.code}:${issue.targetId}:${idx}`}
            className={`sx-compat-issue is-${issue.severity}`}
          >
            {issue.severity === 'error' ? (
              <XCircle size={15} aria-hidden="true" />
            ) : (
              <AlertTriangle size={15} aria-hidden="true" />
            )}
            <span>{issue.message}</span>
          </div>
        ))}
      </div>

      <div className="sx-modal-actions">
        <button type="button" className="sx-btn-ghost" onClick={onBack}>
          Back
        </button>

        {isBlocked ? null : isWarningOnly && onOpenAnyway ? (
          <button type="button" className="sx-btn-primary" onClick={onOpenAnyway}>
            Open anyway
          </button>
        ) : hasInstallPlan ? (
          <button type="button" className="sx-btn-primary" onClick={onInstallMissing}>
            {signedIn ? 'Install & Open' : 'Sign in & Install'}
          </button>
        ) : hasEnablePlan ? (
          <button type="button" className="sx-btn-primary" onClick={onEnableAll}>
            Enable &amp; Open
          </button>
        ) : null}
      </div>
    </main>
  )
}
