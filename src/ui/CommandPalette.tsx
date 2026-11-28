import { useEffect, useMemo, useState } from 'react'
import { Command } from 'cmdk'
import {
  BookOpen,
  Compass,
  FileText,
  Home,
  Library,
  Moon,
  Puzzle,
  Search,
  Settings,
  Sun,
  Terminal,
  User,
  Volume2,
  VolumeX,
} from 'lucide-react'
import { toast } from 'sonner'
import { useContributionStore } from '../extensions/contributions.ts'
import { documentStore, type DocumentEnvelope } from '../extensions/documents.ts'
import { extensionManager } from '../extensions/manager.ts'
import { getNativeDevHost, refreshNativeDevInstalls, useNativeDevStore } from '../extensions/native/devHost.ts'
import { useExtensionStore } from '../extensions/store.ts'

export interface CommandPaletteProps {
  open: boolean
  theme: 'light' | 'dark'
  soundOn: boolean
  onOpenChange: (open: boolean) => void
  onNavigate: (path: string) => void
  onToggleTheme: () => void
  onToggleSound: () => void
}

export function CommandPalette({
  open,
  theme,
  soundOn,
  onOpenChange,
  onNavigate,
  onToggleTheme,
  onToggleSound,
}: CommandPaletteProps) {
  const records = useExtensionStore(s => s.records)
  const runtimeById = useExtensionStore(s => s.runtime)
  const commands = useContributionStore(s => s.commands)
  const views = useContributionStore(s => s.views)
  const nativeInstalls = useNativeDevStore(state => state.installs)
  const nativeReady = useNativeDevStore(state => state.phase === 'ready')
  const nativeCommands = nativeReady ? nativeInstalls.flatMap(({ package: { manifest } }) =>
    getNativeDevHost().runtime.listCommands(manifest.id).map(command => ({ manifest, command })),
  ) : []
  const [documents, setDocuments] = useState<DocumentEnvelope[]>([])

  useEffect(() => {
    if (!open) return
    let cancelled = false
    void documentStore.list().then(list => {
      if (!cancelled) setDocuments(list)
    })
    return () => {
      cancelled = true
    }
  }, [open])

  const nameById = useMemo(() => new Map(records.map(r => [r.id, r.manifest.name])), [records])
  const kindById = useMemo(() => new Map(records.map(r => [r.id, r.manifest.kind])), [records])
  const nonEmbedViews = useMemo(() => views.filter(v => v.placement !== 'embed'), [views])
  const activeCommands = useMemo(
    () =>
      commands.filter(cmd => {
        const rt = runtimeById[cmd.ownerId]
        return !(rt && rt.status === 'failed' && !rt.hasLiveWorker)
      }),
    [commands, runtimeById],
  )

  function run(action: () => void) {
    onOpenChange(false)
    action()
  }

  return (
    <Command.Dialog
      open={open}
      onOpenChange={onOpenChange}
      label="Quick search and commands"
      className="sx-cmdk-dialog"
      overlayClassName="sx-cmdk-overlay"
      contentClassName="sx-cmdk-content"
      data-testid="command-palette"
    >
      <div className="sx-cmd-input-row">
        <Search size={16} className="sx-cmd-search-icon" aria-hidden="true" />
        <Command.Input
          className="sx-cmd-input"
          placeholder="Search commands, courses, extensions, documents..."
          aria-label="Search commands and workspace"
          autoFocus
        />
        <kbd className="sx-kbd">Esc</kbd>
      </div>

      <Command.List className="sx-cmd-results">
        <Command.Empty className="sx-cmd-empty">
          No matching commands, views, or documents.
        </Command.Empty>

        {(activeCommands.length > 0 || nativeCommands.length > 0) && (
          <Command.Group heading="Commands" className="sx-cmd-group">
            {activeCommands.map(cmd => {
              const ownerName = nameById.get(cmd.ownerId) ?? cmd.ownerId
              return (
                <Command.Item
                  key={`cmd:${cmd.key}`}
                  value={`${cmd.title} ${ownerName} ${cmd.id} command`}
                  className="sx-cmd-item"
                  onSelect={() =>
                    run(() => {
                      void extensionManager.runCommand(cmd.key).catch(err => {
                        toast.error(`${ownerName}: ${err instanceof Error ? err.message : String(err)}`)
                      })
                    })
                  }
                >
                  <Terminal size={15} className="sx-cmd-row-icon" aria-hidden="true" />
                  <span className="sx-cmd-item-copy">
                    <strong>{cmd.title}</strong>
                    <small>{ownerName}</small>
                  </span>
                </Command.Item>
              )
            })}
            {nativeCommands.map(({ manifest, command }) => (
              <Command.Item
                key={`native:${manifest.id}:${command.id}`}
                value={`${command.title} ${manifest.name} ${command.id} command`}
                className="sx-cmd-item"
                onSelect={() => run(() => {
                  void getNativeDevHost().runCommand(manifest.id, command.id).catch(async error => {
                    toast.error(`${manifest.name}: ${error instanceof Error ? error.message : String(error)}`)
                    await refreshNativeDevInstalls()
                  }).catch(error => toast.error(error instanceof Error ? error.message : String(error)))
                })}
              >
                <Terminal size={15} className="sx-cmd-row-icon" aria-hidden="true" />
                <span className="sx-cmd-item-copy">
                  <strong>{command.title}</strong>
                  <small>{manifest.name}</small>
                </span>
              </Command.Item>
            ))}
          </Command.Group>
        )}

        {nonEmbedViews.length > 0 && (
          <Command.Group heading="Courses & Extensions" className="sx-cmd-group">
            {nonEmbedViews.map(view => {
              const ownerName = nameById.get(view.ownerId) ?? view.ownerId
              const isCourse = kindById.get(view.ownerId) === 'course'
              return (
                <Command.Item
                  key={`view:${view.key}`}
                  value={`${view.title} ${ownerName} ${view.ownerId} ${isCourse ? 'course' : 'extension'}`}
                  className="sx-cmd-item"
                  onSelect={() =>
                    run(() =>
                      onNavigate(`/ext/${encodeURIComponent(view.ownerId)}/${encodeURIComponent(view.id)}`),
                    )
                  }
                >
                  {isCourse ? (
                    <BookOpen size={15} className="sx-cmd-row-icon" aria-hidden="true" />
                  ) : (
                    <Puzzle size={15} className="sx-cmd-row-icon" aria-hidden="true" />
                  )}
                  <span className="sx-cmd-item-copy">
                    <strong>{view.title}</strong>
                    <small>{isCourse ? `${ownerName} · Course` : ownerName}</small>
                  </span>
                </Command.Item>
              )
            })}
          </Command.Group>
        )}

        {documents.length > 0 && (
          <Command.Group heading="Saved Documents" className="sx-cmd-group">
            {documents.slice(0, 12).map(doc => {
              const ownerName = nameById.get(doc.createdByExtensionId) ?? doc.createdByExtensionId
              const ownerViews = nonEmbedViews.filter(v => v.ownerId === doc.createdByExtensionId)
              const matchingView =
                ownerViews.find(v => v.docTypes.includes(doc.type)) ?? ownerViews[0]
              const viewId = matchingView?.id ?? 'main'
              return (
                <Command.Item
                  key={`doc:${doc.id}`}
                  value={`${doc.title} ${doc.type} ${ownerName} document`}
                  className="sx-cmd-item"
                  onSelect={() =>
                    run(() =>
                      onNavigate(
                        `/ext/${encodeURIComponent(doc.createdByExtensionId)}/${encodeURIComponent(viewId)}/${encodeURIComponent(doc.id)}`,
                      ),
                    )
                  }
                >
                  <FileText size={15} className="sx-cmd-row-icon" aria-hidden="true" />
                  <span className="sx-cmd-item-copy">
                    <strong>{doc.title}</strong>
                    <small>
                      {doc.type} · {ownerName}
                    </small>
                  </span>
                </Command.Item>
              )
            })}
          </Command.Group>
        )}

        <Command.Group heading="Workspace" className="sx-cmd-group">
          <Command.Item
            value="Go to Home start overview"
            className="sx-cmd-item"
            onSelect={() => run(() => onNavigate('/'))}
          >
            <Home size={15} className="sx-cmd-row-icon" aria-hidden="true" />
            <span className="sx-cmd-item-copy">
              <strong>Go to Home</strong>
              <small>Workspace overview</small>
            </span>
          </Command.Item>
          <Command.Item
            value="Go to Library courses documents widgets"
            className="sx-cmd-item"
            onSelect={() => run(() => onNavigate('/library'))}
          >
            <Library size={15} className="sx-cmd-row-icon" aria-hidden="true" />
            <span className="sx-cmd-item-copy">
              <strong>Go to Library</strong>
              <small>Courses, extensions, and saved documents</small>
            </span>
          </Command.Item>
          <Command.Item
            value="Manage Extensions Courses install plugins logs"
            className="sx-cmd-item"
            onSelect={() => run(() => onNavigate('/extensions'))}
          >
            <Puzzle size={15} className="sx-cmd-row-icon" aria-hidden="true" />
            <span className="sx-cmd-item-copy">
              <strong>Manage Extensions &amp; Courses</strong>
              <small>Install, update, settings, and logs</small>
            </span>
          </Command.Item>
          <Command.Item
            value="Browse Community Hub catalog discover store"
            className="sx-cmd-item"
            onSelect={() => run(() => onNavigate('/community'))}
          >
            <Compass size={15} className="sx-cmd-row-icon" aria-hidden="true" />
            <span className="sx-cmd-item-copy">
              <strong>Browse Community Hub</strong>
              <small>Discover published packages</small>
            </span>
          </Command.Item>
          <Command.Item
            value="Open Settings preferences theme sound sema"
            className="sx-cmd-item"
            onSelect={() => run(() => onNavigate('/settings'))}
          >
            <Settings size={15} className="sx-cmd-row-icon" aria-hidden="true" />
            <span className="sx-cmd-item-copy">
              <strong>Open Settings</strong>
              <small>Appearance, sound, and preferences</small>
            </span>
          </Command.Item>
          <Command.Item
            value="Open Profile account sync activity"
            className="sx-cmd-item"
            onSelect={() => run(() => onNavigate('/profile'))}
          >
            <User size={15} className="sx-cmd-row-icon" aria-hidden="true" />
            <span className="sx-cmd-item-copy">
              <strong>Open Profile &amp; Activity</strong>
              <small>Account, activity heatmap, and cloud sync</small>
            </span>
          </Command.Item>
          <Command.Item
            value="Switch theme dark light mode appearance"
            className="sx-cmd-item"
            onSelect={() => run(onToggleTheme)}
          >
            {theme === 'dark' ? (
              <Sun size={15} className="sx-cmd-row-icon" aria-hidden="true" />
            ) : (
              <Moon size={15} className="sx-cmd-row-icon" aria-hidden="true" />
            )}
            <span className="sx-cmd-item-copy">
              <strong>{theme === 'dark' ? 'Switch to Light Mode' : 'Switch to Dark Mode'}</strong>
              <small>Change appearance</small>
            </span>
          </Command.Item>
          <Command.Item
            value="Sound effects audio mute unmute"
            className="sx-cmd-item"
            onSelect={() => run(onToggleSound)}
          >
            {soundOn ? (
              <VolumeX size={15} className="sx-cmd-row-icon" aria-hidden="true" />
            ) : (
              <Volume2 size={15} className="sx-cmd-row-icon" aria-hidden="true" />
            )}
            <span className="sx-cmd-item-copy">
              <strong>{soundOn ? 'Mute Sound Effects' : 'Enable Sound Effects'}</strong>
              <small>Toggle interface audio</small>
            </span>
          </Command.Item>
        </Command.Group>
      </Command.List>

      <div className="sx-cmd-footer" aria-hidden="true">
        <span><kbd className="sx-kbd">↑</kbd><kbd className="sx-kbd">↓</kbd> Navigate</span>
        <span><kbd className="sx-kbd">↵</kbd> Open</span>
        <span><kbd className="sx-kbd">Esc</kbd> Close</span>
      </div>
    </Command.Dialog>
  )
}
