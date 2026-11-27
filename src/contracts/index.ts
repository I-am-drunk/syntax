import { z } from 'zod'

/**
 * Extensibility v2 shared Zod v4 contracts (`src/contracts/`).
 *
 * Single source of truth for:
 *  - `syntax.course.v1`: pure declarative courses (zero untrusted JS)
 *  - `syntax.theme.v1`: pure JSON color-token packs with enforced WCAG >= 4.5:1 contrast
 *  - `syntax.widget.v1`: sandboxed interactive widgets with host-derived capability disclosures
 */

const HEX_COLOR_RE = /^#(?:[0-9a-fA-F]{6}|[0-9a-fA-F]{3})$/

export function expandHex(hex: string): [number, number, number] {
  const clean = hex.trim().replace(/^#/, '')
  const full =
    clean.length === 3
      ? clean
          .split('')
          .map(ch => ch + ch)
          .join('')
      : clean
  const r = Number.parseInt(full.slice(0, 2), 16)
  const g = Number.parseInt(full.slice(2, 4), 16)
  const b = Number.parseInt(full.slice(4, 6), 16)
  return [r, g, b]
}

/** WCAG 2.1 relative luminance in [0, 1]. */
export function relativeLuminance(hex: string): number {
  const [r, g, b] = expandHex(hex).map(c => {
    const s = c / 255
    return s <= 0.03928 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4
  })
  return 0.2126 * r! + 0.7152 * g! + 0.0722 * b!
}

/** WCAG 2.1 contrast ratio in [1, 21]. */
export function contrastRatio(hexA: string, hexB: string): number {
  const la = relativeLuminance(hexA)
  const lb = relativeLuminance(hexB)
  const lighter = Math.max(la, lb)
  const darker = Math.min(la, lb)
  return (lighter + 0.05) / (darker + 0.05)
}

export const HexColorSchema = z
  .string()
  .trim()
  .regex(HEX_COLOR_RE, 'Color must be a 3-digit or 6-digit hex value (e.g. #456dff).')

export const ThemeTokenPaletteSchema = z
  .object({
    canvas: HexColorSchema,
    surface: HexColorSchema,
    surfaceMuted: HexColorSchema,
    ink: HexColorSchema,
    inkMuted: HexColorSchema,
    accent: HexColorSchema,
    accentInk: HexColorSchema,
    border: HexColorSchema,
  })
  .superRefine((tokens, ctx) => {
    const bodyContrast = contrastRatio(tokens.ink, tokens.surface)
    if (bodyContrast < 4.5) {
      ctx.addIssue({
        code: 'custom',
        path: ['ink'],
        message: `Primary text contrast on surface is ${bodyContrast.toFixed(2)}:1 (WCAG AA requires >= 4.5:1).`,
      })
    }
    const canvasContrast = contrastRatio(tokens.ink, tokens.canvas)
    if (canvasContrast < 4.5) {
      ctx.addIssue({
        code: 'custom',
        path: ['canvas'],
        message: `Primary text contrast on canvas is ${canvasContrast.toFixed(2)}:1 (WCAG AA requires >= 4.5:1).`,
      })
    }
    const accentContrast = contrastRatio(tokens.accentInk, tokens.accent)
    if (accentContrast < 4.5) {
      ctx.addIssue({
        code: 'custom',
        path: ['accentInk'],
        message: `Button label contrast on accent is ${accentContrast.toFixed(2)}:1 (WCAG AA requires >= 4.5:1).`,
      })
    }
    const mutedContrast = contrastRatio(tokens.inkMuted, tokens.surface)
    if (mutedContrast < 3.0) {
      ctx.addIssue({
        code: 'custom',
        path: ['inkMuted'],
        message: `Muted text contrast on surface is ${mutedContrast.toFixed(2)}:1 (minimum 3.0:1).`,
      })
    }
  })

export type ThemeTokenPalette = z.infer<typeof ThemeTokenPaletteSchema>

export const SyntaxThemeV1Schema = z.object({
  contract: z.literal('syntax.theme.v1'),
  id: z.string().regex(/^[a-z0-9][a-z0-9-]{1,62}$/),
  name: z.string().trim().min(2).max(48),
  tagline: z.string().trim().min(4).max(120),
  author: z.string().trim().min(2).max(48),
  version: z.string().regex(/^\d+\.\d+\.\d+$/),
  builtIn: z.boolean().optional(),
  light: ThemeTokenPaletteSchema,
  dark: ThemeTokenPaletteSchema,
})

export type SyntaxThemeV1 = z.infer<typeof SyntaxThemeV1Schema>

export const DeclarativeStepSchema = z
  .object({
    id: z.string().min(1),
    title: z.string().min(2),
    summary: z.string().min(4),
    prompt: z.string().optional(),
    kind: z.enum(['choice', 'math-input', 'read']).optional(),
    choices: z.array(z.string().min(1)).optional(),
    answerIndex: z.number().int().min(0).optional(),
    acceptedAnswers: z.array(z.string().min(1)).optional(),
    hint: z.string().optional(),
    explanation: z.string().optional(),
  })
  .superRefine((step, ctx) => {
    if (step.answerIndex !== undefined && (!step.choices || step.answerIndex >= step.choices.length)) {
      ctx.addIssue({
        code: 'custom',
        path: ['answerIndex'],
        message: 'answerIndex must reference a valid entry in choices.',
      })
    }
  })

export type DeclarativeStep = z.infer<typeof DeclarativeStepSchema>

export const SyntaxCourseV1Schema = z.object({
  contract: z.literal('syntax.course.v1'),
  id: z.string().regex(/^[a-z0-9][a-z0-9-]{1,62}$/),
  name: z.string().trim().min(2).max(80),
  subtitle: z.string().trim().max(160).optional(),
  version: z.string().regex(/^\d+\.\d+\.\d+$/),
  units: z
    .array(
      z.object({
        title: z.string().min(2),
        lessons: z.array(DeclarativeStepSchema).min(1),
      }),
    )
    .min(1),
})

export type SyntaxCourseV1 = z.infer<typeof SyntaxCourseV1Schema>

export const WidgetCapabilityTokenSchema = z.enum([
  'theme:read',
  'resize:auto',
  'lesson:context',
])
export type WidgetCapabilityToken = z.infer<typeof WidgetCapabilityTokenSchema>

/** Host-owned immutable disclosure text (Chrome MV3 rule: never trust author prose). */
export const HOST_CAPABILITY_DISCLOSURES: Record<
  WidgetCapabilityToken,
  { label: string; detail: string }
> = {
  'theme:read': {
    label: 'Match Syntax theme',
    detail: 'Receives live Light and Dark surface tokens from Syntax.',
  },
  'resize:auto': {
    label: 'Auto-fit height',
    detail: 'Adjusts its isolated frame height up to 920px inside the lesson.',
  },
  'lesson:context': {
    label: 'Read lesson state',
    detail: 'Reads the current lesson title and step number without modifying your progress.',
  },
}

export const SyntaxWidgetV1Schema = z.object({
  contract: z.literal('syntax.widget.v1'),
  id: z.string().regex(/^[a-z0-9][a-z0-9-]{1,62}$/),
  name: z.string().trim().min(2).max(80),
  version: z.string().regex(/^\d+\.\d+\.\d+$/),
  capabilities: z.array(WidgetCapabilityTokenSchema).default(['theme:read', 'resize:auto']),
  html: z.string().min(1).max(250000),
})

export type SyntaxWidgetV1 = z.infer<typeof SyntaxWidgetV1Schema>
