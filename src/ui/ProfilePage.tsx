import { useMemo } from 'react'
import { useAccount } from '../core/account'
import { useAuthActions } from '../core/clerkAuth'
import { useInstalledPackages } from '../core/registry'
import { Sema } from '../mpm2d/mascot/Sema'
import type { SyntaxPrefs } from '../mpm2d/storage'
import { MPM2D_TOTAL_LESSONS } from '../packages/courseMeta'
import { assetUrl } from '../mpm2d/assetUrl'
import { PackageIcon } from './PackageIcon'

export interface ProfilePageProps {
  prefs: SyntaxPrefs
  completedLessonCount: number
  masteredCount: number
  coursePct: number
  onOpenCourse: (courseId: string) => void
  onOpenLibrary: () => void
  onOpenPlugins: () => void
  onOpenCommunityHub: () => void
  onOpenSettings: () => void
}

export function ProfilePage({
  prefs,
  completedLessonCount,
  masteredCount,
  coursePct,
  onOpenCourse,
  onOpenLibrary,
  onOpenPlugins,
  onOpenCommunityHub,
  onOpenSettings,
}: ProfilePageProps) {
  const account = useAccount()
  const auth = useAuthActions()
  const records = useInstalledPackages()

  const installedCourses = useMemo(
    () => records.filter(r => r.manifest.kind === 'course' && r.enabled).map(r => r.manifest),
    [records],
  )
  const enabledPluginCount = useMemo(
    () => records.filter(r => r.manifest.kind !== 'course' && r.enabled).length,
    [records],
  )

  const initials = account
    ? account.displayName.trim().slice(0, 1).toUpperCase() || 'S'
    : 'G'

  return (
    <main className="sx-profile-page" aria-label="Profile">
      <section className="sx-profile-hero">
        <div className="sx-profile-identity">
          <div className="sx-profile-avatar-wrap">
            {account?.avatarUrl ? (
              <img
                src={account.avatarUrl}
                alt={account.displayName}
                className="sx-profile-avatar-img"
                width={72}
                height={72}
              />
            ) : (
              <div className="sx-profile-avatar-fallback" aria-hidden="true">
                {initials}
              </div>
            )}
            <div className="sx-profile-sema-chip" title="Your Sema companion">
              <Sema
                state="idle"
                shape={prefs.semaShape}
                tail={prefs.semaTail}
                expression={prefs.semaExpression}
                size={28}
                followCursor={false}
                ariaLabel="Sema companion preview"
              />
            </div>
          </div>

          <div className="sx-profile-titles">
            <h1>{account ? account.displayName : 'Guest learner'}</h1>
            <p className="sx-profile-handle">
              {account ? `@${account.handle}` : 'Sign in to sync your account and install community packages'}
              {account?.email ? ` · ${account.email}` : ''}
            </p>
          </div>
        </div>

        <div className="sx-profile-hero-actions">
          {account ? (
            <>
              <button
                type="button"
                className="sx-btn-secondary"
                onClick={() => auth.openAccount()}
              >
                Manage account
              </button>
              <button
                type="button"
                className="sx-btn-secondary"
                onClick={() => void auth.signOut()}
              >
                Sign out
              </button>
            </>
          ) : (
            <button
              type="button"
              className="sx-btn-primary"
              onClick={() => auth.openSignIn()}
            >
              Sign in
            </button>
          )}
        </div>
      </section>

      <section className="sx-profile-stats" aria-label="Progress summary">
        <div className="sx-profile-stat">
          <span className="sx-profile-stat-value">
            {completedLessonCount}/{MPM2D_TOTAL_LESSONS}
          </span>
          <span className="sx-profile-stat-label">Lessons completed</span>
        </div>
        <div className="sx-profile-stat">
          <span className="sx-profile-stat-value">{masteredCount}</span>
          <span className="sx-profile-stat-label">Lessons mastered</span>
        </div>
        <div className="sx-profile-stat">
          <span className="sx-profile-stat-value">{coursePct}%</span>
          <span className="sx-profile-stat-label">Analytic Geometry</span>
        </div>
        <div className="sx-profile-stat">
          <span className="sx-profile-stat-value">{installedCourses.length}</span>
          <span className="sx-profile-stat-label">
            Installed {installedCourses.length === 1 ? 'course' : 'courses'}
          </span>
        </div>
      </section>

      <section className="sx-profile-section" aria-label="Your courses">
        <div className="sx-profile-section-head">
          <h2>Your courses</h2>
          <button type="button" className="sx-btn-secondary sx-btn-sm" onClick={onOpenLibrary}>
            Open Library
          </button>
        </div>

        <div className="preference-rows">
          {installedCourses.map(course => {
            const isMpm2d = course.id === 'mpm2d-analytic-geometry'
            const isTic = course.id === 'thinking-in-code'
            const pct = isMpm2d ? coursePct : 0
            return (
              <div key={course.id} className="preference-row sx-profile-course-row">
                <div className="sx-profile-course-main">
                  {isMpm2d ? (
                    <img
                      src={assetUrl('/assets/courses/Coordinate_Geometry-bgclJY.png')}
                      alt=""
                      width={40}
                      height={40}
                      className="sx-profile-course-art"
                    />
                  ) : isTic ? (
                    <img
                      src={assetUrl('/assets/courses/thinking-in-code-DolooX.png')}
                      alt=""
                      width={40}
                      height={40}
                      className="sx-profile-course-art"
                    />
                  ) : (
                    <PackageIcon id={course.id} kind="course" svg={course.iconSvg} size={40} />
                  )}
                  <div className="sx-profile-course-info">
                    <strong>{isMpm2d ? 'Analytic Geometry' : course.name}</strong>
                    <div className="sx-profile-bar-wrap">
                      <div className="sx-profile-bar-track" aria-hidden="true">
                        <div className="sx-profile-bar-fill" style={{ width: `${pct}%` }} />
                      </div>
                      <span>{isMpm2d ? `${pct}%` : 'Ready'}</span>
                    </div>
                  </div>
                </div>
                <button
                  type="button"
                  className="sx-btn-secondary sx-btn-sm"
                  onClick={() => onOpenCourse(course.id)}
                >
                  Open
                </button>
              </div>
            )
          })}
        </div>
      </section>

      <section className="sx-profile-section" aria-label="Workspace">
        <div className="sx-profile-section-head">
          <h2>Workspace</h2>
        </div>
        <div className="preference-rows">
          <div className="preference-row">
            <div className="syntax-pref-copy">
              <p>Active plugins</p>
              <span>{enabledPluginCount} enabled on this device</span>
            </div>
            <button type="button" className="sx-btn-secondary sx-btn-sm" onClick={onOpenPlugins}>
              Plugins
            </button>
          </div>
          <div className="preference-row">
            <div className="syntax-pref-copy">
              <p>Community Hub</p>
              <span>Browse courses, app plugins, and embedded tools</span>
            </div>
            <button type="button" className="sx-btn-secondary sx-btn-sm" onClick={onOpenCommunityHub}>
              Browse
            </button>
          </div>
          <div className="preference-row">
            <div className="syntax-pref-copy">
              <p>Preferences &amp; Sema</p>
              <span>Theme, navigation, Pen Studio, and companion style</span>
            </div>
            <button type="button" className="sx-btn-secondary sx-btn-sm" onClick={onOpenSettings}>
              Settings
            </button>
          </div>
        </div>
      </section>
    </main>
  )
}
