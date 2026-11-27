import { useEffect, useState } from 'react'
import {
  Cloud,
  CloudOff,
  Compass,
  KeyRound,
  Library,
  Puzzle,
  RefreshCw,
  Settings,
  ShieldCheck,
} from 'lucide-react'
import { useAccount } from '../core/account'
import { useAuthActions } from '../core/clerkAuth'
import { useCloudSyncStore } from '../core/clerkSync'
import type { SyntaxPrefs } from '../core/prefs'
import { Sema } from '../mascot/Sema'

export interface ProfilePageProps {
  prefs: SyntaxPrefs
  onOpenLibrary: () => void
  onOpenExtensions: () => void
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
  onOpenLibrary,
  onOpenExtensions,
  onOpenCommunityHub,
  onOpenSettings,
}: ProfilePageProps) {
  const account = useAccount()
  const auth = useAuthActions()
  const cloudSync = useCloudSyncStore()
  const [avatarFailed, setAvatarFailed] = useState(false)

  useEffect(() => {
    setAvatarFailed(false)
  }, [account?.avatarUrl])

  const initials = account
    ? account.displayName.trim().slice(0, 1).toUpperCase() || 'S'
    : 'G'

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
                size={22}
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
                : 'Sign in with Passkey, Google, or Apple to cloud-sync your preferences'}
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
                  ? `${formatSyncTime(cloudSync.lastSyncedAt)} · Syncs your theme, sound, Sema style, installed extensions, and extension settings across devices`
                  : 'Sign in to sync your preferences and installed extensions across devices'}
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
                className="sx-btn-secondary sx-btn-sm"
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

      <section className="sx-profile-section" aria-label="Workspace">
        <div className="sx-profile-section-head">
          <h2>Workspace</h2>
        </div>
        <div className="preference-rows">
          <div className="preference-row">
            <div className="syntax-pref-copy">
              <p>Library</p>
              <span>Browse extension views and saved documents</span>
            </div>
            <button type="button" className="sx-btn-secondary sx-btn-sm" onClick={onOpenLibrary}>
              <Library size={14} aria-hidden="true" />
              <span>Library</span>
            </button>
          </div>
          <div className="preference-row">
            <div className="syntax-pref-copy">
              <p>Extensions</p>
              <span>Manage installed standalone and embedded Syntax extensions</span>
            </div>
            <button type="button" className="sx-btn-secondary sx-btn-sm" onClick={onOpenExtensions}>
              <Puzzle size={14} aria-hidden="true" />
              <span>Extensions</span>
            </button>
          </div>
          <div className="preference-row">
            <div className="syntax-pref-copy">
              <p>Community Hub</p>
              <span>Explore community extensions</span>
            </div>
            <button
              type="button"
              className="sx-btn-secondary sx-btn-sm"
              onClick={onOpenCommunityHub}
            >
              <Compass size={14} aria-hidden="true" />
              <span>Browse</span>
            </button>
          </div>
          <div className="preference-row">
            <div className="syntax-pref-copy">
              <p>Preferences &amp; Sema</p>
              <span>Light or dark mode, audio cues, and Sema companion style</span>
            </div>
            <button type="button" className="sx-btn-secondary sx-btn-sm" onClick={onOpenSettings}>
              <Settings size={14} aria-hidden="true" />
              <span>Settings</span>
            </button>
          </div>
        </div>
      </section>
    </main>
  )
}
