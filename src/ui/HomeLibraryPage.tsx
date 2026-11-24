import { getCourseDependencyStatus, useInstalledPackages } from '../core/registry'
import { CoreTouchWarning } from './CoreTouchWarning'
import { PackageIcon } from './PackageIcon'

type HomeLibraryPageProps = {
  onOpenCourse: (courseId: string) => void
  onGoHub: () => void
  onGoPlugins: () => void
}

export function HomeLibraryPage({
  onOpenCourse,
  onGoHub,
  onGoPlugins,
}: HomeLibraryPageProps) {
  const installed = useInstalledPackages()
  const courses = installed.filter(r => r.manifest.kind === 'course')
  const activePlugins = installed.filter(r => r.manifest.kind === 'plugin' && r.enabled)
  const coreTouchCount = activePlugins.filter(r => r.manifest.touchesCore).length

  return (
    <main className="sx-page">
      <div className="sx-page-header">
        <div>
          <h1>Your Syntax Library</h1>
          <p className="sx-page-subtitle">
            Interactive courses you own, powered by clean modular plugins. Everything runs fast,
            locally, and free.
          </p>
        </div>
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
          <button type="button" className="sx-btn sx-btn-sm" onClick={onGoPlugins}>
            Manage Plugins ({activePlugins.length} on)
          </button>
          <button type="button" className="sx-btn sx-btn-sm sx-btn-primary" onClick={onGoHub}>
            Browse Community Hub
          </button>
        </div>
      </div>

      <div className="sx-section-title">
        <span>Installed Courses (.syntaxcourse) · {courses.length}</span>
      </div>

      {courses.length === 0 ? (
        <div className="sx-card">
          <h2 className="sx-card-title">No courses installed yet</h2>
          <p className="sx-card-tagline">
            Head to the Community Hub to install official or community courses.
          </p>
          <div>
            <button type="button" className="sx-btn sx-btn-primary" onClick={onGoHub}>
              Open Community Hub
            </button>
          </div>
        </div>
      ) : (
        <div className="sx-grid">
          {courses.map(({ manifest }) => {
            const depStatus = getCourseDependencyStatus(manifest.id)
            return (
              <article key={manifest.id} className="sx-card">
                <div className="sx-card-top">
                  <PackageIcon svg={manifest.iconSvg} name={manifest.name} />
                  <div className="sx-card-meta">
                    <div className="sx-card-title-row">
                      <h2 className="sx-card-title">{manifest.name}</h2>
                      {manifest.author.official && (
                        <span className="sx-pill sx-pill-official">Official</span>
                      )}
                    </div>
                    <div className="sx-card-author">
                      by @{manifest.author.handle} · v{manifest.version}
                    </div>
                  </div>
                </div>

                <p className="sx-card-tagline">{manifest.tagline}</p>

                <div className="sx-pill-row">
                  <span className="sx-pill sx-pill-ext">{manifest.extension}</span>
                  {(manifest.requires ?? []).map(dep => (
                    <span key={dep.id} className="sx-pill">
                      Uses {dep.name}
                    </span>
                  ))}
                  {!depStatus.ok && (
                    <span className="sx-core-touch-badge">Embedded plugin paused</span>
                  )}
                </div>

                <div className="sx-card-footer">
                  <span className="sx-card-author">
                    {manifest.tags.slice(0, 2).join(' · ')}
                  </span>
                  <button
                    type="button"
                    className="sx-btn sx-btn-sm sx-btn-primary"
                    onClick={() => onOpenCourse(manifest.id)}
                  >
                    {depStatus.ok ? 'Continue Course' : 'Resolve & Open'}
                  </button>
                </div>
              </article>
            )
          })}
        </div>
      )}

      <div className="sx-section-title">
        <span>Active App Plugins ({activePlugins.length})</span>
        <button type="button" className="sx-btn sx-btn-sm sx-btn-ghost" onClick={onGoPlugins}>
          Configure all →
        </button>
      </div>

      {coreTouchCount > 0 && (
        <div style={{ marginBottom: 14 }}>
          <CoreTouchWarning
            variant="badge"
            reason={`${coreTouchCount} active app ${coreTouchCount === 1 ? 'plugin touches' : 'plugins touch'} Syntax core. Manage them anytime in Plugins.`}
          />
        </div>
      )}

      <div className="sx-pill-row">
        {activePlugins.map(({ manifest }) => (
          <span key={manifest.id} className="sx-pill">
            {manifest.name}
            {manifest.touchesCore ? ' · touches core' : ''}
          </span>
        ))}
      </div>
    </main>
  )
}
