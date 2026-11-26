import { z } from 'zod'
import { compareSemver, isValidSemver, isValidSemverRange } from './semver'

export { compareSemver, isValidSemver, isValidSemverRange }

/** Public Syntax host application version (matched by depends["syntax"]). */
export const SYNTAX_HOST_VERSION = '1.0.0'

/** Plugin & course runtime API contract version (matched by depends["syntax-api"]). */
export const SYNTAX_API_VERSION = '1.0.0'

/** Older API versions still supported via compatibility shims. */
export const SYNTAX_COMPAT_API_VERSIONS: readonly string[] = []

/** Reserved virtual IDs representing the Syntax host runtime itself. */
export const RESERVED_HOST_IDS = new Set(['syntax', 'syntax-api'])

/** Universal v2 archive file extension (standard PKZIP). */
export const SYTX_EXTENSION = '.sytx' as const

export const PackageKindSchema = z.enum(['course', 'plugin', 'embedded-plugin'])
export type PackageKind = z.infer<typeof PackageKindSchema>

export const PackageExtensionSchema = z.enum([
  '.sytx',
  '.syntaxcourse',
  '.syntaxplugin',
  '.syntaxembeddedplugin',
])
export type PackageExtension = z.infer<typeof PackageExtensionSchema>

export const PACKAGE_EXTENSION_BY_KIND: Record<PackageKind, PackageExtension> = {
  course: '.sytx',
  plugin: '.sytx',
  'embedded-plugin': '.sytx',
}

export const LEGACY_EXTENSION_BY_KIND: Record<PackageKind, PackageExtension> = {
  course: '.syntaxcourse',
  plugin: '.syntaxplugin',
  'embedded-plugin': '.syntaxembeddedplugin',
}

export const PACKAGE_LABEL_BY_KIND: Record<PackageKind, string> = {
  course: 'Course',
  plugin: 'App Plugin',
  'embedded-plugin': 'Embedded Engine',
}

export const PackageEnvironmentSchema = z.enum(['all', 'course', 'lesson'])
export type PackageEnvironment = z.infer<typeof PackageEnvironmentSchema>

export const PluginPermissionSchema = z.enum([
  'storage',
  'ui:toolbar',
  'ui:lesson-block',
  'ui:playbook',
  'ui:theme',
  'core:layout',
])
export type PluginPermission = z.infer<typeof PluginPermissionSchema>

export const PERMISSION_LABELS: Record<
  PluginPermission,
  { title: string; detail: string; sensitive?: boolean }
> = {
  storage: {
    title: 'Local plugin storage',
    detail: 'Save up to 128 KB of its own settings or state on this device.',
  },
  'ui:toolbar': {
    title: 'Toolbar drawer button',
    detail: 'Add a quick-access tool button in the header and inside lessons.',
  },
  'ui:lesson-block': {
    title: 'Interactive lesson blocks',
    detail: 'Render interactive widgets inside custom course lessons and report scores.',
  },
  'ui:playbook': {
    title: 'Formula Playbook cards',
    detail: 'Add reference formula cards and tips to the Formula Playbook.',
  },
  'ui:theme': {
    title: 'Theme accent tokens',
    detail: 'Customize approved Syntax accent colors and surfaces cleanly.',
  },
  'core:layout': {
    title: 'Core workspace layout',
    detail: 'Modify built-in lesson workspace panels or modal frames.',
    sensitive: true,
  },
}

// Package IDs ("math-graph-engine", "syntax", "syntax-api") OR capabilities ("engine:...", "slot:...")
export const DependencyKeySchema = z
  .string()
  .regex(
    /^(?:[a-z0-9][a-z0-9-]{1,62}|(?:engine|slot):[a-z0-9][a-z0-9-]{1,48})$/,
    'Dependency key must be a valid package id or engine:/slot: capability.',
  )

export const CapabilityIdSchema = z
  .string()
  .regex(
    /^(?:engine|slot):[a-z0-9][a-z0-9-]{1,48}$/,
    'Capability must use engine:<name> or slot:<name> format.',
  )

export const SemverVersionSchema = z
  .string()
  .refine(isValidSemver, 'version must follow SemVer (for example 1.0.0).')

export const SemverRangeSchema = z
  .string()
  .refine(isValidSemverRange, 'Invalid SemVer range (for example "^1.0.0", ">=1.0.0 <2.0.0", "*").')

export const DependencyRangeMapSchema = z.record(DependencyKeySchema, SemverRangeSchema)
export type DependencyRangeMap = z.infer<typeof DependencyRangeMapSchema>

