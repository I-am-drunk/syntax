/**
 * Real `.sytx` PKZIP archive packer, unpacker, inspector, and v1 legacy upgrader.
 * Uses `fflate` (~7 KB gzipped, zero deps) so `.sytx` files open natively in Finder,
 * Explorer, and `unzip`, and round-trip identically in Browser SPA and Node CLI.
 */
import { strFromU8, strToU8, unzipSync, zipSync, type Zippable } from 'fflate'
import {
  CustomCourseDataSchema,
  DEFAULT_ICON_SVG,
  SYNTAX_API_VERSION,
  SYNTAX_HOST_VERSION,
  SYTX_EXTENSION,
  getCompatibility,
  isSafeSvgIcon,
  isSafeThemeTokenValue,
  validatePackageManifest,
  type SyntaxPackageManifest,
} from './packages'

export const MAX_SYTX_COMPRESSED_BYTES = 10 * 1024 * 1024 // 10 MB
export const MAX_SYTX_UNCOMPRESSED_BYTES = 25 * 1024 * 1024 // 25 MB
export const MAX_SYTX_FILE_COUNT = 200
const DETERMINISTIC_MTIME = new Date(Date.UTC(2026, 0, 1, 0, 0, 0))

export type ArchiveEntryInfo = {
  path: string
  sizeBytes: number
  kind: 'manifest' | 'icon' | 'widget' | 'course' | 'theme' | 'readme' | 'asset'
}

export type UnpackedSytx = {
  manifest: SyntaxPackageManifest
  entries: ArchiveEntryInfo[]
  files: Record<string, Uint8Array>
  rawBytes: Uint8Array
  sha256: string
  sizeBytes: number
  upgradedFromV1: boolean
}

export type UnpackSytxResult =
  | { ok: true; archive: UnpackedSytx }
  | { ok: false; errors: string[] }

function classifyEntry(path: string): ArchiveEntryInfo['kind'] {
  const lower = path.toLowerCase()
  if (lower === 'syntax.mod.json' || lower === 'manifest.json') return 'manifest'
  if (lower.startsWith('icon.')) return 'icon'
  if (lower.endsWith('.html')) return 'widget'
  if (lower === 'course.json') return 'course'
  if (lower.endsWith('.css')) return 'theme'
  if (lower === 'readme.md') return 'readme'
  return 'asset'
}

function isZipMagic(bytes: Uint8Array): boolean {
  return (
    bytes.length >= 4 &&
    bytes[0] === 0x50 &&
    bytes[1] === 0x4b &&
    (bytes[2] === 0x03 || bytes[2] === 0x05 || bytes[2] === 0x07)
  )
}

function isIgnoredArchivePath(rawPath: string): boolean {
  if (!rawPath || rawPath.endsWith('/')) return true
  const parts = rawPath.split('/')
  return parts.some(p => p === '__MACOSX' || p === '.DS_Store' || p === 'Thumbs.db')
}

function isSafeArchivePath(rawPath: string): boolean {
  if (!rawPath || rawPath.includes('\0') || rawPath.includes('\\')) return false
  if (rawPath.startsWith('/')) return false
  const parts = rawPath.split('/')
  return !parts.some(p => p === '..' || p === '.')
}

/**
 * Computes lowercase hex SHA-256 via Web Crypto (available in browsers + Node 20+).
 */
export async function computeSha256Hex(bytes: Uint8Array): Promise<string> {
  try {
    const cryptoObj = globalThis.crypto
    if (cryptoObj?.subtle) {
      const copy = new Uint8Array(bytes.byteLength)
      copy.set(bytes)
      const digest = await cryptoObj.subtle.digest('SHA-256', copy.buffer)
      return Array.from(new Uint8Array(digest))
        .map(b => b.toString(16).padStart(2, '0'))
        .join('')
    }
  } catch {
    // Fallback below if Web Crypto subtle is unavailable (e.g. non-HTTPS local origin)
  }
  // Lightweight FNV-1a 64-bit hex fallback for insecure HTTP contexts
  let h1 = 0x811c9dc5
  let h2 = 0x01000193
  for (let i = 0; i < bytes.length; i++) {
    h1 = Math.imul(h1 ^ bytes[i]!, 0x01000193) >>> 0
    h2 = Math.imul(h2 ^ bytes[i]!, 0x85ebca6b) >>> 0
  }
  return `local-${h1.toString(16).padStart(8, '0')}${h2.toString(16).padStart(8, '0')}`
}

