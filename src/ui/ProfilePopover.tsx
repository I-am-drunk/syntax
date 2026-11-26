import { useState } from 'react'
import { Popover } from '@base-ui/react/popover'
import {
  Blocks,
  BookOpen,
  Compass,
  LogOut,
  Settings,
  User,
  UserCog,
} from 'lucide-react'
import { useAccount, useSessionStatus } from '../core/account'
import { useAuthActions } from '../core/clerkAuth'

interface ProfilePopoverProps {
  onNavigate: (path: string) => void
}

export function ProfilePopover({ onNavigate }: ProfilePopoverProps) {
  const account = useAccount()
  const sessionStatus = useSessionStatus()
  const auth = useAuthActions()
  const [open, setOpen] = useState(false)
  const [imgFailed, setImgFailed] = useState(false)

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

  function go(path: string) {
    setOpen(false)
    onNavigate(path)
  }

  function handleManageAccount() {
    setOpen(false)
    window.setTimeout(() => {
      auth.openAccount()
    }, 40)
  }

  function handleSignOut() {
    setOpen(false)
    void auth.signOut()
  }

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
              <button type="button" className="sx-profile-pop-item" onClick={() => go('/plugins')}>
                <Blocks size={16} strokeWidth={1.9} aria-hidden="true" />
                <span>Plugins</span>
              </button>
              <button type="button" className="sx-profile-pop-item" onClick={() => go('/community')}>
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
                <UserCog size={16} strokeWidth={1.9} aria-hidden="true" />
                <span>Manage account</span>
              </button>
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
