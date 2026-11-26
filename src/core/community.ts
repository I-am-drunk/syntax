import { OFFICIAL_BY_ID, OFFICIAL_CATALOG, RETIRED_OFFICIAL_IDS } from '../packages/catalog'
import { syntaxLog } from './logger'
import {
  normalizeExternalManifest,
  stripManifestForStorage,
  validatePackageManifest,
  type SyntaxPackageManifest,
} from './packages'

export const COMMUNITY_HUB_WEB_URL = 'https://i-am-drunk.github.io/syntax-community/'
export const COMMUNITY_CATALOG_URL =
  'https://i-am-drunk.github.io/syntax-community/catalog/catalog.json'

const CACHE_KEY = 'syntax-community-catalog-cache-v3'
const OFFICIAL_ID_SET = new Set(OFFICIAL_BY_ID.keys())

export type CommunityCatalogState = {
  items: SyntaxPackageManifest[]
  source: 'live' | 'cached' | 'offline-official'
  updatedAt: string
  warning?: string
}

interface StoredCatalogCache {
  updatedAt: string
  items: SyntaxPackageManifest[]
}

function mergeWithOfficial(remoteItems: SyntaxPackageManifest[]): SyntaxPackageManifest[] {
  const byId = new Map<string, SyntaxPackageManifest>()
  for (const item of OFFICIAL_CATALOG) {
    byId.set(item.id, item)
  }
  for (const rawItem of remoteItems) {
    if (RETIRED_OFFICIAL_IDS.has(rawItem.id)) continue
    const existing = byId.get(rawItem.id)
    if (existing && OFFICIAL_ID_SET.has(rawItem.id)) {
      byId.set(rawItem.id, { ...existing, packageUrl: rawItem.packageUrl ?? existing.packageUrl })
    } else {
      byId.set(rawItem.id, normalizeExternalManifest(rawItem, OFFICIAL_ID_SET))
    }
  }
  return Array.from(byId.values())
}

function readCachedCatalog(): StoredCatalogCache | null {
  try {
    const raw = localStorage.getItem(CACHE_KEY)
    if (!raw) return null
    const parsed = JSON.parse(raw) as Partial<StoredCatalogCache> | null
    if (!parsed || !Array.isArray(parsed.items)) return null
    const valid: SyntaxPackageManifest[] = []
    for (const item of parsed.items) {
      const check = validatePackageManifest(item)
      if (check.ok && !RETIRED_OFFICIAL_IDS.has(check.manifest.id)) {
        valid.push(normalizeExternalManifest(check.manifest, OFFICIAL_ID_SET))
      }
    }
    if (valid.length === 0) return null
    return {
      updatedAt: typeof parsed.updatedAt === 'string' ? parsed.updatedAt : new Date().toISOString(),
      items: valid,
    }
  } catch {
    return null
  }
}

function writeCachedCatalog(communityOnly: SyntaxPackageManifest[], updatedAt: string) {
  try {
    const payload: StoredCatalogCache = {
      updatedAt,
      items: communityOnly.map(stripManifestForStorage),
    }
    localStorage.setItem(CACHE_KEY, JSON.stringify(payload))
  } catch {
    // ignore quota errors
  }
}

export function getInitialCommunityCatalog(): CommunityCatalogState {
  const cached = readCachedCatalog()
  if (cached) {
    return {
      items: mergeWithOfficial(cached.items),
      source: 'cached',
      updatedAt: cached.updatedAt,
    }
  }
  return {
    items: [...OFFICIAL_CATALOG],
    source: 'offline-official',
    updatedAt: new Date().toISOString(),
  }
}

export async function fetchCommunityCatalog(
  signal?: AbortSignal,
): Promise<CommunityCatalogState | null> {
  if (signal?.aborted) return null

  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), 6000)
  const forwardAbort = () => controller.abort()
  signal?.addEventListener('abort', forwardAbort)

  try {
    const res = await fetch(COMMUNITY_CATALOG_URL, {
      signal: controller.signal,
      cache: 'no-cache',
    })
    if (!res.ok) {
      throw new Error(`HTTP ${res.status}`)
    }
    const json = (await res.json()) as { packages?: unknown[] }
    const rawList = Array.isArray(json?.packages) ? json.packages : []
    const valid: SyntaxPackageManifest[] = []
    let skipped = 0

    for (const entry of rawList) {
      const check = validatePackageManifest(entry)
      if (check.ok && !RETIRED_OFFICIAL_IDS.has(check.manifest.id)) {
        valid.push(normalizeExternalManifest(check.manifest, OFFICIAL_ID_SET))
      } else if (!check.ok) {
        skipped++
      }
    }

    if (skipped > 0) {
      syntaxLog.warn('community', `Skipped ${skipped} invalid catalog entries from remote hub`)
    }

    const updatedAt = new Date().toISOString()
    // Store only non-official items in cache so retired official items can never resurrect.
    const communityOnly = valid.filter(item => !OFFICIAL_ID_SET.has(item.id))
    writeCachedCatalog(communityOnly, updatedAt)

    const merged = mergeWithOfficial(valid)
    syntaxLog.info('community', `Loaded ${merged.length} packages from Syntax Community Hub`)

    return {
      items: merged,
      source: 'live',
      updatedAt,
    }
  } catch (err) {
    if (signal?.aborted) {
      return null
    }
    const cached = readCachedCatalog()
    const msg = err instanceof Error ? err.message : String(err)
    syntaxLog.warn('community', 'Community Hub fetch fell back to local catalog', { reason: msg })
    return {
      items: cached ? mergeWithOfficial(cached.items) : [...OFFICIAL_CATALOG],
      source: cached ? 'cached' : 'offline-official',
      updatedAt: cached?.updatedAt ?? new Date().toISOString(),
      warning: 'Showing built-in and cached packages (Community Hub is unreachable right now).',
    }
  } finally {
    clearTimeout(timer)
    signal?.removeEventListener('abort', forwardAbort)
  }
}

export function readInstallDeepLink(): string | null {
  try {
    const params = new URLSearchParams(window.location.search)
    const fromQuery = params.get('install')
    if (fromQuery && /^[a-z0-9][a-z0-9-]{1,62}$/i.test(fromQuery)) {
      return fromQuery.toLowerCase()
    }
    const hash = window.location.hash
    const hashMatch = hash.match(/^#\/?(?:install[=/]|\?install=)([a-z0-9-]+)$/i)
    if (hashMatch) return hashMatch[1]!.toLowerCase()
  } catch {
    // ignore
  }
  return null
}

/**
 * Removes only the ?install= parameter or #/install/<id> hash while preserving
 * all other query parameters (especially Clerk's __clerk_db_jwt handshake params).
 */
export function clearInstallDeepLink() {
  try {
    const url = new URL(window.location.href)
    let changed = false
    if (url.searchParams.has('install')) {
      url.searchParams.delete('install')
      changed = true
    }
    if (/^#\/?(?:install[=/]|\?install=)[a-z0-9-]+$/i.test(url.hash)) {
      url.hash = '#/community'
      changed = true
    }
    if (changed) {
      history.replaceState(null, '', url.pathname + url.search + url.hash)
    }
  } catch {
    // ignore
  }
}
