import { z } from 'zod'

export const COMMUNITY_CATALOG_URL =
  'https://syntax-platform.github.io/syntax-community/catalog/catalog.json'
export const COMMUNITY_HUB_WEB_URL = 'https://syntax-platform.github.io/syntax-community/'
export const OFFICIAL_EXTENSIONS_REPO_URL =
  'https://github.com/syntax-platform/syntax-official-plugins'

const catalogEntrySchema = z.object({
  id: z.string().min(3),
  name: z.string().min(1),
  version: z.string().min(1),
  description: z.string().optional(),
  author: z.string().optional(),
  manifestUrl: z.string().url().refine(u => u.startsWith('https://') || u.startsWith('http://')),
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
): Promise<CatalogState> {
  try {
    const res = await fetch(url, { mode: 'cors', credentials: 'omit', cache: 'no-store', signal })
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
      return { status: 'idle', entries: [], updatedAt: null, error: null }
    }
    return {
      status: 'error',
      entries: [],
      updatedAt: null,
      error: err instanceof Error ? err.message : 'Failed to fetch catalog.',
    }
  }
}
