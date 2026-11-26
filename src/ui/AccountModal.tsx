import { useEffect, useState } from 'react'
import { Dialog } from '@base-ui/react/dialog'
import { X } from 'lucide-react'
import { sanitizeHandle, useAccount, useAccountStore } from '../core/account'

interface AccountModalProps {
  open: boolean
  reason?: string
  onClose: () => void
  onSignedIn?: () => void
}

export function AccountModal({ open, reason, onClose, onSignedIn }: AccountModalProps) {
  const existingAccount = useAccount()
  const signInLocal = useAccountStore(s => s.signInLocal)
  const [displayName, setDisplayName] = useState('')
  const [handle, setHandle] = useState('')
  const [handleTouched, setHandleTouched] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => {
    if (open) {
      if (existingAccount?.provider === 'local') {
        setDisplayName(existingAccount.displayName)
        setHandle(existingAccount.handle)
        setHandleTouched(true)
      } else {
        setDisplayName('')
        setHandle('')
        setHandleTouched(false)
      }
      setError('')
    } else {
      setError('')
      setHandleTouched(false)
    }
  }, [open, existingAccount])

  function submit(e: React.FormEvent) {
    e.preventDefault()
    setError('')
    const clean = sanitizeHandle(handle || displayName)
    if (clean.length < 2) {
      setError('Enter at least 2 letters or numbers.')
      return
    }
    try {
      signInLocal(clean, displayName.trim() || clean)
      onSignedIn?.()
      onClose()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not sign in.')
    }
  }

  const isEditing = existingAccount?.provider === 'local'

  return (
    <Dialog.Root
      open={open}
      onOpenChange={nextOpen => {
        if (!nextOpen) onClose()
      }}
    >
      <Dialog.Portal>
        <Dialog.Backdrop className="sx-modal-backdrop" />
        <Dialog.Popup className="sx-modal sx-modal-compact sx-dialog-popup">
          <div className="sx-modal-head">
            <Dialog.Title className="sx-dialog-title">
              {isEditing ? 'Local profile' : 'Sign in'}
            </Dialog.Title>
            <Dialog.Close className="sx-icon-close" aria-label="Close">
              <X size={18} aria-hidden="true" />
            </Dialog.Close>
          </div>

          {reason && <Dialog.Description className="sx-modal-copy">{reason}</Dialog.Description>}

          <form className="sx-form" onSubmit={submit}>
            <label className="sx-field">
              <span>Name</span>
              <input
                type="text"
                value={displayName}
                onChange={e => {
                  const nextName = e.target.value
                  setDisplayName(nextName)
                  if (!handleTouched) {
                    setHandle(sanitizeHandle(nextName))
                  }
                }}
                placeholder="Alex Chen"
                autoFocus
              />
            </label>
            <label className="sx-field">
              <span>Handle</span>
              <input
                type="text"
                value={handle}
                onChange={e => {
                  setHandleTouched(true)
                  setHandle(sanitizeHandle(e.target.value))
                }}
                placeholder="alex"
                required
              />
            </label>

            {error && <p className="sx-field-error">{error}</p>}

            <div className="sx-modal-actions">
              <button type="button" className="sx-btn-ghost" onClick={onClose}>
                Cancel
              </button>
              <button type="submit" className="sx-btn-primary">
                {isEditing ? 'Save' : 'Continue'}
              </button>
            </div>
          </form>
        </Dialog.Popup>
      </Dialog.Portal>
    </Dialog.Root>
  )
}
