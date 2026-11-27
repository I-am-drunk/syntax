import { useEffect, useRef, useState } from 'react'
import { Popover } from '@base-ui/react/popover'
import {
  BookOpen,
  Check,
  Cloud,
  CloudOff,
  Compass,
  LogOut,
  Puzzle,
  RefreshCw,
  Settings,
  ShieldCheck,
  User,
  UserCog,
  UserPlus,
} from 'lucide-react'
import { useAccount, useSessionStatus } from '../core/account'
import { useAuthActions } from '../core/clerkAuth'
import { useCloudSyncStore } from '../core/clerkSync'

interface ProfilePopoverProps {
  onNavigate: (path: string) => void
}

export function ProfilePopover({ onNavigate }: ProfilePopoverProps) {
  const account = useAccount()
  const sessionStatus = useSessionStatus()
  const auth = useAuthActions()
  const cloudStatus = useCloudSyncStore(s => s.status)
  const [open, setOpen] = useState(false)
  const [imgFailed, setImgFailed] = useState(false)
  const manageTimerRef = useRef<number>(0)

  useEffect(() => {
    setImgFailed(false)
  }, [account?.avatarUrl])

  useEffect(() => {
    if (!account) setOpen(false)
  }, [account])

  useEffect(() => {
    return () => window.clearTimeout(manageTimerRef.current)
  }, [])

  if (!account && auth.isClerkActive && sessionStatus === 'hydrating' && !auth.isLoaded) {
    return <span className="sx-header-avatar-skeleton" aria-hidden="true" />
  }

  if (!account) {
    return (
      <button
        type="button"
        className="sx-header-signin"
        onClick={() => auth.openSignIn()}
      >
        Sign in
      </button>
    )
  }

  const initials = account.displayName.trim().slice(0, 1).toUpperCase() || 'S'
  const showAvatarImg = Boolean(account.avatarUrl && !imgFailed)
  const otherSessions = auth.sessions.filter(s => !s.isCurrent)

  function go(path: string) {
    setOpen(false)
    onNavigate(path)
  }

  function handleManageAccount() {
    setOpen(false)
    window.clearTimeout(manageTimerRef.current)
    manageTimerRef.current = window.setTimeout(() => {
      auth.openAccount()
    }, 40)
  }

  function handleAddAccount() {
    setOpen(false)
    window.clearTimeout(manageTimerRef.current)
    manageTimerRef.current = window.setTimeout(() => {
      auth.addAccount()
    }, 40)
  }

  function handleSignOut() {
    setOpen(false)
    void auth.signOut()
  }

  const syncLabel =
    !auth.isClerkActive || account.provider !== 'clerk'
      ? 'Local only'
      : cloudStatus === 'syncing'
        ? 'Syncing...'
        : cloudStatus === 'synced'
          ? 'Cloud synced'
          : cloudStatus === 'error'
            ? 'Sync paused'
            : 'Ready to sync'

  return (
    <Popover.Root open={open} onOpenChange={setOpen}>
      <Popover.Trigger
        type="button"
        className="sx-avatar-trigger"
        aria-label={`Account menu for ${account.displayName}`}
        title={account.displayName}
      >
        {showAvatarImg ? (
          <img
            src={account.avatarUrl}
            alt={account.displayName}
            width={34}
            height={34}
            className="sx-avatar-img"
            onError={() => setImgFailed(true)}
          />
        ) : (
          <span className="sx-avatar-monogram" aria-hidden="true">
            {initials}
          </span>
        )}
      </Popover.Trigger>

      <Popover.Portal>
        <Popover.Positioner sideOffset={12} align="end" className="sx-popover-positioner">
          <Popover.Popup className="sx-profile-popover" aria-label="Account and workspace">
            <div className="sx-profile-pop-head">
              {showAvatarImg ? (
                <img
                  src={account.avatarUrl}
                  alt=""
                  width={40}
                  height={40}
                  className="sx-profile-pop-avatar"
                  onError={() => setImgFailed(true)}
                />
              ) : (
                <div className="sx-profile-pop-avatar is-mono" aria-hidden="true">
                  {initials}
                </div>
              )}
              <div className="sx-profile-pop-id">
                <strong>{account.displayName}</strong>
                <span>@{account.handle}</span>
                {account.email && <small>{account.email}</small>}
              </div>
            </div>

            <div className="sx-cloud-sync-strip">
              <span className={`sx-cloud-pill is-${cloudStatus}`}>
                {cloudStatus === 'local-only' || cloudStatus === 'error' ? (
                  <CloudOff size={13} aria-hidden="true" />
                ) : (
                  <Cloud size={13} aria-hidden="true" />
                )}
                <span>{syncLabel}</span>
              </span>
              {auth.isClerkActive && account.provider === 'clerk' && (
                <button
                  type="button"
                  className="sx-cloud-sync-btn"
                  disabled={cloudStatus === 'syncing'}
                  onClick={() => void auth.syncNow()}
                >
                  <RefreshCw
                    size={12}
                    className={cloudStatus === 'syncing' ? 'sx-spin' : undefined}
                    aria-hidden="true"
                  />
                  <span>Sync</span>
                </button>
              )}
            </div>

            {otherSessions.length > 0 && (
              <>
                <div className="sx-profile-pop-sep" role="separator" />
                <div className="sx-profile-pop-group">
                  <span className="sx-profile-pop-label">Switch account</span>
                  {otherSessions.map(sess => (
                    <button
                      key={sess.id}
                      type="button"
                      className="sx-profile-pop-item"
                      onClick={() => {
                        setOpen(false)
                        void auth.switchSession(sess.id)
                      }}
                    >
                      <span className="sx-mini-avatar" aria-hidden="true">
                        {sess.displayName.slice(0, 1).toUpperCase()}
                      </span>
                      <span className="sx-switch-copy">
                        <span>{sess.displayName}</span>
                        <small>@{sess.handle}</small>
                      </span>
                      {sess.isCurrent && <Check size={14} aria-hidden="true" />}
                    </button>
                  ))}
                </div>
              </>
            )}

            <div className="sx-profile-pop-sep" role="separator" />

            <div className="sx-profile-pop-group">
              <button type="button" className="sx-profile-pop-item" onClick={() => go('/profile')}>
                <User size={16} strokeWidth={1.9} aria-hidden="true" />
                <span>Profile</span>
              </button>
              <button type="button" className="sx-profile-pop-item" onClick={() => go('/library')}>
                <BookOpen size={16} strokeWidth={1.9} aria-hidden="true" />
                <span>Library</span>
              </button>
              <button type="button" className="sx-profile-pop-item" onClick={() => go('/extensions')}>
                <Puzzle size={16} strokeWidth={1.9} aria-hidden="true" />
                <span>Extensions</span>
              </button>
              <button
                type="button"
                className="sx-profile-pop-item"
                onClick={() => go('/community')}
              >
                <Compass size={16} strokeWidth={1.9} aria-hidden="true" />
                <span>Community Hub</span>
              </button>
              <button type="button" className="sx-profile-pop-item" onClick={() => go('/settings')}>
                <Settings size={16} strokeWidth={1.9} aria-hidden="true" />
                <span>Settings</span>
              </button>
            </div>

            <div className="sx-profile-pop-sep" role="separator" />

            <div className="sx-profile-pop-group">
              <button
                type="button"
                className="sx-profile-pop-item"
                onClick={handleManageAccount}
              >
                {auth.security.passkeyCount > 0 || auth.security.twoFactorEnabled ? (
                  <ShieldCheck size={16} strokeWidth={1.9} aria-hidden="true" />
                ) : (
                  <UserCog size={16} strokeWidth={1.9} aria-hidden="true" />
                )}
                <span>Manage account &amp; security</span>
              </button>
              {auth.isClerkActive && (
                <button
                  type="button"
                  className="sx-profile-pop-item"
                  onClick={handleAddAccount}
                >
                  <UserPlus size={16} strokeWidth={1.9} aria-hidden="true" />
                  <span>Add another account</span>
                </button>
              )}
              <button
                type="button"
                className="sx-profile-pop-item is-danger"
                onClick={handleSignOut}
              >
                <LogOut size={16} strokeWidth={1.9} aria-hidden="true" />
                <span>Sign out</span>
              </button>
            </div>
          </Popover.Popup>
        </Popover.Positioner>
      </Popover.Portal>
    </Popover.Root>
  )
}
