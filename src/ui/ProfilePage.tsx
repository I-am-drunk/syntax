import { useEffect, useMemo, useState } from 'react'
import { Cloud, CloudOff, KeyRound, RefreshCw, ShieldCheck } from 'lucide-react'
import { useAccount } from '../core/account'
import { useAuthActions } from '../core/clerkAuth'
import { useCloudSyncStore } from '../core/clerkSync'
import { useInstalledPackages } from '../core/registry'
import { Sema } from '../mpm2d/mascot/Sema'
import type { SyntaxPrefs } from '../mpm2d/storage'
import type {
  Mpm2dProgressSummary,
  ThinkingInCodeProgressSummary,
} from '../packages/courseMeta'
import { assetUrl } from '../mpm2d/assetUrl'
import { PackageIcon } from './PackageIcon'

export interface ProfilePageProps {
  prefs: SyntaxPrefs
  mpm2dSummary: Mpm2dProgressSummary
  csSummary: ThinkingInCodeProgressSummary
  onOpenCourse: (courseId: string) => void
  onOpenLibrary: () => void
  onOpenPlugins: () => void
  onOpenCommunityHub: () => void
  onOpenSettings: () => void
}

function formatSyncTime(iso: string | null): string {
  if (!iso) return 'Not synced yet'
  try {
    return `Last synced ${new Date(iso).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' })}`
  } catch {
    return 'Synced'
  }
}

export function ProfilePage({
  prefs,
  mpm2dSummary,
  csSummary,
  onOpenCourse,
  onOpenLibrary,
  onOpenPlugins,
  onOpenCommunityHub,
  onOpenSettings,
}: ProfilePageProps) {
  const account = useAccount()
  const auth = useAuthActions()
  const cloudSync = useCloudSyncStore()
  const records = useInstalledPackages()
  const [avatarFailed, setAvatarFailed] = useState(false)

  useEffect(() => {
    setAvatarFailed(false)
  }, [account?.avatarUrl])

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

  const totalCompleted = mpm2dSummary.completedCount + csSummary.completedCount
  const totalLessons = mpm2dSummary.totalLessons + csSummary.totalLessons
  const overallPct = totalLessons > 0 ? Math.round((totalCompleted / totalLessons) * 100) : 0
  const isClerkUser = Boolean(account && account.provider === 'clerk' && auth.isClerkActive)

  return (
    <main className="sx-profile-page" aria-label="Profile">
      <section className="sx-profile-hero">
        <div className="sx-profile-identity">
          <div className="sx-profile-avatar-wrap">
            {account?.avatarUrl && !avatarFailed ? (
              <img
                src={account.avatarUrl}
                alt={account.displayName}
                className="sx-profile-avatar-img"
                width={72}
                height={72}
                onError={() => setAvatarFailed(true)}
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
              {account
                ? `@${account.handle}`
                : 'Sign in with Passkey, Google, GitHub, or Apple to cloud-sync your progress'}
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
            {totalCompleted}/{totalLessons}
          </span>
          <span className="sx-profile-stat-label">Lessons completed</span>
        </div>
        <div className="sx-profile-stat">
          <span className="sx-profile-stat-value">{mpm2dSummary.masteredCount}</span>
          <span className="sx-profile-stat-label">Lessons mastered</span>
        </div>
        <div className="sx-profile-stat">
          <span className="sx-profile-stat-value">{overallPct}%</span>
          <span className="sx-profile-stat-label">Overall progress</span>
        </div>
        <div className="sx-profile-stat">
          <span className="sx-profile-stat-value">{installedCourses.length}</span>
          <span className="sx-profile-stat-label">
            Installed {installedCourses.length === 1 ? 'course' : 'courses'}
          </span>
        </div>
      </section>

      <section className="sx-profile-section" aria-label="Cloud Sync and Security">
        <div className="sx-profile-section-head">
          <h2>Account &amp; Cloud Sync</h2>
        </div>
        <div className="preference-rows">
          <div className="preference-row">
            <div className="syntax-pref-copy">
              <p className="sx-inline-icon-label">
                {isClerkUser && cloudSync.status !== 'error' ? (
                  <Cloud size={15} aria-hidden="true" />
                ) : (
                  <CloudOff size={15} aria-hidden="true" />
                )}
                <span>
                  {isClerkUser
                    ? cloudSync.status === 'syncing'
                      ? 'Syncing to your Clerk account...'
                      : cloudSync.status === 'error'
                        ? 'Cloud sync paused (changes saved locally)'
                        : 'Clerk Cloud Sync active'
                    : 'Local device storage'}
                </span>
              </p>
              <span>
                {isClerkUser
                  ? `${formatSyncTime(cloudSync.lastSyncedAt)} · Syncs MPM2D & CS progress, Sema style, theme pack, and workspace settings across devices`
                  : 'Sign in to automatically back up and merge your progress across devices'}
              </span>
            </div>
            {isClerkUser ? (
              <button
                type="button"
                className="sx-btn-secondary sx-btn-sm"
                disabled={cloudSync.status === 'syncing'}
                onClick={() => void auth.syncNow()}
              >
                <RefreshCw
                  size={13}
                  className={cloudSync.status === 'syncing' ? 'sx-spin' : undefined}
                  aria-hidden="true"
                />
                <span>Sync now</span>
              </button>
            ) : (
              <button
                type="button"
                className="sx-btn-primary sx-btn-sm"
                onClick={() => auth.openSignIn()}
              >
                Sign in
              </button>
            )}
          </div>

          {isClerkUser && (
            <div className="preference-row">
              <div className="syntax-pref-copy">
                <p className="sx-inline-icon-label">
                  {auth.security.passkeyCount > 0 || auth.security.twoFactorEnabled ? (
                    <ShieldCheck size={15} aria-hidden="true" />
                  ) : (
                    <KeyRound size={15} aria-hidden="true" />
                  )}
                  <span>Sign-in &amp; Security</span>
                </p>
                <span>
                  {auth.security.passkeyCount > 0
                    ? `${auth.security.passkeyCount} ${auth.security.passkeyCount === 1 ? 'Passkey' : 'Passkeys'}`
                    : 'No passkey yet'}
                  {' · '}
                  {auth.security.twoFactorEnabled ? '2FA enabled' : '2FA optional'}
                  {auth.security.connectedProviders.length > 0
                    ? ` · Connected: ${auth.security.connectedProviders.join(', ')}`
                    : ''}
                </span>
              </div>
              <button
                type="button"
                className="sx-btn-secondary sx-btn-sm"
                onClick={() => auth.openSecurity()}
              >
                Passkeys &amp; 2FA
              </button>
            </div>
          )}
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
            const pct = isMpm2d ? mpm2dSummary.percent : isTic ? csSummary.percent : 0
            const progressLabel = isMpm2d || isTic ? `${pct}%` : 'Ready'
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
                      <span>{progressLabel}</span>
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
            <button
              type="button"
              className="sx-btn-secondary sx-btn-sm"
              onClick={onOpenCommunityHub}
            >
              Browse
            </button>
          </div>
          <div className="preference-row">
            <div className="syntax-pref-copy">
              <p>Preferences, Themes &amp; Sema</p>
              <span>Color themes, core workspace tools, Pen Studio, and companion style</span>
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
