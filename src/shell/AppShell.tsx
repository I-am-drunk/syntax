import { Suspense, lazy, useCallback, useEffect, useRef, useState } from 'react'
import { Route, Router, Switch, useLocation } from 'wouter'
import { useHashLocation } from 'wouter/use-hash-location'
import { Toaster, toast } from 'sonner'
import { useAccount } from '../core/account'
import { useAuthActions } from '../core/clerkAuth'
import {
  clearInstallDeepLink,
  fetchCommunityCatalog,
  getInitialCommunityCatalog,
  readInstallDeepLink,
  type CommunityCatalogState,
} from '../core/community'
import { SyntaxErrorBoundary } from '../core/ErrorBoundary'
import { HostSlotsProvider, useHostSlots } from '../core/hostSlots'
import type { SyntaxPackageManifest } from '../core/packages'
import { useRegistryStore } from '../core/registry'
import { HomePage } from '../courses/HomePage'
import { isDevEnvironment } from '../core/devEnv'
import { loadPrefs, savePrefs, type SyntaxPrefs } from '../mpm2d/storage'
import {
  readMpm2dProgressSummary,
  readThinkingInCodeProgressSummary,
  type Mpm2dProgressSummary,
  type ThinkingInCodeProgressSummary,
} from '../packages/courseMeta'
import { playLessonSound, type LessonSound } from '../services/lessonSounds'
import { CS_PROGRESS_EVENT } from '../services/progress'
import { CourseStageHost } from '../stages/CourseStageHost'
import { CommunityHubPage } from '../ui/CommunityHubPage'
import { InstallModal } from '../ui/InstallModal'
import { LibraryPage } from '../ui/LibraryPage'
import { PluginsPage } from '../ui/PluginsPage'
import { ProfilePage } from '../ui/ProfilePage'
import { AppHeader, type ShellMode, type WorkspaceTab } from './AppHeader'

const SyntaxSettingsPage = lazy(() =>
  import('../mpm2d/components/SyntaxSettingsModal').then(m => ({ default: m.SyntaxSettingsPage })),
)
const OnboardingModal = lazy(() =>
  import('../mpm2d/components/OnboardingModal').then(m => ({ default: m.OnboardingModal })),
)

const THEME_KEY = 'mpm2d-brilliant-theme-v1'
const SOUND_KEY = 'mpm2d-brilliant-sound-v1'

function safeDecode(segment: string): string {
  try {
    return decodeURIComponent(segment)
  } catch {
    return segment
  }
}

function loadTheme(): 'light' | 'dark' {
  try {
    const saved = localStorage.getItem(THEME_KEY)
    if (saved === 'light' || saved === 'dark') return saved
  } catch {
    // ignore
  }
  return matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light'
}

function loadSound(): boolean {
  try {
    const saved = localStorage.getItem(SOUND_KEY)
    if (saved === 'false') return false
  } catch {
    // ignore
  }
  return true
}

export interface AppShellProps {
  hideToaster?: boolean
}

function parseRouteInfo(location: string): {
  clean: string
  mode: ShellMode
  mainActiveTab: 'home' | 'library' | null
  workspaceActiveTab: WorkspaceTab | null
  courseId: string | null
  lessonId: string | null
  communityId: string | null
} {
  const clean = location.split('?')[0] || '/'
  if (clean === '/settings') {
    return {
      clean,
      mode: 'workspace',
      mainActiveTab: null,
      workspaceActiveTab: 'settings',
      courseId: null,
      lessonId: null,
      communityId: null,
    }
  }
  if (clean === '/plugins') {
    return {
      clean,
      mode: 'workspace',
      mainActiveTab: null,
      workspaceActiveTab: 'plugins',
      courseId: null,
      lessonId: null,
      communityId: null,
    }
  }
  if (clean === '/community' || clean.startsWith('/community/')) {
    const sub = clean.startsWith('/community/')
      ? safeDecode(clean.slice('/community/'.length))
      : null
    return {
      clean,
      mode: 'workspace',
      mainActiveTab: null,
      workspaceActiveTab: 'community',
      courseId: null,
      lessonId: null,
      communityId: sub || null,
    }
  }
  if (clean.startsWith('/course/')) {
    const rest = clean.slice('/course/'.length)
    const parts = rest.split('/').filter(Boolean)
    const courseId = parts[0] ? safeDecode(parts[0]) : null
    const lessonId = parts[1] === 'lesson' && parts[2] ? safeDecode(parts[2]) : null
    return {
      clean,
      mode: 'course',
      mainActiveTab: 'library',
      workspaceActiveTab: null,
      courseId,
      lessonId,
      communityId: null,
    }
  }
  if (clean === '/' || clean === '') {
    return {
      clean: '/',
      mode: 'main',
      mainActiveTab: 'home',
      workspaceActiveTab: null,
      courseId: null,
      lessonId: null,
      communityId: null,
    }
  }
  if (clean === '/profile') {
    return {
      clean,
      mode: 'main',
      mainActiveTab: null,
      workspaceActiveTab: null,
      courseId: null,
      lessonId: null,
      communityId: null,
    }
  }
  // /library and any unknown fallback route render LibraryPage
  return {
    clean,
    mode: 'main',
    mainActiveTab: 'library',
    workspaceActiveTab: null,
    courseId: null,
    lessonId: null,
    communityId: null,
  }
}

