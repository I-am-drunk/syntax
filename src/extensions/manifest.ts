import { z } from 'zod'
import { ExtensionError } from './plugos/protocol.ts'

export const SYNTAX_EXTENSION_API_VERSION = '1.0.0'
const MANIFEST_FETCH_TIMEOUT_MS = 8_000
const MAX_MANIFEST_BYTES = 256 * 1024

const EXT_ID_RE = /^[a-z0-9][a-z0-9.-]{1,62}[a-z0-9]$/
const LOCAL_ID_RE = /^[a-z0-9][a-z0-9._-]{0,63}$/i
const SEMVER_RE = /^(\d+)\.(\d+)\.(\d+)(?:-([0-9A-Za-z.-]+))?$/
const SEMVER_RANGE_RE =
  /^(?:\^|~|>=|>|<=|<)?\d+\.\d+\.\d+(?:-[0-9A-Za-z.-]+)?(?:\s+(?:>=|>|<=|<)\d+\.\d+\.\d+(?:-[0-9A-Za-z.-]+)?)?$/

function isSafeRelativeOrHttpUrl(raw: string): boolean {
  const trimmed = raw.trim()
  if (!trimmed) return false
  if (/^(javascript|data|blob|file|vbscript):/i.test(trimmed)) return false
  return true
}

const safePathSchema = z
  .string()
  .trim()
  .min(1)
  .max(512)
  .refine(isSafeRelativeOrHttpUrl, 'Disallowed URL scheme')

export const commandDeclarationSchema = z.object({
  id: z.string().trim().regex(LOCAL_ID_RE, 'Invalid command id'),
  title: z.string().trim().min(1).max(80),
  /** Exported function name in worker.js (defaults to command id) */
  run: z.string().trim().min(1).max(80).optional(),
})

export const toolbarDeclarationSchema = z
  .object({
    id: z.string().trim().regex(LOCAL_ID_RE, 'Invalid toolbar id'),
    label: z.string().trim().min(1).max(40),
    /** Either invokes one of this extension's commands or opens one of its views */
    commandId: z.string().trim().min(1).max(80).optional(),
    viewId: z.string().trim().min(1).max(80).optional(),
  })
  .refine(t => Boolean(t.commandId) !== Boolean(t.viewId), {
    message: 'Toolbar item must specify exactly one of commandId or viewId',
  })

export const viewDeclarationSchema = z.object({
  id: z.string().trim().regex(LOCAL_ID_RE, 'Invalid view id'),
  title: z.string().trim().min(1).max(80),
  entry: safePathSchema,
  placement: z.enum(['page', 'tab', 'embed']).default('page'),
  docTypes: z.array(z.string().trim().min(1).max(64)).max(16).default([]),
})

export const settingDeclarationSchema = z
  .object({
    id: z.string().trim().regex(LOCAL_ID_RE, 'Invalid setting id'),
    type: z.enum(['boolean', 'string', 'number']),
    label: z.string().trim().min(1).max(80),
    default: z.union([z.boolean(), z.string(), z.number()]),
  })
  .superRefine((setting, ctx) => {
    if (typeof setting.default !== setting.type) {
      ctx.addIssue({
        code: 'custom',
        path: ['default'],
        message: `default value must be of type "${setting.type}" (got "${typeof setting.default}").`,
      })
    }
  })

function checkDuplicateIds(
  items: ReadonlyArray<{ id: string }>,
  field: 'commands' | 'views' | 'toolbar' | 'settings',
  ctx: z.RefinementCtx,
) {
  const seen = new Set<string>()
  items.forEach((item, idx) => {
    if (seen.has(item.id)) {
      ctx.addIssue({
        code: 'custom',
        path: [field, idx, 'id'],
        message: `Duplicate ${field} id "${item.id}".`,
      })
    } else {
      seen.add(item.id)
    }
  })
}

