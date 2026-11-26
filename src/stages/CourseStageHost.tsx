import { Suspense, lazy } from 'react'
import { toast } from 'sonner'
import { useAccount } from '../core/account'
import { SyntaxErrorBoundary } from '../core/ErrorBoundary'
import type { SyntaxPackageManifest } from '../core/packages'
import {
  useCourseDependencyStatus,
  useInstalledPackages,
  useRegistryStore,
} from '../core/registry'
import type { SyntaxPrefs } from '../mpm2d/storage'
import { DependencyGate } from '../ui/DependencyGate'
import { CourseLoadingView } from './CourseLoadingView'

const Mpm2dCourseStage = lazy(() => import('./Mpm2dCourseStage'))
const ThinkingInCodeCourseStage = lazy(() => import('./ThinkingInCodeCourseStage'))
const CustomCourseStage = lazy(() => import('./CustomCourseStage'))

interface CourseStageHostProps {
  courseId: string
  lessonId?: string | null
  catalogPackages: SyntaxPackageManifest[]
  theme: 'light' | 'dark'
  soundOn: boolean
  prefs: SyntaxPrefs
  onPatchPrefs: (patch: Partial<SyntaxPrefs>) => void
  onBackToLibrary: () => void
  onLessonRouteChange: (lessonId: string | null) => void
  onProgressChanged: () => void
  onRequireSignIn: (manifest: SyntaxPackageManifest) => void
}

export function CourseStageHost({
  courseId,
  lessonId = null,
  catalogPackages,
  theme,
  soundOn,
  prefs,
  onPatchPrefs,
  onBackToLibrary,
  onLessonRouteChange,
  onProgressChanged,
  onRequireSignIn,
}: CourseStageHostProps) {
  const account = useAccount()
  const records = useInstalledPackages()
  const installPackage = useRegistryStore(s => s.installPackage)
  const setPackageEnabled = useRegistryStore(s => s.setPackageEnabled)
  const depStatus = useCourseDependencyStatus(courseId)

  const courseRecord = records.find(r => r.manifest.id === courseId)
  const courseManifest =
    courseRecord?.manifest ?? catalogPackages.find(p => p.id === courseId) ?? null

  if (!courseManifest) {
    return (
      <main className="sx-dep-gate">
        <h2>Course not installed</h2>
        <p className="sx-modal-copy">
          Could not find <code>{courseId}</code> in your Library.
        </p>
        <div className="sx-modal-actions">
          <button type="button" className="sx-btn-primary" onClick={onBackToLibrary}>
            Back to Library
          </button>
        </div>
      </main>
    )
  }

  if (!depStatus.ok) {
    return (
      <DependencyGate
        course={courseManifest}
        status={depStatus}
        signedIn={Boolean(account)}
        onBack={onBackToLibrary}
        onEnableAll={() => {
          for (const d of depStatus.disabled) {
            setPackageEnabled(d.id, true)
          }
          toast.success(`Enabled required plugins for ${courseManifest.name}`)
        }}
        onInstallMissing={() => {
          if (!account) {
            onRequireSignIn(courseManifest)
            return
          }
          const res = installPackage(courseManifest, {
            source: courseManifest.builtIn ? 'official' : 'community',
            catalogPool: catalogPackages,
          })
          if (!res.ok) {
            if (res.needsSignIn) {
              onRequireSignIn(courseManifest)
              return
            }
            toast.error(res.error)
            return
          }
          toast.success(`Installed required embedded plugins for ${courseManifest.name}`)
        }}
      />
    )
  }

  return (
    <SyntaxErrorBoundary
      scope={`course:${courseManifest.id}`}
      pluginName={courseManifest.name}
      onExitScope={onBackToLibrary}
      exitLabel="Back to Library"
      onDisablePlugin={
        !courseManifest.builtIn
          ? () => {
              setPackageEnabled(courseManifest.id, false)
              onBackToLibrary()
            }
          : undefined
      }
      resetKeys={[courseManifest.id, lessonId]}
    >
      <Suspense
        fallback={
          <CourseLoadingView
            courseName={courseManifest.name}
            iconSvg={courseManifest.iconSvg}
          />
        }
      >
        {courseManifest.id === 'mpm2d-analytic-geometry' ? (
          <Mpm2dCourseStage
            initialLessonId={lessonId}
            theme={theme}
            soundOn={soundOn}
            prefs={prefs}
            onPatchPrefs={onPatchPrefs}
            onLessonRouteChange={onLessonRouteChange}
            onProgressChanged={onProgressChanged}
          />
        ) : courseManifest.id === 'thinking-in-code' ? (
          <ThinkingInCodeCourseStage
            initialLessonId={lessonId}
            soundOn={soundOn}
            onBackToLibrary={onBackToLibrary}
            onLessonRouteChange={onLessonRouteChange}
          />
        ) : (
          <CustomCourseStage course={courseManifest} theme={theme} />
        )}
      </Suspense>
    </SyntaxErrorBoundary>
  )
}
