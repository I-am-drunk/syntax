import { Suspense, lazy, useCallback, useEffect, useState } from 'react'
import { Route, Switch, useLocation } from 'wouter'
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
import { HostSlotsProvider } from '../core/hostSlots'
import type { SyntaxPackageManifest } from '../core/packages'
import { useRegistryStore } from '../core/registry'
import { HomePage } from '../courses/HomePage'
import { isDevEnvironment } from '../core/devEnv'
import { loadPrefs, savePrefs, type SyntaxPrefs } from '../mpm2d/storage'
import { readMpm2dProgressSummary, type Mpm2dProgressSummary } from '../packages/courseMeta'
import { playLessonSound, type LessonSound } from '../services/lessonSounds'
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
  mode: ShellMode
  mainActiveTab: 'home' | 'library' | null
  workspaceActiveTab: WorkspaceTab | null
  courseId: string | null
  lessonId: string | null
  communityId: string | null
  isLessonFullscreen: boolean
} {
  const clean = location.split('?')[0] || '/'
  if (clean === '/settings') {
    return {
      mode: 'workspace',
      mainActiveTab: null,
      workspaceActiveTab: 'settings',
      courseId: null,
      lessonId: null,
      communityId: null,
      isLessonFullscreen: false,
    }
  }
  if (clean === '/plugins') {
    return {
      mode: 'workspace',
      mainActiveTab: null,
      workspaceActiveTab: 'plugins',
      courseId: null,
      lessonId: null,
      communityId: null,
      isLessonFullscreen: false,
    }
  }
  if (clean === '/community' || clean.startsWith('/community/')) {
    const sub = clean.startsWith('/community/') ? decodeURIComponent(clean.slice('/community/'.length)) : null
    return {
      mode: 'workspace',
      mainActiveTab: null,
      workspaceActiveTab: 'community',
      courseId: null,
      lessonId: null,
      communityId: sub || null,
      isLessonFullscreen: false,
    }
  }
  if (clean.startsWith('/course/')) {
    const rest = clean.slice('/course/'.length)
    const parts = rest.split('/').filter(Boolean)
    const courseId = parts[0] ? decodeURIComponent(parts[0]) : null
    const lessonId = parts[1] === 'lesson' && parts[2] ? decodeURIComponent(parts[2]) : null
    return {
      mode: 'course',
      mainActiveTab: 'library',
      workspaceActiveTab: null,
      courseId,
      lessonId,
      communityId: null,
      isLessonFullscreen: Boolean(lessonId && (courseId === 'mpm2d-analytic-geometry' || courseId === 'thinking-in-code')),
    }
  }
  if (clean === '/library') {
    return {
      mode: 'main',
      mainActiveTab: 'library',
      workspaceActiveTab: null,
      courseId: null,
      lessonId: null,
      communityId: null,
      isLessonFullscreen: false,
    }
  }
  if (clean === '/profile') {
    return {
      mode: 'main',
      mainActiveTab: null,
      workspaceActiveTab: null,
      courseId: null,
      lessonId: null,
      communityId: null,
      isLessonFullscreen: false,
    }
  }
  return {
    mode: 'main',
    mainActiveTab: 'home',
    workspaceActiveTab: null,
    courseId: null,
    lessonId: null,
    communityId: null,
    isLessonFullscreen: false,
  }
}

