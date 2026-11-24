import { useCallback, useEffect, useRef, useState } from 'react'
import { Route, Router, Switch } from 'wouter'
import { Toaster, toast } from 'sonner'
import { initSyntaxAuth, useSyntaxAccount } from '../core/account'
import {
  clearInstallDeepLink,
  fetchCommunityCatalog,
  getInitialCommunityCatalog,
  readInstallDeepLink,
  type CommunityCatalogState,
} from '../core/community'
import { SyntaxErrorBoundary } from '../core/ErrorBoundary'
import { syntaxLog } from '../core/logger'
import type { SyntaxPackageManifest } from '../core/packages'
import {
  getCourseDependencyStatus,
  installPackage,
  setPackageEnabled,
  useInstalledPackages,
  type InstalledPackageSource,
} from '../core/registry'
import { SYNTAX_PATHS, useSyntaxLocation } from '../core/router'
import { OFFICIAL_BY_ID } from '../packages/catalog'
import { CourseShell } from '../mpm2d/CourseShell'
import { Sema } from '../mpm2d/mascot/Sema'
import { AccountModal } from './AccountModal'
import { CommunityHubPage } from './CommunityHubPage'
import { CustomCourseView, ThinkingInCodeCourseView } from './CustomCourseView'
import { DependencyGate } from './DependencyGate'
import { DiagnosticsModal } from './DiagnosticsModal'
import { HomeLibraryPage } from './HomeLibraryPage'
import { InstallModal } from './InstallModal'
import { PluginsPage } from './PluginsPage'
import { ProfilePage } from './ProfilePage'
import './syntaxPlatform.css'

const THEME_KEY = 'mpm2d-brilliant-theme-v1'

function loadTheme(): 'light' | 'dark' {
  try {
    const saved = localStorage.getItem(THEME_KEY)
    if (saved === 'light' || saved === 'dark') return saved
  } catch {
    // ignore storage errors
  }
  return typeof matchMedia !== 'undefined' && matchMedia('(prefers-color-scheme: dark)').matches
    ? 'dark'
    : 'light'
}

function SunIcon() {
  return (
    <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <circle cx="12" cy="12" r="4" />
      <path d="M12 2v2M12 20v2M4.93 4.93l1.41 1.41M17.66 17.66l1.41 1.41M2 12h2M20 12h2M6.34 17.66l-1.41 1.41M19.07 4.93l-1.41 1.41" />
    </svg>
  )
}

function MoonIcon() {
  return (
    <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M12 3a6 6 0 0 0 9 9 9 9 0 1 1-9-9Z" />
    </svg>
  )
}

function LogIcon() {
  return (
    <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
      <polyline points="14 2 14 8 20 8" />
      <line x1="8" y1="13" x2="16" y2="13" />
      <line x1="8" y1="17" x2="13" y2="17" />
    </svg>
  )
}

type PendingInstall = {
  pkg: SyntaxPackageManifest
  source: InstalledPackageSource
  openAfter?: boolean
}

