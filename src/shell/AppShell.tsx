import { Suspense, lazy, useCallback, useEffect, useState } from 'react'
import { Route, Router, Switch, useLocation } from 'wouter'
import { useHashLocation } from 'wouter/use-hash-location'
import { Toaster } from 'sonner'
import { CLOUD_SYNC_APPLIED_EVENT } from '../core/clerkSync'
import { isDevEnvironment } from '../core/devEnv'
import { SyntaxErrorBoundary } from '../core/ErrorBoundary'
import { HostSlotsProvider, useHostSlots } from '../core/hostSlots'
import { loadPrefs, savePrefs, type SyntaxPrefs } from '../core/prefs'
import { ExtensionPage } from '../extensions/ExtensionPage.tsx'
import { extensionManager } from '../extensions/manager.ts'
import { isSafeMode } from '../extensions/store.ts'
import { playLessonSound, type LessonSound } from '../services/lessonSounds'
import { CommunityHubPage } from '../ui/CommunityHubPage'
import { ExtensionsPage } from '../ui/ExtensionsPage'
import { HomePage } from '../ui/HomePage'
import { LibraryPage } from '../ui/LibraryPage'
import { ProfilePage } from '../ui/ProfilePage'
import { AppHeader, type ShellMode, type WorkspaceTab } from './AppHeader'

const SettingsPage = lazy(() =>
  import('../ui/SettingsPage').then(m => ({ default: m.SettingsPage })),
)
const OnboardingModal = lazy(() =>
  import('../ui/OnboardingModal').then(m => ({ default: m.OnboardingModal })),
)
const DevToolsSuite = lazy(() =>
  import('../core/devTools').then(m => ({ default: m.DevToolsSuite })),
)

const THEME_KEY = 'syntax.theme.v1'
const LEGACY_THEME_KEY = 'mpm2d-brilliant-theme-v1'
const SOUND_KEY = 'syntax.sound.v1'
const LEGACY_SOUND_KEY = 'mpm2d-brilliant-sound-v1'

function loadTheme(): 'light' | 'dark' {
  try {
    const saved = localStorage.getItem(THEME_KEY) ?? localStorage.getItem(LEGACY_THEME_KEY)
    if (saved === 'light' || saved === 'dark') return saved
  } catch {
    // ignore
  }
  return matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light'
}

