import { channelStateKey } from '../../core/channelState.ts'
import type { NativeCourseProgress, NativeData } from './api.ts'
import { NativePackageError } from './manifest.ts'
import type { NativePackage } from './package.ts'
import type { NativeDataStore } from './runtime.ts'

export interface NativeInstall {
  package: NativePackage
  revision: string
  enabled: boolean
  failure?: string
  failedSha256?: string
  failureAt?: string
  retryCaution?: boolean
}

export interface NativeRepository extends NativeDataStore {
  list(): Promise<NativeInstall[]>
  get(id: string): Promise<NativeInstall | undefined>
  replace(id: string, expected: string | undefined, next: NativeInstall): Promise<void>
  remove(id: string): Promise<void>
  listProgress(): Promise<Record<string, NativeCourseProgress>>
  listDataOwners(): Promise<string[]>
  clearOwnerData(ownerId: string): Promise<void>
}

export function createNativeRepository(factory: IDBFactory = indexedDB): NativeRepository {
  const name = channelStateKey('syntax-native-extensions-v2')

  async function transaction<T>(
    storeNames: string | string[],
    mode: IDBTransactionMode,
    run: (transaction: IDBTransaction, setResult: (value: T) => void) => void,
  ): Promise<T> {
    const db = await new Promise<IDBDatabase>((resolve, reject) => {
      const request = factory.open(name, 2)
      request.onupgradeneeded = () => {
        const database = request.result
        if (!database.objectStoreNames.contains('installs')) database.createObjectStore('installs')
        if (!database.objectStoreNames.contains('data')) database.createObjectStore('data')
        if (!database.objectStoreNames.contains('progress')) database.createObjectStore('progress')
      }
      request.onsuccess = () => {
        const database = request.result
        database.onversionchange = () => database.close()
        resolve(database)
      }
      request.onblocked = () => reject(new Error('Another Syntax tab is holding an older storage connection. Close or reload other tabs and try again.'))
      request.onerror = () => reject(request.error)
    })
    try {
      return await new Promise<T>((resolve, reject) => {
        const tx = db.transaction(storeNames, mode)
        let result: T
        tx.oncomplete = () => resolve(result)
        tx.onabort = () => reject(tx.error ?? new NativePackageError('INSTALL_CHANGED', 'The installed extension changed in another operation.'))
        run(tx, value => { result = value })
      })
    } finally {
      db.close()
    }
  }

  return {
    list: () => transaction<NativeInstall[]>('installs', 'readonly', (tx, result) => {
      const request = tx.objectStore('installs').getAll()
      request.onsuccess = () => result(request.result)
    }),
    get: id => transaction<NativeInstall | undefined>('installs', 'readonly', (tx, result) => {
      const request = tx.objectStore('installs').get(id)
      request.onsuccess = () => result(request.result)
    }),
    replace: (id, expected, next) => transaction<void>('installs', 'readwrite', tx => {
      const store = tx.objectStore('installs')
      const request = store.get(id)
      request.onsuccess = () => {
        const current = request.result as NativeInstall | undefined
        if (current?.revision !== expected) {
          tx.abort()
          return
        }
        store.put(next, id)
      }
    }),
    remove: id => transaction<void>('installs', 'readwrite', tx => {
      tx.objectStore('installs').delete(id)
    }),
    load: id => transaction<NativeData | undefined>('data', 'readonly', (tx, result) => {
      const request = tx.objectStore('data').get(id)
      request.onsuccess = () => result(request.result)
    }),
    save: (id, value, revision) => transaction<void>(['installs', 'data'], 'readwrite', tx => {
      const request = tx.objectStore('installs').get(id)
      request.onsuccess = () => {
        const current = request.result as NativeInstall | undefined
        if (!current?.enabled || current.revision !== revision) {
          tx.abort()
          return
        }
        tx.objectStore('data').put(value, id)
      }
    }),
    loadProgress: id => transaction<NativeCourseProgress | undefined>('progress', 'readonly', (tx, result) => {
      const request = tx.objectStore('progress').get(id)
      request.onsuccess = () => result(request.result)
    }),
    saveProgress: (id, progress, revision) => transaction<void>(['installs', 'progress'], 'readwrite', tx => {
      const request = tx.objectStore('installs').get(id)
      request.onsuccess = () => {
        const current = request.result as NativeInstall | undefined
        if (!current?.enabled || current.revision !== revision) {
          tx.abort()
          return
        }
        const store = tx.objectStore('progress')
        if (progress === null) store.delete(id)
        else store.put(progress, id)
      }
    }),
    listProgress: () => transaction<Record<string, NativeCourseProgress>>('progress', 'readonly', (tx, result) => {
      const store = tx.objectStore('progress')
      const out: Record<string, NativeCourseProgress> = {}
      const cursorReq = store.openCursor()
      cursorReq.onsuccess = () => {
        const cursor = cursorReq.result
        if (!cursor) {
          result(out)
          return
        }
        if (typeof cursor.key === 'string') {
          out[cursor.key] = cursor.value as NativeCourseProgress
        }
        cursor.continue()
      }
    }),
    listDataOwners: () => transaction<string[]>(['data', 'progress'], 'readonly', (tx, result) => {
      const owners = new Set<string>()
      let pending = 2
      const done = () => {
        pending -= 1
        if (pending === 0) result([...owners].sort())
      }
      const dataKeys = tx.objectStore('data').getAllKeys()
      dataKeys.onsuccess = () => {
        for (const k of dataKeys.result) if (typeof k === 'string') owners.add(k)
        done()
      }
      const progressKeys = tx.objectStore('progress').getAllKeys()
      progressKeys.onsuccess = () => {
        for (const k of progressKeys.result) if (typeof k === 'string') owners.add(k)
        done()
      }
    }),
    clearOwnerData: id => transaction<void>(['data', 'progress'], 'readwrite', tx => {
      tx.objectStore('data').delete(id)
      tx.objectStore('progress').delete(id)
    }),
  }
}