/**
 * Extracts only allowlisted `--token: #color;` declarations from a theme.css file.
 * Supports `:root { ... }`, `[data-theme="light"] { ... }`, and `[data-theme="dark"] { ... }`.
 */
export function parseSafeThemeCss(css: string): {
  light: Record<string, string>
  dark: Record<string, string>
} {
  const light: Record<string, string> = {}
  const dark: Record<string, string> = {}
  const clean = css.replace(/\/\*[\s\S]*?\*\//g, '')
  const blockRe = /([^{}]+)\{([^{}]*)\}/g
  let match: RegExpExecArray | null

  while ((match = blockRe.exec(clean)) !== null) {
    const selector = match[1]!.trim().toLowerCase()
    const body = match[2]!
    const targetDark = selector.includes('data-theme="dark"') || selector.includes("data-theme='dark'")
    const targetLight =
      selector.includes('data-theme="light"') || selector.includes("data-theme='light'")
    const targetBoth = !targetDark && !targetLight && selector.includes(':root')
    if (!targetDark && !targetLight && !targetBoth) continue

    for (const decl of body.split(';')) {
      const colon = decl.indexOf(':')
      if (colon < 0) continue
      const prop = decl.slice(0, colon).trim()
      const val = decl.slice(colon + 1).trim()
      if (!isSafeThemeTokenValue(prop, val)) continue
      if (targetBoth) {
        if (!(prop in light)) light[prop] = val
        if (!(prop in dark)) dark[prop] = val
      } else if (targetLight) {
        light[prop] = val
      } else if (targetDark) {
        dark[prop] = val
      }
    }
  }
  return { light, dark }
}

/**
 * Formats safe theme tokens back into a clean human-readable `theme.css`.
 */
export function buildThemeCss(theme: {
  light?: Record<string, string>
  dark?: Record<string, string>
}): string {
  const sections: string[] = []
  const lightEntries = Object.entries(theme.light ?? {}).filter(([k, v]) => isSafeThemeTokenValue(k, v))
  const darkEntries = Object.entries(theme.dark ?? {}).filter(([k, v]) => isSafeThemeTokenValue(k, v))

  if (lightEntries.length > 0) {
    sections.push(
      `[data-theme="light"] {\n${lightEntries.map(([k, v]) => `  ${k}: ${v};`).join('\n')}\n}`,
    )
  }
  if (darkEntries.length > 0) {
    sections.push(
      `[data-theme="dark"] {\n${darkEntries.map(([k, v]) => `  ${k}: ${v};`).join('\n')}\n}`,
    )
  }
  return sections.join('\n\n') + (sections.length > 0 ? '\n' : '')
}

/**
 * Packs a SyntaxPackageManifest + optional extra files into a deterministic,
 * real PKZIP `.sytx` archive (`Uint8Array`).
 */
export function packSytx(
  manifest: SyntaxPackageManifest,
  extras?: {
    files?: Record<string, Uint8Array | string>
    readmeMd?: string
  },
): Uint8Array {
  const compat = getCompatibility(manifest)

  // Build clean v2 syntax.mod.json without duplicating bulky file contents inline
  const {
    sandboxHtml,
    customCourse,
    readmeMd: manifestReadme,
    archiveSha256: _sha,
    archiveSizeBytes: _size,
    iconSvg,
    ...rest
  } = manifest

  const modJson: Record<string, unknown> = {
    ...rest,
    schemaVersion: 2,
    extension: SYTX_EXTENSION,
    icon: 'icon.svg',
    environment: compat.environment,
    depends: compat.depends,
    ...(Object.keys(compat.recommends).length > 0 ? { recommends: compat.recommends } : {}),
    ...(Object.keys(compat.breaks).length > 0 ? { breaks: compat.breaks } : {}),
    ...(Object.keys(compat.conflicts).length > 0 ? { conflicts: compat.conflicts } : {}),
    ...(compat.provides.length > 0 ? { provides: compat.provides } : {}),
  }

  const fileMap = new Map<string, Uint8Array>()
  fileMap.set('syntax.mod.json', strToU8(JSON.stringify(modJson, null, 2) + '\n'))
  fileMap.set('icon.svg', strToU8((iconSvg || DEFAULT_ICON_SVG).trim() + '\n'))

  if (sandboxHtml) {
    const entryName =
      manifest.contributes?.toolbar?.[0]?.entry ||
      manifest.contributes?.blocks?.[0]?.entry ||
      manifest.entry ||
      'widget.html'
    fileMap.set(entryName, strToU8(sandboxHtml))
  }

  if (customCourse) {
    fileMap.set('course.json', strToU8(JSON.stringify(customCourse, null, 2) + '\n'))
  }

  if (manifest.contributes?.theme && (manifest.contributes.theme.light || manifest.contributes.theme.dark)) {
    const css = buildThemeCss(manifest.contributes.theme)
    if (css.trim()) {
      fileMap.set(manifest.contributes.theme.entry || 'theme.css', strToU8(css))
    }
  }

  const readme = extras?.readmeMd ?? manifestReadme
  if (readme && readme.trim().length > 0) {
    fileMap.set('README.md', strToU8(readme))
  } else {
    fileMap.set(
      'README.md',
      strToU8(
        `# ${manifest.name}\n\n${manifest.tagline}\n\n${manifest.description}\n\n- **ID:** \`${manifest.id}\`\n- **Version:** \`v${manifest.version}\`\n- **Author:** @${manifest.author.handle}\n`,
      ),
    )
  }

  if (extras?.files) {
    for (const [path, content] of Object.entries(extras.files)) {
      if (!isSafeArchivePath(path) || isIgnoredArchivePath(path)) continue
      fileMap.set(path, typeof content === 'string' ? strToU8(content) : content)
    }
  }

  // Deterministic ordering: syntax.mod.json always first, then alphabetical
  const orderedKeys = [...fileMap.keys()].sort((a, b) => {
    if (a === 'syntax.mod.json') return -1
    if (b === 'syntax.mod.json') return 1
    return a.localeCompare(b)
  })

  const zippable: Zippable = {}
  for (const key of orderedKeys) {
    zippable[key] = [fileMap.get(key)!, { level: 6, mtime: DETERMINISTIC_MTIME }]
  }

  return zipSync(zippable)
}

/**
 * Unpacks, validates, and inspects a `.sytx` PKZIP archive with strict zip-slip
 * and zip-bomb protections.
 */
export async function unpackSytx(rawBytes: Uint8Array): Promise<UnpackSytxResult> {
  if (rawBytes.byteLength === 0) {
    return { ok: false, errors: ['Archive file is empty.'] }
  }
  if (rawBytes.byteLength > MAX_SYTX_COMPRESSED_BYTES) {
    return {
      ok: false,
      errors: [`Archive exceeds maximum compressed size of ${MAX_SYTX_COMPRESSED_BYTES / (1024 * 1024)} MB.`],
    }
  }
  if (!isZipMagic(rawBytes)) {
    return { ok: false, errors: ['File is not a valid .sytx ZIP archive.'] }
  }

  let totalDeclaredUncompressed = 0
  let fileCount = 0
  let securityError: string | null = null

  let rawEntries: Record<string, Uint8Array>
  try {
    rawEntries = unzipSync(rawBytes, {
      filter(file) {
        if (securityError) return false
        if (isIgnoredArchivePath(file.name)) return false
        if (!isSafeArchivePath(file.name)) {
          securityError = `Unsafe archive path rejected: "${file.name}".`
          return false
        }
        fileCount += 1
        if (fileCount > MAX_SYTX_FILE_COUNT) {
          securityError = `Archive contains more than ${MAX_SYTX_FILE_COUNT} files.`
          return false
        }
        totalDeclaredUncompressed += file.originalSize
        if (totalDeclaredUncompressed > MAX_SYTX_UNCOMPRESSED_BYTES) {
          securityError = `Archive exceeds maximum uncompressed size of ${MAX_SYTX_UNCOMPRESSED_BYTES / (1024 * 1024)} MB.`
          return false
        }
        return true
      },
    })
  } catch (err) {
    return {
      ok: false,
      errors: [err instanceof Error ? `Corrupt .sytx archive: ${err.message}` : 'Corrupt .sytx archive.'],
    }
  }

  if (securityError) {
    return { ok: false, errors: [securityError] }
  }

  // Strip a single wrapping folder if user zipped a folder from Finder/Explorer
  const rawNames = Object.keys(rawEntries).filter(p => !isIgnoredArchivePath(p))
  if (rawNames.length === 0) {
    return { ok: false, errors: ['Archive contains no files.'] }
  }

  let prefix = ''
  if (!rawNames.includes('syntax.mod.json') && !rawNames.includes('manifest.json')) {
    const firstSegments = new Set(rawNames.map(p => (p.includes('/') ? p.slice(0, p.indexOf('/') + 1) : '')))
    if (firstSegments.size === 1) {
      const candidatePrefix = [...firstSegments][0]!
      if (
        candidatePrefix &&
        (rawNames.includes(`${candidatePrefix}syntax.mod.json`) ||
          rawNames.includes(`${candidatePrefix}manifest.json`))
      ) {
        prefix = candidatePrefix
      }
    }
  }

  const files: Record<string, Uint8Array> = {}
  let actualUncompressed = 0
  for (const name of rawNames) {
    const cleanPath = prefix && name.startsWith(prefix) ? name.slice(prefix.length) : name
    if (!cleanPath || !isSafeArchivePath(cleanPath)) continue
    const buf = rawEntries[name]!
    actualUncompressed += buf.byteLength
    if (actualUncompressed > MAX_SYTX_UNCOMPRESSED_BYTES) {
      return {
        ok: false,
        errors: ['Archive exceeds maximum uncompressed size limit.'],
      }
    }
    files[cleanPath] = buf
  }

  const manifestBytes = files['syntax.mod.json'] ?? files['manifest.json']
  if (!manifestBytes) {
    return {
      ok: false,
      errors: ['Missing syntax.mod.json at the root of this .sytx archive.'],
    }
  }

  let parsedJson: Record<string, unknown>
  try {
    const parsed = JSON.parse(strFromU8(manifestBytes)) as unknown
    if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
      return { ok: false, errors: ['syntax.mod.json must be a JSON object.'] }
    }
    parsedJson = { ...(parsed as Record<string, unknown>) }
  } catch (err) {
    return {
      ok: false,
      errors: [err instanceof Error ? `Invalid syntax.mod.json: ${err.message}` : 'Invalid syntax.mod.json.'],
    }
  }

  // Hydrate icon.svg from archive if referenced or present
  const iconPath = typeof parsedJson.icon === 'string' ? parsedJson.icon : 'icon.svg'
  if (files[iconPath] && iconPath.toLowerCase().endsWith('.svg')) {
    const svgText = strFromU8(files[iconPath]!).trim()
    if (!isSafeSvgIcon(svgText)) {
      return {
        ok: false,
        errors: [`${iconPath} failed SVG safety checks (scripts, foreignObject, and event handlers are disallowed).`],
      }
    }
    parsedJson.iconSvg = svgText
  } else if (!parsedJson.iconSvg) {
    parsedJson.iconSvg = DEFAULT_ICON_SVG
  }

  // Hydrate course.json if present
  if (files['course.json'] && !parsedJson.customCourse) {
    try {
      const courseRaw = JSON.parse(strFromU8(files['course.json']!)) as unknown
      const courseCheck = CustomCourseDataSchema.safeParse(courseRaw)
      if (!courseCheck.success) {
        return {
          ok: false,
          errors: courseCheck.error.issues.map(
            i => `course.json ${i.path.join('.')}: ${i.message}`,
          ),
        }
      }
      parsedJson.customCourse = courseCheck.data
    } catch (err) {
      return {
        ok: false,
        errors: [err instanceof Error ? `Invalid course.json: ${err.message}` : 'Invalid course.json.'],
      }
    }
  }

  // Hydrate widget.html (or declared toolbar/block entry HTML)
  const contributes =
    parsedJson.contributes && typeof parsedJson.contributes === 'object'
      ? (parsedJson.contributes as Record<string, unknown>)
      : null
  const toolbarArr = Array.isArray(contributes?.toolbar)
    ? (contributes.toolbar as Array<Record<string, unknown>>)
    : []
  const blocksArr = Array.isArray(contributes?.blocks)
    ? (contributes.blocks as Array<Record<string, unknown>>)
    : []
  const declaredEntry =
    (typeof parsedJson.entry === 'string' ? parsedJson.entry : null) ||
    (typeof toolbarArr[0]?.entry === 'string' ? (toolbarArr[0].entry as string) : null) ||
    (typeof blocksArr[0]?.entry === 'string' ? (blocksArr[0].entry as string) : null) ||
    'widget.html'

  if (!parsedJson.sandboxHtml && files[declaredEntry] && declaredEntry.toLowerCase().endsWith('.html')) {
    parsedJson.sandboxHtml = strFromU8(files[declaredEntry]!)
  }

  // Hydrate theme.css into safe allowlisted theme tokens
  const themeContrib =
    contributes?.theme && typeof contributes.theme === 'object'
      ? (contributes.theme as Record<string, unknown>)
      : null
  const themeEntry =
    (typeof themeContrib?.entry === 'string' ? themeContrib.entry : null) || 'theme.css'
  if (files[themeEntry]) {
    const parsedCss = parseSafeThemeCss(strFromU8(files[themeEntry]!))
    const mergedTheme = {
      ...(themeContrib ?? {}),
      entry: themeEntry,
      light: {
        ...parsedCss.light,
        ...((themeContrib?.light as Record<string, string> | undefined) ?? {}),
      },
      dark: {
        ...parsedCss.dark,
        ...((themeContrib?.dark as Record<string, string> | undefined) ?? {}),
      },
    }
    parsedJson.contributes = {
      ...(contributes ?? {}),
      theme: mergedTheme,
    }
  }

  // Hydrate README.md
  if (files['README.md'] && !parsedJson.readmeMd) {
    parsedJson.readmeMd = strFromU8(files['README.md']!).slice(0, 80000)
  }

  const sha256 = await computeSha256Hex(rawBytes)
  parsedJson.archiveSha256 = sha256
  parsedJson.archiveSizeBytes = rawBytes.byteLength
  parsedJson.extension = SYTX_EXTENSION

  const check = validatePackageManifest(parsedJson)
  if (!check.ok) {
    return { ok: false, errors: check.errors }
  }

  const entries: ArchiveEntryInfo[] = Object.keys(files)
    .sort((a, b) => (a === 'syntax.mod.json' ? -1 : b === 'syntax.mod.json' ? 1 : a.localeCompare(b)))
    .map(path => ({
      path,
      sizeBytes: files[path]!.byteLength,
      kind: classifyEntry(path),
    }))

  return {
    ok: true,
    archive: {
      manifest: check.manifest,
      entries,
      files,
      rawBytes,
      sha256,
      sizeBytes: rawBytes.byteLength,
      upgradedFromV1: false,
    },
  }
}

