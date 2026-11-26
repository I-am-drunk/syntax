/**
 * Safe CSS Custom Property Theme Pack Host.
 * Mounted once inside AppShell: gathers `contributes.theme` from enabled plugins
 * holding `ui:theme` permission in deterministic load order, validates every token
 * against `SAFE_THEME_TOKENS`, and injects a single `<style id="syntax-plugin-themes">`.
 * Disabling a theme plugin removes 100% of its CSS rules immediately.
 */
import { useEffect, useMemo } from 'react'
import { computeLoadOrder } from './compatibility'
import { getEffectivePermissions, isSafeThemeTokenValue } from './packages'
import { useInstalledPackages } from './registry'

const STYLE_ELEMENT_ID = 'syntax-plugin-themes'

export function PluginThemeHost() {
  const records = useInstalledPackages()

  const cssText = useMemo(() => {
    const enabled = records.filter(r => r.enabled).map(r => r.manifest)
    const { order } = computeLoadOrder(enabled)
    const byId = new Map(enabled.map(m => [m.id, m]))

    const lightTokens: Record<string, string> = {}
    const darkTokens: Record<string, string> = {}

    for (const id of order) {
      const m = byId.get(id)
      if (!m?.contributes?.theme) continue
      if (!getEffectivePermissions(m).includes('ui:theme')) continue
      for (const [k, v] of Object.entries(m.contributes.theme.light ?? {})) {
        if (isSafeThemeTokenValue(k, v)) lightTokens[k] = v.trim()
      }
      for (const [k, v] of Object.entries(m.contributes.theme.dark ?? {})) {
        if (isSafeThemeTokenValue(k, v)) darkTokens[k] = v.trim()
      }
    }

    const parts: string[] = []
    const lightEntries = Object.entries(lightTokens)
    const darkEntries = Object.entries(darkTokens)

    if (lightEntries.length > 0) {
      parts.push(
        `:root:not([data-theme="dark"]), :root[data-theme="light"] {\n${lightEntries
          .map(([k, v]) => `  ${k}: ${v};`)
          .join('\n')}\n}`,
      )
    }
    if (darkEntries.length > 0) {
      parts.push(
        `:root[data-theme="dark"] {\n${darkEntries.map(([k, v]) => `  ${k}: ${v};`).join('\n')}\n}`,
      )
    }

    return parts.join('\n\n')
  }, [records])

  useEffect(() => {
    if (typeof document === 'undefined') return
    let el = document.getElementById(STYLE_ELEMENT_ID) as HTMLStyleElement | null

    if (!cssText) {
      el?.remove()
      return
    }
    if (!el) {
      el = document.createElement('style')
      el.id = STYLE_ELEMENT_ID
      document.head.appendChild(el)
    }
    el.textContent = cssText

    return () => {
      // Keep style clean if AppShell unmounts
      if (!cssText) el?.remove()
    }
  }, [cssText])

  return null
}
