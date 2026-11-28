import { z } from 'zod'

export const COMMUNITY_CATALOG_URL =
  'https://syntax-platform.github.io/syntax-community/catalog/catalog.json'
export const COMMUNITY_HUB_WEB_URL = 'https://syntax-platform.github.io/syntax-community/'
export const OFFICIAL_EXTENSIONS_REPO_URL =
  'https://github.com/syntax-platform/syntax-official-extensions'

const CATALOG_FETCH_TIMEOUT_MS = 8_000

const httpUrlSchema = z
  .string()
  .url()
  .refine(u => u.startsWith('https://') || u.startsWith('http://'))

const catalogEntrySchema = z.object({
  id: z.string().min(3),
  manifestVersion: z.union([z.literal(1), z.literal(2)]).default(1),
  kind: z.enum(['extension', 'course']).default('extension'),
  name: z.string().min(1),
  version: z.string().min(1),
  syntaxApi: z.string().optional(),
  sha256: z.string().regex(/^[0-9a-f]{64}$/).optional(),
  description: z.string().optional(),
  author: z.string().optional(),
  icon: httpUrlSchema.optional(),
  previewImages: z.array(httpUrlSchema).max(6).default([]),
  manifestUrl: httpUrlSchema,
  tested: z.boolean().optional(),
  tags: z.array(z.string()).default([]),
})

const catalogDocumentSchema = z.object({
  schemaVersion: z.number().int().min(1),
  updatedAt: z.string().optional(),
  packages: z.array(z.unknown()).default([]),
})

export type CatalogEntry = z.infer<typeof catalogEntrySchema>

export type CatalogState =
  | { status: 'idle'; entries: CatalogEntry[]; updatedAt: string | null; error: null }
  | { status: 'loading'; entries: CatalogEntry[]; updatedAt: string | null; error: null }
  | { status: 'ready'; entries: CatalogEntry[]; updatedAt: string | null; error: null }
  | { status: 'error'; entries: CatalogEntry[]; updatedAt: string | null; error: string }

/**
 * Honest catalog fetcher: reports real network/parse state and only returns
 * entries whose manifestUrl and metadata match the v1 extension schema.
 */
export async function fetchExtensionCatalog(
  url = COMMUNITY_CATALOG_URL,
  signal?: AbortSignal,
  timeoutMs = CATALOG_FETCH_TIMEOUT_MS,
): Promise<CatalogState> {
  const controller = new AbortController()
  let timedOut = false
  const onCallerAbort = () => controller.abort()
  if (signal?.aborted) {
    return { status: 'idle', entries: [], updatedAt: null, error: null }
  }
  signal?.addEventListener('abort', onCallerAbort, { once: true })
  const timer = globalThis.setTimeout(() => {
    timedOut = true
    controller.abort()
  }, timeoutMs)

  try {
    const res = await fetch(url, {
      mode: 'cors',
      credentials: 'omit',
      cache: 'no-store',
      signal: controller.signal,
    })
    if (!res.ok) {
      return {
        status: 'error',
        entries: [],
        updatedAt: null,
        error: `Catalog server returned HTTP ${res.status}.`,
      }
    }
    const raw = (await res.json()) as unknown
    const doc = catalogDocumentSchema.safeParse(raw)
    if (!doc.success) {
      return {
        status: 'error',
        entries: [],
        updatedAt: null,
        error: 'Catalog JSON did not match expected format.',
      }
    }
    const entries: CatalogEntry[] = []
    for (const item of doc.data.packages) {
      const parsed = catalogEntrySchema.safeParse(item)
      if (parsed.success) entries.push(parsed.data)
    }
    return {
      status: 'ready',
      entries,
      updatedAt: doc.data.updatedAt ?? null,
      error: null,
    }
  } catch (err) {
    if (err instanceof DOMException && err.name === 'AbortError') {
      if (timedOut) {
        return {
          status: 'error',
          entries: [],
          updatedAt: null,
          error: `Catalog request timed out after ${Math.round(timeoutMs / 1000)}s.`,
        }
      }
      return { status: 'idle', entries: [], updatedAt: null, error: null }
    }
    return {
      status: 'error',
      entries: [],
      updatedAt: null,
      error: err instanceof Error ? err.message : 'Failed to fetch catalog.',
    }
  } finally {
    globalThis.clearTimeout(timer)
    signal?.removeEventListener('abort', onCallerAbort)
  }
}
