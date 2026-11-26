/**
 * TypeScript definitions for the sandboxed `window.Syntax` runtime SDK
 * available inside Syntax plugin `widget.html` entry files.
 */

export type SyntaxThemeMode = 'light' | 'dark'

export type SyntaxThemeTokens = {
  bg: string
  fg: string
  muted: string
  border: string
  accent: string
}

export type SyntaxPermission =
  | 'storage'
  | 'ui:toolbar'
  | 'ui:lesson-block'
  | 'ui:playbook'
  | 'ui:theme'
  | 'core:layout'

export type SyntaxBlockResult = {
  correct?: boolean
  score?: number
  summary?: string
}

export interface SyntaxPluginSDK {
  /** Current Syntax host theme ('light' | 'dark'). */
  readonly theme: SyntaxThemeMode

  /** Initial props passed by the host lesson block (empty object for toolbar widgets). */
  readonly props: Readonly<Record<string, unknown>>

  /** Effective permissions granted to this plugin. */
  readonly permissions: readonly SyntaxPermission[]

  /** Subscribe to live theme switches without reloading the widget. Returns an unsubscribe fn. */
  onThemeChange(callback: (theme: SyntaxThemeMode, tokens: SyntaxThemeTokens) => void): () => void

  /** Scoped per-plugin local storage (requires "storage" permission, max 128 KB). */
  readonly storage: {
    get<T = unknown>(key: string): Promise<T | null>
    set(key: string, value: unknown): Promise<boolean>
    remove(key: string): Promise<boolean>
  }

  /** Show a brief non-intrusive toast in Syntax (rate-limited). */
  toast(message: string): void

  /** Report completion or grading state from an inline lesson block. */
  reportResult(result: SyntaxBlockResult): void

  /** Request an explicit iframe height in pixels (auto-sizing via ResizeObserver is built in). */
  resize(heightPx: number): void
}

declare global {
  interface Window {
    Syntax: SyntaxPluginSDK
  }
}
