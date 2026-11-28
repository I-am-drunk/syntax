import { create } from 'zustand'
import { channelStateKey } from '../../core/channelState.ts'
import { syntaxLog } from '../../core/logger'
import { createNativeDevAuthorization, nativeMode } from './devPolicy.ts'
import { NativeHost } from './host.ts'
import { createNativeRepository, type NativeInstall } from './repository.ts'

export const nativeDevMode = nativeMode(import.meta.env.VITE_CHANNEL, import.meta.env.DEV, new URL(window.location.href))

export const useNativeDevStore = create<{
  installs: NativeInstall[]
  phase: 'loading' | 'ready' | 'recovery' | 'failed'
  error?: string
}>(() => ({ installs: [], phase: 'loading' }))

let host: NativeHost | undefined
let boot: Promise<void> | undefined
let changes: BroadcastChannel | undefined

export function getNativeDevHost(): NativeHost {
  if (nativeDevMode === 'disabled') throw new Error('Native extensions are unavailable in this build.')
  return host ??= new NativeHost(
    createNativeRepository(), sessionStorage,
    (id, error) => syntaxLog.error(`native:${id}`, 'Extension cleanup failed.', error),
    createNativeDevAuthorization(nativeDevMode),
  )
}

export async function refreshNativeDevInstalls(broadcast = true) {
  useNativeDevStore.setState({ installs: await getNativeDevHost().reconcile() })
  if (broadcast) changes?.postMessage('installs-changed')
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
    } catch (error) {
      useNativeDevStore.setState({ phase: 'failed', error: error instanceof Error ? error.message : String(error) })
    }
  })()
}
