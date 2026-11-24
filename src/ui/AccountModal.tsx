import { useEffect, useState, type FormEvent } from 'react'
import { isFirebaseConfigured, useAccountStore } from '../core/account'

type AccountModalProps = {
  open: boolean
  reason?: string
  onClose: () => void
  onSignedIn?: () => void
}

export function AccountModal({ open, reason, onClose, onSignedIn }: AccountModalProps) {
  const signInWithOAuth = useAccountStore(s => s.signInWithOAuth)
  const signInWithEmail = useAccountStore(s => s.signInWithEmail)
  const signInPreview = useAccountStore(s => s.signInPreview)
  const busy = useAccountStore(s => s.busy)

  const [emailMode, setEmailMode] = useState<'signin' | 'signup'>('signin')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [displayName, setDisplayName] = useState('')
  const [handle, setHandle] = useState('')
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (!open) {
      setPassword('')
      setError(null)
      return
    }
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose()
    }
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [open, onClose])

  if (!open) return null

  async function handleOAuth(provider: 'google' | 'github') {
    setError(null)
    const res = await signInWithOAuth(provider)
    if (!res.ok) {
      setError(res.error)
      return
    }
    onSignedIn?.()
    onClose()
  }

  async function handleEmailSubmit(e: FormEvent) {
    e.preventDefault()
    setError(null)
    const res = await signInWithEmail(email, password, emailMode, displayName)
    if (!res.ok) {
      setError(res.error)
      return
    }
    setPassword('')
    onSignedIn?.()
    onClose()
  }

  function handlePreviewSubmit(e: FormEvent) {
    e.preventDefault()
    setError(null)
    const res = signInPreview(handle, displayName || handle)
    if (!res.ok) {
      setError(res.error)
      return
    }
    onSignedIn?.()
    onClose()
  }

  return (
    <div
      className="sx-modal-backdrop"
      role="dialog"
      aria-modal="true"
      aria-labelledby="sx-signin-title"
      onClick={e => {
        if (e.target === e.currentTarget) onClose()
      }}
    >
      <div className="sx-modal">
        <div className="sx-modal-head">
          <div>
            <h2 id="sx-signin-title">Sign in to Syntax</h2>
            <p className="sx-page-subtitle" style={{ marginTop: 4, fontSize: 13.5 }}>
              {reason ||
                'Sign in to install courses and plugins, save your library, and connect your AI.'}
            </p>
          </div>
          <button type="button" className="sx-btn sx-btn-sm sx-btn-ghost" onClick={onClose}>
            Close
          </button>
        </div>

        {isFirebaseConfigured ? (
          <>
            <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
              <button
                type="button"
                className="sx-btn sx-btn-primary"
                style={{ flex: 1 }}
                disabled={busy}
                onClick={() => void handleOAuth('github')}
              >
                Continue with GitHub
              </button>
              <button
                type="button"
                className="sx-btn"
                style={{ flex: 1 }}
                disabled={busy}
                onClick={() => void handleOAuth('google')}
              >
                Continue with Google
              </button>
            </div>

            <div className="sx-inline-note" style={{ textAlign: 'center', padding: '7px 10px' }}>
              Or {emailMode === 'signin' ? 'sign in' : 'create an account'} with email
            </div>

            <form
              onSubmit={handleEmailSubmit}
              style={{ display: 'flex', flexDirection: 'column', gap: 12 }}
            >
              {emailMode === 'signup' && (
                <div className="sx-field">
                  <label htmlFor="sx-auth-name">Display name</label>
                  <input
                    id="sx-auth-name"
                    className="sx-input"
                    value={displayName}
                    onChange={e => setDisplayName(e.target.value)}
                    placeholder="Alex"
                    required
                  />
                </div>
              )}
              <div className="sx-field">
                <label htmlFor="sx-auth-email">Email</label>
                <input
                  id="sx-auth-email"
                  type="email"
                  className="sx-input"
                  value={email}
                  onChange={e => setEmail(e.target.value)}
                  placeholder="you@example.com"
                  required
                />
              </div>
              <div className="sx-field">
                <label htmlFor="sx-auth-password">Password</label>
                <input
                  id="sx-auth-password"
                  type="password"
                  className="sx-input"
                  value={password}
                  onChange={e => setPassword(e.target.value)}
                  placeholder="At least 6 characters"
                  minLength={6}
                  required
                />
              </div>
              {error && <div className="sx-error-badge">{error}</div>}
              <div
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  gap: 10,
                }}
              >
                <button
                  type="button"
                  className="sx-btn sx-btn-sm sx-btn-ghost"
                  onClick={() => {
                    setError(null)
                    setEmailMode(m => (m === 'signin' ? 'signup' : 'signin'))
                  }}
                >
                  {emailMode === 'signin' ? 'Need an account?' : 'Have an account?'}
                </button>
                <button type="submit" className="sx-btn sx-btn-primary" disabled={busy}>
                  {busy ? 'Working...' : emailMode === 'signin' ? 'Sign in' : 'Create account'}
                </button>
              </div>
            </form>
          </>
        ) : (
          <>
            <div className="sx-inline-note">
              <strong>Firebase Auth Ready:</strong> Add your free Firebase web config in{' '}
              <code>VITE_FIREBASE_*</code> repository variables to enable Google, GitHub, and Email
              cloud sign-in. Until then, you can sign in locally below to install and test packages.
            </div>
            <form
              onSubmit={handlePreviewSubmit}
              style={{ display: 'flex', flexDirection: 'column', gap: 12 }}
            >
              <div className="sx-field">
                <label htmlFor="sx-preview-handle">Handle</label>
                <input
                  id="sx-preview-handle"
                  className="sx-input"
                  value={handle}
                  onChange={e => setHandle(e.target.value)}
                  placeholder="yourname"
                  required
                  autoFocus
                />
              </div>
              <div className="sx-field">
                <label htmlFor="sx-preview-name">Display name</label>
                <input
                  id="sx-preview-name"
                  className="sx-input"
                  value={displayName}
                  onChange={e => setDisplayName(e.target.value)}
                  placeholder="Alex"
                  required
                />
              </div>
              {error && <div className="sx-error-badge">{error}</div>}
              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8 }}>
                <button type="button" className="sx-btn sx-btn-ghost" onClick={onClose}>
                  Cancel
                </button>
                <button type="submit" className="sx-btn sx-btn-primary">
                  Sign in &amp; continue
                </button>
              </div>
            </form>
          </>
        )}
      </div>
    </div>
  )
}
