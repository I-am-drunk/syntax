import { useState } from 'react'
import { AnimatePresence, motion } from 'framer-motion'
import { Menu } from '@base-ui/react/menu'
import {
  ArrowLeft,
  Compass,
  Home,
  Library,
  Menu as MenuIcon,
  Moon,
  Puzzle,
  Search,
  Settings,
  Sparkles,
  Sun,
  Terminal,
  Volume2,
  VolumeX,
} from 'lucide-react'
import { toast } from 'sonner'
import { isDevEnvironment } from '../core/devEnv'
import { useContributionStore } from '../extensions/contributions.ts'
import { extensionManager } from '../extensions/manager.ts'
import { useExtensionStore } from '../extensions/store.ts'
import { TopBarSema } from '../mascot/TopBarSema'
import type { SyntaxPrefs } from '../core/prefs'
import { ProfilePopover } from '../ui/ProfilePopover'

export type ShellMode = 'main' | 'workspace'
export type WorkspaceTab = 'settings' | 'extensions' | 'community'

interface AppHeaderProps {
  mode: ShellMode
  mainActiveTab: 'home' | 'library' | null
  workspaceActiveTab: WorkspaceTab | null
  theme: 'light' | 'dark'
  soundOn: boolean
  prefs: SyntaxPrefs
  onNavigate: (path: string) => void
  onOpenCommandPalette: () => void
  onToggleTheme: () => void
  onToggleSound: () => void
  onOpenWelcome: () => void
  onPokeSema: () => void
}

const NAV_TRANSITION = {
  duration: 0.14,
  ease: [0.22, 1, 0.36, 1] as const,
}