function SyntaxAppInner() {
  const [location, navigate] = useSyntaxLocation()
  const account = useSyntaxAccount()
  const installed = useInstalledPackages()

  const [theme, setTheme] = useState<'light' | 'dark'>(loadTheme)
  const [catalog, setCatalog] = useState<CommunityCatalogState>(getInitialCommunityCatalog)
  const [catalogLoading, setCatalogLoading] = useState(false)

  const [inspectPkg, setInspectPkg] = useState<PendingInstall | null>(null)
  const [pendingAfterSignIn, setPendingAfterSignIn] = useState<PendingInstall | null>(null)
  const [signInOpen, setSignInOpen] = useState(false)
  const [signInReason, setSignInReason] = useState<string | undefined>(undefined)
  const [diagnosticsOpen, setDiagnosticsOpen] = useState(false)
  const [deepLinkId, setDeepLinkId] = useState<string | null>(() => readInstallDeepLink())

  const catalogAbortRef = useRef<AbortController | null>(null)

  useEffect(() => {
    initSyntaxAuth()
  }, [])

  useEffect(() => {
    document.documentElement.dataset.theme = theme
    document.documentElement.style.colorScheme = theme
    try {
      localStorage.setItem(THEME_KEY, theme)
    } catch {
      // ignore storage errors
    }
  }, [theme])

  const refreshCatalog = useCallback(() => {
    catalogAbortRef.current?.abort()
    const ac = new AbortController()
    catalogAbortRef.current = ac
    setCatalogLoading(true)
    void fetchCommunityCatalog(ac.signal).then(next => {
      if (ac.signal.aborted || !next) return
      setCatalog(next)
      setCatalogLoading(false)
    })
  }, [])

  useEffect(() => {
    refreshCatalog()
    return () => {
      catalogAbortRef.current?.abort()
    }
  }, [refreshCatalog])

  // Listen for `#/install/<id>` deep links even after initial mount
  useEffect(() => {
    const onHashChange = () => {
      const id = readInstallDeepLink()
      if (id) setDeepLinkId(id)
    }
    window.addEventListener('hashchange', onHashChange)
    return () => window.removeEventListener('hashchange', onHashChange)
  }, [])

  // Handle Arc-style `?install=<package-id>` or `#/install/<package-id>` deep links
  useEffect(() => {
    if (!deepLinkId) return
    const found =
      catalog.items.find(item => item.id === deepLinkId) ?? OFFICIAL_BY_ID.get(deepLinkId)
    if (found) {
      syntaxLog.info('deeplink', `Opened install sheet for ${found.id}`)
      setInspectPkg({
        pkg: found,
        source: OFFICIAL_BY_ID.has(found.id) ? 'official' : 'community',
      })
      clearInstallDeepLink()
      setDeepLinkId(null)
    } else if (!catalogLoading && catalog.source === 'live') {
      toast.error(`Package "${deepLinkId}" was not found in the Community Hub.`)
      clearInstallDeepLink()
      setDeepLinkId(null)
    }
  }, [deepLinkId, catalog, catalogLoading])

  const executeInstall = useCallback(
    (target: PendingInstall) => {
      const result = installPackage(target.pkg, {
        source: target.source,
        catalogPool: catalog.items,
      })

      if (!result.ok) {
        if (result.needsSignIn) {
          setPendingAfterSignIn(target)
          setInspectPkg(null)
          setSignInReason(
            `Sign in to your Syntax account to install ${target.pkg.name} (${target.pkg.extension}).`,
          )
          setSignInOpen(true)
          return
        }
        toast.error(result.error)
        return
      }

      const extraDeps = result.installedIds.filter(id => id !== target.pkg.id)
      toast.success(
        extraDeps.length > 0
          ? `Installed ${target.pkg.name} (+ ${extraDeps.length} required embedded ${extraDeps.length === 1 ? 'plugin' : 'plugins'})`
          : `Installed ${target.pkg.name}`,
      )
      setInspectPkg(null)
      if (target.openAfter && target.pkg.kind === 'course') {
        navigate(SYNTAX_PATHS.course(target.pkg.id))
      }
    },
    [catalog.items, navigate],
  )

  const handleRequestInstall = useCallback(
    (pkg: SyntaxPackageManifest, source: InstalledPackageSource = 'community') => {
      setInspectPkg({
        pkg,
        source: OFFICIAL_BY_ID.has(pkg.id) ? 'official' : source,
      })
    },
    [],
  )

  const isCourseRoute = location.startsWith('/course/')

  return (
    <div className="sx-shell">
      <Toaster position="bottom-center" theme={theme} />

      {!isCourseRoute && (
        <header className="sx-topbar">
          <div className="sx-topbar-left">
            <button
              type="button"
              className="sx-wordmark"
              onClick={() => navigate(SYNTAX_PATHS.home)}
            >
              <Sema state="idle" size={26} />
              <span>Syntax</span>
            </button>

            <nav className="sx-nav" aria-label="Syntax navigation">
              <button
                type="button"
                className={`sx-nav-link${location === '/' ? ' is-active' : ''}`}
                onClick={() => navigate(SYNTAX_PATHS.home)}
              >
                <span>Library</span>
              </button>
              <button
                type="button"
                className={`sx-nav-link${location === '/hub' ? ' is-active' : ''}`}
                onClick={() => navigate(SYNTAX_PATHS.hub)}
              >
                <span>Community Hub</span>
              </button>
              <button
                type="button"
                className={`sx-nav-link${location === '/plugins' ? ' is-active' : ''}`}
                onClick={() => navigate(SYNTAX_PATHS.plugins)}
              >
                <span>Plugins</span>
              </button>
            </nav>
          </div>

          <div className="sx-topbar-right">
            <button
              type="button"
              className="sx-icon-btn"
              title="Diagnostics & Event Log"
              aria-label="Open Diagnostics Log"
              onClick={() => setDiagnosticsOpen(true)}
            >
              <LogIcon />
            </button>
            <button
              type="button"
              className="sx-icon-btn"
              title={theme === 'dark' ? 'Switch to light mode' : 'Switch to dark mode'}
              aria-label={theme === 'dark' ? 'Switch to light mode' : 'Switch to dark mode'}
              onClick={() => setTheme(t => (t === 'dark' ? 'light' : 'dark'))}
            >
              {theme === 'dark' ? <SunIcon /> : <MoonIcon />}
            </button>

            {account ? (
              <button
                type="button"
                className="sx-account-pill"
                onClick={() => navigate(SYNTAX_PATHS.profile)}
              >
                <span className="sx-avatar" style={{ background: account.avatarColor }}>
                  {account.photoURL ? (
                    <img src={account.photoURL} alt={account.displayName} />
                  ) : (
                    account.displayName.slice(0, 1).toUpperCase()
                  )}
                </span>
                <span>@{account.handle}</span>
              </button>
            ) : (
              <button
                type="button"
                className="sx-btn sx-btn-sm sx-btn-primary"
                onClick={() => {
                  setSignInReason(undefined)
                  setSignInOpen(true)
                }}
              >
                Sign in
              </button>
            )}
          </div>
        </header>
      )}

      <SyntaxErrorBoundary scope={`route:${location}`} resetKeys={[location]}>
        <Switch>
          <Route path="/">
            <HomeLibraryPage
              onOpenCourse={id => navigate(SYNTAX_PATHS.course(id))}
              onGoHub={() => navigate(SYNTAX_PATHS.hub)}
              onGoPlugins={() => navigate(SYNTAX_PATHS.plugins)}
            />
          </Route>

          <Route path="/hub">
            <CommunityHubPage
              catalog={catalog}
              loading={catalogLoading}
              onRefresh={refreshCatalog}
              onRequestInstall={pkg => handleRequestInstall(pkg, 'community')}
              onOpenCourse={id => navigate(SYNTAX_PATHS.course(id))}
            />
          </Route>

          <Route path="/plugins">
            <PluginsPage
              theme={theme}
              onRequestInstall={(pkg, source) => handleRequestInstall(pkg, source)}
            />
          </Route>

          <Route path="/profile">
            <ProfilePage
              onOpenSignIn={() => {
                setSignInReason(undefined)
                setSignInOpen(true)
              }}
              onOpenDiagnostics={() => setDiagnosticsOpen(true)}
              onOpenCourse={id => navigate(SYNTAX_PATHS.course(id))}
            />
          </Route>

          <Route path="/course/:courseId">
            {params => {
              const courseId = params.courseId
              const installedCourse = installed.find(r => r.manifest.id === courseId)
              const manifest =
                installedCourse?.manifest ??
                catalog.items.find(i => i.id === courseId) ??
                OFFICIAL_BY_ID.get(courseId)

              if (!manifest || manifest.kind !== 'course') {
                return (
                  <main className="sx-page">
                    <div className="sx-card" style={{ maxWidth: 520, margin: '32px auto' }}>
                      <h1 className="sx-card-title">Course not found</h1>
                      <p className="sx-card-tagline">
                        Could not find a course with ID <code>{courseId}</code>.
                      </p>
                      <div>
                        <button
                          type="button"
                          className="sx-btn sx-btn-primary"
                          onClick={() => navigate(SYNTAX_PATHS.home)}
                        >
                          Back to Library
                        </button>
                      </div>
                    </div>
                  </main>
                )
              }

              const depStatus = getCourseDependencyStatus(manifest.id)
              if (!depStatus.ok) {
                return (
                  <DependencyGate
                    course={manifest}
                    status={depStatus}
                    signedIn={Boolean(account)}
                    onBack={() => navigate(SYNTAX_PATHS.home)}
                    onEnableAll={() => {
                      for (const dep of depStatus.disabled) {
                        setPackageEnabled(dep.id, true)
                      }
                      toast.success(`Enabled required plugins for ${manifest.name}`)
                    }}
                    onInstallMissing={() => {
                      executeInstall({
                        pkg: manifest,
                        source: OFFICIAL_BY_ID.has(manifest.id) ? 'official' : 'community',
                        openAfter: true,
                      })
                    }}
                  />
                )
              }

              if (
                OFFICIAL_BY_ID.has(manifest.id) &&
                manifest.id === 'mpm2d-analytic-geometry'
              ) {
                return (
                  <CourseShell
                    hideToaster
                    externalTheme={theme}
                    onExternalThemeChange={setTheme}
                    onExitCourse={() => navigate(SYNTAX_PATHS.home)}
                    onOpenHub={() => navigate(SYNTAX_PATHS.hub)}
                    onOpenPlugins={() => navigate(SYNTAX_PATHS.plugins)}
                    onOpenProfile={() => navigate(SYNTAX_PATHS.profile)}
                  />
                )
              }

              if (
                OFFICIAL_BY_ID.has(manifest.id) &&
                manifest.id === 'thinking-in-code'
              ) {
                return <ThinkingInCodeCourseView onBack={() => navigate(SYNTAX_PATHS.home)} />
              }

              return (
                <CustomCourseView
                  key={manifest.id}
                  course={manifest}
                  theme={theme}
                  onBack={() => navigate(SYNTAX_PATHS.home)}
                />
              )
            }}
          </Route>

          <Route>
            <HomeLibraryPage
              onOpenCourse={id => navigate(SYNTAX_PATHS.course(id))}
              onGoHub={() => navigate(SYNTAX_PATHS.hub)}
              onGoPlugins={() => navigate(SYNTAX_PATHS.plugins)}
            />
          </Route>
        </Switch>
      </SyntaxErrorBoundary>

      <InstallModal
        pkg={inspectPkg?.pkg ?? null}
        signedIn={Boolean(account)}
        onClose={() => setInspectPkg(null)}
        onConfirmInstall={pkg =>
          executeInstall({
            pkg,
            source: inspectPkg?.source ?? 'community',
          })
        }
      />

      <AccountModal
        open={signInOpen}
        reason={signInReason}
        onClose={() => {
          setSignInOpen(false)
          setPendingAfterSignIn(null)
        }}
        onSignedIn={() => {
          if (pendingAfterSignIn) {
            const target = pendingAfterSignIn
            setPendingAfterSignIn(null)
            executeInstall(target)
          }
        }}
      />

      <DiagnosticsModal open={diagnosticsOpen} onClose={() => setDiagnosticsOpen(false)} />
    </div>
  )
}

export function SyntaxApp() {
  return (
    <Router hook={useSyntaxLocation}>
      <SyntaxAppInner />
    </Router>
  )
}
