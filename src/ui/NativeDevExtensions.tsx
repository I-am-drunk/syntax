import { useEffect, useState, type FormEvent } from 'react'
import { toast } from 'sonner'
import { SyntaxErrorBoundary } from '../core/ErrorBoundary'
import { isSafeMode } from '../extensions/store.ts'
import {
  getNativeDevHost,
  inspectNativeExtension,
  nativeDevMode,
  notifyNativeCrash,
  refreshNativeDevInstalls,
  useNativeDevStore,
} from '../extensions/native/devHost.ts'
import { hasHostedNativePackages } from '../extensions/native/devPolicy.ts'
import type { NativePackage } from '../extensions/native/package.ts'

const extensionsPath = '/extensions'
const screenPath = (id: string, screen: string) =>
  `/native-extension/${encodeURIComponent(id)}/${encodeURIComponent(screen)}`

function formatError(error: unknown): string {
  return error instanceof Error ? error.message : String(error)
}

interface InstalledBanner {
  id: string
  name: string
  screenId?: string
  screenTitle?: string
}

interface ClearedCautionBanner {
  id: string
  version: string
  dismissing: boolean
}

export function NativeDevExtensions({
  onNavigate,
  initialUrl,
  onInitialUrlConsumed,
}: {
  onNavigate: (path: string) => void
  initialUrl?: string
  onInitialUrlConsumed?: () => void
}) {
  const { installs, phase, error, inspectedId } = useNativeDevStore()
  const [url, setUrl] = useState('')
  const [candidate, setCandidate] = useState<NativePackage>()
  const [pending, setPending] = useState(false)
  const [actionError, setActionError] = useState<string>()
  const [statusMessage, setStatusMessage] = useState<string>()
  const [installedBanner, setInstalledBanner] = useState<InstalledBanner>()
  const [clearedCaution, setClearedCaution] = useState<ClearedCautionBanner>()
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

  useEffect(() => {
    if (!initialUrl || phase !== 'ready' || !canInstall) return
    setUrl(initialUrl)
    setInstalledBanner(undefined)
    setStatusMessage(undefined)
    onInitialUrlConsumed?.()
    void perform(async () => setCandidate(await getNativeDevHost().inspect(initialUrl.trim())))
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [initialUrl, phase, canInstall])

  useEffect(() => {
    if (!clearedCaution) return
    const reducedMotion = typeof window !== 'undefined' &&
      window.matchMedia?.('(prefers-reduced-motion: reduce)').matches
    const fadeTimer = window.setTimeout(() => {
      setClearedCaution(prev => (prev ? { ...prev, dismissing: true } : undefined))
    }, reducedMotion ? 2600 : 3000)
    const removeTimer = window.setTimeout(() => {
      setClearedCaution(undefined)
    }, reducedMotion ? 2650 : 3500)
    return () => {
      window.clearTimeout(fadeTimer)
      window.clearTimeout(removeTimer)
    }
  }, [clearedCaution?.id, clearedCaution?.version])

  function inspect(event: FormEvent) {
    event.preventDefault()
    setInstalledBanner(undefined)
    setStatusMessage(undefined)
    void perform(async () => setCandidate(await getNativeDevHost().inspect(url.trim())))
  }

  return (
    <section className="sx-plugins-section" aria-label="Native extensions">
      <div className="sx-plugins-section-head">
        <h2>Native extensions</h2>
        <span>{installs.length}</span>
      </div>

      {phase === 'loading' && <p role="status">Loading native extensions...</p>}
      {phase === 'failed' && <p className="sx-ext-inline-error" role="alert">{error}</p>}
      {phase === 'recovery' && (
        <div className="sx-native-recovery">
          <p role="alert">Syntax started with native extensions paused.</p>
          {!isSafeMode() && (
            <button
              type="button"
              className="sx-btn-secondary"
              disabled={pending}
              onClick={() => void perform(async () => {
                await getNativeDevHost().acknowledgeUnknownStartup()
                window.location.reload()
              })}
            >
              Restart native extensions
            </button>
          )}
        </div>
      )}

      {phase === 'ready' && !canInstall && <p>No native packages are approved for this build.</p>}

      {phase === 'ready' && canInstall && (candidate ? (
        <div className="sx-native-review-card">
          <p>
            <strong>{candidate.manifest.name}</strong>{' '}
            <span className="sx-ext-version-tag">v{candidate.manifest.version}</span>
          </p>
          <p className="sx-ext-meta-line">{candidate.sourceUrl}</p>
          <p>This code runs with the same browser access as Syntax. Install only packages you trust.</p>
          <div className="sx-native-review-actions">
            <button
              type="button"
              className="sx-btn-primary"
              disabled={pending}
              onClick={() => void perform(async () => {
                const prior = installs.find(item => item.package.manifest.id === candidate.manifest.id)
                const hadCaution = Boolean(
                  prior &&
                  (prior.retryCaution || prior.failedSha256) &&
                  prior.package.manifest.sha256 !== candidate.manifest.sha256,
                )
                const host = getNativeDevHost()
                await host.installInspected(candidate)
                setCandidate(undefined)
                await refreshNativeDevInstalls()
                const primaryScreen = host.runtime.listScreens(candidate.manifest.id)[0]
                setInstalledBanner({
                  id: candidate.manifest.id,
                  name: candidate.manifest.name,
                  screenId: primaryScreen?.id,
                  screenTitle: primaryScreen?.title,
                })
                if (hadCaution) {
                  setClearedCaution({
                    id: candidate.manifest.id,
                    version: candidate.manifest.version,
                    dismissing: false,
                  })
                }
              })}
            >
              Install native package
            </button>
            <button
              type="button"
              className="sx-btn-secondary"
              disabled={pending}
              onClick={() => setCandidate(undefined)}
            >
              Cancel
            </button>
          </div>
        </div>
      ) : (
        <form className="sx-ext-install-form" onSubmit={inspect}>
          <input
            className="sx-ext-url-input"
            aria-label="Native manifest URL"
            inputMode="url"
            placeholder="https://example.com/manifest.json"
            autoComplete="off"
            spellCheck={false}
            value={url}
            onChange={event => setUrl(event.target.value)}
            required
            disabled={pending}
          />
          <button
            type="submit"
            className="sx-btn-secondary"
            disabled={pending || !url.trim()}
          >
            Review native package
          </button>
        </form>
      ))}

      {actionError && (
        <p className="sx-ext-inline-error" role="alert">{actionError}</p>
      )}

      {installedBanner && (
        <div className="sx-native-install-success" role="status" data-native-install-success={installedBanner.id}>
          <span>Installed {installedBanner.name}.</span>
          {installedBanner.screenId && (
            <button
              type="button"
              className="sx-btn-primary sx-btn-sm"
              aria-label={`Open installed ${installedBanner.name}`}
              onClick={() => onNavigate(screenPath(installedBanner.id, installedBanner.screenId!))}
            >
              Open
            </button>
          )}
        </div>
      )}

      {statusMessage && <p role="status">{statusMessage}</p>}

      {installs.length > 0 && (
        <div className="sx-ext-list">
          {installs.map(record => {
            const { package: pkg, enabled, failure, failedSha256, failureAt, retryCaution } = record
            const { manifest } = pkg
            const runtime = phase === 'ready' ? getNativeDevHost().runtime : undefined
            const screens = runtime?.listScreens(manifest.id) ?? []
            const commands = runtime?.listCommands(manifest.id) ?? []
            const isInspected = inspectedId === manifest.id
            const status = failure ? 'failed' : enabled ? 'active' : 'disabled'
            const statusText = failure ? 'Needs attention' : enabled ? 'Active' : 'Disabled'
            const showCleared = clearedCaution?.id === manifest.id && !failure
            const inspectPanelId = `native-inspect-${manifest.id}`

            return (
              <article
                key={manifest.id}
                className={`sx-ext-card sx-native-card is-${status}`}
                data-native-extension-id={manifest.id}
                data-native-extension-status={status}
              >
                <div className="sx-ext-card-top">
                  <div className="sx-ext-card-id">
                    <div className="sx-ext-card-title-row">
                      <h3>{manifest.name}</h3>
                      <span className={`sx-ext-status-badge is-${status}`}>{statusText}</span>
                      <span className="sx-ext-version-tag">v{manifest.version}</span>
                    </div>
                    <p className="sx-ext-meta-line">
                      <code>{manifest.id}</code>
                    </p>
                  </div>

                  <div className="sx-ext-card-actions">
                    {screens.map(screen => (
                      <button
                        key={screen.id}
                        type="button"
                        className="sx-btn-primary sx-btn-sm"
                        aria-label={`Open ${screen.title}`}
                        onClick={() => onNavigate(screenPath(manifest.id, screen.id))}
                      >
                        {screens.length > 1 ? `Open ${screen.title}` : 'Open'}
                      </button>
                    ))}
                    {enabled && runtime && !runtime.isActive(manifest.id) && (
                      <button
                        type="button"
                        className="sx-btn-secondary sx-btn-sm"
                        onClick={() => window.location.reload()}
                      >
                        Reload to use this version
                      </button>
                    )}
                    <button
                      type="button"
                      className="sx-btn-secondary sx-btn-sm"
                      aria-expanded={isInspected}
                      aria-controls={inspectPanelId}
                      aria-label={`Inspect ${manifest.name}`}
                      onClick={() => inspectNativeExtension(isInspected ? undefined : manifest.id)}
                    >
                      Inspect
                    </button>
                    <button
                      type="button"
                      className="sx-btn-secondary sx-btn-sm"
                      disabled={pending || (!enabled && phase !== 'ready')}
                      onClick={() => void perform(async () => {
                        try {
                          await getNativeDevHost().setEnabled(manifest.id, !enabled)
                        } finally {
                          await refreshNativeDevInstalls()
                        }
                      })}
                    >
                      {enabled ? 'Disable' : failure ? 'Re-enable' : 'Enable'}
                    </button>
                  </div>
                </div>

                {failure && (
                  <p className="sx-ext-inline-error" role="alert">{failure}</p>
                )}

                {retryCaution && (
                  <div className="sx-native-caution" role="status" data-retry-caution="true">
                    Retrying the same build (v{manifest.version}) that previously crashed. Install an updated build if the problem repeats.
                  </div>
                )}

                {showCleared && clearedCaution && (
                  <div
                    className={`sx-native-caution-cleared${clearedCaution.dismissing ? ' is-dismissing' : ''}`}
                    role="status"
                    data-caution-cleared="true"
                  >
                    Previous caution cleared after verified v{clearedCaution.version} started.
                  </div>
                )}

                <div className="sx-ext-card-footer">
                  <div className="sx-ext-card-footer-tools">
                    {phase === 'ready' && canInstall && (
                      <button
                        type="button"
                        className="sx-btn-ghost sx-btn-sm"
                        aria-label={`Check update for ${manifest.name}`}
                        disabled={pending}
                        onClick={() => {
                          setUrl(pkg.sourceUrl)
                          setInstalledBanner(undefined)
                          setStatusMessage(undefined)
                          void perform(async () => setCandidate(await getNativeDevHost().inspect(pkg.sourceUrl)))
                        }}
                      >
                        Check update
                      </button>
                    )}
                  </div>
                  <div className="sx-ext-card-footer-danger">
                    <button
                      type="button"
                      className="sx-btn-danger-ghost sx-btn-sm"
                      disabled={pending}
                      aria-label={`Uninstall ${manifest.name}`}
                      onClick={() => void perform(async () => {
                        await getNativeDevHost().uninstall(manifest.id)
                        if (inspectedId === manifest.id) inspectNativeExtension(undefined)
                        if (installedBanner?.id === manifest.id) setInstalledBanner(undefined)
                        await refreshNativeDevInstalls()
                        setStatusMessage(`Uninstalled ${manifest.name}. Saved data was preserved.`)
                      })}
                    >
                      Uninstall
                    </button>
                  </div>
                </div>

                {isInspected && (
                  <div
                    id={inspectPanelId}
                    className="sx-native-inspect-panel"
                    data-native-inspect={manifest.id}
                  >
                    <dl className="sx-native-inspect-grid">
                      <dt>Extension ID</dt>
                      <dd><code>{manifest.id}</code></dd>
                      <dt>Version</dt>
                      <dd>{manifest.version} (Syntax API {manifest.syntaxApi})</dd>
                      <dt>Source</dt>
                      <dd><code>{pkg.sourceUrl}</code></dd>
                      <dt>Build digest</dt>
                      <dd><code>{manifest.sha256.slice(0, 16)}...</code></dd>
                      <dt>Contributions</dt>
                      <dd>{screens.length} {screens.length === 1 ? 'screen' : 'screens'}, {commands.length} {commands.length === 1 ? 'command' : 'commands'}</dd>
                      {failure && (
                        <>
                          <dt>Last error</dt>
                          <dd>{failure}</dd>
                        </>
                      )}
                      {failureAt && (
                        <>
                          <dt>Recorded at</dt>
                          <dd>{failureAt}</dd>
                        </>
                      )}
                      {failedSha256 && (
                        <>
                          <dt>Failed build</dt>
                          <dd><code>{failedSha256.slice(0, 16)}...</code></dd>
                        </>
                      )}
                    </dl>
                  </div>
                )}
              </article>
            )
          })}
        </div>
      )}
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
      <div className="sx-native-screen-bar">
        <button type="button" className="sx-btn-secondary" onClick={exit}>Back to Extensions</button>
      </div>
      {Content && install ? (
        <SyntaxErrorBoundary
          key={install.revision}
          scope={id}
          extensionName={install.package.manifest.name}
          onExitScope={exit}
          exitLabel="Back to Extensions"
          onError={error => {
            const message = formatError(error)
            void getNativeDevHost().reportFailure(id, install.revision, error)
              .then(async quarantined => {
                await refreshNativeDevInstalls()
                if (quarantined) {
                  notifyNativeCrash({
                    id,
                    name: install.package.manifest.name,
                    message,
                    onInspect: exit,
                  })
                }
              })
              .catch(failure => toast.error(formatError(failure)))
          }}
        >
          <Content />
        </SyntaxErrorBoundary>
      ) : install?.failure ? (
        <section className="sx-native-review-card" role="alert">
          <h2>{install.package.manifest.name} stopped after an error</h2>
          <p>{install.failure}</p>
          <p>This extension screen is unavailable.</p>
          <div className="sx-native-review-actions">
            <button
              type="button"
              className="sx-btn-primary sx-btn-sm"
              onClick={() => {
                inspectNativeExtension(id)
                exit()
              }}
            >
              Inspect in Extensions
            </button>
          </div>
        </section>
      ) : <p role="status">{phase === 'loading' ? 'Loading extension...' : 'This extension screen is unavailable.'}</p>}
    </main>
  )
}