function AppShellInner({ hideToaster = false }: AppShellProps) {
  const isDev = isDevEnvironment()
  const [location, setLocation] = useLocation()
  const account = useAccount()
  const auth = useAuthActions()
  const { isFullscreenLesson } = useHostSlots()
  const installPackage = useRegistryStore(s => s.installPackage)

  const [theme, setTheme] = useState<'light' | 'dark'>(loadTheme)
  const [soundOn, setSoundOn] = useState<boolean>(loadSound)
  const [prefs, setPrefs] = useState<SyntaxPrefs>(loadPrefs)
  const [mpm2dSummary, setMpm2dSummary] = useState<Mpm2dProgressSummary>(readMpm2dProgressSummary)
  const [csSummary, setCsSummary] = useState<ThinkingInCodeProgressSummary>(
    readThinkingInCodeProgressSummary,
  )
  const [catalog, setCatalog] = useState<CommunityCatalogState>(getInitialCommunityCatalog)
  const [catalogRefreshing, setCatalogRefreshing] = useState(false)
  const [localImportPkg, setLocalImportPkg] = useState<SyntaxPackageManifest | null>(null)
  const [pendingInstall, setPendingInstall] = useState<{
    manifest: SyntaxPackageManifest
    source: 'official' | 'community' | 'local-file'
  } | null>(null)

  const catalogAbortRef = useRef<AbortController | null>(null)
  const prevModeRef = useRef<ShellMode>('main')
  const routeInfo = parseRouteInfo(location)

  const emitSound = useCallback(
    (cue: LessonSound) => {
      if (soundOn) playLessonSound(cue)
    },
    [soundOn],
  )

  const patchPrefs = useCallback((patch: Partial<SyntaxPrefs>) => {
    setPrefs(prev => ({ ...prev, ...patch, drawMode: false }))
  }, [])

  const refreshProgressSummaries = useCallback(() => {
    setMpm2dSummary(readMpm2dProgressSummary())
    setCsSummary(readThinkingInCodeProgressSummary())
  }, [])

  // Refresh progress summaries when leaving a course or when CS progress changes
  useEffect(() => {
    if (prevModeRef.current === 'course' && routeInfo.mode !== 'course') {
      refreshProgressSummaries()
    }
    prevModeRef.current = routeInfo.mode
  }, [routeInfo.mode, refreshProgressSummaries])

  useEffect(() => {
    const onCsProgress = () => setCsSummary(readThinkingInCodeProgressSummary())
    const onAuthClosed = () => setPendingInstall(null)
    window.addEventListener(CS_PROGRESS_EVENT, onCsProgress)
    window.addEventListener('syntax:auth-modal-closed', onAuthClosed)
    return () => {
      window.removeEventListener(CS_PROGRESS_EVENT, onCsProgress)
      window.removeEventListener('syntax:auth-modal-closed', onAuthClosed)
    }
  }, [])

  // Persist prefs, theme, sound
  useEffect(() => {
    savePrefs(prefs)
  }, [prefs])

  useEffect(() => {
    document.documentElement.dataset.theme = theme
    document.documentElement.style.colorScheme = theme
    const meta = document.querySelector('meta[name="theme-color"]')
    if (meta) meta.setAttribute('content', theme === 'dark' ? '#141414' : '#ffffff')
    try {
      localStorage.setItem(THEME_KEY, theme)
    } catch {
      // ignore
    }
  }, [theme])

  useEffect(() => {
    try {
      localStorage.setItem(SOUND_KEY, String(soundOn))
    } catch {
      // ignore
    }
  }, [soundOn])

  // Fetch Community Hub catalog on startup (with AbortController race guard)
  const refreshCatalog = useCallback(() => {
    catalogAbortRef.current?.abort()
    const ac = new AbortController()
    catalogAbortRef.current = ac
    setCatalogRefreshing(true)
    void fetchCommunityCatalog(ac.signal).then(res => {
      if (!ac.signal.aborted && catalogAbortRef.current === ac) {
        if (res) setCatalog(res)
        setCatalogRefreshing(false)
      }
    })
    return () => {
      ac.abort()
      if (catalogAbortRef.current === ac) {
        catalogAbortRef.current = null
      }
    }
  }, [])

  useEffect(() => {
    return refreshCatalog()
  }, [refreshCatalog])

  // Translate legacy #lesson=<id> hashes cleanly to /course/mpm2d-analytic-geometry/lesson/<id>
  useEffect(() => {
    const checkLegacyHash = () => {
      const m = window.location.hash.match(/^#\/?lesson[=/]([a-z0-9-]+)$/i)
      if (m) {
        setLocation(`/course/mpm2d-analytic-geometry/lesson/${encodeURIComponent(m[1]!)}`, {
          replace: true,
        })
      }
    }
    checkLegacyHash()
    window.addEventListener('hashchange', checkLegacyHash)
    return () => window.removeEventListener('hashchange', checkLegacyHash)
  }, [setLocation])

  // Handle ?install=<id> deep links by navigating directly to the full in-app Community Hub detail page
  useEffect(() => {
    const handleInstallLink = () => {
      const targetId = readInstallDeepLink()
      if (!targetId) return
      clearInstallDeepLink()
      setLocation(`/community/${encodeURIComponent(targetId)}`, { replace: true })
    }
    handleInstallLink()
    window.addEventListener('hashchange', handleInstallLink)
    return () => window.removeEventListener('hashchange', handleInstallLink)
  }, [setLocation])

  // Auto-complete a pending install once sign-in finishes
  useEffect(() => {
    if (!account || !pendingInstall) return
    const { manifest, source } = pendingInstall
    setPendingInstall(null)
    const res = installPackage(manifest, {
      source,
      catalogPool: catalog.items,
    })
    if (res.ok) {
      toast.success(`Added ${manifest.name}`)
      if (manifest.kind === 'course') {
        setLocation(`/course/${encodeURIComponent(manifest.id)}`)
      }
    } else {
      toast.error(res.error)
    }
  }, [account, pendingInstall, installPackage, catalog.items, setLocation])

  // Document title sync
  useEffect(() => {
    const baseTitle =
      routeInfo.workspaceActiveTab === 'settings'
        ? 'Settings · Syntax'
        : routeInfo.workspaceActiveTab === 'plugins'
          ? 'Plugins · Syntax'
          : routeInfo.workspaceActiveTab === 'community'
            ? 'Community Hub · Syntax'
            : routeInfo.mode === 'course'
              ? `${
                  routeInfo.courseId === 'mpm2d-analytic-geometry'
                    ? 'Analytic Geometry'
                    : routeInfo.courseId === 'thinking-in-code'
                      ? 'Thinking in Code'
                      : (catalog.items.find(p => p.id === routeInfo.courseId)?.name ?? 'Course')
                } · Syntax`
              : routeInfo.clean === '/library'
                ? 'Library · Syntax'
                : routeInfo.clean === '/profile'
                  ? 'Profile · Syntax'
                  : routeInfo.clean === '/'
                    ? 'Syntax'
                    : 'Library · Syntax'
    document.title = isDev ? `${baseTitle} (Dev)` : baseTitle
  }, [routeInfo, catalog.items, isDev])

  const navigate = useCallback(
    (path: string) => {
      setPendingInstall(null)
      if (path !== location) {
        setLocation(path)
      }
      window.scrollTo({ top: 0 })
    },
    [location, setLocation],
  )

  const handleRequireSignIn = useCallback(
    (
      manifest: SyntaxPackageManifest,
      source: 'official' | 'community' | 'local-file' = 'community',
    ) => {
      setPendingInstall({ manifest, source })
      auth.openSignIn()
    },
    [auth],
  )

  const totalCompletedLessons = mpm2dSummary.completedCount + csSummary.completedCount

  return (
    <>
      {!hideToaster && <Toaster position="bottom-center" theme={theme} />}

      {!isFullscreenLesson && (
        <AppHeader
          mode={routeInfo.mode}
          mainActiveTab={routeInfo.mainActiveTab}
          workspaceActiveTab={routeInfo.workspaceActiveTab}
          theme={theme}
          soundOn={soundOn}
          prefs={prefs}
          hasMissedNotification={
            routeInfo.courseId === 'mpm2d-analytic-geometry' && mpm2dSummary.missedCheckCount > 0
          }
          onNavigate={navigate}
          onToggleTheme={() => setTheme(t => (t === 'dark' ? 'light' : 'dark'))}
          onToggleSound={() => setSoundOn(v => !v)}
          onOpenWelcome={() => patchPrefs({ onboarded: false })}
          onPokeSema={() => emitSound('lightweight-choice')}
        />
      )}

      <Switch>
        <Route path="/">
          <SyntaxErrorBoundary scope="page:home" onExitScope={() => navigate('/library')}>
            <HomePage
              mpm2dSummary={mpm2dSummary}
              csSummary={csSummary}
              totalCompletedLessons={totalCompletedLessons}
              onOpenMpm2dCourse={() => navigate('/course/mpm2d-analytic-geometry')}
              onOpenMpm2dLesson={lessonId =>
                navigate(`/course/mpm2d-analytic-geometry/lesson/${encodeURIComponent(lessonId)}`)
              }
              onOpenCsCourse={() => navigate('/course/thinking-in-code')}
              onOpenCsLesson={lessonId =>
                navigate(`/course/thinking-in-code/lesson/${encodeURIComponent(lessonId)}`)
              }
              onOpenCustomCourse={id => navigate(`/course/${encodeURIComponent(id)}`)}
              onOpenLibrary={() => navigate('/library')}
            />
          </SyntaxErrorBoundary>
        </Route>

        <Route path="/library">
          <SyntaxErrorBoundary scope="page:library" onExitScope={() => navigate('/')}>
            <LibraryPage
              mpm2dPercent={mpm2dSummary.percent}
              mpm2dCompletedCount={mpm2dSummary.completedCount}
              csPercent={csSummary.percent}
              csCompletedCount={csSummary.completedCount}
              onOpenCourse={id => navigate(`/course/${encodeURIComponent(id)}`)}
              onOpenPlugins={() => navigate('/plugins')}
              onOpenCommunityHub={() => navigate('/community')}
              onInspectCourse={pkg => navigate(`/community/${encodeURIComponent(pkg.id)}`)}
            />
          </SyntaxErrorBoundary>
        </Route>

        <Route path="/profile">
          <SyntaxErrorBoundary scope="page:profile" onExitScope={() => navigate('/library')}>
            <ProfilePage
              prefs={prefs}
              mpm2dSummary={mpm2dSummary}
              csSummary={csSummary}
              onOpenCourse={id => navigate(`/course/${encodeURIComponent(id)}`)}
              onOpenLibrary={() => navigate('/library')}
              onOpenPlugins={() => navigate('/plugins')}
              onOpenCommunityHub={() => navigate('/community')}
              onOpenSettings={() => navigate('/settings')}
            />
          </SyntaxErrorBoundary>
        </Route>

        <Route path="/settings">
          <SyntaxErrorBoundary scope="workspace:settings" onExitScope={() => navigate('/library')}>
            <Suspense
              fallback={
                <main className="sx-course-loading">
                  <div className="sx-course-loading-card">
                    <h2>Loading settings&hellip;</h2>
                  </div>
                </main>
              }
            >
              <SyntaxSettingsPage
                onClose={() => navigate('/library')}
                theme={theme}
                onChangeTheme={setTheme}
                soundOn={soundOn}
                onChangeSound={setSoundOn}
                prefs={prefs}
                onPatchPrefs={patchPrefs}
                onReplayWelcome={() => patchPrefs({ onboarded: false })}
              />
            </Suspense>
          </SyntaxErrorBoundary>
        </Route>

        <Route path="/plugins">
          <SyntaxErrorBoundary scope="workspace:plugins" onExitScope={() => navigate('/library')}>
            <PluginsPage
              onSelectPackage={pkg => navigate(`/community/${encodeURIComponent(pkg.id)}`)}
              onOpenCourse={id => navigate(`/course/${encodeURIComponent(id)}`)}
              onOpenCommunityHub={() => navigate('/community')}
              onImportPackage={pkg => setLocalImportPkg(pkg)}
            />
          </SyntaxErrorBoundary>
        </Route>

        <Route path="/community">
          <SyntaxErrorBoundary scope="workspace:community" onExitScope={() => navigate('/library')}>
            <CommunityHubPage
              packages={catalog.items}
              source={catalog.source}
              warning={catalog.warning}
              isRefreshing={catalogRefreshing}
              selectedPackageId={null}
              theme={theme}
              onRefresh={refreshCatalog}
              onSelectPackage={id =>
                navigate(id ? `/community/${encodeURIComponent(id)}` : '/community')
              }
              onOpenCourse={id => navigate(`/course/${encodeURIComponent(id)}`)}
              onRequireSignIn={pkg =>
                handleRequireSignIn(pkg, pkg.builtIn ? 'official' : 'community')
              }
            />
          </SyntaxErrorBoundary>
        </Route>

        <Route path="/community/:id">
          {params => (
            <SyntaxErrorBoundary
              scope="workspace:community-detail"
              onExitScope={() => navigate('/community')}
            >
              <CommunityHubPage
                packages={catalog.items}
                source={catalog.source}
                warning={catalog.warning}
                isRefreshing={catalogRefreshing}
                selectedPackageId={safeDecode(params.id)}
                theme={theme}
                onRefresh={refreshCatalog}
                onSelectPackage={id =>
                  navigate(id ? `/community/${encodeURIComponent(id)}` : '/community')
                }
                onOpenCourse={id => navigate(`/course/${encodeURIComponent(id)}`)}
                onRequireSignIn={pkg =>
                  handleRequireSignIn(pkg, pkg.builtIn ? 'official' : 'community')
                }
              />
            </SyntaxErrorBoundary>
          )}
        </Route>

        {/* Single consolidated course route so CourseStageHost stays mounted across lesson open/close */}
        <Route path="/course/:courseId/*?">
          {() => {
            const cid = routeInfo.courseId
            if (!cid) {
              return (
                <SyntaxErrorBoundary scope="page:library" onExitScope={() => navigate('/')}>
                  <LibraryPage
                    mpm2dPercent={mpm2dSummary.percent}
                    mpm2dCompletedCount={mpm2dSummary.completedCount}
                    csPercent={csSummary.percent}
                    csCompletedCount={csSummary.completedCount}
                    onOpenCourse={id => navigate(`/course/${encodeURIComponent(id)}`)}
                    onOpenPlugins={() => navigate('/plugins')}
                    onOpenCommunityHub={() => navigate('/community')}
                    onInspectCourse={pkg => navigate(`/community/${encodeURIComponent(pkg.id)}`)}
                  />
                </SyntaxErrorBoundary>
              )
            }
            return (
              <CourseStageHost
                courseId={cid}
                lessonId={routeInfo.lessonId}
                catalogPackages={catalog.items}
                theme={theme}
                soundOn={soundOn}
                prefs={prefs}
                onPatchPrefs={patchPrefs}
                onBackToLibrary={() => navigate('/library')}
                onLessonRouteChange={nextLesson =>
                  navigate(
                    nextLesson
                      ? `/course/${encodeURIComponent(cid)}/lesson/${encodeURIComponent(nextLesson)}`
                      : `/course/${encodeURIComponent(cid)}`,
                  )
                }
                onProgressChanged={refreshProgressSummaries}
                onRequireSignIn={pkg =>
                  handleRequireSignIn(pkg, pkg.builtIn ? 'official' : 'community')
                }
              />
            )
          }}
        </Route>

        {/* Fallback route */}
        <Route>
          <SyntaxErrorBoundary scope="page:library-fallback" onExitScope={() => navigate('/')}>
            <LibraryPage
              mpm2dPercent={mpm2dSummary.percent}
              mpm2dCompletedCount={mpm2dSummary.completedCount}
              csPercent={csSummary.percent}
              csCompletedCount={csSummary.completedCount}
              onOpenCourse={id => navigate(`/course/${encodeURIComponent(id)}`)}
              onOpenPlugins={() => navigate('/plugins')}
              onOpenCommunityHub={() => navigate('/community')}
              onInspectCourse={pkg => navigate(`/community/${encodeURIComponent(pkg.id)}`)}
            />
          </SyntaxErrorBoundary>
        </Route>
      </Switch>

      {!prefs.onboarded && (
        <Suspense fallback={null}>
          <OnboardingModal
            open={!prefs.onboarded}
            theme={theme}
            semaShape={prefs.semaShape}
            semaTail={prefs.semaTail}
            onSelectTheme={setTheme}
            onFinish={() => patchPrefs({ onboarded: true })}
          />
        </Suspense>
      )}

      <InstallModal
        manifest={localImportPkg}
        source="local-file"
        allKnownPackages={catalog.items}
        theme={theme}
        onClose={() => setLocalImportPkg(null)}
        onRequireSignIn={pkg => {
          setLocalImportPkg(null)
          handleRequireSignIn(pkg, 'local-file')
        }}
        onInstalled={pkg => {
          toast.success(`Imported ${pkg.name}`)
        }}
        onOpenCourse={id => navigate(`/course/${encodeURIComponent(id)}`)}
      />
    </>
  )
}

export function AppShell(props: AppShellProps) {
  return (
    <Router hook={useHashLocation}>
      <HostSlotsProvider>
        <AppShellInner {...props} />
      </HostSlotsProvider>
    </Router>
  )
}
