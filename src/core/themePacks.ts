import { z } from 'zod'
import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import { syntaxLog } from './logger'

const HEX_COLOR_RE = /^#(?:[0-9a-fA-F]{6}|[0-9a-fA-F]{3})$/

function expandHex(hex: string): [number, number, number] {
  const clean = hex.trim().replace(/^#/, '')
  const full =
    clean.length === 3
      ? clean
          .split('')
          .map(ch => ch + ch)
          .join('')
      : clean
  return [
    Number.parseInt(full.slice(0, 2), 16),
    Number.parseInt(full.slice(2, 4), 16),
    Number.parseInt(full.slice(4, 6), 16),
  ]
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
  return (Math.max(la, lb) + 0.05) / (Math.min(la, lb) + 0.05)
}

const HexColorSchema = z
  .string()
  .trim()
  .regex(HEX_COLOR_RE, 'Color must be a 3-digit or 6-digit hex value (e.g. #456dff).')

const ThemeTokenPaletteSchema = z
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

export const BUILTIN_THEME_PACKS: readonly SyntaxThemeV1[] = [
  {
    contract: 'syntax.theme.v1',
    id: 'syntax-default',
    name: 'Syntax Default',
    tagline: 'Crisp white and neutral charcoal with Syntax blue.',
    author: 'Syntax Official',
    version: '1.0.0',
    builtIn: true,
    light: {
      canvas: '#ffffff',
      surface: '#ffffff',
      surfaceMuted: '#f6f7f9',
      ink: '#141414',
      inkMuted: '#595959',
      accent: '#456dff',
      accentInk: '#ffffff',
      border: '#e5e7eb',
    },
    dark: {
      canvas: '#141414',
      surface: '#1c1c1c',
      surfaceMuted: '#242424',
      ink: '#f3f3f3',
      inkMuted: '#a3a3a3',
      accent: '#4f76ff',
      accentInk: '#ffffff',
      border: '#2e2e2e',
    },
  },
  {
    contract: 'syntax.theme.v1',
    id: 'paper-ink',
    name: 'Paper & Ink',
    tagline: 'Warm textbook paper for long study sessions.',
    author: 'Syntax Official',
    version: '1.0.0',
    builtIn: true,
    light: {
      canvas: '#faf7f2',
      surface: '#fffdf9',
      surfaceMuted: '#f1ece2',
      ink: '#1f1d1a',
      inkMuted: '#5c564e',
      accent: '#1d4ed8',
      accentInk: '#ffffff',
      border: '#e2d9cb',
    },
    dark: {
      canvas: '#181614',
      surface: '#211e1b',
      surfaceMuted: '#2b2723',
      ink: '#f5efe6',
      inkMuted: '#b0a699',
      accent: '#2563eb',
      accentInk: '#ffffff',
      border: '#35302a',
    },
  },
  {
    contract: 'syntax.theme.v1',
    id: 'emerald-chalk',
    name: 'Emerald Studio',
    tagline: 'Calm botanical emerald accents on monochrome surfaces.',
    author: 'Syntax Official',
    version: '1.0.0',
    builtIn: true,
    light: {
      canvas: '#f8faf9',
      surface: '#ffffff',
      surfaceMuted: '#edf3f0',
      ink: '#111c17',
      inkMuted: '#4a5d54',
      accent: '#047857',
      accentInk: '#ffffff',
      border: '#d6e3dc',
    },
    dark: {
      canvas: '#111614',
      surface: '#18201d',
      surfaceMuted: '#202b27',
      ink: '#eef5f1',
      inkMuted: '#9db0a6',
      accent: '#059669',
      accentInk: '#ffffff',
      border: '#2a3833',
    },
  },
  {
    contract: 'syntax.theme.v1',
    id: 'nordic-slate',
    name: 'Nordic Slate',
    tagline: 'Cool architectural slate surfaces tuned for deep focus.',
    author: 'Syntax Official',
    version: '1.0.0',
    builtIn: true,
    light: {
      canvas: '#f4f6f9',
      surface: '#ffffff',
      surfaceMuted: '#e8edf4',
      ink: '#0f172a',
      inkMuted: '#475569',
      accent: '#3730a3',
      accentInk: '#ffffff',
      border: '#d4dce7',
    },
    dark: {
      canvas: '#0f141c',
      surface: '#161d28',
      surfaceMuted: '#1f2937',
      ink: '#f1f5f9',
      inkMuted: '#94a3b8',
      accent: '#4f46e5',
      accentInk: '#ffffff',
      border: '#293548',
    },
  },
]

const BUILTIN_BY_ID = new Map(BUILTIN_THEME_PACKS.map(t => [t.id, t]))

export function applyThemePackToDocument(pack: SyntaxThemeV1, mode: 'light' | 'dark') {
  if (typeof document === 'undefined') return
  const root = document.documentElement
  const palette: ThemeTokenPalette = mode === 'dark' ? pack.dark : pack.light
  root.dataset.themePack = pack.id

  const managedVars = [
    '--sx-pack-canvas',
    '--sx-pack-surface',
    '--sx-pack-surface-muted',
    '--sx-pack-ink',
    '--sx-pack-ink-muted',
    '--sx-pack-accent',
    '--sx-pack-accent-ink',
    '--sx-pack-border',
    '--surface',
    '--secondary',
    '--text',
    '--muted',
    '--border',
    '--accent-blue',
    '--focus-ring',
  ]

  if (pack.id === 'syntax-default') {
    for (const v of managedVars) root.style.removeProperty(v)
    root.style.removeProperty('background')
    root.style.removeProperty('color')
    return
  }

  root.style.setProperty('--sx-pack-canvas', palette.canvas)
  root.style.setProperty('--sx-pack-surface', palette.surface)
  root.style.setProperty('--sx-pack-surface-muted', palette.surfaceMuted)
  root.style.setProperty('--sx-pack-ink', palette.ink)
  root.style.setProperty('--sx-pack-ink-muted', palette.inkMuted)
  root.style.setProperty('--sx-pack-accent', palette.accent)
  root.style.setProperty('--sx-pack-accent-ink', palette.accentInk)
  root.style.setProperty('--sx-pack-border', palette.border)

  root.style.background = palette.canvas
  root.style.color = palette.ink
  root.style.setProperty('--surface', palette.surface)
  root.style.setProperty('--secondary', palette.surfaceMuted)
  root.style.setProperty('--text', palette.ink)
  root.style.setProperty('--muted', palette.inkMuted)
  root.style.setProperty('--border', palette.border)
  root.style.setProperty('--accent-blue', palette.accent)
  root.style.setProperty('--focus-ring', palette.accent)
}

export function getThemeContrastSummary(pack: SyntaxThemeV1, mode: 'light' | 'dark'): string {
  const p = mode === 'dark' ? pack.dark : pack.light
  const ratio = contrastRatio(p.ink, p.surface)
  return `${ratio.toFixed(1)}:1 WCAG ${ratio >= 7 ? 'AAA' : 'AA'}`
}

interface ThemePackStoreState {
  activeThemeId: string
  customThemes: SyntaxThemeV1[]
  setActiveThemeId: (id: string) => void
  importThemeJson: (raw: string) => { ok: true; theme: SyntaxThemeV1 } | { ok: false; error: string }
  removeCustomTheme: (id: string) => void
}

export const useThemePackStore = create<ThemePackStoreState>()(
  persist(
    (set, get) => ({
      activeThemeId: 'syntax-default',
      customThemes: [],

      setActiveThemeId(id) {
        const exists = BUILTIN_BY_ID.has(id) || get().customThemes.some(t => t.id === id)
        if (!exists) return
        set({ activeThemeId: id })
        if (typeof window !== 'undefined') {
          window.dispatchEvent(new CustomEvent('syntax:theme-pack-changed', { detail: id }))
        }
      },

      importThemeJson(raw) {
        if (raw.length > 64000) {
          return { ok: false, error: 'Theme file is too large (max 64 KB).' }
        }
        let parsed: unknown
        try {
          parsed = JSON.parse(raw)
        } catch {
          return { ok: false, error: 'Theme file must be valid JSON.' }
        }
        const checked = SyntaxThemeV1Schema.safeParse(parsed)
        if (!checked.success) {
          const msg = checked.error.issues[0]?.message ?? 'Invalid syntax.theme.v1 schema.'
          return { ok: false, error: msg }
        }
        if (BUILTIN_BY_ID.has(checked.data.id)) {
          return {
            ok: false,
            error: `Theme ID "${checked.data.id}" is reserved for a built-in theme.`,
          }
        }
        const cleanTheme: SyntaxThemeV1 = { ...checked.data, builtIn: false }
        const next = [
          ...get().customThemes.filter(t => t.id !== cleanTheme.id),
          cleanTheme,
        ]
        set({ customThemes: next, activeThemeId: cleanTheme.id })
        syntaxLog.info('themes', `Imported WCAG-verified theme pack ${cleanTheme.name}`)
        if (typeof window !== 'undefined') {
          window.dispatchEvent(new CustomEvent('syntax:theme-pack-changed', { detail: cleanTheme.id }))
        }
        return { ok: true, theme: cleanTheme }
      },

      removeCustomTheme(id) {
        const next = get().customThemes.filter(t => t.id !== id)
        const nextActive = get().activeThemeId === id ? 'syntax-default' : get().activeThemeId
        set({ customThemes: next, activeThemeId: nextActive })
      },
    }),
    {
      name: 'syntax-theme-packs-v1',
      merge: (persisted, current) => {
        const saved = persisted as Partial<ThemePackStoreState> | undefined
        if (!saved) return current
        const validCustom: SyntaxThemeV1[] = []
        for (const item of Array.isArray(saved.customThemes) ? saved.customThemes : []) {
          const check = SyntaxThemeV1Schema.safeParse(item)
          if (check.success && !BUILTIN_BY_ID.has(check.data.id)) {
            validCustom.push({ ...check.data, builtIn: false })
          }
        }
        const savedId = typeof saved.activeThemeId === 'string' ? saved.activeThemeId : 'syntax-default'
        const activeThemeId =
          BUILTIN_BY_ID.has(savedId) || validCustom.some(t => t.id === savedId)
            ? savedId
            : 'syntax-default'
        return { ...current, activeThemeId, customThemes: validCustom }
      },
    },
  ),
)

export function getAllThemePacks(customThemes: SyntaxThemeV1[]): SyntaxThemeV1[] {
  return [...BUILTIN_THEME_PACKS, ...customThemes]
}

export function resolveThemePack(id: string, customThemes: SyntaxThemeV1[]): SyntaxThemeV1 {
  return (
    BUILTIN_BY_ID.get(id) ??
    customThemes.find(t => t.id === id) ??
    BUILTIN_THEME_PACKS[0]!
  )
}
