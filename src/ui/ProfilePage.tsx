import { useState, type FormEvent } from 'react'
import { toast } from 'sonner'
import { isFirebaseConfigured, useAccountStore } from '../core/account'
import { useInstalledPackages } from '../core/registry'
import { PackageIcon } from './PackageIcon'

type ProfilePageProps = {
  onOpenSignIn: () => void
  onOpenDiagnostics: () => void
  onOpenCourse: (courseId: string) => void
}

export function ProfilePage({
  onOpenSignIn,
  onOpenDiagnostics,
  onOpenCourse,
}: ProfilePageProps) {
  const account = useAccountStore(s => s.account)
  const signOut = useAccountStore(s => s.signOut)
  const updateAccountProfile = useAccountStore(s => s.updateAccountProfile)
  const toggleConnectedAI = useAccountStore(s => s.toggleConnectedAI)
  const installed = useInstalledPackages()

  const [editing, setEditing] = useState(false)
  const [displayName, setDisplayName] = useState('')
  const [handle, setHandle] = useState('')
  const [bio, setBio] = useState('')
  const [formError, setFormError] = useState<string | null>(null)

  const courses = installed.filter(r => r.manifest.kind === 'course')
  const plugins = installed.filter(r => r.manifest.kind !== 'course')

  if (!account) {
    return (
      <main className="sx-page">
        <div className="sx-card" style={{ maxWidth: 520, margin: '36px auto', padding: 28 }}>
          <h1 style={{ margin: 0, fontSize: 24 }}>Your Syntax Profile</h1>
          <p className="sx-card-tagline">
            Sign in to save your installed courses, install community packages from the Hub, and
            connect Claude or ChatGPT via MCP when ready.
          </p>
          <div style={{ display: 'flex', gap: 10, marginTop: 8 }}>
            <button type="button" className="sx-btn sx-btn-primary" onClick={onOpenSignIn}>
              Sign in to Syntax
            </button>
            <button type="button" className="sx-btn sx-btn-ghost" onClick={onOpenDiagnostics}>
              Diagnostics Log
            </button>
          </div>
        </div>
      </main>
    )
  }

  function startEditing() {
    if (!account) return
    setDisplayName(account.displayName)
    setHandle(account.handle)
    setBio(account.bio)
    setFormError(null)
    setEditing(true)
  }

  async function saveProfile(e: FormEvent) {
    e.preventDefault()
    setFormError(null)
    const res = await updateAccountProfile({ displayName, handle, bio })
    if (!res.ok) {
      setFormError(res.error)
      return
    }
    setEditing(false)
    toast.success('Profile updated')
  }

  return (
    <main className="sx-page">
      <div className="sx-card" style={{ padding: 24 }}>
        <div className="sx-card-top" style={{ alignItems: 'center' }}>
          <span className="sx-avatar is-lg" style={{ background: account.avatarColor }}>
            {account.photoURL ? (
              <img src={account.photoURL} alt={account.displayName} />
            ) : (
              account.displayName.slice(0, 1).toUpperCase()
            )}
          </span>
          <div className="sx-card-meta">
            <div className="sx-card-title-row">
              <h1 style={{ margin: 0, fontSize: 24 }}>{account.displayName}</h1>
              <span className="sx-pill">@{account.handle}</span>
              <span className="sx-pill sx-pill-official">
                {account.provider === 'local-preview'
                  ? 'Local Preview'
                  : isFirebaseConfigured
                    ? 'Firebase Auth'
                    : 'Signed In'}
              </span>
            </div>
            <p className="sx-card-tagline" style={{ marginTop: 6 }}>
              {account.bio}
            </p>
          </div>
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
            <button type="button" className="sx-btn sx-btn-sm" onClick={startEditing}>
              Edit profile
            </button>
            <button
              type="button"
              className="sx-btn sx-btn-sm sx-btn-ghost"
              onClick={onOpenDiagnostics}
            >
              Logs
            </button>
            <button
              type="button"
              className="sx-btn sx-btn-sm sx-btn-danger"
              onClick={() => {
                void signOut()
                toast('Signed out')
              }}
            >
              Sign out
            </button>
          </div>
        </div>

        {editing && (
          <form
            onSubmit={saveProfile}
            style={{
              marginTop: 14,
              paddingTop: 16,
              borderTop: '1px solid var(--sx-border)',
              display: 'flex',
              flexDirection: 'column',
              gap: 12,
            }}
          >
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
              <div className="sx-field">
                <label htmlFor="sx-edit-name">Display name</label>
                <input
                  id="sx-edit-name"
                  className="sx-input"
                  value={displayName}
                  onChange={e => setDisplayName(e.target.value)}
                  required
                />
              </div>
              <div className="sx-field">
                <label htmlFor="sx-edit-handle">Handle</label>
                <input
                  id="sx-edit-handle"
                  className="sx-input"
                  value={handle}
                  onChange={e => setHandle(e.target.value)}
                  minLength={2}
                  required
                />
              </div>
            </div>
            <div className="sx-field">
              <label htmlFor="sx-edit-bio">Bio</label>
              <textarea
                id="sx-edit-bio"
                className="sx-textarea"
                value={bio}
                onChange={e => setBio(e.target.value)}
              />
            </div>
            {formError && <div className="sx-error-badge">{formError}</div>}
            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8 }}>
              <button
                type="button"
                className="sx-btn sx-btn-sm sx-btn-ghost"
                onClick={() => setEditing(false)}
              >
                Cancel
              </button>
              <button type="submit" className="sx-btn sx-btn-sm sx-btn-primary">
                Save changes
              </button>
            </div>
          </form>
        )}
      </div>

      {/* Connected AIs & MCP readiness */}
      <div className="sx-section-title">
        <span>Connected AIs &amp; MCP Readiness</span>
      </div>
      <div className="sx-grid">
        {account.connectedAIs.map(ai => (
          <div key={ai.id} className="sx-card">
            <div className="sx-card-top" style={{ alignItems: 'center' }}>
              <div className="sx-card-meta">
                <h2 className="sx-card-title">{ai.name}</h2>
                <div className="sx-card-author">
                  Mode: {ai.mode === 'mcp-connector' ? 'Native MCP Connector' : 'Link Mode'}
                </div>
              </div>
              <button
                type="button"
                role="switch"
                aria-checked={ai.connected}
                aria-label={`Toggle ${ai.name}`}
                className={`sx-switch${ai.connected ? ' is-on' : ''}`}
                onClick={() => {
                  toggleConnectedAI(ai.id)
                  toast(`${ai.name} ${ai.connected ? 'disconnected' : 'marked ready for MCP'}`)
                }}
              />
            </div>
            <p className="sx-card-tagline" style={{ fontSize: 13 }}>
              Allows {ai.name} to discover your installed{' '}
              <code>.syntaxembeddedplugin</code> libraries and build new courses cleanly.
            </p>
          </div>
        ))}
      </div>

      {/* Installed Library */}
      <div className="sx-section-title">
        <span>Installed Courses ({courses.length})</span>
      </div>
      <div className="sx-grid">
        {courses.map(({ manifest }) => (
          <div key={manifest.id} className="sx-card">
            <div className="sx-card-top">
              <PackageIcon svg={manifest.iconSvg} name={manifest.name} size="sm" />
              <div className="sx-card-meta">
                <h2 className="sx-card-title">{manifest.name}</h2>
                <div className="sx-card-author">
                  v{manifest.version} · {manifest.extension}
                </div>
              </div>
              <button
                type="button"
                className="sx-btn sx-btn-sm sx-btn-primary"
                onClick={() => onOpenCourse(manifest.id)}
              >
                Open
              </button>
            </div>
          </div>
        ))}
      </div>

      <div className="sx-section-title">
        <span>Installed Plugins &amp; Libraries ({plugins.length})</span>
      </div>
      <div className="sx-pill-row">
        {plugins.map(({ manifest, enabled }) => (
          <span key={manifest.id} className="sx-pill">
            {manifest.name} ({enabled ? 'On' : 'Off'})
          </span>
        ))}
      </div>
    </main>
  )
}
