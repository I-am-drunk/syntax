import { toast } from 'sonner'
import { create } from 'zustand'
import { channelStateKey } from '../../core/channelState.ts'
import { syntaxLog } from '../../core/logger'
import { syntaxUiHostModule } from '../../ui/sdk/SyntaxUI'
import type { NativeCourseProgress, NativeRegisteredCourseTool } from './api.ts'
import { wrapCourseTool } from './courseToolWrapper.tsx'
import { createNativeDevAuthorization, nativeMode } from './devPolicy.ts'
import { NativeHost } from './host.ts'
import { createNativeRepository, type NativeInstall } from './repository.ts'
import { bindCourseToolsStore, playSyntaxSound, syntaxApiHostModule } from './sdkApi.ts'

export const nativeDevMode = nativeMode(import.meta.env.VITE_CHANNEL, import.meta.env.DEV, new URL(window.location.href))

export const useNativeDevStore = create<{
  installs: NativeInstall[]
  progressById: Record<string, NativeCourseProgress>
  dataOwnerIds: string[]
  contributionsVersion: number
  phase: 'loading' | 'ready' | 'recovery' | 'failed'
  error?: string
  inspectedId?: string
}>(() => ({ installs: [], progressById: {}, dataOwnerIds: [], contributionsVersion: 0, phase: 'loading' }))

const EMPTY_COURSE_TOOLS: readonly NativeRegisteredCourseTool[] = Object.freeze([])
let wrappedToolsVersion = -1
const wrappedToolsCache = new Map<string, readonly NativeRegisteredCourseTool[]>()

function getSafeCourseTools(courseId: string): readonly NativeRegisteredCourseTool[] {
  if (!host) return EMPTY_COURSE_TOOLS
  const version = host.runtime.getContributionsVersion()
  if (version !== wrappedToolsVersion) {
    wrappedToolsVersion = version
    wrappedToolsCache.clear()
  }
  const cached = wrappedToolsCache.get(courseId)
  if (cached) return cached
  const rawTools = host.runtime.listCourseToolsFor(courseId)
  if (rawTools.length === 0) {
    wrappedToolsCache.set(courseId, EMPTY_COURSE_TOOLS)
    return EMPTY_COURSE_TOOLS
  }
  const wrapped = Object.freeze(rawTools.map(tool =>
    wrapCourseTool(
      tool,
      host!.runtime.getActiveRevision(tool.ownerId),
      (ownerId, ownerName, revision, error) => {
        const message = error instanceof Error ? error.message : String(error)
        if (revision) {
          void host!.reportFailure(ownerId, revision, error)
            .then(async quarantined => {
              await refreshNativeDevInstalls()
              if (quarantined) {
                notifyNativeCrash({ id: ownerId, name: ownerName, message })
              }
            })
            .catch(() => undefined)
        }
      },
    ),
  ))
  wrappedToolsCache.set(courseId, wrapped)
  return wrapped
}

bindCourseToolsStore(
  listener => useNativeDevStore.subscribe(listener),
  getSafeCourseTools,
)

let host: NativeHost | undefined
let boot: Promise<void> | undefined
let changes: BroadcastChannel | undefined
let navigatorFn: ((path: string) => void) | null = null

export function setNativeDevNavigator(navigate: ((path: string) => void) | null) {
  navigatorFn = navigate
  if (host) host.setNavigator(navigate)
}

export function inspectNativeExtension(id: string | undefined) {
  useNativeDevStore.setState({ inspectedId: id })
}

export function notifyNativeCrash(options: {
  id: string
  name: string
  message: string
  onInspect?: () => void
}) {
  const { id, name, message, onInspect } = options
  toast.error(`${name} stopped after an error`, {
    id: `native-crash:${id}`,
    description: message,
    duration: 8000,
    action: {
      label: 'Inspect',
      onClick: () => {
        inspectNativeExtension(id)
        if (onInspect) {
          onInspect()
        } else {
          navigatorFn?.('/extensions')
        }
      },
    },
  })
}