export const extensionManifestSchema = z
  .object({
    formatVersion: z.literal(1),
    kind: z.enum(['extension', 'course']).default('extension'),
    id: z
      .string()
      .trim()
      .regex(EXT_ID_RE, 'id must be 3-64 lowercase letters, digits, dots, or hyphens'),
    name: z.string().trim().min(1).max(80),
    version: z.string().trim().regex(SEMVER_RE, 'version must be valid semver (e.g. 1.0.0)'),
    syntaxApi: z
      .string()
      .trim()
      .regex(SEMVER_RANGE_RE, 'syntaxApi must be a valid semver range (e.g. ^1.0.0)')
      .default('^1.0.0'),
    description: z.string().trim().max(240).optional(),
    author: z.string().trim().max(80).optional(),
    icon: safePathSchema.optional(),
    worker: safePathSchema.optional(),
    views: z.array(viewDeclarationSchema).max(24).default([]),
    commands: z.array(commandDeclarationSchema).max(64).default([]),
    toolbar: z.array(toolbarDeclarationSchema).max(12).default([]),
    settings: z.array(settingDeclarationSchema).max(32).default([]),
    services: z
      .object({
        provides: z
          .record(z.string().trim().min(2).max(96), z.string().trim().regex(SEMVER_RE))
          .default({}),
        requires: z
          .record(z.string().trim().min(2).max(96), z.string().trim().regex(SEMVER_RANGE_RE))
          .default({}),
        optional: z
          .record(z.string().trim().min(2).max(96), z.string().trim().regex(SEMVER_RANGE_RE))
          .default({}),
      })
      .default({ provides: {}, requires: {}, optional: {} }),
  })
  .superRefine((m, ctx) => {
    checkDuplicateIds(m.commands, 'commands', ctx)
    checkDuplicateIds(m.views, 'views', ctx)
    checkDuplicateIds(m.toolbar, 'toolbar', ctx)
    checkDuplicateIds(m.settings, 'settings', ctx)

    const cmdIds = new Set(m.commands.map(c => c.id))
    const viewIds = new Set(m.views.map(v => v.id))

    if (m.commands.length > 0 && !m.worker) {
      ctx.addIssue({
        code: 'custom',
        path: ['worker'],
        message: 'worker is required when commands are declared.',
      })
    }
    if (Object.keys(m.services.provides).length > 0 && !m.worker) {
      ctx.addIssue({
        code: 'custom',
        path: ['worker'],
        message: 'worker is required when services.provides are declared.',
      })
    }

    for (const svc of Object.keys(m.services.requires)) {
      if (svc in m.services.optional) {
        ctx.addIssue({
          code: 'custom',
          path: ['services', 'optional', svc],
          message: `Service "${svc}" cannot be declared in both services.requires and services.optional.`,
        })
      }
      if (svc in m.services.provides) {
        ctx.addIssue({
          code: 'custom',
          path: ['services', 'requires', svc],
          message: `Extension cannot require service "${svc}" that it also provides.`,
        })
      }
    }

    m.toolbar.forEach((item, idx) => {
      if (item.commandId && !cmdIds.has(item.commandId)) {
        ctx.addIssue({
          code: 'custom',
          path: ['toolbar', idx, 'commandId'],
          message: `toolbar[${idx}].commandId "${item.commandId}" does not match any declared command.`,
        })
      }
      if (item.viewId && !viewIds.has(item.viewId)) {
        ctx.addIssue({
          code: 'custom',
          path: ['toolbar', idx, 'viewId'],
          message: `toolbar[${idx}].viewId "${item.viewId}" does not match any declared view.`,
        })
      }
    })
  })

export type ExtensionManifest = z.infer<typeof extensionManifestSchema>
export type CommandDeclaration = z.infer<typeof commandDeclarationSchema>
export type ToolbarDeclaration = z.infer<typeof toolbarDeclarationSchema>
export type ViewDeclaration = z.infer<typeof viewDeclarationSchema>
export type SettingDeclaration = z.infer<typeof settingDeclarationSchema>

export interface ResolvedExtensionAssets {
  manifestUrl: string
  baseUrl: string
  origin: string
  workerUrl: string | null
  iconUrl: string | null
  viewUrls: Record<string, string>
}

export interface ParsedSemver {
  major: number
  minor: number
  patch: number
  pre: string[]
}

export function parseSemver(raw: string): ParsedSemver | null {
  const m = SEMVER_RE.exec(raw.trim())
  if (!m) return null
  return {
    major: Number.parseInt(m[1]!, 10),
    minor: Number.parseInt(m[2]!, 10),
    patch: Number.parseInt(m[3]!, 10),
    pre: m[4] ? m[4].split('.') : [],
  }
}

