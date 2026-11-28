import { useState, type FormEvent } from 'react'
import { toast } from 'sonner'
import { SyntaxErrorBoundary } from '../core/ErrorBoundary'
import { isSafeMode } from '../extensions/store.ts'
import {
  getNativeDevHost, nativeDevMode, refreshNativeDevInstalls, useNativeDevStore,
} from '../extensions/native/devHost.ts'
import { hasHostedNativePackages } from '../extensions/native/devPolicy.ts'
import type { NativePackage } from '../extensions/native/package.ts'

const extensionsPath = '/extensions'
const screenPath = (id: string, screen: string) => `/native-extension/${id}/${screen}`

function formatError(error: unknown): string {
  return error instanceof Error ? error.message : String(error)
}

export function NativeDevExtensions({ onNavigate }: { onNavigate: (path: string) => void }) {
  const { installs, phase, error } = useNativeDevStore()
  const [url, setUrl] = useState('')
  const [candidate, setCandidate] = useState<NativePackage>()
  const [pending, setPending] = useState(false)
  const [actionError, setActionError] = useState<string>()
  const [installedName, setInstalledName] = useState<string>()
  const canInstall = nativeDevMode === 'local-dev' || hasHostedNativePackages

  async function perform(action: () => Promise<void>) {
    setPending(true)
    setActionError(undefined)
    try {
      await action()
    } catch (failure) {
      setActionError(formatError(failure))
    } finally {
      setPending(false)
    }
  }

  function inspect(event: FormEvent) {
    event.preventDefault()
    setInstalledName(undefined)
    void perform(async () => setCandidate(await getNativeDevHost().inspect(url.trim())))
  }

  return (
    <section className="sx-plugins-section" aria-label="Native extensions">
      <div className="sx-plugins-section-head"><h2>Native extensions</h2></div>
      {phase === 'loading' && <p role="status">Loading native extensions…</p>}
      {phase === 'failed' && <p role="alert">{error}</p>}
      {phase === 'recovery' && (
        <div>
          <p role="alert">Syntax started with native extensions paused.</p>
          {!isSafeMode() && (
            <button className="sx-btn-secondary" disabled={pending} onClick={() => void perform(async () => {
              await getNativeDevHost().acknowledgeUnknownStartup()
              window.location.reload()
            })}>
              Restart native extensions
            </button>
          )}
        </div>
      )}
      {phase === 'ready' && !canInstall && <p>No native packages are approved for this build.</p>}
      {phase === 'ready' && canInstall && (candidate ? (
        <div>
          <p><strong>{candidate.manifest.name}</strong> {candidate.manifest.version}</p>
          <p>{candidate.sourceUrl}</p>
          <p>This code runs with the same browser access as Syntax. Install only packages you trust.</p>
          <button className="sx-btn-primary" disabled={pending} onClick={() => void perform(async () => {
            await getNativeDevHost().installInspected(candidate)
            setCandidate(undefined)
            await refreshNativeDevInstalls()
            setInstalledName(candidate.manifest.name)
          })}>Install native package</button>
          <button className="sx-btn-secondary" disabled={pending} onClick={() => setCandidate(undefined)}>Cancel</button>
        </div>
      ) : (
        <form className="sx-ext-install-form" onSubmit={inspect}>
          <input className="sx-ext-url-input" aria-label="Native manifest URL" inputMode="url"
            placeholder="https://example.com/manifest.json" autoComplete="off" spellCheck={false}
            value={url} onChange={event => setUrl(event.target.value)} required disabled={pending} />
          <button className="sx-btn-secondary" disabled={pending || !url.trim()}>Review native package</button>
        </form>
      ))}
      {actionError && <p role="alert">{actionError}</p>}
      {installedName && <p role="status">Installed {installedName}.</p>}
      {installs.map(({ package: { manifest }, enabled, failure }) => {
        const runtime = phase === 'ready' ? getNativeDevHost().runtime : undefined
        const screens = runtime?.listScreens(manifest.id) ?? []
        return (
          <div key={manifest.id}>
            <h3>{manifest.name}</h3>
            {failure && <p role="alert">{failure}</p>}
            {screens.map(screen => (
              <button key={screen.id} className="sx-btn-primary" aria-label={`Open ${screen.title}`}
                onClick={() => onNavigate(screenPath(manifest.id, screen.id))}>
                Open
              </button>
            ))}
            {enabled && runtime && !runtime.isActive(manifest.id) && (
              <button className="sx-btn-secondary" onClick={() => window.location.reload()}>Reload to use this version</button>
            )}
            <button className="sx-btn-secondary" disabled={pending || (!enabled && phase !== 'ready')}
              onClick={() => void perform(async () => {
                try {
                  await getNativeDevHost().setEnabled(manifest.id, !enabled)
                } finally {
                  await refreshNativeDevInstalls()
                }
              })}>
              {enabled ? 'Disable' : 'Enable'}
            </button>
          </div>
        )
      })}
    </section>
  )
}

export function NativeDevScreen({ id, screen, onNavigate }: {
  id: string
  screen: string
  onNavigate: (path: string) => void
}) {
  const { phase, installs } = useNativeDevStore()
  const install = installs.find(item => item.package.manifest.id === id)
  const contribution = phase === 'ready' && nativeDevMode !== 'disabled' && install?.enabled
    ? getNativeDevHost().runtime.getScreen(id, screen)
    : undefined
  const Content = contribution?.component
  const exit = () => onNavigate(extensionsPath)
  return (
    <main className="sx-workspace-page">
      <button className="sx-btn-secondary" onClick={exit}>Back to Extensions</button>
      {Content && install ? (
        <SyntaxErrorBoundary key={install.revision} scope={id} extensionName={install.package.manifest.name}
          onExitScope={exit} exitLabel="Back to Extensions" onError={error => {
            void getNativeDevHost().reportFailure(id, install.revision, error)
              .then(async quarantined => {
                await refreshNativeDevInstalls()
                if (quarantined) toast.error(`${install.package.manifest.name} stopped after an error.`)
              })
              .catch(failure => toast.error(formatError(failure)))
          }}>
          <Content />
        </SyntaxErrorBoundary>
      ) : <p role="status">{phase === 'loading' ? 'Loading extension…' : 'This extension screen is unavailable.'}</p>}
    </main>
  )
}
