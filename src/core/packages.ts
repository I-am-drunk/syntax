import { z } from 'zod'

export const PackageKindSchema = z.enum(['course', 'plugin', 'embedded-plugin'])
export type PackageKind = z.infer<typeof PackageKindSchema>

export const PackageExtensionSchema = z.enum([
  '.syntaxcourse',
  '.syntaxplugin',
  '.syntaxembeddedplugin',
])
export type PackageExtension = z.infer<typeof PackageExtensionSchema>

export const PACKAGE_EXTENSION_BY_KIND: Record<PackageKind, PackageExtension> = {
  course: '.syntaxcourse',
  plugin: '.syntaxplugin',
  'embedded-plugin': '.syntaxembeddedplugin',
}

export const PACKAGE_LABEL_BY_KIND: Record<PackageKind, string> = {
  course: 'Course',
  plugin: 'App Plugin',
  'embedded-plugin': 'Embedded Plugin',
}

const UNSAFE_SVG_RE =
  /<script\b|<\/script\b|<foreignobject\b|<iframe\b|<object\b|<embed\b|\son[a-z]+\s*=|javascript:|vbscript:|data:text\/html/i

const MAX_PACKAGE_FILE_BYTES = 2 * 1024 * 1024

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

export function compareSemver(a: string, b: string): number {
  const split = (v: string) => {
    const clean = v.split('+')[0] ?? v
    const dash = clean.indexOf('-')
    const core = dash >= 0 ? clean.slice(0, dash) : clean
    const pre = dash >= 0 ? clean.slice(dash + 1) : ''
    const nums = core.split('.').map(n => Number.parseInt(n, 10) || 0)
    return { nums, pre: pre ? pre.split('.') : [] }
  }
  const pa = split(a)
  const pb = split(b)
  for (let i = 0; i < 3; i++) {
    const diff = (pa.nums[i] ?? 0) - (pb.nums[i] ?? 0)
    if (diff !== 0) return diff > 0 ? 1 : -1
  }
  // Stable release is newer than prerelease (e.g. 1.0.0 > 1.0.0-alpha.1)
  if (pa.pre.length > 0 && pb.pre.length === 0) return -1
  if (pa.pre.length === 0 && pb.pre.length > 0) return 1
  const maxLen = Math.max(pa.pre.length, pb.pre.length)
  for (let i = 0; i < maxLen; i++) {
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

export const PackageDependencySchema = z.object({
  id: z.string().regex(/^[a-z0-9][a-z0-9-]{1,62}$/),
  kind: z.enum(['plugin', 'embedded-plugin']),
  minVersion: z.string().regex(/^\d+\.\d+\.\d+(?:-[a-z0-9.-]+)?$/i),
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

export const CustomCourseLessonSchema = z
  .object({
    id: z.string().min(1),
    title: z.string().min(2),
    summary: z.string().min(4),
    prompt: z.string().optional(),
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

export const SyntaxPackageManifestSchema = z
  .object({
    schemaVersion: z.literal(1),
    id: z
      .string()
      .regex(
        /^[a-z0-9][a-z0-9-]{1,62}$/,
        'id must be lowercase letters, numbers, and hyphens (2 to 63 chars).',
      ),
    kind: PackageKindSchema,
    extension: PackageExtensionSchema,
    name: z.string().trim().min(2, 'name is required.'),
    tagline: z.string().trim().min(4, 'tagline is required.'),
    description: z.string().trim().min(8, 'description is required.'),
    version: z
      .string()
      .regex(
        /^\d+\.\d+\.\d+(?:-[a-z0-9.-]+)?$/i,
        'version must follow major.minor.patch (for example 1.0.0).',
      ),
    author: PackageAuthorSchema,
    iconSvg: z.string().trim().refine(isSafeSvgIcon, {
      message: 'Package requires a safe inline <svg>...</svg> icon.',
    }),
    accentColor: z.string().regex(/^#[0-9a-fA-F]{3,8}$/, 'accentColor must be a hex color.'),
    tags: z.array(z.string().min(1)).default([]),
    touchesCore: z.boolean(),
    coreTouchReason: z.string().optional(),
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
    customCourse: CustomCourseDataSchema.optional(),
    sandboxHtml: z.string().max(250000).optional(),
  })
  .superRefine((data, ctx) => {
    const expectedExt = PACKAGE_EXTENSION_BY_KIND[data.kind]
    if (data.extension !== expectedExt) {
      ctx.addIssue({
        code: 'custom',
        path: ['extension'],
        message: `extension must be "${expectedExt}" for kind "${data.kind}".`,
      })
    }
    if (data.touchesCore && (!data.coreTouchReason || data.coreTouchReason.trim().length < 4)) {
      ctx.addIssue({
        code: 'custom',
        path: ['coreTouchReason'],
        message: 'Plugins that touch core should explain why in coreTouchReason.',
      })
    }
  })

export type SyntaxPackageManifest = z.infer<typeof SyntaxPackageManifestSchema>

export type ValidationResult =
  | { ok: true; manifest: SyntaxPackageManifest }
  | { ok: false; errors: string[] }

export function validatePackageManifest(raw: unknown): ValidationResult {
  const parsed = SyntaxPackageManifestSchema.safeParse(raw)
  if (parsed.success) {
    return { ok: true, manifest: parsed.data }
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

export function exportPackageFile(pkg: SyntaxPackageManifest) {
  const filename = `${pkg.id}${pkg.extension}`
  const payload = JSON.stringify(pkg, null, 2)
  const blob = new Blob([payload], { type: 'application/json' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  document.body.appendChild(a)
  a.click()
  a.remove()
  setTimeout(() => URL.revokeObjectURL(url), 1000)
}

export async function parsePackageFile(file: File): Promise<ValidationResult> {
  const lower = file.name.toLowerCase()
  const validExt =
    lower.endsWith('.syntaxcourse') ||
    lower.endsWith('.syntaxplugin') ||
    lower.endsWith('.syntaxembeddedplugin') ||
    lower.endsWith('.json')

  if (!validExt) {
    return {
      ok: false,
      errors: [
        'Unsupported file type. Choose a .syntaxcourse, .syntaxplugin, .syntaxembeddedplugin, or .json file.',
      ],
    }
  }

  if (file.size > MAX_PACKAGE_FILE_BYTES) {
    return {
      ok: false,
      errors: ['Package file is too large (maximum size is 2 MB).'],
    }
  }

  try {
    const text = await file.text()
    const parsed = JSON.parse(text) as unknown
    return validatePackageManifest(parsed)
  } catch (err) {
    return {
      ok: false,
      errors: [err instanceof Error ? `Invalid JSON: ${err.message}` : 'Could not parse JSON file.'],
    }
  }
}
