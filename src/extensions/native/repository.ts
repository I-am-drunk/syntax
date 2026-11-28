import { channelStateKey } from '../../core/channelState.ts'
import type { NativeData } from './api.ts'
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
}

export function createNativeRepository(factory: IDBFactory = indexedDB): NativeRepository {
  const name = channelStateKey('syntax-native-extensions-v2')

  async function transaction<T>(
    storeNames: string | string[],
    mode: IDBTransactionMode,
    run: (transaction: IDBTransaction, setResult: (value: T) => void) => void,
  ): Promise<T> {
    const db = await new Promise<IDBDatabase>((resolve, reject) => {
      const request = factory.open(name, 1)
      request.onupgradeneeded = () => {
        request.result.createObjectStore('installs')
        request.result.createObjectStore('data')
      }
      request.onsuccess = () => resolve(request.result)
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
  }
}