// =========================================================================
// SAFE THEME TOKENS (Allowlisted CSS custom properties only)
// =========================================================================
export const SAFE_THEME_TOKENS = [
  '--accent',
  '--accent-hover',
  '--accent-soft',
  '--accent-blue',
  '--geo-blue',
  '--geo-teal',
  '--geo-amber',
  '--geo-violet',
  '--geo-green',
  '--surface',
  '--surface-elevated',
  '--surface-subtle',
  '--border',
  '--bg',
] as const
export type SafeThemeToken = (typeof SAFE_THEME_TOKENS)[number]
const SAFE_THEME_TOKEN_SET = new Set<string>(SAFE_THEME_TOKENS)

const SAFE_CSS_VALUE_RE =
  /^(?:#[0-9a-fA-F]{3,8}|rgba?\(\s*\d{1,3}(?:\s*,\s*|\s+)\d{1,3}(?:\s*,\s*|\s+)\d{1,3}(?:\s*(?:,|\/)\s*(?:0|1|0?\.\d+|\d{1,3}%))?\s*\)|hsla?\(\s*\d{1,3}(?:deg)?(?:\s*,\s*|\s+)\d{1,3}%(?:\s*,\s*|\s+)\d{1,3}%(?:\s*(?:,|\/)\s*(?:0|1|0?\.\d+|\d{1,3}%))?\s*\))$/

export function isSafeThemeTokenValue(token: string, value: string): boolean {
  if (!SAFE_THEME_TOKEN_SET.has(token)) return false
  const clean = value.trim()
  if (clean.length === 0 || clean.length > 64) return false
  if (/[;{}()\\<>]|url\s*\(|expression\s*\(|@import/i.test(clean) && !SAFE_CSS_VALUE_RE.test(clean)) {
    return false
  }
  return SAFE_CSS_VALUE_RE.test(clean)
}

export const ThemeTokenMapSchema = z.record(
  z.string().refine(k => SAFE_THEME_TOKEN_SET.has(k), 'Unsupported theme token.'),
  z.string().refine(v => SAFE_CSS_VALUE_RE.test(v.trim()), 'Theme token must be a safe color value.'),
)

// =========================================================================
// EXTENSION POINT CONTRIBUTIONS (`contributes`)
// =========================================================================
export const ToolbarContributionSchema = z.object({
  id: z.string().regex(/^[a-z0-9][a-z0-9-]{1,40}$/),
  label: z.string().trim().min(2).max(28),
  tooltip: z.string().trim().min(2).max(120).optional(),
  entry: z.string().min(1).default('widget.html'),
  defaultWidth: z.number().int().min(260).max(520).optional(),
  defaultHeight: z.number().int().min(180).max(640).optional(),
})
export type ToolbarContribution = z.infer<typeof ToolbarContributionSchema>

export const BlockContributionSchema = z.object({
  type: z.string().regex(/^[a-z0-9][a-z0-9-]{1,40}$/),
  title: z.string().trim().min(2).max(60),
  entry: z.string().min(1).default('widget.html'),
  minHeight: z.number().int().min(140).max(760).optional(),
  gradable: z.boolean().optional(),
})
export type BlockContribution = z.infer<typeof BlockContributionSchema>

export const PlaybookCardContributionSchema = z.object({
  id: z.string().regex(/^[a-z0-9][a-z0-9-]{1,48}$/),
  title: z.string().trim().min(2).max(64),
  formula: z.string().trim().min(1).max(200),
  note: z.string().trim().max(240).optional(),
  steps: z.array(z.string().trim().min(2).max(220)).max(6).optional(),
  tip: z.string().trim().max(220).optional(),
})
export type PlaybookCardContribution = z.infer<typeof PlaybookCardContributionSchema>

export const ThemeContributionSchema = z.object({
  label: z.string().trim().min(2).max(40).optional(),
  entry: z.string().min(1).optional(),
  light: ThemeTokenMapSchema.optional(),
  dark: ThemeTokenMapSchema.optional(),
})
export type ThemeContribution = z.infer<typeof ThemeContributionSchema>

export const PluginContributesSchema = z.object({
  toolbar: z.array(ToolbarContributionSchema).max(3).optional(),
  blocks: z.array(BlockContributionSchema).max(8).optional(),
  playbook: z.array(PlaybookCardContributionSchema).max(16).optional(),
  theme: ThemeContributionSchema.optional(),
})
export type PluginContributes = z.infer<typeof PluginContributesSchema>

// =========================================================================
// SVG & HTML SAFETY
// =========================================================================
const UNSAFE_SVG_RE =
  /<script\b|<\/script\b|<foreignobject\b|<iframe\b|<object\b|<embed\b|\son[a-z]+\s*=|javascript:|vbscript:|data:text\/html/i

export function isSafeSvgIcon(svg: string): boolean {
  const trimmed = svg.trim()
  if (trimmed.length === 0 || trimmed.length > 32000) return false
  if (!trimmed.startsWith('<svg') || !trimmed.endsWith('</svg>')) return false
  if (UNSAFE_SVG_RE.test(trimmed)) return false
  return true
}

export function isValidSvgIcon(svg: string): boolean {
  return isSafeSvgIcon(svg)
}

export function isSafeSandboxHtml(html: string): boolean {
  return typeof html === 'string' && html.length <= 250000
}

// =========================================================================
// LEGACY + V2 MANIFEST SUB-SCHEMAS
// =========================================================================
export const PackageDependencySchema = z.object({
  id: z.string().regex(/^[a-z0-9][a-z0-9-]{1,62}$/),
  kind: z.enum(['plugin', 'embedded-plugin']),
  minVersion: SemverVersionSchema,
  name: z.string().min(2),
})
export type PackageDependency = z.infer<typeof PackageDependencySchema>

export const PackageAuthorSchema = z.object({
  handle: z.string().min(2).max(40),
  displayName: z.string().min(2).max(80),
  official: z.boolean().optional(),
  verified: z.boolean().optional(),
})
export type PackageAuthor = z.infer<typeof PackageAuthorSchema>

export const PackageSafetySchema = z.object({
  automatedScan: z.enum(['passed', 'warning', 'unverified']),
  sandboxed: z.boolean(),
  networkAccess: z.enum(['none', 'allowlisted']),
  lastChecked: z.string().min(4),
  official: z.boolean().optional(),
})
export type PackageSafety = z.infer<typeof PackageSafetySchema>

export const PackageAIUsageSchema = z.object({
  summary: z.string().min(8),
  blocks: z.array(z.string().min(1)).min(1),
  example: z.string().min(4),
})
export type PackageAIUsage = z.infer<typeof PackageAIUsageSchema>

export const LessonBlockInstanceSchema = z.object({
  id: z.string().min(1).optional(),
  plugin: z.string().regex(/^[a-z0-9][a-z0-9-]{1,62}$/),
  type: z.string().min(1),
  title: z.string().optional(),
  props: z.record(z.string(), z.unknown()).optional(),
})
export type LessonBlockInstance = z.infer<typeof LessonBlockInstanceSchema>

export const CustomCourseLessonSchema = z
  .object({
    id: z.string().min(1),
    title: z.string().min(2),
    summary: z.string().min(4),
    prompt: z.string().optional(),
    blocks: z.array(LessonBlockInstanceSchema).max(6).optional(),
    choices: z.array(z.string().min(1)).optional(),
    answerIndex: z.number().int().min(0).optional(),
    explanation: z.string().optional(),
  })
  .superRefine((lesson, ctx) => {
    if (lesson.answerIndex !== undefined) {
      if (!lesson.choices || lesson.answerIndex >= lesson.choices.length) {
        ctx.addIssue({
          code: 'custom',
          path: ['answerIndex'],
          message: 'answerIndex must point to a valid entry in choices.',
        })
      }
    }
  })
export type CustomCourseLesson = z.infer<typeof CustomCourseLessonSchema>

export const CustomCourseDataSchema = z.object({
  subtitle: z.string().optional(),
  units: z
    .array(
      z.object({
        title: z.string().min(2),
        lessons: z.array(CustomCourseLessonSchema).min(1),
      }),
    )
    .min(1),
})
export type CustomCourseData = z.infer<typeof CustomCourseDataSchema>

export const DEFAULT_ICON_SVG =
  '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64" fill="none"><rect width="64" height="64" rx="16" fill="#2563eb"/><rect x="16" y="16" width="32" height="32" rx="8" stroke="#ffffff" stroke-width="3.5"/><circle cx="32" cy="32" r="6" fill="#ffffff"/></svg>'

export const SyntaxPackageManifestSchema = z
  .object({
    $schema: z.string().optional(),
    schemaVersion: z.union([z.literal(1), z.literal(2)]).default(2),
    id: z
      .string()
      .regex(
        /^[a-z0-9][a-z0-9-]{1,62}$/,
        'id must be lowercase letters, numbers, and hyphens (2 to 63 chars).',
      ),
    kind: PackageKindSchema,
    extension: PackageExtensionSchema.optional(),
    name: z.string().trim().min(2, 'name is required.'),
    tagline: z.string().trim().min(4, 'tagline is required.'),
    description: z.string().trim().min(8, 'description is required.'),
    version: SemverVersionSchema,
    author: PackageAuthorSchema,
    icon: z.string().optional(),
    iconSvg: z
      .string()
      .trim()
      .refine(isSafeSvgIcon, {
        message: 'Package requires a safe inline <svg>...</svg> icon.',
      })
      .optional(),
    accentColor: z
      .string()
      .regex(/^#[0-9a-fA-F]{3,8}$/, 'accentColor must be a hex color.')
      .default('#456dff'),
    tags: z.array(z.string().min(1)).default([]),
    license: z.string().max(40).optional(),
    homepage: z
      .string()
      .url()
      .refine(u => u.startsWith('https://'), 'homepage must use https://')
      .optional(),

    // Fabric / Modrinth compatibility block
    environment: PackageEnvironmentSchema.optional(),
    depends: DependencyRangeMapSchema.optional(),
    recommends: DependencyRangeMapSchema.optional(),
    breaks: DependencyRangeMapSchema.optional(),
    conflicts: DependencyRangeMapSchema.optional(),
    provides: z.array(CapabilityIdSchema).optional(),

    // Runtime permissions & extension points
    permissions: z.array(PluginPermissionSchema).optional(),
    contributes: PluginContributesSchema.optional(),

    // Core-touch transparency (kept for v1 + official packages)
    touchesCore: z.boolean().default(false),
    coreTouchReason: z.string().optional(),

    // Legacy v1 dependency arrays (auto-normalized by getCompatibility)
    requires: z.array(PackageDependencySchema).optional(),
    optional: z
      .array(
        z.object({
          id: z.string().min(2),
          kind: z.enum(['plugin', 'embedded-plugin']),
          name: z.string().min(2),
        }),
      )
      .optional(),

    aiUsage: PackageAIUsageSchema.optional(),
    safety: PackageSafetySchema.default({
      automatedScan: 'passed',
      sandboxed: true,
      networkAccess: 'none',
      lastChecked: '2026-11-26',
    }),
    builtIn: z.boolean().optional(),
    packageUrl: z
      .string()
      .url()
      .refine(u => u.startsWith('https://'), 'packageUrl must use https://')
      .optional(),
    courseRoute: z.enum(['mpm2d', 'thinking-in-code', 'custom']).optional(),

    // Entry payloads (either embedded in legacy JSON or unpacked from .sytx archive)
    entry: z.string().optional(),
    customCourse: CustomCourseDataSchema.optional(),
    sandboxHtml: z.string().max(250000).optional(),
    readmeMd: z.string().max(80000).optional(),
    archiveSha256: z.string().optional(),
    archiveSizeBytes: z.number().int().min(0).optional(),
  })
  .superRefine((data, ctx) => {
    if (data.schemaVersion === 1 && data.extension) {
      const expectedLegacy = LEGACY_EXTENSION_BY_KIND[data.kind]
      if (data.extension !== expectedLegacy && data.extension !== '.sytx') {
        ctx.addIssue({
          code: 'custom',
          path: ['extension'],
          message: `extension must be "${expectedLegacy}" or ".sytx" for kind "${data.kind}".`,
        })
      }
    }
    if (data.touchesCore && (!data.coreTouchReason || data.coreTouchReason.trim().length < 4)) {
      ctx.addIssue({
        code: 'custom',
        path: ['coreTouchReason'],
        message: 'Plugins that touch core should explain why in coreTouchReason.',
      })
    }
    if (!data.iconSvg && !data.icon) {
      ctx.addIssue({
        code: 'custom',
        path: ['iconSvg'],
        message: 'Package requires either iconSvg or an icon file inside the .sytx archive.',
      })
    }
  })

export type SyntaxPackageManifest = Omit<
  z.infer<typeof SyntaxPackageManifestSchema>,
  'iconSvg' | 'extension'
> & {
  iconSvg: string
  extension: PackageExtension
}

export type ValidationResult =
  | { ok: true; manifest: SyntaxPackageManifest }
  | { ok: false; errors: string[] }

export type NormalizedCompat = {
  environment: PackageEnvironment
  depends: Record<string, string>
  recommends: Record<string, string>
  breaks: Record<string, string>
  conflicts: Record<string, string>
  provides: string[]
}

/**
 * Single source of truth for reading compatibility fields from BOTH v1 and v2 manifests.
 * Automatically folds legacy `requires` -> `depends` and `optional` -> `recommends`.
 */
export function getCompatibility(m: SyntaxPackageManifest): NormalizedCompat {
  const depends: Record<string, string> = { ...(m.depends ?? {}) }
  if (!depends.syntax) {
    depends.syntax = `^${SYNTAX_HOST_VERSION}`
  }
  for (const req of m.requires ?? []) {
    if (!depends[req.id]) {
      depends[req.id] = `>=${req.minVersion}`
    }
  }

  const recommends: Record<string, string> = { ...(m.recommends ?? {}) }
  for (const opt of m.optional ?? []) {
    if (!recommends[opt.id]) {
      recommends[opt.id] = '*'
    }
  }

  const environment: PackageEnvironment =
    m.environment ??
    (m.kind === 'embedded-plugin' ? 'lesson' : m.kind === 'course' ? 'course' : 'all')

  return {
    environment,
    depends,
    recommends,
    breaks: { ...(m.breaks ?? {}) },
    conflicts: { ...(m.conflicts ?? {}) },
    provides: [...(m.provides ?? [])],
  }
}

/**
 * Returns the effective permissions for a manifest, inferring from contributes/touchesCore
 * for backwards compatibility with v1 community packages.
 */
export function getEffectivePermissions(m: SyntaxPackageManifest): PluginPermission[] {
  const perms = new Set<PluginPermission>(m.permissions ?? [])
  if (m.touchesCore) perms.add('core:layout')
  if (m.contributes?.toolbar?.length) perms.add('ui:toolbar')
  if (m.contributes?.blocks?.length) perms.add('ui:lesson-block')
  if (m.contributes?.playbook?.length) perms.add('ui:playbook')
  if (m.contributes?.theme) perms.add('ui:theme')
  // Legacy v1 app plugins with sandboxHtml act as toolbar widgets automatically
  if (m.kind === 'plugin' && m.sandboxHtml && !m.contributes?.toolbar?.length && !m.builtIn) {
    perms.add('ui:toolbar')
  }
  if (m.kind === 'embedded-plugin' && m.sandboxHtml && !m.contributes?.blocks?.length) {
    perms.add('ui:lesson-block')
  }
  return [...perms]
}

/**
 * Resolves effective toolbar contributions, including automatic v1 upgrade for community
 * app plugins that only ship `sandboxHtml` (like focus-pomodoro-bar!).
 */
export function getToolbarContributions(m: SyntaxPackageManifest): ToolbarContribution[] {
  if (m.contributes?.toolbar && m.contributes.toolbar.length > 0) {
    return m.contributes.toolbar
  }
  if (m.kind === 'plugin' && m.sandboxHtml && !m.builtIn) {
    return [
      {
        id: m.id,
        label: m.name.length > 18 ? m.name.slice(0, 18).trim() : m.name,
        tooltip: m.tagline,
        entry: 'widget.html',
        defaultWidth: 360,
        defaultHeight: 340,
      },
    ]
  }
  return []
}

export function validatePackageManifest(raw: unknown): ValidationResult {
  const parsed = SyntaxPackageManifestSchema.safeParse(raw)
  if (parsed.success) {
    const data = parsed.data
    const manifest: SyntaxPackageManifest = {
      ...data,
      iconSvg: data.iconSvg ?? DEFAULT_ICON_SVG,
      extension: data.extension ?? SYTX_EXTENSION,
    }
    return { ok: true, manifest }
  }
  const errors = parsed.error.issues.map(issue => {
    const path = issue.path.length > 0 ? `${issue.path.join('.')}: ` : ''
    return `${path}${issue.message}`
  })
  return { ok: false, errors }
}

export function normalizeExternalManifest(
  manifest: SyntaxPackageManifest,
  officialIds: ReadonlySet<string>,
): SyntaxPackageManifest {
  if (officialIds.has(manifest.id)) {
    return manifest
  }
  return {
    ...manifest,
    builtIn: false,
    courseRoute: manifest.kind === 'course' ? 'custom' : undefined,
    author: {
      ...manifest.author,
      official: false,
    },
    safety: {
      ...manifest.safety,
      official: false,
    },
  }
}

export function sanitizeUntrustedManifest(
  manifest: SyntaxPackageManifest,
  officialIds: ReadonlySet<string>,
): SyntaxPackageManifest {
  return normalizeExternalManifest(manifest, officialIds)
}

/**
 * Strips bulky inline payloads before persisting metadata to localStorage,
 * while keeping full data cached in IndexedDB PackageVault.
 */
export function stripManifestForStorage(manifest: SyntaxPackageManifest): SyntaxPackageManifest {
  const { sandboxHtml: _h, readmeMd: _r, ...lean } = manifest
  return {
    ...lean,
    // Keep small custom courses or inline HTML under 40 KB in localStorage as fallback
    ...(manifest.sandboxHtml && manifest.sandboxHtml.length <= 40000
      ? { sandboxHtml: manifest.sandboxHtml }
      : {}),
  }
}