/**
 * Converts any legacy v1 JSON manifest (e.g. from Community Hub catalog or old `.syntaxplugin` file)
 * into a full unpacked `.sytx` archive with deterministic SHA-256 and file listing.
 */
export async function upgradeV1ManifestToSytx(
  manifest: SyntaxPackageManifest,
): Promise<UnpackedSytx> {
  const bytes = packSytx(manifest)
  const unpacked = await unpackSytx(bytes)
  if (!unpacked.ok) {
    const sha256 = await computeSha256Hex(bytes)
    return {
      manifest: { ...manifest, archiveSha256: sha256, archiveSizeBytes: bytes.byteLength },
      entries: [{ path: 'syntax.mod.json', sizeBytes: bytes.byteLength, kind: 'manifest' }],
      files: {},
      rawBytes: bytes,
      sha256,
      sizeBytes: bytes.byteLength,
      upgradedFromV1: true,
    }
  }
  return {
    ...unpacked.archive,
    manifest: {
      ...manifest,
      ...unpacked.archive.manifest,
      // Preserve builtIn/courseRoute/official flags when packing official packages for export
      builtIn: manifest.builtIn,
      courseRoute: manifest.courseRoute,
      author: manifest.author,
      safety: manifest.safety,
      archiveSha256: unpacked.archive.sha256,
      archiveSizeBytes: unpacked.archive.sizeBytes,
    },
    upgradedFromV1: manifest.schemaVersion === 1,
  }
}