function loadSound(): boolean {
  try {
    const saved = localStorage.getItem(SOUND_KEY) ?? localStorage.getItem(LEGACY_SOUND_KEY)
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
} {
  const clean = location.split('?')[0] || '/'
  if (clean === '/settings') {
    return { clean, mode: 'workspace', mainActiveTab: null, workspaceActiveTab: 'settings' }
  }
  if (clean === '/extensions' || clean === '/plugins') {
    return { clean, mode: 'workspace', mainActiveTab: null, workspaceActiveTab: 'extensions' }
  }
  if (clean === '/community' || clean.startsWith('/community/')) {
    return { clean, mode: 'workspace', mainActiveTab: null, workspaceActiveTab: 'community' }
  }
  if (clean.startsWith('/ext/')) {
    return { clean, mode: 'main', mainActiveTab: null, workspaceActiveTab: null }
  }
  if (clean === '/' || clean === '') {
    return { clean: '/', mode: 'main', mainActiveTab: 'home', workspaceActiveTab: null }
  }
  if (clean === '/profile') {
    return { clean, mode: 'main', mainActiveTab: null, workspaceActiveTab: null }
  }
  return { clean, mode: 'main', mainActiveTab: 'library', workspaceActiveTab: null }
}

function LegacyPluginsRedirect({
  onRedirect,
  onOpenCommunityHub,
  onNavigate,
}: {
  onRedirect: () => void
  onOpenCommunityHub: () => void
  onNavigate: (path: string) => void
}) {
  useEffect(() => {
    onRedirect()
  }, [onRedirect])
  return <ExtensionsPage onOpenCommunityHub={onOpenCommunityHub} onNavigate={onNavigate} />
}

function AppShellInner({ hideToaster = false }: AppShellProps) {
  const isDev = isDevEnvironment()
  const [location, setLocation] = useLocation()
  const { isFullscreenLesson } = useHostSlots()

  const [theme, setTheme] = useState<'light' | 'dark'>(loadTheme)
  const [soundOn, setSoundOn] = useState<boolean>(loadSound)
  const [prefs, setPrefs] = useState<SyntaxPrefs>(loadPrefs)
  const routeInfo = parseRouteInfo(location)

  const emitSound = useCallback(
    (cue: LessonSound) => {
      if (soundOn) playLessonSound(cue)
    },
    [soundOn],
  )

  const patchPrefs = useCallback((patch: Partial<SyntaxPrefs>) => {
    setPrefs(prev => ({ ...prev, ...patch }))
  }, [])

  const navigate = useCallback(
    (path: string) => {
      if (path !== location) {
        setLocation(path)
      }
      window.scrollTo({ top: 0 })
    },
    [location, setLocation],
  )

  useEffect(() => {
    extensionManager.setNavigator(navigate)
    return () => extensionManager.setNavigator(null)
  }, [navigate])

  useEffect(() => {
    const safeMode = isSafeMode()
    void extensionManager.boot({ safeMode })
    const cleanLoc = location.split('?')[0] || '/'
    if (safeMode && cleanLoc === '/') {
      setLocation('/extensions', { replace: true })
    }
    // Boot once on mount (StrictMode-safe inside extensionManager.boot)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  useEffect(() => {
    const onCloudApplied = () => {
      setTheme(loadTheme())
      setSoundOn(loadSound())
      setPrefs(loadPrefs())
    }
    window.addEventListener(CLOUD_SYNC_APPLIED_EVENT, onCloudApplied)
    return () => window.removeEventListener(CLOUD_SYNC_APPLIED_EVENT, onCloudApplied)
  }, [])

  useEffect(() => {
    savePrefs(prefs)
  }, [prefs])

  useEffect(() => {
    document.documentElement.dataset.theme = theme
    document.documentElement.style.colorScheme = theme
    const meta = document.querySelector('meta[name="theme-color"]')
    if (meta) {
      meta.setAttribute('content', theme === 'dark' ? '#141414' : '#ffffff')
    }
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

  useEffect(() => {
    const baseTitle =
      routeInfo.workspaceActiveTab === 'settings'
        ? 'Settings · Syntax'
        : routeInfo.workspaceActiveTab === 'extensions'
          ? 'Extensions · Syntax'
          : routeInfo.workspaceActiveTab === 'community'
            ? 'Community Hub · Syntax'
            : routeInfo.clean.startsWith('/ext/')
              ? 'Extension · Syntax'
              : routeInfo.clean === '/library'
                ? 'Library · Syntax'
                : routeInfo.clean === '/profile'
                  ? 'Profile · Syntax'
                  : routeInfo.clean === '/'
                    ? 'Syntax'
                    : 'Library · Syntax'
    document.title = isDev ? `${baseTitle} (Dev)` : baseTitle
  }, [routeInfo, isDev])

  const redirectLegacyPlugins = useCallback(() => {
    setLocation('/extensions', { replace: true })
  }, [setLocation])

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
          hasMissedNotification={false}
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
              prefs={prefs}
              onOpenLibrary={() => navigate('/library')}
              onOpenExtensions={() => navigate('/extensions')}
              onOpenSettings={() => navigate('/settings')}
            />
          </SyntaxErrorBoundary>
        </Route>

        <Route path="/library">
          <SyntaxErrorBoundary scope="page:library" onExitScope={() => navigate('/')}>
            <LibraryPage
              onOpenExtensions={() => navigate('/extensions')}
              onOpenCommunityHub={() => navigate('/community')}
              onNavigate={navigate}
            />
          </SyntaxErrorBoundary>
        </Route>

        <Route path="/profile">
          <SyntaxErrorBoundary scope="page:profile" onExitScope={() => navigate('/library')}>
            <ProfilePage
              prefs={prefs}
              onOpenLibrary={() => navigate('/library')}
              onOpenExtensions={() => navigate('/extensions')}
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
              <SettingsPage
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

        <Route path="/extensions">
          <SyntaxErrorBoundary scope="workspace:extensions" onExitScope={() => navigate('/library')}>
            <ExtensionsPage
              onOpenCommunityHub={() => navigate('/community')}
              onNavigate={navigate}
            />
          </SyntaxErrorBoundary>
        </Route>

        <Route path="/plugins">
          <SyntaxErrorBoundary scope="workspace:extensions" onExitScope={() => navigate('/library')}>
            <LegacyPluginsRedirect
              onRedirect={redirectLegacyPlugins}
              onOpenCommunityHub={() => navigate('/community')}
              onNavigate={navigate}
            />
          </SyntaxErrorBoundary>
        </Route>

        <Route path="/ext/:extensionId/:viewId/:docId">
          {params => (
            <ExtensionPage
              extensionId={params.extensionId}
              viewId={params.viewId}
              docId={params.docId}
              onBackToLibrary={() => navigate('/library')}
              onOpenExtensions={() => navigate('/extensions')}
              onNavigate={navigate}
            />
          )}
        </Route>

        <Route path="/ext/:extensionId/:viewId">
          {params => (
            <ExtensionPage
              extensionId={params.extensionId}
              viewId={params.viewId}
              onBackToLibrary={() => navigate('/library')}
              onOpenExtensions={() => navigate('/extensions')}
              onNavigate={navigate}
            />
          )}
        </Route>

        <Route path="/community">
          <SyntaxErrorBoundary scope="workspace:community" onExitScope={() => navigate('/library')}>
            <CommunityHubPage onOpenExtensions={() => navigate('/extensions')} />
          </SyntaxErrorBoundary>
        </Route>

        <Route path="/community/:id">
          <SyntaxErrorBoundary scope="workspace:community" onExitScope={() => navigate('/library')}>
            <CommunityHubPage onOpenExtensions={() => navigate('/extensions')} />
          </SyntaxErrorBoundary>
        </Route>

        <Route>
          <SyntaxErrorBoundary scope="page:library-fallback" onExitScope={() => navigate('/')}>
            <LibraryPage
              onOpenExtensions={() => navigate('/extensions')}
              onOpenCommunityHub={() => navigate('/community')}
              onNavigate={navigate}
            />
          </SyntaxErrorBoundary>
        </Route>
      </Switch>

      {!prefs.onboarded && !isSafeMode() && (
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

      {isDev && (
        <Suspense fallback={null}>
          <DevToolsSuite />
        </Suspense>
      )}
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
