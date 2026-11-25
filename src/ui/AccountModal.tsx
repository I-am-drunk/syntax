import { useEffect, useState } from 'react'
import { sanitizeHandle, useAccountStore } from '../core/account'

interface AccountModalProps {
  open: boolean
  reason?: string
  onClose: () => void
  onSignedIn?: () => void
}

export function AccountModal({ open, reason, onClose, onSignedIn }: AccountModalProps) {
  const [handle, setHandle] = useState('')
  const [displayName, setDisplayName] = useState('')
  const [error, setError] = useState('')
  const signInLocal = useAccountStore(s => s.signInLocal)

  useEffect(() => {
    if (!open) {
      setError('')
      return
    }
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && !e.defaultPrevented) {
        e.preventDefault()
        onClose()
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [open, onClose])

  if (!open) return null

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

  return (
    <div
      className="sx-modal-backdrop"
      role="dialog"
      aria-modal="true"
      aria-label="Sign in to Syntax"
      onClick={e => {
        if (e.target === e.currentTarget) onClose()
      }}
    >
      <div className="sx-modal sx-modal-compact">
        <div className="sx-modal-head">
          <h2>Sign in</h2>
          <button type="button" className="sx-icon-close" onClick={onClose} aria-label="Close">
            ✕
          </button>
        </div>

        {reason && <p className="sx-modal-copy">{reason}</p>}

        <form className="sx-form" onSubmit={submit}>
          <label className="sx-field">
            <span>Name</span>
            <input
              type="text"
              value={displayName}
              onChange={e => {
                setDisplayName(e.target.value)
                if (!handle) setHandle(sanitizeHandle(e.target.value))
              }}
              placeholder="Tjae"
              autoFocus
            />
          </label>
          <label className="sx-field">
            <span>Handle</span>
            <input
              type="text"
              value={handle}
              onChange={e => setHandle(sanitizeHandle(e.target.value))}
              placeholder="tjae"
              required
            />
          </label>

          {error && <p className="sx-field-error">{error}</p>}

          <div className="sx-modal-actions">
            <button type="button" className="sx-btn-ghost" onClick={onClose}>
              Cancel
            </button>
            <button type="submit" className="sx-btn-primary">
              Continue
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
