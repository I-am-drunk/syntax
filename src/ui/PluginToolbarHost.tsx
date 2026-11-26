/**
 * Toolbar Tool Extension Point:
 * - `<PluginToolbarButtons />`: renders compact buttons in AppHeader & fullscreen lesson chrome
 * - `<PluginToolDrawer />`: single persistent non-blocking floating panel mounted in AppShell
 */
import { useEffect, useMemo, useState } from 'react'
import { X } from 'lucide-react'
import { computeLoadOrder } from '../core/compatibility'
import { SyntaxErrorBoundary } from '../core/ErrorBoundary'
import {
  getEffectivePermissions,
  getToolbarContributions,
  type SyntaxPackageManifest,
  type ToolbarContribution,
} from '../core/packages'
import { getVaultArchive } from '../core/packageVault'
import { usePluginRuntimeStore } from '../core/pluginRuntime'
import { useInstalledPackages, useRegistryStore } from '../core/registry'
import { PluginSandboxFrame } from '../core/sandbox'
import { PackageIcon } from './PackageIcon'

type ActiveToolbarEntry = {
  manifest: SyntaxPackageManifest
  tool: ToolbarContribution
}

function useActiveToolbarEntries(): ActiveToolbarEntry[] {
  const records = useInstalledPackages()
  return useMemo(() => {
    const enabled = records.filter(r => r.enabled).map(r => r.manifest)
    const { order } = computeLoadOrder(enabled)
    const byId = new Map(enabled.map(m => [m.id, m]))
    const out: ActiveToolbarEntry[] = []

    for (const id of order) {
      const m = byId.get(id)
      if (!m) continue
      if (!getEffectivePermissions(m).includes('ui:toolbar')) continue
      for (const tool of getToolbarContributions(m)) {
        out.push({ manifest: m, tool })
      }
    }
    return out
  }, [records])
}

export function PluginToolbarButtons({ compact = false }: { compact?: boolean }) {
  const entries = useActiveToolbarEntries()
  const activeTool = usePluginRuntimeStore(s => s.activeTool)
  const toggleTool = usePluginRuntimeStore(s => s.toggleTool)

  if (entries.length === 0) return null

  return (
    <div className={`sx-plugin-toolbar-group${compact ? ' is-compact' : ''}`}>
      {entries.map(({ manifest, tool }) => {
        const isOpen =
          activeTool?.pluginId === manifest.id && activeTool?.toolId === tool.id
        return (
          <button
            key={`${manifest.id}:${tool.id}`}
            type="button"
            className={`sx-plugin-toolbar-btn${isOpen ? ' is-open' : ''}`}
            aria-pressed={isOpen}
            title={tool.tooltip ?? manifest.name}
            onClick={() => toggleTool(manifest.id, tool.id)}
          >
            <PackageIcon
              id={manifest.id}
              kind={manifest.kind}
              svg={manifest.iconSvg}
              size={16}
            />
            {!compact && <span className="sx-plugin-toolbar-label">{tool.label}</span>}
          </button>
        )
      })}
    </div>
  )
}

export function PluginToolDrawer({ theme }: { theme: 'light' | 'dark' }) {
  const entries = useActiveToolbarEntries()
  const activeTool = usePluginRuntimeStore(s => s.activeTool)
  const closeTool = usePluginRuntimeStore(s => s.closeTool)
  const setPackageEnabled = useRegistryStore(s => s.setPackageEnabled)
  const [vaultHtml, setVaultHtml] = useState<string | null>(null)

  const current = useMemo(() => {
    if (!activeTool) return null
    return (
      entries.find(
        e => e.manifest.id === activeTool.pluginId && e.tool.id === activeTool.toolId,
      ) ?? null
    )
  }, [entries, activeTool])

  // Hydrate full widget HTML from IndexedDB vault if it exceeded localStorage trim threshold
  useEffect(() => {
    let cancelled = false
    setVaultHtml(null)
    if (!current || current.manifest.sandboxHtml) return
    void getVaultArchive(current.manifest.id).then(rec => {
      if (!cancelled && rec?.sandboxHtml) {
        setVaultHtml(rec.sandboxHtml)
      }
    })
    return () => {
      cancelled = true
    }
  }, [current])

  // Escape closes drawer cleanly
  useEffect(() => {
    if (!current) return
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && !e.defaultPrevented) {
        closeTool()
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [current, closeTool])

  if (!current) return null

  const { manifest, tool } = current
  const html = manifest.sandboxHtml ?? vaultHtml
  const width = tool.defaultWidth ?? 360
  const minHeight = tool.defaultHeight ?? 240

  return (
    <aside
      className="sx-plugin-drawer"
      style={{ width: `min(${width}px, calc(100vw - 32px))` }}
      aria-label={manifest.name}
    >
      <header className="sx-plugin-drawer-head">
        <div className="sx-plugin-drawer-title">
          <PackageIcon
            id={manifest.id}
            kind={manifest.kind}
            svg={manifest.iconSvg}
            size={22}
          />
          <div>
            <strong>{manifest.name}</strong>
            <span>v{manifest.version}</span>
          </div>
        </div>
        <button
          type="button"
          className="sx-icon-close"
          aria-label={`Close ${manifest.name}`}
          onClick={() => closeTool()}
        >
          <X size={16} aria-hidden="true" />
        </button>
      </header>

      <div className="sx-plugin-drawer-body">
        {html ? (
          <SyntaxErrorBoundary
            scope={`toolbar:${manifest.id}`}
            pluginName={manifest.name}
            onDisablePlugin={() => setPackageEnabled(manifest.id, false)}
            resetKeys={[manifest.id, tool.id]}
          >
            <PluginSandboxFrame
              pluginId={manifest.id}
              title={manifest.name}
              html={html}
              theme={theme}
              minHeight={minHeight}
              permissions={getEffectivePermissions(manifest)}
              networkAccess={manifest.safety.networkAccess}
              onDisablePlugin={() => setPackageEnabled(manifest.id, false)}
            />
          </SyntaxErrorBoundary>
        ) : (
          <p className="sx-modal-copy">
            This plugin does not include an interactive widget file.
          </p>
        )}
      </div>
    </aside>
  )
}