/**
 * Parses an imported File from disk — supports real `.sytx` ZIP archives AND legacy
 * `.syntaxplugin` / `.syntaxcourse` / `.syntaxembeddedplugin` / `.json` files seamlessly.
 */
export async function parsePackageFile(file: File): Promise<UnpackSytxResult> {
  const lower = file.name.toLowerCase()
  const validExt =
    lower.endsWith('.sytx') ||
    lower.endsWith('.zip') ||
    lower.endsWith('.syntaxcourse') ||
    lower.endsWith('.syntaxplugin') ||
    lower.endsWith('.syntaxembeddedplugin') ||
    lower.endsWith('.json')

  if (!validExt) {
    return {
      ok: false,
      errors: ['Unsupported file type. Choose a .sytx archive (or legacy .syntax* / .json file).'],
    }
  }

  if (file.size > MAX_SYTX_COMPRESSED_BYTES) {
    return {
      ok: false,
      errors: ['Package file is too large (maximum size is 10 MB).'],
    }
  }

  const buffer = await file.arrayBuffer()
  const bytes = new Uint8Array(buffer)

  // Magic-byte detection: real ZIP archive (.sytx)
  if (isZipMagic(bytes)) {
    return unpackSytx(bytes)
  }

  if (lower.endsWith('.sytx')) {
    return {
      ok: false,
      errors: ['This .sytx file is not a valid ZIP archive. Rebuild it with `npm run plugin:pack`.'],
    }
  }

  // Legacy JSON fallback (.syntaxplugin / .syntaxcourse / .syntaxembeddedplugin / .json)
  try {
    const text = strFromU8(bytes)
    const parsed = JSON.parse(text) as unknown
    const check = validatePackageManifest(parsed)
    if (!check.ok) {
      return { ok: false, errors: check.errors }
    }
    const upgraded = await upgradeV1ManifestToSytx(check.manifest)
    return { ok: true, archive: upgraded }
  } catch (err) {
    return {
      ok: false,
      errors: [err instanceof Error ? `Invalid JSON: ${err.message}` : 'Could not parse package file.'],
    }
  }
}