export function AppHeader({
  mode,
  mainActiveTab,
  workspaceActiveTab,
  theme,
  soundOn,
  prefs,
  onNavigate,
  onOpenCommandPalette,
  onToggleTheme,
  onToggleSound,
  onOpenWelcome,
  onPokeSema,
}: AppHeaderProps) {
  const isDev = isDevEnvironment()
  const extensionToolbar = useContributionStore(s => s.toolbar)
  const extensionCommands = useContributionStore(s => s.commands)
  const extensionRecords = useExtensionStore(s => s.records)
  const [runningCommands, setRunningCommands] = useState<ReadonlySet<string>>(() => new Set())
  const isWorkspace = mode === 'workspace'

  const ownerNames = new Map(extensionRecords.map(r => [r.id, r.manifest.name]))

  async function handleRunCommand(commandKey: string, ownerId: string) {
    setRunningCommands(prev => {
      const next = new Set(prev)
      next.add(commandKey)
      return next
    })
    const owner = ownerNames.get(ownerId) ?? ownerId
    let slowToastId: string | number | undefined
    const slowTimer = window.setTimeout(() => {
      slowToastId = toast.warning(`${owner} is taking a while...`, {
        duration: 15000,
        action: {
          label: 'Stop worker',
          onClick: () => {
            extensionManager.stopWorker(ownerId)
            toast(`Stopped ${owner} worker`)
          },
        },
      })
    }, 4000)

    try {
      await extensionManager.runCommand(commandKey)
    } catch (err) {
      toast.error(`${owner}: ${err instanceof Error ? err.message : String(err)}`)
    } finally {
      window.clearTimeout(slowTimer)
      if (slowToastId !== undefined) toast.dismiss(slowToastId)
      setRunningCommands(prev => {
        if (!prev.has(commandKey)) return prev
        const next = new Set(prev)
        next.delete(commandKey)
        return next
      })
    }
  }

  function handleLogoClick() {
    onPokeSema()
    onNavigate(prefs.logoClickTarget === 'home' ? '/' : '/library')
  }

  return (
    <header className="app-header sx-app-header" data-workspace={isWorkspace || undefined}>
      <div
        className={`brand-lockup${isDev ? ' is-dev-brand' : ''}`}
        data-workspace={isWorkspace || undefined}
      >
        <a
          className="wordmark"
          href={prefs.logoClickTarget === 'home' ? '#/' : '#/library'}
          aria-label={
            prefs.logoClickTarget === 'home'
              ? isDev
                ? 'Syntax Dev Home'
                : 'Syntax Home'
              : isDev
                ? 'Syntax Dev Library'
                : 'Syntax Library'
          }
          onClick={e => {
            e.preventDefault()
            handleLogoClick()
          }}
        >
          <span>Syntax</span>
          {isDev && <span className="dev-rainbow-text">Dev</span>}
        </a>

        <TopBarSema
          enableRoaming={prefs.onboarded && !isWorkspace}
          dockedIntoLogo={isWorkspace}
          isDev={isDev}
          shape={prefs.semaShape}
          tail={prefs.semaTail}
          expression={prefs.semaExpression}
          hasNotification={false}
          onPoke={onPokeSema}
          onLogoClick={handleLogoClick}
        />
      </div>

      {/* Mode-switched Top Navigation with crisp GPU-only cross-slide */}
      <div className="sx-nav-stage">
        <AnimatePresence mode="wait" initial={false}>
          {isWorkspace ? (
            <motion.nav
              key="nav-workspace"
              className="primary-nav sx-workspace-nav"
              aria-label="Workspace navigation"
              initial={{ opacity: 0, x: -6 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -6 }}
              transition={NAV_TRANSITION}
            >
              <button
                type="button"
                className="sx-nav-back-btn"
                aria-label="Back to Library"
                onClick={() => onNavigate('/library')}
              >
                <ArrowLeft size={16} strokeWidth={2.1} aria-hidden="true" />
                <span className="sx-nav-back-label">Library</span>
              </button>

              <span className="sx-nav-divider" aria-hidden="true" />

              <div className="sx-workspace-tabs">
                {(
                  [
                    { id: 'settings', label: 'Settings', path: '/settings', Icon: Settings },
                    { id: 'extensions', label: 'Extensions', path: '/extensions', Icon: Puzzle },
                    { id: 'community', label: 'Community Hub', path: '/community', Icon: Compass },
                  ] as const
                ).map(({ id, label, path, Icon }) => {
                  const active = workspaceActiveTab === id
                  return (
                    <button
                      key={id}
                      type="button"
                      className="primary-nav-btn"
                      aria-current={active ? 'page' : undefined}
                      onClick={() => onNavigate(path)}
                    >
                      <Icon size={16} strokeWidth={1.9} className="nav-svg-icon" aria-hidden="true" />
                      <span className="primary-nav-label">{label}</span>
                      {active && (
                        <motion.span
                          layoutId="workspace-nav-indicator"
                          className="primary-nav-indicator"
                          transition={{ type: 'spring', stiffness: 520, damping: 38 }}
                        />
                      )}
                    </button>
                  )
                })}
              </div>
            </motion.nav>
          ) : (
            <motion.nav
              key="nav-main"
              className="primary-nav sx-main-nav"
              aria-label="Main navigation"
              initial={{ opacity: 0, x: 6 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: 6 }}
              transition={NAV_TRANSITION}
            >
              <div className="sx-main-nav-tabs">
                <a
                  href="#/"
                  aria-label="Home"
                  aria-current={mainActiveTab === 'home' ? 'page' : undefined}
                  onClick={e => {
                    e.preventDefault()
                    onNavigate('/')
                  }}
                >
                  <Home size={16} strokeWidth={1.9} className="nav-svg-icon" aria-hidden="true" />
                  <span className="primary-nav-label">Home</span>
                  {mainActiveTab === 'home' && (
                    <motion.span
                      layoutId="primary-nav-indicator"
                      className="primary-nav-indicator"
                      transition={{ type: 'spring', stiffness: 520, damping: 38 }}
                    />
                  )}
                </a>

                <a
                  href="#/library"
                  aria-label="Library"
                  aria-current={mainActiveTab === 'library' ? 'page' : undefined}
                  onClick={e => {
                    e.preventDefault()
                    onNavigate('/library')
                  }}
                >
                  <Library size={16} strokeWidth={1.9} className="nav-svg-icon" aria-hidden="true" />
                  <span className="primary-nav-label">Library</span>
                  {mainActiveTab === 'library' && (
                    <motion.span
                      layoutId="primary-nav-indicator"
                      className="primary-nav-indicator"
                      transition={{ type: 'spring', stiffness: 520, damping: 38 }}
                    />
                  )}
                </a>
              </div>
            </motion.nav>
          )}
        </AnimatePresence>
      </div>

      <div className="header-actions">
        {extensionToolbar.length > 0 && (
          <div className="sx-ext-header-toolbar" role="toolbar" aria-label="Extension actions">
            {extensionToolbar.map(item => {
              const busy = Boolean(item.commandKey && runningCommands.has(item.commandKey))
              return (
                <button
                  key={item.key}
                  type="button"
                  className="sx-ext-toolbar-btn"
                  data-extension-toolbar-key={item.key}
                  disabled={busy}
                  aria-busy={busy || undefined}
                  title={`${item.label} (${ownerNames.get(item.ownerId) ?? item.ownerId})`}
                  onClick={() => {
                    if (item.commandKey) {
                      void handleRunCommand(item.commandKey, item.ownerId)
                    } else if (item.viewId) {
                      onNavigate(
                        `/ext/${encodeURIComponent(item.ownerId)}/${encodeURIComponent(item.viewId)}`,
                      )
                    }
                  }}
                >
                  <span>{item.label}</span>
                </button>
              )
            })}
          </div>
        )}

        <button
          type="button"
          className="header-icon-btn"
          aria-label="Quick search and commands (Ctrl+K)"
          title="Quick search (Ctrl+K)"
          onClick={onOpenCommandPalette}
        >
          <Search size={18} aria-hidden="true" />
        </button>

        <button
          type="button"
          className="header-icon-btn"
          aria-label={soundOn ? 'Mute sound effects' : 'Enable sound effects'}
          title={soundOn ? 'Sound on' : 'Sound off'}
          onClick={onToggleSound}
        >
          {soundOn ? (
            <Volume2 size={18} aria-hidden="true" />
          ) : (
            <VolumeX size={18} aria-hidden="true" />
          )}
        </button>

        <button
          type="button"
          className="header-icon-btn"
          aria-label={theme === 'dark' ? 'Switch to light mode' : 'Switch to dark mode'}
          title={theme === 'dark' ? 'Light mode' : 'Dark mode'}
          onClick={onToggleTheme}
        >
          {theme === 'dark' ? (
            <Sun size={18} aria-hidden="true" />
          ) : (
            <Moon size={18} aria-hidden="true" />
          )}
        </button>

        <ProfilePopover onNavigate={onNavigate} />

        <Menu.Root>
          <Menu.Trigger aria-label="Menu" className="menu-trigger">
            <MenuIcon size={20} aria-hidden="true" />
          </Menu.Trigger>
          <Menu.Portal>
            <Menu.Positioner sideOffset={12} align="end" className="menu-positioner">
              <Menu.Popup className="menu-popup sx-menu-popup">
                <Menu.Group className="menu-group">
                  <Menu.Item
                    className="menu-item sx-menu-item"
                    onClick={() => onNavigate('/settings')}
                  >
                    <Settings size={16} strokeWidth={1.9} aria-hidden="true" />
                    <span>Settings</span>
                  </Menu.Item>
                  <Menu.Item
                    className="menu-item sx-menu-item"
                    onClick={() => onNavigate('/extensions')}
                  >
                    <Puzzle size={16} strokeWidth={1.9} aria-hidden="true" />
                    <span>Extensions</span>
                  </Menu.Item>
                  <Menu.Item
                    className="menu-item sx-menu-item"
                    onClick={() => onNavigate('/community')}
                  >
                    <Compass size={16} strokeWidth={1.9} aria-hidden="true" />
                    <span>Community Hub</span>
                  </Menu.Item>
                </Menu.Group>

                {(extensionCommands.length > 0 || extensionToolbar.some(t => t.viewId && !t.commandKey)) && (
                  <>
                    <Menu.Separator className="menu-separator" />
                    <Menu.Group className="menu-group">
                      {extensionToolbar
                        .filter(item => item.viewId && !item.commandKey)
                        .map(item => (
                          <Menu.Item
                            key={`tb:${item.key}`}
                            className="menu-item sx-menu-item sx-ext-cmd-item"
                            onClick={() =>
                              onNavigate(
                                `/ext/${encodeURIComponent(item.ownerId)}/${encodeURIComponent(item.viewId!)}`,
                              )
                            }
                          >
                            <Puzzle size={15} strokeWidth={1.9} aria-hidden="true" />
                            <span className="sx-ext-cmd-copy">
                              <span>{item.label}</span>
                              <small>{ownerNames.get(item.ownerId) ?? item.ownerId}</small>
                            </span>
                          </Menu.Item>
                        ))}
                      {extensionCommands.map(cmd => (
                        <Menu.Item
                          key={cmd.key}
                          className="menu-item sx-menu-item sx-ext-cmd-item"
                          data-extension-command-key={cmd.key}
                          onClick={() => void handleRunCommand(cmd.key, cmd.ownerId)}
                        >
                          <Terminal size={15} strokeWidth={1.9} aria-hidden="true" />
                          <span className="sx-ext-cmd-copy">
                            <span>{cmd.title}</span>
                            <small>{ownerNames.get(cmd.ownerId) ?? cmd.ownerId}</small>
                          </span>
                        </Menu.Item>
                      ))}
                    </Menu.Group>
                  </>
                )}

                <Menu.Separator className="menu-separator" />

                <Menu.Group className="menu-group">
                  <Menu.Item className="menu-item sx-menu-item" onClick={onOpenWelcome}>
                    <Sparkles size={16} strokeWidth={1.9} aria-hidden="true" />
                    <span>Welcome tour</span>
                  </Menu.Item>
                </Menu.Group>
              </Menu.Popup>
            </Menu.Positioner>
          </Menu.Portal>
        </Menu.Root>
      </div>
    </header>
  )
}
