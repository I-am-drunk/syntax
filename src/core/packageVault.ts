/**
 * IndexedDB vault for raw `.sytx` ZIP bytes + unpacked archive inspection metadata.
 * Keeps `localStorage` lean (metadata only) so Syntax never hits the 5 MB quota,
 * with an automatic in-memory Map fallback for private browsing / SSR / Node.
 */
import type { ArchiveEntryInfo, UnpackedSytx } from './archive'

const DB_NAME = 'syntax-package-vault-v1'
const STORE_NAME = 'archives'

export type VaultArchiveRecord = {
  id: string
  version: string
  sha256: string
  sizeBytes: number
  entries: ArchiveEntryInfo[]
  rawBytes: Uint8Array
  sandboxHtml?: string
  readmeMd?: string
  storedAt: string
}

const memoryCache = new Map<string, VaultArchiveRecord>()
let dbPromise: Promise<IDBDatabase | null> | null = null

function openVaultDb(): Promise<IDBDatabase | null> {
  if (typeof indexedDB === 'undefined') return Promise.resolve(null)
  if (!dbPromise) {
    dbPromise = new Promise<IDBDatabase | null>(resolve => {
      try {
        const req = indexedDB.open(DB_NAME, 1)
        req.onupgradeneeded = () => {
          const db = req.result
          if (!db.objectStoreNames.contains(STORE_NAME)) {
            db.createObjectStore(STORE_NAME, { keyPath: 'id' })
          }
        }
        req.onsuccess = () => resolve(req.result)
        req.onerror = () => resolve(null)
      } catch {
        resolve(null)
      }
    })
  }
  return dbPromise
}

export async function putVaultArchive(archive: UnpackedSytx): Promise<void> {
  const record: VaultArchiveRecord = {
    id: archive.manifest.id,
    version: archive.manifest.version,
    sha256: archive.sha256,
    sizeBytes: archive.sizeBytes,
    entries: archive.entries,
    rawBytes: archive.rawBytes,
    sandboxHtml: archive.manifest.sandboxHtml,
    readmeMd: archive.manifest.readmeMd,
    storedAt: new Date().toISOString(),
  }
  memoryCache.set(record.id, record)

  const db = await openVaultDb()
  if (!db) return
  await new Promise<void>(resolve => {
    try {
      const tx = db.transaction(STORE_NAME, 'readwrite')
      tx.objectStore(STORE_NAME).put(record)
      tx.oncomplete = () => resolve()
      tx.onerror = () => resolve()
    } catch {
      resolve()
    }
  })
}

export function getVaultArchiveSync(id: string): VaultArchiveRecord | null {
  return memoryCache.get(id) ?? null
}

export async function getVaultArchive(id: string): Promise<VaultArchiveRecord | null> {
  const cached = memoryCache.get(id)
  if (cached) return cached

  const db = await openVaultDb()
  if (!db) return null

  return new Promise<VaultArchiveRecord | null>(resolve => {
    try {
      const tx = db.transaction(STORE_NAME, 'readonly')
      const req = tx.objectStore(STORE_NAME).get(id)
      req.onsuccess = () => {
        const rec = req.result as VaultArchiveRecord | undefined
        if (rec) {
          memoryCache.set(id, rec)
          resolve(rec)
        } else {
          resolve(null)
        }
      }
      req.onerror = () => resolve(null)
    } catch {
      resolve(null)
    }
  })
}

export async function deleteVaultArchive(id: string): Promise<void> {
  memoryCache.delete(id)
  const db = await openVaultDb()
  if (!db) return
  await new Promise<void>(resolve => {
    try {
      const tx = db.transaction(STORE_NAME, 'readwrite')
      tx.objectStore(STORE_NAME).delete(id)
      tx.oncomplete = () => resolve()
      tx.onerror = () => resolve()
    } catch {
      resolve()
    }
  })
}
