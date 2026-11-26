/**
 * Calm "Build a plugin" modal:
 * - Lets anyone download a working `.sytx` starter archive in 1 click (or test-install it immediately)
 * - Shows the 3-command local CLI workflow (`plugin:new`, `plugin:check`, `plugin:pack`)
 */
import { useState } from 'react'
import { Dialog } from '@base-ui/react/dialog'
import { BookOpen, Check, Copy, Download, Palette, Play, Terminal, Wrench, X } from 'lucide-react'
import { toast } from 'sonner'
import {
  buildStarterTemplate,
  exportSytxArchive,
  unpackSytx,
  type StarterTemplateKind,
  type UnpackedSytx,
} from '../core/archive'

type BuildPluginModalProps = {
  open: boolean
  onClose: () => void
  onTestInstall: (archive: UnpackedSytx) => void
}

const TEMPLATES: Array<{
  kind: StarterTemplateKind
  title: string
  subtitle: string
  files: string
  Icon: typeof Wrench
}> = [
  {
    kind: 'toolbar',
    title: 'Toolbar Tool',
    subtitle: 'Floating timer or utility docked in the Syntax header and inside lessons.',
    files: 'syntax.mod.json, icon.svg, widget.html',
    Icon: Wrench,
  },
  {
    kind: 'theme',
    title: 'Theme Pack',
    subtitle: 'Safe CSS color token overrides for light and dark mode with zero layout bleed.',
    files: 'syntax.mod.json, icon.svg, theme.css',
    Icon: Palette,
  },
  {
    kind: 'course',
    title: 'Custom Course',
    subtitle: 'Interactive unit & lesson deck with instant checks and explanations.',
    files: 'syntax.mod.json, icon.svg, course.json',
    Icon: BookOpen,
  },
]

const CLI_SNIPPET = `npm run plugin:new my-plugin -- --type tool
npm run plugin:check plugins/my-plugin
npm run plugin:pack plugins/my-plugin`

export function BuildPluginModal({ open, onClose, onTestInstall }: BuildPluginModalProps) {
  const [selected, setSelected] = useState<StarterTemplateKind>('toolbar')
  const [copiedCli, setCopiedCli] = useState(false)

  function handleDownload() {
    const { manifest, bytes } = buildStarterTemplate(selected)
    exportSytxArchive(manifest, bytes)
    toast.success(`Downloaded ${manifest.id}-${manifest.version}.sytx`)
  }

  async function handleInstallNow() {
    const { bytes } = buildStarterTemplate(selected)
    const unpacked = await unpackSytx(bytes)
    if (!unpacked.ok) {
      toast.error(unpacked.errors[0] || 'Could not unpack starter archive.')
      return
    }
    onClose()
    onTestInstall(unpacked.archive)
  }

  async function handleCopyCli() {
    try {
      await navigator.clipboard.writeText(CLI_SNIPPET)
      setCopiedCli(true)
      window.setTimeout(() => setCopiedCli(false), 1600)
    } catch {
      toast.error('Could not copy commands')
    }
  }

  return (
    <Dialog.Root
      open={open}
      onOpenChange={nextOpen => {
        if (!nextOpen) onClose()
      }}
    >
      <Dialog.Portal>
        <Dialog.Backdrop className="sx-modal-backdrop" />
        <Dialog.Popup className="sx-modal sx-dialog-popup sx-build-modal">
          <div className="sx-modal-head">
            <div className="sx-modal-titles">
              <Dialog.Title className="sx-dialog-title">Build a Syntax plugin</Dialog.Title>
              <span className="sx-modal-meta">
                Every Syntax mod is a standard .sytx ZIP archive containing syntax.mod.json
              </span>
            </div>
            <Dialog.Close className="sx-icon-close" aria-label="Close">
              <X size={18} aria-hidden="true" />
            </Dialog.Close>
          </div>

          <div className="sx-starter-grid" role="radiogroup" aria-label="Starter template">
            {TEMPLATES.map(({ kind, title, subtitle, files, Icon }) => {
              const active = selected === kind
              return (
                <button
                  key={kind}
                  type="button"
                  role="radio"
                  aria-checked={active}
                  className={`sx-starter-card${active ? ' is-selected' : ''}`}
                  onClick={() => setSelected(kind)}
                >
                  <div className="sx-starter-card-head">
                    <Icon size={16} aria-hidden="true" />
                    <strong>{title}</strong>
                  </div>
                  <p>{subtitle}</p>
                  <code>{files}</code>
                </button>
              )
            })}
          </div>

          <div className="sx-build-actions-row">
            <button type="button" className="sx-btn-primary" onClick={() => void handleInstallNow()}>
              <Play size={14} aria-hidden="true" />
              <span>Inspect &amp; test now</span>
            </button>
            <button type="button" className="sx-btn-secondary" onClick={handleDownload}>
              <Download size={14} aria-hidden="true" />
              <span>Download starter .sytx</span>
            </button>
          </div>

          <div className="sx-cli-box">
            <div className="sx-cli-box-head">
              <span>
                <Terminal size={13} aria-hidden="true" /> Local CLI workflow
              </span>
              <button
                type="button"
                className="sx-btn-ghost sx-btn-xs"
                onClick={() => void handleCopyCli()}
              >
                {copiedCli ? <Check size={12} aria-hidden="true" /> : <Copy size={12} aria-hidden="true" />}
                <span>{copiedCli ? 'Copied' : 'Copy'}</span>
              </button>
            </div>
            <pre>{CLI_SNIPPET}</pre>
            <p className="sx-cli-hint">
              Drop the generated <code>.sytx</code> file anywhere on the Plugins page to inspect and
              install locally without signing in.
            </p>
          </div>
        </Dialog.Popup>
      </Dialog.Portal>
    </Dialog.Root>
  )
}