export function compareSemver(a: string, b: string): number {
  const pa = parseSemver(a)
  const pb = parseSemver(b)
  if (!pa || !pb) return 0
  if (pa.major !== pb.major) return pa.major > pb.major ? 1 : -1
  if (pa.minor !== pb.minor) return pa.minor > pb.minor ? 1 : -1
  if (pa.patch !== pb.patch) return pa.patch > pb.patch ? 1 : -1
  if (pa.pre.length > 0 && pb.pre.length === 0) return -1
  if (pa.pre.length === 0 && pb.pre.length > 0) return 1
  const len = Math.max(pa.pre.length, pb.pre.length)
  for (let i = 0; i < len; i++) {
    const ia = pa.pre[i]
    const ib = pb.pre[i]
    if (ia === undefined) return -1
    if (ib === undefined) return 1
    if (ia === ib) continue
    const aNum = /^\d+$/.test(ia)
    const bNum = /^\d+$/.test(ib)
    if (aNum && bNum) {
      const diff = Number.parseInt(ia, 10) - Number.parseInt(ib, 10)
      if (diff !== 0) return diff > 0 ? 1 : -1
    } else if (aNum) {
      return -1
    } else if (bNum) {
      return 1
    } else {
      return ia > ib ? 1 : -1
    }
  }
  return 0
}

/**
 * Pure TypeScript semver range check supporting exact, `^`, `~`, `>=`, `>`, `<=`, `<`
 * and whitespace-separated comparator intersections (e.g. `>=1.0.0 <2.0.0`).
 */
export function satisfiesSemver(version: string, range: string): boolean {
  const actual = parseSemver(version)
  if (!actual) return false
  const parts = range.trim().split(/\s+/).filter(Boolean)
  if (parts.length === 0) return false

  for (const token of parts) {
    if (token.startsWith('^')) {
      const target = parseSemver(token.slice(1))
      if (!target) return false
      if (compareSemver(version, token.slice(1)) < 0) return false
      if (target.major > 0) {
        if (actual.major !== target.major) return false
      } else if (target.minor > 0) {
        if (actual.major !== 0 || actual.minor !== target.minor) return false
      } else {
        if (actual.major !== 0 || actual.minor !== 0 || actual.patch !== target.patch) return false
      }
    } else if (token.startsWith('~')) {
      const target = parseSemver(token.slice(1))
      if (!target) return false
      if (compareSemver(version, token.slice(1)) < 0) return false
      if (actual.major !== target.major || actual.minor !== target.minor) return false
    } else if (token.startsWith('>=')) {
      if (compareSemver(version, token.slice(2)) < 0) return false
    } else if (token.startsWith('<=')) {
      if (compareSemver(version, token.slice(2)) > 0) return false
    } else if (token.startsWith('>')) {
      if (compareSemver(version, token.slice(1)) <= 0) return false
    } else if (token.startsWith('<')) {
      if (compareSemver(version, token.slice(1)) >= 0) return false
    } else {
      if (compareSemver(version, token) !== 0) return false
    }
  }
  return true
}

export function validateExtensionManifest(raw: unknown): ExtensionManifest {
  const parsed = extensionManifestSchema.safeParse(raw)
  if (!parsed.success) {
    const details = parsed.error.issues
      .map(issue => {
        const path = issue.path.length > 0 ? `${issue.path.join('.')}: ` : ''
        return `${path}${issue.message}`
      })
      .join('; ')
    throw new ExtensionError('MANIFEST_INVALID', `Invalid extension.json: ${details}`, {
      detail: details,
    })
  }
  return parsed.data
}

function assertHttpUrl(url: URL, field: string) {
  if (url.protocol !== 'http:' && url.protocol !== 'https:') {
    throw new ExtensionError(
      'MANIFEST_INVALID',
      `${field} must resolve to http: or https: (got ${url.protocol})`,
    )
  }
}

