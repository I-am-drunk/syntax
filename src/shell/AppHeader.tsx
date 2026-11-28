import { useEffect, useLayoutEffect, useRef, useState } from 'react'
import { Menu } from '@base-ui/react/menu'
import { AnimatePresence, motion } from 'framer-motion'
import {
  ArrowLeft,
  Blocks,
  BookOpen,
  Check,
  Compass,
  Home,
  Menu as MenuIcon,
  Moon,
  Search,
  Settings,
  Sparkles,
  Sun,
  Terminal,
  User,
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

export type ActiveNavRoute =
  | 'home'
  | 'library'
  | 'extensions'
  | 'community'
  | 'settings'
  | 'profile'
  | null

interface AppHeaderProps {
  activeRoute: ActiveNavRoute
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

// Keep Sema in the codebase, disabled in the top bar for now
const SHOW_TOPBAR_SEMA = false

const DESKTOP_TABS = [
  { id: 'home', label: 'Home', path: '/' },
  { id: 'library', label: 'Library', path: '/library' },
] as const

const MOBILE_TABS = [
  { id: 'home', label: 'Home', path: '/', Icon: Home },
  { id: 'library', label: 'Library', path: '/library', Icon: BookOpen },
  { id: 'extensions', label: 'Extensions', path: '/extensions', Icon: Blocks },
  { id: 'community', label: 'Community Hub', path: '/community', Icon: Compass },
  { id: 'profile', label: 'Profile', path: '/profile', Icon: User },
] as const

const MENU_NAV_ITEMS = [
  { id: 'home', label: 'Home', path: '/', Icon: Home },
  { id: 'library', label: 'Library', path: '/library', Icon: BookOpen },
  { id: 'extensions', label: 'Extensions', path: '/extensions', Icon: Blocks },
  { id: 'community', label: 'Community Hub', path: '/community', Icon: Compass },
  { id: 'settings', label: 'Settings', path: '/settings', Icon: Settings },
] as const

export function AppHeader({
  activeRoute,
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
  const rawExtensionToolbar = useContributionStore(s => s.toolbar)
  const rawExtensionCommands = useContributionStore(s => s.commands)
  const extensionRecords = useExtensionStore(s => s.records)
  const runtimeById = useExtensionStore(s => s.runtime)
  const [runningCommands, setRunningCommands] = useState<ReadonlySet<string>>(() => new Set())

  const navStyle = prefs.navStyle === 'pill' ? 'pill' : 'underline'
  const navRef = useRef<HTMLElement | null>(null)
  const tabRefs = useRef<Record<string, HTMLAnchorElement | null>>({})
  const [indicator, setIndicator] = useState<{ left: number; width: number; visible: boolean }>({
    left: 0,
    width: 0,
    visible: false,
  })

  useLayoutEffect(() => {
    const syncIndicator = () => {
      if (activeRoute !== 'home' && activeRoute !== 'library') {
        setIndicator(prev => (prev.visible ? { ...prev, visible: false } : prev))
        return
      }
      const el = tabRefs.current[activeRoute]
      if (!el || el.offsetWidth === 0) return
      setIndicator({ left: el.offsetLeft, width: el.offsetWidth, visible: true })
    }
    syncIndicator()
    const rafId = window.requestAnimationFrame(syncIndicator)
    const ro =
      typeof ResizeObserver !== 'undefined' && navRef.current
        ? new ResizeObserver(syncIndicator)
        : null
    if (ro && navRef.current) ro.observe(navRef.current)
    window.addEventListener('resize', syncIndicator, { passive: true })
    return () => {
      window.cancelAnimationFrame(rafId)
      ro?.disconnect()
      window.removeEventListener('resize', syncIndicator)
    }
  }, [activeRoute, navStyle])

  useEffect(() => {
    if (typeof document === 'undefined' || !('fonts' in document)) return
    let active = true
    void document.fonts.ready.then(() => {
      if (!active || (activeRoute !== 'home' && activeRoute !== 'library')) return
      const el = tabRefs.current[activeRoute]
      if (el) setIndicator({ left: el.offsetLeft, width: el.offsetWidth, visible: true })
    })
    return () => {
      active = false
    }
  }, [activeRoute, navStyle])

  const isWorkerStopped = (ownerId: string) => {
    const rt = runtimeById[ownerId]
    return Boolean(rt && rt.status === 'failed' && !rt.hasLiveWorker)
  }
  const extensionToolbar = rawExtensionToolbar.filter(
    item => !item.commandKey || !isWorkerStopped(item.ownerId),
  )
  const extensionCommands = rawExtensionCommands.filter(cmd => !isWorkerStopped(cmd.ownerId))

  const ownerNames = new Map(extensionRecords.map(r => [r.id, r.manifest.name]))
  const isMac =
    typeof navigator !== 'undefined' &&
    /Mac|iPhone|iPad|iPod/i.test(navigator.platform || navigator.userAgent)
  const shortcutLabel = isMac ? '⌘K' : 'Ctrl K'

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
    onNavigate(prefs.logoClickTarget === 'home' ? '/' : '/library')
  }

  const toolbarViewItems = extensionToolbar.filter(item => item.viewId && !item.commandKey)
  const hasExtensionMenuActions = extensionCommands.length > 0 || toolbarViewItems.length > 0

  return (
    <>
      <header className="app-header sx-app-header">
        <div className="sx-header-left">
          <div className={`brand-lockup${isDev ? ' is-dev-brand' : ''}`}>
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

            {SHOW_TOPBAR_SEMA && (
              <TopBarSema
                enableRoaming={false}
                dockedIntoLogo={false}
                isDev={isDev}
                shape={prefs.semaShape}
                tail={prefs.semaTail}
                expression={prefs.semaExpression}
                hasNotification={false}
                onPoke={onPokeSema}
                onLogoClick={handleLogoClick}
              />
            )}
          </div>

          <div className="sx-nav-cluster">
            <AnimatePresence initial={false}>
              {activeRoute !== 'home' && activeRoute !== 'library' && (
                <motion.a
                  key={`back-library-${navStyle}`}
                  href="#/library"
                  className={`sx-nav-back-bubble ${navStyle === 'pill' ? 'is-pill' : 'is-underline'}`}
                  initial={{ opacity: 0, x: -10, scale: 0.94 }}
                  animate={{ opacity: 1, x: 0, scale: 1 }}
                  exit={{ opacity: 0, x: -8, scale: 0.94 }}
                  transition={{ type: 'spring', stiffness: 380, damping: 30, mass: 0.85 }}
                  onClick={e => {
                    e.preventDefault()
                    onNavigate('/library')
                  }}
                >
                  <ArrowLeft size={14} strokeWidth={2} aria-hidden="true" />
                  <span>Back to Library</span>
                </motion.a>
              )}
            </AnimatePresence>

            <nav
              ref={navRef}
              className={`sx-nav-bar ${navStyle === 'pill' ? 'is-pill' : 'is-underline'}`}
              aria-label="Main navigation"
            >
              {navStyle === 'pill' && (
                <span
                  className={`sx-nav-pill-slider${indicator.visible ? ' is-visible' : ''}`}
                  aria-hidden="true"
                  style={{
                    width: `${indicator.width}px`,
                    transform: `translate3d(${indicator.left}px, 0, 0)`,
                  }}
                />
              )}
              {DESKTOP_TABS.map(tab => {
                const active = activeRoute === tab.id
                return (
                  <a
                    key={tab.id}
                    ref={el => {
                      tabRefs.current[tab.id] = el
                    }}
                    href={`#${tab.path}`}
                    className={`sx-nav-link${active ? ' is-active' : ''}`}
                    aria-current={active ? 'page' : undefined}
                    onClick={e => {
                      e.preventDefault()
                      onNavigate(tab.path)
                    }}
                  >
                    {tab.label}
                  </a>
                )
              })}
              {navStyle === 'underline' && (
                <span
                  className={`sx-nav-underline${indicator.visible ? ' is-visible' : ''}`}
                  aria-hidden="true"
                  style={{
                    width: `${indicator.width}px`,
                    transform: `translate3d(${indicator.left}px, 0, 0)`,
                  }}
                />
              )}
            </nav>
          </div>
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
            className="sx-header-search-btn"
            aria-label={`Quick search and commands (${shortcutLabel})`}
            title={`Quick search (${shortcutLabel})`}
            onClick={onOpenCommandPalette}
          >
            <Search size={15} strokeWidth={2} aria-hidden="true" />
            <span className="sx-header-search-text">Search</span>
            <kbd className="sx-header-search-kbd">{shortcutLabel}</kbd>
          </button>

          <button
            type="button"
            className="header-icon-btn sx-header-sound-btn"
            aria-label={soundOn ? 'Mute sound effects' : 'Enable sound effects'}
            title={soundOn ? 'Sound on' : 'Sound off'}
            onClick={onToggleSound}
          >
            {soundOn ? (
              <Volume2 size={17} strokeWidth={1.9} aria-hidden="true" />
            ) : (
              <VolumeX size={17} strokeWidth={1.9} aria-hidden="true" />
            )}
          </button>

          <button
            type="button"
            className="header-icon-btn sx-header-theme-btn"
            aria-label={theme === 'dark' ? 'Switch to light mode' : 'Switch to dark mode'}
            title={theme === 'dark' ? 'Light mode' : 'Dark mode'}
            onClick={onToggleTheme}
          >
            {theme === 'dark' ? (
              <Sun size={17} strokeWidth={1.9} aria-hidden="true" />
            ) : (
              <Moon size={17} strokeWidth={1.9} aria-hidden="true" />
            )}
          </button>

          <span className="sx-header-sep" aria-hidden="true" />

          <ProfilePopover onNavigate={onNavigate} />

          <Menu.Root>
            <Menu.Trigger aria-label="Menu" className="menu-trigger">
              <MenuIcon size={18} strokeWidth={2} aria-hidden="true" />
            </Menu.Trigger>
            <Menu.Portal>
              <Menu.Positioner sideOffset={8} align="end" collisionPadding={10} className="menu-positioner">
                <Menu.Popup className="sx-menu-popup">
                  <Menu.Group className="sx-menu-group">
                    <Menu.Item className="sx-menu-item" onClick={onOpenCommandPalette}>
                      <Search size={15} strokeWidth={1.75} className="sx-menu-row-icon" aria-hidden="true" />
                      <span className="sx-menu-label">Quick search</span>
                      <kbd className="sx-menu-kbd">{shortcutLabel}</kbd>
                    </Menu.Item>
                  </Menu.Group>

                  <Menu.Separator className="sx-menu-sep" />

                  <Menu.Group className="sx-menu-group">
                    {MENU_NAV_ITEMS.map(({ id, label, path, Icon }) => {
                      const active = activeRoute === id
                      return (
                        <Menu.Item
                          key={id}
                          className={`sx-menu-item${active ? ' is-current' : ''}`}
                          onClick={() => onNavigate(path)}
                        >
                          <Icon size={15} strokeWidth={1.75} className="sx-menu-row-icon" aria-hidden="true" />
                          <span className="sx-menu-label">{label}</span>
                          {active && (
                            <Check size={14} strokeWidth={2.2} className="sx-menu-check" aria-hidden="true" />
                          )}
                        </Menu.Item>
                      )
                    })}
                  </Menu.Group>

                  {hasExtensionMenuActions && (
                    <>
                      <Menu.Separator className="sx-menu-sep" />
                      <Menu.Group className="sx-menu-group">
                        <div className="sx-menu-section-label">Extensions</div>
                        {toolbarViewItems.map(item => (
                          <Menu.Item
                            key={`tb:${item.key}`}
                            className="sx-menu-item sx-ext-cmd-item"
                            onClick={() =>
                              onNavigate(
                                `/ext/${encodeURIComponent(item.ownerId)}/${encodeURIComponent(item.viewId!)}`,
                              )
                            }
                          >
                            <Blocks size={15} strokeWidth={1.75} className="sx-menu-row-icon" aria-hidden="true" />
                            <span className="sx-ext-cmd-copy">
                              <span>{item.label}</span>
                              <small>{ownerNames.get(item.ownerId) ?? item.ownerId}</small>
                            </span>
                          </Menu.Item>
                        ))}
                        {extensionCommands.map(cmd => (
                          <Menu.Item
                            key={cmd.key}
                            className="sx-menu-item sx-ext-cmd-item"
                            data-extension-command-key={cmd.key}
                            onClick={() => void handleRunCommand(cmd.key, cmd.ownerId)}
                          >
                            <Terminal size={15} strokeWidth={1.75} className="sx-menu-row-icon" aria-hidden="true" />
                            <span className="sx-ext-cmd-copy">
                              <span>{cmd.title}</span>
                              <small>{ownerNames.get(cmd.ownerId) ?? cmd.ownerId}</small>
                            </span>
                          </Menu.Item>
                        ))}
                      </Menu.Group>
                    </>
                  )}

                  <Menu.Separator className="sx-menu-sep" />

                  <Menu.Group className="sx-menu-group">
                    <Menu.Item className="sx-menu-item" onClick={onToggleTheme}>
                      {theme === 'dark' ? (
                        <Sun size={15} strokeWidth={1.75} className="sx-menu-row-icon" aria-hidden="true" />
                      ) : (
                        <Moon size={15} strokeWidth={1.75} className="sx-menu-row-icon" aria-hidden="true" />
                      )}
                      <span className="sx-menu-label">Appearance</span>
                      <span className="sx-menu-value">{theme === 'dark' ? 'Dark' : 'Light'}</span>
                    </Menu.Item>
                    <Menu.Item className="sx-menu-item" onClick={onToggleSound}>
                      {soundOn ? (
                        <Volume2 size={15} strokeWidth={1.75} className="sx-menu-row-icon" aria-hidden="true" />
                      ) : (
                        <VolumeX size={15} strokeWidth={1.75} className="sx-menu-row-icon" aria-hidden="true" />
                      )}
                      <span className="sx-menu-label">Sound</span>
                      <span className="sx-menu-value">{soundOn ? 'On' : 'Off'}</span>
                    </Menu.Item>
                    <Menu.Item className="sx-menu-item" onClick={onOpenWelcome}>
                      <Sparkles size={15} strokeWidth={1.75} className="sx-menu-row-icon" aria-hidden="true" />
                      <span className="sx-menu-label">Welcome tour</span>
                    </Menu.Item>
                  </Menu.Group>
                </Menu.Popup>
              </Menu.Positioner>
            </Menu.Portal>
          </Menu.Root>
        </div>
      </header>

      <nav className="sx-mobile-tabbar" aria-label="Mobile navigation">
        {MOBILE_TABS.map(tab => {
          const active = activeRoute === tab.id
          const Icon = tab.Icon
          return (
            <a
              key={tab.id}
              href={`#${tab.path}`}
              className={`sx-mobile-tab${active ? ' is-active' : ''}`}
              aria-label={tab.label}
              title={tab.label}
              aria-current={active ? 'page' : undefined}
              onClick={e => {
                e.preventDefault()
                onNavigate(tab.path)
              }}
            >
              <Icon
                size={22}
                strokeWidth={active ? 2.3 : 1.75}
                className="sx-mobile-tab-icon"
                aria-hidden="true"
              />
            </a>
          )
        })}
      </nav>
    </>
  )
}