/**
 * Triggers a browser download of a real `.sytx` PKZIP archive (`<id>-<version>.sytx`).
 */
export function exportSytxArchive(pkg: SyntaxPackageManifest, rawBytes?: Uint8Array) {
  const bytes = rawBytes && rawBytes.byteLength > 0 ? rawBytes : packSytx(pkg)
  const copy = new Uint8Array(bytes.byteLength)
  copy.set(bytes)
  const filename = `${pkg.id}-${pkg.version}${SYTX_EXTENSION}`
  const blob = new Blob([copy.buffer], { type: 'application/zip' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  document.body.appendChild(a)
  a.click()
  a.remove()
  setTimeout(() => URL.revokeObjectURL(url), 1000)
}

/**
 * Formats byte sizes cleanly for the archive file tree inspector.
 */
export function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
  return `${(bytes / (1024 * 1024)).toFixed(2)} MB`
}

// =========================================================================
// IN-BROWSER STARTER `.sytx` GENERATOR (Zero-CLI 1-Click Starter Downloads)
// =========================================================================
export type StarterTemplateKind = 'toolbar' | 'theme' | 'course'

export function buildStarterTemplate(
  kind: StarterTemplateKind,
  customId?: string,
): { manifest: SyntaxPackageManifest; bytes: Uint8Array } {
  const safeId = (customId || `my-${kind}-starter`)
    .toLowerCase()
    .replace(/[^a-z0-9-]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 48) || `my-${kind}-starter`

  if (kind === 'theme') {
    const manifest: SyntaxPackageManifest = {
      schemaVersion: 2,
      id: safeId,
      kind: 'plugin',
      extension: '.sytx',
      name: 'Emerald Focus Theme',
      tagline: 'Calm forest-emerald accents tuned for neutral light and dark study sessions.',
      description:
        'A lightweight Syntax theme pack demonstrating safe CSS custom property overrides in theme.css without touching core layout.',
      version: '1.0.0',
      author: { handle: 'you', displayName: 'Local Author' },
      accentColor: '#10b981',
      tags: ['Theme', 'Starter', 'Focus'],
      environment: 'all',
      depends: {
        syntax: `^${SYNTAX_HOST_VERSION}`,
        'syntax-api': `^${SYNTAX_API_VERSION}`,
      },
      permissions: ['ui:theme'],
      contributes: {
        theme: {
          label: 'Emerald Focus',
          entry: 'theme.css',
          light: {
            '--accent': '#059669',
            '--accent-hover': '#047857',
            '--accent-blue': '#059669',
            '--geo-blue': '#059669',
          },
          dark: {
            '--accent': '#10b981',
            '--accent-hover': '#34d399',
            '--accent-blue': '#10b981',
            '--geo-blue': '#34d399',
          },
        },
      },
      touchesCore: false,
      safety: {
        automatedScan: 'passed',
        sandboxed: true,
        networkAccess: 'none',
        lastChecked: '2026-11-26',
      },
      iconSvg:
        '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64" fill="none"><rect width="64" height="64" rx="16" fill="#047857"/><circle cx="32" cy="32" r="16" fill="#34d399" fill-opacity="0.25" stroke="#ffffff" stroke-width="3"/><circle cx="32" cy="32" r="7" fill="#ffffff"/></svg>',
    }
    return { manifest, bytes: packSytx(manifest) }
  }

  if (kind === 'course') {
    const manifest: SyntaxPackageManifest = {
      schemaVersion: 2,
      id: safeId,
      kind: 'course',
      extension: '.sytx',
      name: 'Mental Math Warmups',
      tagline: 'Three quick interactive warm-up problems packed inside a .sytx course.',
      description:
        'A starter custom course archive with course.json units, multiple-choice checks, and instant explanations. Unzip, edit course.json, and re-zip to customize.',
      version: '1.0.0',
      author: { handle: 'you', displayName: 'Local Author' },
      accentColor: '#3b82f6',
      tags: ['Math', 'Starter', 'Warmup'],
      environment: 'course',
      depends: {
        syntax: `^${SYNTAX_HOST_VERSION}`,
        'syntax-api': `^${SYNTAX_API_VERSION}`,
      },
      touchesCore: false,
      courseRoute: 'custom',
      customCourse: {
        subtitle: 'Quick 2-minute drills before starting a full unit',
        units: [
          {
            title: 'Unit 1: Fast Slopes & Midpoints',
            lessons: [
              {
                id: 'warmup-1',
                title: 'Quick Midpoint Check',
                summary: 'Average x-values and y-values in your head.',
                prompt: 'What is the midpoint of the segment from (2, 4) to (8, 10)?',
                choices: ['(5, 7)', '(6, 6)', '(4, 7)', '(5, 6)'],
                answerIndex: 0,
                explanation: 'Average the x-coordinates: (2 + 8)/2 = 5. Average the y-coordinates: (4 + 10)/2 = 7.',
              },
              {
                id: 'warmup-2',
                title: 'Perpendicular Slope Flip',
                summary: 'Negative reciprocal rule in one step.',
                prompt: 'A line has slope 2/3. What is the slope of a line perpendicular to it?',
                choices: ['3/2', '-2/3', '-3/2', '-1/3'],
                answerIndex: 2,
                explanation: 'Flip 2/3 to 3/2 and reverse the sign to get -3/2. Check: (2/3) * (-3/2) = -1.',
              },
            ],
          },
        ],
      },
      safety: {
        automatedScan: 'passed',
        sandboxed: true,
        networkAccess: 'none',
        lastChecked: '2026-11-26',
      },
      iconSvg:
        '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64" fill="none"><rect width="64" height="64" rx="16" fill="#1d4ed8"/><path d="M18 44L46 20" stroke="#93c5fd" stroke-width="3.5" stroke-linecap="round"/><circle cx="24" cy="39" r="5" fill="#ffffff"/><circle cx="40" cy="25" r="5" fill="#facc15"/></svg>',
    }
    return { manifest, bytes: packSytx(manifest) }
  }

  // Default: toolbar widget starter using window.Syntax SDK
  const widgetHtml = `<style>
  .card { display: flex; flex-direction: column; gap: 12px; }
  .time { font-size: 36px; font-weight: 700; font-variant-numeric: tabular-nums; letter-spacing: -0.03em; }
  .row { display: flex; gap: 8px; flex-wrap: wrap; }
  button {
    border: 1px solid var(--sx-border);
    background: transparent;
    color: var(--sx-fg);
    border-radius: 10px;
    padding: 8px 14px;
    font: inherit;
    font-weight: 600;
    cursor: pointer;
  }
  button.primary { background: var(--sx-accent); border-color: var(--sx-accent); color: #fff; }
  .meta { font-size: 13px; color: var(--sx-muted); }
</style>
<div class="card">
  <div class="meta">Study Sprint Timer</div>
  <div id="clock" class="time">25:00</div>
  <div class="row">
    <button id="toggle" class="primary" type="button">Start</button>
    <button id="reset" type="button">Reset</button>
    <button id="short" type="button">5m Break</button>
  </div>
  <div id="done" class="meta">Completed sprints: 0</div>
</div>
<script>
  var seconds = 25 * 60;
  var running = false;
  var timer = null;
  var completed = 0;

  var clockEl = document.getElementById('clock');
  var toggleBtn = document.getElementById('toggle');
  var doneEl = document.getElementById('done');

  function render() {
    var m = Math.floor(seconds / 60);
    var s = seconds % 60;
    clockEl.textContent = String(m).padStart(2, '0') + ':' + String(s).padStart(2, '0');
    toggleBtn.textContent = running ? 'Pause' : 'Start';
    doneEl.textContent = 'Completed sprints: ' + completed;
  }

  if (window.Syntax && window.Syntax.storage) {
    window.Syntax.storage.get('completed').then(function (val) {
      if (typeof val === 'number') { completed = val; render(); }
    });
  }

  toggleBtn.addEventListener('click', function () {
    running = !running;
    if (running) {
      timer = setInterval(function () {
        if (seconds > 0) {
          seconds -= 1;
          render();
        } else {
          clearInterval(timer);
          running = false;
          completed += 1;
          if (window.Syntax) {
            window.Syntax.storage.set('completed', completed);
            window.Syntax.toast('Study sprint complete!');
          }
          render();
        }
      }, 1000);
    } else {
      clearInterval(timer);
    }
    render();
  });

  document.getElementById('reset').addEventListener('click', function () {
    clearInterval(timer); running = false; seconds = 25 * 60; render();
  });
  document.getElementById('short').addEventListener('click', function () {
    clearInterval(timer); running = false; seconds = 5 * 60; render();
  });
  render();
</script>`

  const manifest: SyntaxPackageManifest = {
    schemaVersion: 2,
    id: safeId,
    kind: 'plugin',
    extension: '.sytx',
    name: 'Study Sprint Timer',
    tagline: 'Minimal 25/5 Pomodoro timer docked in the Syntax toolbar.',
    description:
      'A starter Syntax toolbar plugin using the window.Syntax SDK for live dark/light theme sync, persistent local storage, and toast notifications.',
    version: '1.0.0',
    author: { handle: 'you', displayName: 'Local Author' },
    accentColor: '#f59e0b',
    tags: ['Timer', 'Focus', 'Starter'],
    environment: 'all',
    depends: {
      syntax: `^${SYNTAX_HOST_VERSION}`,
      'syntax-api': `^${SYNTAX_API_VERSION}`,
    },
    permissions: ['storage', 'ui:toolbar'],
    contributes: {
      toolbar: [
        {
          id: 'sprint-timer',
          label: 'Timer',
          tooltip: 'Open Study Sprint Timer',
          entry: 'widget.html',
          defaultWidth: 340,
          defaultHeight: 240,
        },
      ],
    },
    touchesCore: false,
    sandboxHtml: widgetHtml,
    safety: {
      automatedScan: 'passed',
      sandboxed: true,
      networkAccess: 'none',
      lastChecked: '2026-11-26',
    },
    iconSvg:
      '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64" fill="none"><rect width="64" height="64" rx="16" fill="#d97706"/><circle cx="32" cy="34" r="16" stroke="#ffffff" stroke-width="3.5"/><path d="M32 25V34L38 38M26 14H38" stroke="#fef3c7" stroke-width="3.5" stroke-linecap="round" stroke-linejoin="round"/></svg>',
  }
  return { manifest, bytes: packSytx(manifest) }
}
