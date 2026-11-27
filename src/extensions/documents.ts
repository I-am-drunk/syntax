import { ExtensionError } from './plugos/protocol.ts'

const DB_NAME = 'syntax-extensions-v1'
const DB_VERSION = 1
const STORE_NAME = 'documents'

/**
 * Syntax-owned document envelope persisted in IndexedDB.
 * Survives extension disable, uninstall, reinstall, and failed updates.
 */
export interface DocumentEnvelope<T = unknown> {
  id: string
  type: string
  title: string
  schemaVersion: number
  createdByExtensionId: string
  revision: number
  createdAt: number
  updatedAt: number
  data: T
}

export interface CreateDocumentInput<T = unknown> {
  id?: string
  type: string
  title: string
  schemaVersion?: number
  createdByExtensionId: string
  data: T
}

export interface SaveDocumentInput<T = unknown> {
  id: string
  expectedRevision: number
  title?: string
  schemaVersion?: number
  data: T
}

export interface DocumentStore {
  get<T = unknown>(id: string): Promise<DocumentEnvelope<T> | null>
  list(type?: string): Promise<DocumentEnvelope[]>
  create<T = unknown>(input: CreateDocumentInput<T>): Promise<DocumentEnvelope<T>>
  save<T = unknown>(input: SaveDocumentInput<T>): Promise<DocumentEnvelope<T>>
  /** Explicit user-initiated delete only; never called on extension disable or uninstall. */
  delete(id: string): Promise<void>
}

function generateDocId(): string {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return crypto.randomUUID()
  }
  return `doc_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 10)}`
}

function cloneData<T>(value: T): T {
  if (value === undefined) return undefined as T
  return typeof structuredClone === 'function'
    ? structuredClone(value)
    : (JSON.parse(JSON.stringify(value)) as T)
}

/**
 * In-memory DocumentStore for Node unit tests (identical revision conflict semantics).
 */
export function createMemoryDocumentStore(): DocumentStore {
  const docs = new Map<string, DocumentEnvelope>()

  return {
    async get<T = unknown>(id: string) {
      const found = docs.get(id)
      return found ? (cloneData(found) as DocumentEnvelope<T>) : null
    },
    async list(type?: string) {
      const all = [...docs.values()]
      const filtered = type ? all.filter(d => d.type === type) : all
      return filtered.sort((a, b) => b.updatedAt - a.updatedAt).map(d => cloneData(d))
    },
    async create<T = unknown>(input: CreateDocumentInput<T>) {
      if (!input.type || !input.type.trim()) {
        throw new ExtensionError('SYSCALL_DENIED', 'Document type is required.')
      }
      const id = input.id?.trim() || generateDocId()
      if (docs.has(id)) {
        throw new ExtensionError('REVISION_CONFLICT', `Document "${id}" already exists.`)
      }
      const now = Date.now()
      const env: DocumentEnvelope<T> = {
        id,
        type: input.type.trim(),
        title: (typeof input.title === 'string' ? input.title.trim() : '') || 'Untitled',
        schemaVersion: input.schemaVersion ?? 1,
        createdByExtensionId: input.createdByExtensionId,
        revision: 1,
        createdAt: now,
        updatedAt: now,
        data: cloneData(input.data),
      }
      docs.set(id, env)
      return cloneData(env)
    },
    async save<T = unknown>(input: SaveDocumentInput<T>) {
      const existing = docs.get(input.id)
      if (!existing) {
        throw new ExtensionError('REVISION_CONFLICT', `Document "${input.id}" does not exist.`)
      }
      if (existing.revision !== input.expectedRevision) {
        throw new ExtensionError(
          'REVISION_CONFLICT',
          `Document "${existing.title}" was modified elsewhere (expected revision ${input.expectedRevision}, current is ${existing.revision}).`,
        )
      }
      const next: DocumentEnvelope<T> = {
        ...existing,
        title: input.title !== undefined ? input.title.trim() || existing.title : existing.title,
        schemaVersion: input.schemaVersion ?? existing.schemaVersion,
        revision: existing.revision + 1,
        updatedAt: Date.now(),
        data: cloneData(input.data),
      }
      docs.set(input.id, next)
      return cloneData(next)
    },
    async delete(id: string) {
      docs.delete(id)
    },
  }
}

function openDocumentsDb(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, DB_VERSION)
    req.onupgradeneeded = () => {
      const db = req.result
      if (!db.objectStoreNames.contains(STORE_NAME)) {
        const store = db.createObjectStore(STORE_NAME, { keyPath: 'id' })
        store.createIndex('type', 'type', { unique: false })
        store.createIndex('updatedAt', 'updatedAt', { unique: false })
      }
    }
    req.onsuccess = () => resolve(req.result)
    req.onerror = () => reject(req.error ?? new Error('Could not open IndexedDB'))
  })
}