export function getNativeDevHost(): NativeHost {
  if (nativeDevMode === 'disabled') throw new Error('Native extensions are unavailable in this build.')
  if (!host) {
    host = new NativeHost(
      createNativeRepository(),
      sessionStorage,
      (id, error) => syntaxLog.error(`native:${id}`, 'Extension cleanup failed.', error),
      createNativeDevAuthorization(nativeDevMode),
      {
        hostModules: Object.freeze({
          '@syntax/api': Object.freeze({ ...syntaxApiHostModule }),
          '@syntax/ui': Object.freeze({ ...syntaxUiHostModule }),
        }),
        playSound: playSyntaxSound,
        onDataChanged: () => {
          void refreshNativeDevProgress(true).catch(error =>
            syntaxLog.error('native', 'Could not refresh saved extension data.', error))
        },
        onProgressChanged: () => {
          void refreshNativeDevProgress(true).catch(error =>
            syntaxLog.error('native', 'Could not refresh course progress.', error))
        },
        onContributionsChanged: () => {
          useNativeDevStore.setState(state => ({ contributionsVersion: state.contributionsVersion + 1 }))
        },
      },
    )
    host.setNavigator(navigatorFn)
  }
  return host
}

export async function refreshNativeDevProgress(broadcast = false) {
  const currentHost = getNativeDevHost()
  const [progressById, dataOwnerIds] = await Promise.all([
    currentHost.listProgress(),
    currentHost.listDataOwners(),
  ])
  useNativeDevStore.setState({ progressById, dataOwnerIds })
  if (broadcast) changes?.postMessage('installs-changed')
}

export async function refreshNativeDevInstalls(broadcast = true) {
  const currentHost = getNativeDevHost()
  const activateMissing = useNativeDevStore.getState().phase === 'ready'
  const installs = await currentHost.reconcile({ activateMissing })
  const [progressById, dataOwnerIds] = await Promise.all([
    currentHost.listProgress(),
    currentHost.listDataOwners(),
  ])
  useNativeDevStore.setState({ installs, progressById, dataOwnerIds })
  if (broadcast) changes?.postMessage('installs-changed')
}

export async function clearNativeCourseData(id: string) {
  await getNativeDevHost().clearCourseData(id)
  await refreshNativeDevProgress(true)
}

function observeNativeDevChanges() {
  const reconcile = () => {
    void refreshNativeDevInstalls(false).catch(error =>
      syntaxLog.error('native', 'Could not refresh installed extensions.', error))
  }
  window.addEventListener('focus', reconcile)
  try {
    changes = new BroadcastChannel(channelStateKey('syntax.native-installs.v2'))
    changes.addEventListener('message', reconcile)
  } catch {
    // Focus refresh still catches up when messaging is unavailable.
  }
}

export function bootNativeDev(safeMode: boolean): Promise<void> {
  if (nativeDevMode === 'disabled') return Promise.resolve()
  return boot ??= (async () => {
    try {
      const result = safeMode ? undefined : await getNativeDevHost().boot()
      observeNativeDevChanges()
      await refreshNativeDevInstalls(Boolean(result?.failed.length))
      useNativeDevStore.setState({ phase: !result || result.recovery === 'skipped' ? 'recovery' : 'ready' })
      if (result?.failed.length) {
        const installs = useNativeDevStore.getState().installs
        for (const failedId of result.failed) {
          const item = installs.find(entry => entry.package.manifest.id === failedId)
          if (item?.failure) {
            notifyNativeCrash({
              id: failedId,
              name: item.package.manifest.name,
              message: item.failure,
            })
          }
        }
      }
    } catch (error) {
      useNativeDevStore.setState({ phase: 'failed', error: error instanceof Error ? error.message : String(error) })
    }
  })()
}
