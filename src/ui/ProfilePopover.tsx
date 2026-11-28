import { useEffect, useRef, useState } from 'react'
import { Menu } from '@base-ui/react/menu'
import {
  Check,
  LogOut,
  RefreshCw,
  Settings,
  ShieldCheck,
  User,
  UserCog,
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
  const isClerkAccount = auth.isClerkActive && account.provider === 'clerk'

  function handleManageAccount() {
    window.clearTimeout(manageTimerRef.current)
    manageTimerRef.current = window.setTimeout(() => {
      auth.openAccount()
    }, 40)
  }

  const syncDotClass = !isClerkAccount
    ? 'is-local'
    : cloudStatus === 'synced'
      ? 'is-synced'
      : cloudStatus === 'syncing'
        ? 'is-syncing'
        : cloudStatus === 'error'
          ? 'is-error'
          : 'is-local'

  const syncLabel = !isClerkAccount
    ? 'Local storage'
    : cloudStatus === 'syncing'
      ? 'Syncing...'
      : cloudStatus === 'synced'
        ? 'Cloud synced'
        : cloudStatus === 'error'
          ? 'Sync paused'
          : 'Cloud ready'

  return (
    <Menu.Root open={open} onOpenChange={setOpen}>
      <Menu.Trigger
        className="sx-avatar-trigger"
        aria-label={`Account menu for ${account.displayName}`}
        title={account.displayName}
      >
        {showAvatarImg ? (
          <img
            src={account.avatarUrl}
            alt={account.displayName}
            width={32}
            height={32}
            className="sx-avatar-img"
            onError={() => setImgFailed(true)}
          />
        ) : (
          <span className="sx-avatar-monogram" aria-hidden="true">
            {initials}
          </span>
        )}
      </Menu.Trigger>

      <Menu.Portal>
        <Menu.Positioner
          sideOffset={8}
          align="end"
          collisionPadding={10}
          className="sx-popover-positioner"
        >
          <Menu.Popup className="sx-profile-popover" aria-label="Account menu">
            <div className="sx-profile-pop-header">
              {showAvatarImg ? (
                <img
                  src={account.avatarUrl}
                  alt=""
                  width={36}
                  height={36}
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
                <span>{account.email || `@${account.handle}`}</span>
                <span className="sx-profile-pop-sync-inline">
                  <span className={`sx-sync-dot ${syncDotClass}`} aria-hidden="true" />
                  <span>{syncLabel}</span>
                </span>
              </div>
              {isClerkAccount && (
                <button
                  type="button"
                  className="sx-profile-pop-sync-icon"
                  disabled={cloudStatus === 'syncing'}
                  aria-label="Sync now"
                  title="Sync now"
                  onClick={e => {
                    e.stopPropagation()
                    void auth.syncNow()
                  }}
                >
                  <RefreshCw
                    size={13}
                    className={cloudStatus === 'syncing' ? 'sx-spin' : undefined}
                    aria-hidden="true"
                  />
                </button>
              )}
            </div>

            {otherSessions.length > 0 && (
              <>
                <Menu.Separator className="sx-menu-sep" />
                <Menu.Group className="sx-menu-group">
                  <div className="sx-menu-section-label">Switch account</div>
                  {otherSessions.map(sess => (
                    <Menu.Item
                      key={sess.id}
                      className="sx-menu-item"
                      onClick={() => void auth.switchSession(sess.id)}
                    >
                      <span className="sx-mini-avatar" aria-hidden="true">
                        {sess.displayName.slice(0, 1).toUpperCase()}
                      </span>
                      <span className="sx-switch-copy">
                        <span>{sess.displayName}</span>
                        <small>@{sess.handle}</small>
                      </span>
                      {sess.isCurrent && <Check size={14} aria-hidden="true" />}
                    </Menu.Item>
                  ))}
                </Menu.Group>
              </>
            )}

            <Menu.Separator className="sx-menu-sep" />

            <Menu.Group className="sx-menu-group">
              <Menu.Item className="sx-menu-item" onClick={() => onNavigate('/profile')}>
                <User size={15} strokeWidth={1.75} className="sx-menu-row-icon" aria-hidden="true" />
                <span className="sx-menu-label">Profile</span>
              </Menu.Item>
              <Menu.Item className="sx-menu-item" onClick={() => onNavigate('/settings')}>
                <Settings size={15} strokeWidth={1.75} className="sx-menu-row-icon" aria-hidden="true" />
                <span className="sx-menu-label">Settings</span>
              </Menu.Item>
              <Menu.Item className="sx-menu-item" onClick={handleManageAccount}>
                {auth.security.passkeyCount > 0 || auth.security.twoFactorEnabled ? (
                  <ShieldCheck size={15} strokeWidth={1.75} className="sx-menu-row-icon" aria-hidden="true" />
                ) : (
                  <UserCog size={15} strokeWidth={1.75} className="sx-menu-row-icon" aria-hidden="true" />
                )}
                <span className="sx-menu-label">Account &amp; security</span>
              </Menu.Item>
            </Menu.Group>

            <Menu.Separator className="sx-menu-sep" />

            <Menu.Group className="sx-menu-group">
              <Menu.Item className="sx-menu-item is-danger" onClick={() => void auth.signOut()}>
                <LogOut size={15} strokeWidth={1.75} className="sx-menu-row-icon" aria-hidden="true" />
                <span className="sx-menu-label">Sign out</span>
              </Menu.Item>
            </Menu.Group>
          </Menu.Popup>
        </Menu.Positioner>
      </Menu.Portal>
    </Menu.Root>
  )
}