export function createIndexedDbDocumentStore(): DocumentStore {
  if (typeof indexedDB === 'undefined') {
    return createMemoryDocumentStore()
  }

  let dbPromise: Promise<IDBDatabase> | null = null
  const getDb = () => {
    if (!dbPromise) {
      dbPromise = openDocumentsDb()
        .then(db => {
          db.onversionchange = () => {
            db.close()
            dbPromise = null
          }
          db.onclose = () => {
            dbPromise = null
          }
          return db
        })
        .catch(err => {
          dbPromise = null
          throw err
        })
    }
    return dbPromise
  }

  return {
    async get<T = unknown>(id: string) {
      const db = await getDb()
      return await new Promise<DocumentEnvelope<T> | null>((resolve, reject) => {
        const tx = db.transaction(STORE_NAME, 'readonly')
        const req = tx.objectStore(STORE_NAME).get(id)
        req.onsuccess = () => resolve((req.result as DocumentEnvelope<T> | undefined) ?? null)
        req.onerror = () => reject(req.error ?? new Error('Read failed'))
      })
    },

    async list(type?: string) {
      const db = await getDb()
      return await new Promise<DocumentEnvelope[]>((resolve, reject) => {
        const tx = db.transaction(STORE_NAME, 'readonly')
        const store = tx.objectStore(STORE_NAME)
        const req = type ? store.index('type').getAll(type) : store.getAll()
        req.onsuccess = () => {
          const rows = (req.result as DocumentEnvelope[] | undefined) ?? []
          resolve(rows.sort((a, b) => b.updatedAt - a.updatedAt))
        }
        req.onerror = () => reject(req.error ?? new Error('List failed'))
      })
    },

    async create<T = unknown>(input: CreateDocumentInput<T>) {
      if (!input.type || !input.type.trim()) {
        throw new ExtensionError('SYSCALL_DENIED', 'Document type is required.')
      }
      const db = await getDb()
      const id = input.id?.trim() || generateDocId()
      const now = Date.now()
      const env: DocumentEnvelope<T> = {
        id,
        type: input.type.trim(),
        title: (typeof input.title === 'string' ? input.title.trim() : '') || 'Untitled',
        schemaVersion: input.schemaVersion ?? 1,
        createdByExtensionId: input.createdByExtensionId,
        revision: 1,
        createdAt: now,
        updatedAt: now,
        data: cloneData(input.data),
      }
      return await new Promise<DocumentEnvelope<T>>((resolve, reject) => {
        const tx = db.transaction(STORE_NAME, 'readwrite')
        const store = tx.objectStore(STORE_NAME)
        let settled = false
        let reqErr: Error | null = null
        const fail = (err: Error) => {
          if (settled) return
          settled = true
          reject(err)
        }
        const ok = (val: DocumentEnvelope<T>) => {
          if (settled) return
          settled = true
          resolve(val)
        }
        const req = store.add(env)
        req.onerror = () => {
          reqErr =
            req.error?.name === 'ConstraintError'
              ? new ExtensionError('REVISION_CONFLICT', `Document "${id}" already exists.`)
              : (req.error ?? new Error('Create failed'))
          fail(reqErr)
        }
        tx.onabort = () => fail(reqErr ?? tx.error ?? new Error('Create aborted'))
        tx.onerror = () => fail(reqErr ?? tx.error ?? new Error('Create transaction failed'))
        tx.oncomplete = () => ok(cloneData(env))
      })
    },

    async save<T = unknown>(input: SaveDocumentInput<T>) {
      const db = await getDb()
      return await new Promise<DocumentEnvelope<T>>((resolve, reject) => {
        const tx = db.transaction(STORE_NAME, 'readwrite')
        const store = tx.objectStore(STORE_NAME)
        const getReq = store.get(input.id)
        let saved: DocumentEnvelope<T> | null = null
        let conflictErr: ExtensionError | null = null
        let settled = false
        const fail = (err: Error) => {
          if (settled) return
          settled = true
          reject(err)
        }
        const ok = (val: DocumentEnvelope<T>) => {
          if (settled) return
          settled = true
          resolve(val)
        }

        getReq.onsuccess = () => {
          const existing = getReq.result as DocumentEnvelope<T> | undefined
          if (!existing) {
            conflictErr = new ExtensionError(
              'REVISION_CONFLICT',
              `Document "${input.id}" does not exist.`,
            )
            tx.abort()
            return
          }
          if (existing.revision !== input.expectedRevision) {
            conflictErr = new ExtensionError(
              'REVISION_CONFLICT',
              `Document "${existing.title}" was modified elsewhere (expected revision ${input.expectedRevision}, current is ${existing.revision}).`,
            )
            tx.abort()
            return
          }
          saved = {
            ...existing,
            title:
              typeof input.title === 'string' ? input.title.trim() || existing.title : existing.title,
            schemaVersion: input.schemaVersion ?? existing.schemaVersion,
            revision: existing.revision + 1,
            updatedAt: Date.now(),
            data: cloneData(input.data),
          }
          store.put(saved)
        }
        getReq.onerror = () => {
          fail(getReq.error ?? new Error('Read before save failed'))
        }
        tx.onabort = () => {
          fail(conflictErr ?? tx.error ?? new Error('Save aborted'))
        }
        tx.onerror = () => {
          fail(conflictErr ?? tx.error ?? new Error('Save transaction failed'))
        }
        tx.oncomplete = () => {
          if (saved) ok(cloneData(saved))
          else fail(new Error('Save completed without result'))
        }
      })
    },

    async delete(id: string) {
      const db = await getDb()
      await new Promise<void>((resolve, reject) => {
        const tx = db.transaction(STORE_NAME, 'readwrite')
        let settled = false
        const fail = (err: Error) => {
          if (settled) return
          settled = true
          reject(err)
        }
        tx.objectStore(STORE_NAME).delete(id)
        tx.oncomplete = () => {
          if (settled) return
          settled = true
          resolve()
        }
        tx.onabort = () => fail(tx.error ?? new Error('Delete aborted'))
        tx.onerror = () => fail(tx.error ?? new Error('Delete failed'))
      })
    },
  }
}

export const documentStore: DocumentStore = createIndexedDbDocumentStore()
