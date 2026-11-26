/**
 * Obsidian-style theme foundation for future `.syntaxtheme` packages.
 * Themes declare safe CSS custom properties scoped to `:root[data-syntax-theme]`,
 * preserving Brilliant's neutral monochrome & charcoal visual calm by default.
 */

export interface SyntaxThemeManifest {
  id: string
  name: string
  author: string
  version: string
  mode: 'light' | 'dark' | 'both'
  tokens: Partial<Record<SyntaxThemeToken, string>>
}

export type SyntaxThemeToken =
  | '--surface'
  | '--secondary'
  | '--text'
  | '--muted'
  | '--border'
  | '--hover'
  | '--geo-blue'
  | '--geo-teal'
  | '--geo-amber'
  | '--geo-violet'
  | '--geo-green'

const ALLOWED_TOKENS = new Set<SyntaxThemeToken>([
  '--surface',
  '--secondary',
  '--text',
  '--muted',
  '--border',
  '--hover',
  '--geo-blue',
  '--geo-teal',
  '--geo-amber',
  '--geo-violet',
  '--geo-green',
])

const SAFE_COLOR_RE =
  /^(#[0-9a-fA-F]{3,8}|rgba?\([0-9.,%\s/]+\)|hsla?\([0-9.,%\s/a-zA-Z]+\))$/

export function applySyntaxTheme(theme: SyntaxThemeManifest | null): void {
  if (typeof document === 'undefined') return
  const root = document.documentElement
  for (const token of ALLOWED_TOKENS) {
    root.style.removeProperty(token)
  }
  if (!theme) {
    delete root.dataset.syntaxTheme
    return
  }
  root.dataset.syntaxTheme = theme.id
  for (const [token, value] of Object.entries(theme.tokens)) {
    if (
      ALLOWED_TOKENS.has(token as SyntaxThemeToken) &&
      typeof value === 'string' &&
      SAFE_COLOR_RE.test(value.trim())
    ) {
      root.style.setProperty(token, value.trim())
    }
  }
}