function AppShellInner({ hideToaster = false }: AppShellProps) {
  const isDev = isDevEnvironment()
  const [location, setLocation] = useLocation()
  const account = useAccount()
  const auth = useAuthActions()
  const installPackage = useRegistryStore(s => s.installPackage)

  const [theme, setTheme] = useState<'light' | 'dark'>(loadTheme)
  const [soundOn, setSoundOn] = useState<boolean>(loadSound)
  const [prefs, setPrefs] = useState<SyntaxPrefs>(loadPrefs)
  const [mpm2dSummary, setMpm2dSummary] = useState<Mpm2dProgressSummary>(readMpm2dProgressSummary)
  const [catalog, setCatalog] = useState<CommunityCatalogState>(getInitialCommunityCatalog)
  const [catalogRefreshing, setCatalogRefreshing] = useState(false)
  const [localImportPkg, setLocalImportPkg] = useState<SyntaxPackageManifest | null>(null)
  const [pendingInstall, setPendingInstall] = useState<{
    manifest: SyntaxPackageManifest
    source: 'official' | 'community' | 'local-file'
  } | null>(null)

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

  const refreshMpm2dSummary = useCallback(() => {
    setMpm2dSummary(readMpm2dProgressSummary())
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

  // Fetch Community Hub catalog on startup (with AbortController cleanup)
  const refreshCatalog = useCallback(() => {
    const ac = new AbortController()
    setCatalogRefreshing(true)
    void fetchCommunityCatalog(ac.signal).then(res => {
      if (!ac.signal.aborted) {
        if (res) setCatalog(res)
        setCatalogRefreshing(false)
      }
    })
    return () => ac.abort()
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
              : location === '/library'
                ? 'Library · Syntax'
                : location === '/profile'
                  ? 'Profile · Syntax'
                  : 'Syntax'
    document.title = isDev ? `${baseTitle} (Dev)` : baseTitle
  }, [routeInfo, location, catalog.items, isDev])

  const navigate = useCallback(
    (path: string) => {
      setLocation(path)
      window.scrollTo({ top: 0 })
    },
    [setLocation],
  )

  const handleRequireSignIn = useCallback(
    (manifest: SyntaxPackageManifest, source: 'official' | 'community' | 'local-file' = 'community') => {
      setPendingInstall({ manifest, source })
      auth.openSignIn()
    },
    [auth],
  )

  return (
    <>
      {!hideToaster && <Toaster position="bottom-center" theme={theme} />}

      {!routeInfo.isLessonFullscreen && (
        <AppHeader
          mode={routeInfo.mode}
          mainActiveTab={routeInfo.mainActiveTab}
          workspaceActiveTab={routeInfo.workspaceActiveTab}
          theme={theme}
          soundOn={soundOn}
          prefs={prefs}
          hasMissedNotification={mpm2dSummary.missedCheckCount > 0}
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
              completedLessonCount={mpm2dSummary.completedCount}
              totalLessonsCount={mpm2dSummary.totalLessons}
              nextMpm2dLessonId={mpm2dSummary.nextLessonId}
              nextMpm2dLessonTitle={mpm2dSummary.nextLessonTitle}
              followingMpm2dLessonTitle={mpm2dSummary.followingLessonTitle}
              hasMpm2dResume={mpm2dSummary.hasResume}
              onOpenMpm2dCourse={() => navigate('/course/mpm2d-analytic-geometry')}
              onOpenMpm2dLesson={lessonId =>
                navigate(`/course/mpm2d-analytic-geometry/lesson/${encodeURIComponent(lessonId)}`)
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
              completedLessonCount={mpm2dSummary.completedCount}
              masteredCount={mpm2dSummary.masteredCount}
              coursePct={mpm2dSummary.percent}
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
              onRequireSignIn={pkg => handleRequireSignIn(pkg, pkg.builtIn ? 'official' : 'community')}
            />
          </SyntaxErrorBoundary>
        </Route>

        <Route path="/community/:id">
          {params => (
            <SyntaxErrorBoundary scope="workspace:community-detail" onExitScope={() => navigate('/community')}>
              <CommunityHubPage
                packages={catalog.items}
                source={catalog.source}
                warning={catalog.warning}
                isRefreshing={catalogRefreshing}
                selectedPackageId={decodeURIComponent(params.id)}
                theme={theme}
                onRefresh={refreshCatalog}
                onSelectPackage={id =>
                  navigate(id ? `/community/${encodeURIComponent(id)}` : '/community')
                }
                onOpenCourse={id => navigate(`/course/${encodeURIComponent(id)}`)}
                onRequireSignIn={pkg => handleRequireSignIn(pkg, pkg.builtIn ? 'official' : 'community')}
              />
            </SyntaxErrorBoundary>
          )}
        </Route>

        <Route path="/course/:courseId/lesson/:lessonId">
          {params => {
            const cid = decodeURIComponent(params.courseId)
            const lid = decodeURIComponent(params.lessonId)
            return (
              <CourseStageHost
                courseId={cid}
                lessonId={lid}
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
                onProgressChanged={refreshMpm2dSummary}
                onRequireSignIn={pkg =>
                  handleRequireSignIn(pkg, pkg.builtIn ? 'official' : 'community')
                }
              />
            )
          }}
        </Route>

        <Route path="/course/:courseId">
          {params => {
            const cid = decodeURIComponent(params.courseId)
            return (
              <CourseStageHost
                courseId={cid}
                lessonId={null}
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
                onProgressChanged={refreshMpm2dSummary}
                onRequireSignIn={pkg =>
                  handleRequireSignIn(pkg, pkg.builtIn ? 'official' : 'community')
                }
              />
            )
          }}
        </Route>

        {/* Fallback route */}
        <Route>
          <LibraryPage
            mpm2dPercent={mpm2dSummary.percent}
            mpm2dCompletedCount={mpm2dSummary.completedCount}
            onOpenCourse={id => navigate(`/course/${encodeURIComponent(id)}`)}
            onOpenPlugins={() => navigate('/plugins')}
            onOpenCommunityHub={() => navigate('/community')}
            onInspectCourse={pkg => navigate(`/community/${encodeURIComponent(pkg.id)}`)}
          />
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

import { Router } from 'wouter'

export function AppShell(props: AppShellProps) {
  return (
    <Router hook={useHashLocation}>
      <HostSlotsProvider>
        <AppShellInner {...props} />
      </HostSlotsProvider>
    </Router>
  )
}