export function resolveExtensionAssets(
  manifestUrl: string,
  manifest: ExtensionManifest,
): ResolvedExtensionAssets {
  let manifestParsed: URL
  try {
    manifestParsed = new URL(manifestUrl)
  } catch {
    throw new ExtensionError('MANIFEST_INVALID', `Invalid manifest URL: ${manifestUrl}`)
  }
  assertHttpUrl(manifestParsed, 'manifestUrl')

  const baseUrl = new URL('./', manifestParsed).href
  const resolveAsset = (rel: string, field: string): string => {
    const resolved = new URL(rel, manifestParsed)
    assertHttpUrl(resolved, field)
    if (resolved.origin !== manifestParsed.origin) {
      throw new ExtensionError(
        'MANIFEST_INVALID',
        `${field} must be hosted on the same origin as extension.json (${manifestParsed.origin}, got ${resolved.origin}).`,
        { extensionId: manifest.id },
      )
    }
    return resolved.href
  }

  const viewUrls: Record<string, string> = {}
  for (const view of manifest.views) {
    viewUrls[view.id] = resolveAsset(view.entry, `views.${view.id}.entry`)
  }

  return {
    manifestUrl: manifestParsed.href,
    baseUrl,
    origin: manifestParsed.origin,
    workerUrl: manifest.worker ? resolveAsset(manifest.worker, 'worker') : null,
    iconUrl: manifest.icon ? resolveAsset(manifest.icon, 'icon') : null,
    viewUrls,
  }
}

export async function fetchExtensionManifest(
  manifestUrl: string,
  timeoutMs = MANIFEST_FETCH_TIMEOUT_MS,
): Promise<{ manifest: ExtensionManifest; assets: ResolvedExtensionAssets }> {
  let parsedUrl: URL
  try {
    parsedUrl = new URL(manifestUrl.trim())
  } catch {
    throw new ExtensionError('MANIFEST_INVALID', `Invalid URL: ${manifestUrl}`)
  }
  assertHttpUrl(parsedUrl, 'manifestUrl')

  const controller = new AbortController()
  const timer = globalThis.setTimeout(() => controller.abort(), timeoutMs)
  let rawText: string
  try {
    const res = await fetch(parsedUrl.href, {
      mode: 'cors',
      credentials: 'omit',
      cache: 'no-store',
      signal: controller.signal,
    })
    if (!res.ok) {
      throw new ExtensionError(
        'MANIFEST_FETCH_FAILED',
        `Could not download extension.json (${res.status} ${res.statusText}).`,
        { detail: parsedUrl.href },
      )
    }
    const ct = (res.headers.get('content-type') || '').toLowerCase()
    if (ct.startsWith('text/html')) {
      throw new ExtensionError(
        'MANIFEST_INVALID',
        'URL returned HTML instead of extension.json (verify the link points directly to extension.json).',
        { detail: parsedUrl.href },
      )
    }
    const declaredLen = Number(res.headers.get('content-length') || '0')
    if (declaredLen > MAX_MANIFEST_BYTES) {
      throw new ExtensionError('MANIFEST_INVALID', 'extension.json exceeds maximum size (256 KB).')
    }
    rawText = await res.text()
    if (rawText.length > MAX_MANIFEST_BYTES) {
      throw new ExtensionError('MANIFEST_INVALID', 'extension.json exceeds maximum size (256 KB).')
    }
  } catch (err) {
    if (err instanceof ExtensionError) throw err
    const isAbort = err instanceof DOMException && err.name === 'AbortError'
    throw new ExtensionError(
      'MANIFEST_FETCH_FAILED',
      isAbort
        ? `Downloading extension.json timed out after ${timeoutMs}ms.`
        : `Failed to fetch ${parsedUrl.href} (verify URL is reachable and sends Access-Control-Allow-Origin: *).`,
      { cause: err, detail: parsedUrl.href },
    )
  } finally {
    globalThis.clearTimeout(timer)
  }

  let json: unknown
  try {
    json = JSON.parse(rawText)
  } catch (err) {
    throw new ExtensionError(
      'MANIFEST_INVALID',
      `extension.json is not valid JSON: ${err instanceof Error ? err.message : String(err)}`,
    )
  }

  const manifest = validateExtensionManifest(json)
  if (!satisfiesSemver(SYNTAX_EXTENSION_API_VERSION, manifest.syntaxApi)) {
    throw new ExtensionError(
      'API_INCOMPATIBLE',
      `${manifest.name} requires Syntax API ${manifest.syntaxApi}, but this build provides ${SYNTAX_EXTENSION_API_VERSION}.`,
      { extensionId: manifest.id },
    )
  }

  const assets = resolveExtensionAssets(parsedUrl.href, manifest)
  return { manifest, assets }
}
