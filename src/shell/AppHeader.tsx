import { AnimatePresence, motion } from 'framer-motion'
import { Menu } from '@base-ui/react/menu'
import {
  ArrowLeft,
  Compass,
  Menu as MenuIcon,
  Moon,
  Puzzle,
  Settings,
  Sun,
  Volume2,
  VolumeX,
} from 'lucide-react'
import { useHostSlots } from '../core/hostSlots'
import { TopBarSema } from '../mpm2d/mascot/TopBarSema'
import { DevMetricsMicroBar, isDevEnvironment } from '../mpm2d/components/DevChannelBadge'
import type { SyntaxPrefs } from '../mpm2d/storage'
import { ProfilePopover } from '../ui/ProfilePopover'

export type ShellMode = 'main' | 'course' | 'workspace'
export type WorkspaceTab = 'settings' | 'plugins' | 'community'

interface AppHeaderProps {
  mode: ShellMode
  mainActiveTab: 'home' | 'library' | null
  workspaceActiveTab: WorkspaceTab | null
  theme: 'light' | 'dark'
  soundOn: boolean
  prefs: SyntaxPrefs
  hasMissedNotification: boolean
  onNavigate: (path: string) => void
  onToggleTheme: () => void
  onToggleSound: () => void
  onOpenWelcome: () => void
  onPokeSema: () => void
}

export function AppHeader({
  mode,
  mainActiveTab,
  workspaceActiveTab,
  theme,
  soundOn,
  prefs,
  hasMissedNotification,
  onNavigate,
  onToggleTheme,
  onToggleSound,
  onOpenWelcome,
  onPokeSema,
}: AppHeaderProps) {
  const isDev = isDevEnvironment()
  const { contribution } = useHostSlots()
  const isWorkspace = mode === 'workspace'
  const isCourse = mode === 'course'

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
        <div className="brand-wordmark-stack">
          {isDev && <DevMetricsMicroBar compact />}
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
            Syntax{isDev && <span className="dev-rainbow-text"> Dev</span>}
          </a>
        </div>

        <TopBarSema
          enableRoaming={prefs.onboarded && !isWorkspace && !isCourse}
          dockedIntoLogo={isWorkspace}
          shape={prefs.semaShape}
          tail={prefs.semaTail}
          expression={prefs.semaExpression}
          hasNotification={hasMissedNotification && isCourse}
          onPoke={onPokeSema}
          onLogoClick={handleLogoClick}
        />
      </div>

      {/* Mode-switched Top Navigation: Main/Course vs Dedicated Workspace Nav */}
      {isWorkspace ? (
        <nav className="primary-nav sx-workspace-nav" aria-label="Workspace navigation">
          <button
            type="button"
            className="sx-nav-back-pill"
            aria-label="Back to Library"
            onClick={() => onNavigate('/library')}
          >
            <ArrowLeft size={15} aria-hidden="true" />
            <span className="sx-nav-back-label">Library</span>
          </button>

          <div className="sx-workspace-tabs">
            {(
              [
                { id: 'settings', label: 'Settings', path: '/settings', Icon: Settings },
                { id: 'plugins', label: 'Plugins', path: '/plugins', Icon: Puzzle },
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
                  <Icon size={16} className="nav-svg-icon" aria-hidden="true" />
                  <span className="primary-nav-label">{label}</span>
                  {active && (
                    <motion.span
                      layoutId="workspace-nav-indicator"
                      className="primary-nav-indicator"
                      transition={{ type: 'spring', stiffness: 460, damping: 36 }}
                    />
                  )}
                </button>
              )
            })}
          </div>
        </nav>
      ) : (
        <nav className="primary-nav sx-main-nav" aria-label="Main navigation">
          <AnimatePresence initial={false}>
            {isCourse && (
              <motion.button
                key="back-to-library"
                type="button"
                className="sx-nav-back-pill"
                aria-label="Back to Library"
                title="Back to Library"
                initial={{ opacity: 0, width: 0, marginRight: 0 }}
                animate={{ opacity: 1, width: 'auto', marginRight: 10 }}
                exit={{ opacity: 0, width: 0, marginRight: 0 }}
                transition={{ duration: 0.2, ease: [0.22, 1, 0.36, 1] }}
                onClick={() => onNavigate('/library')}
              >
                <ArrowLeft size={15} aria-hidden="true" />
                <span className="sx-nav-back-label">Library</span>
              </motion.button>
            )}
          </AnimatePresence>

          <motion.div layout className="sx-main-nav-tabs">
            <a
              href="#/"
              aria-label="Home"
              aria-current={mainActiveTab === 'home' ? 'page' : undefined}
              onClick={e => {
                e.preventDefault()
                onNavigate('/')
              }}
            >
              <span className="icon icon-home" aria-hidden="true" />
              <span>Home</span>
              {mainActiveTab === 'home' && (
                <motion.span
                  layoutId="primary-nav-indicator"
                  className="primary-nav-indicator"
                  transition={{ type: 'spring', stiffness: 460, damping: 36 }}
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
              <span className="icon icon-topics" aria-hidden="true" />
              <span>Library</span>
              {mainActiveTab === 'library' && (
                <motion.span
                  layoutId="primary-nav-indicator"
                  className="primary-nav-indicator"
                  transition={{ type: 'spring', stiffness: 460, damping: 36 }}
                />
              )}
            </a>
          </motion.div>
        </nav>
      )}

      <div className="header-actions">
        {/* Course-contributed action slot (only present when a course stage is active) */}
        {isCourse && contribution.headerAction}

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

        {/* Clean, minimal Pancake Menu (no junk drawer, no Plugins inside courses) */}
        <Menu.Root>
          <Menu.Trigger aria-label="Menu" className="menu-trigger">
            <MenuIcon size={20} aria-hidden="true" />
          </Menu.Trigger>
          <Menu.Portal>
            <Menu.Positioner sideOffset={14} align="end" className="menu-positioner">
              <Menu.Popup className="menu-popup">
                <Menu.Arrow className="menu-arrow">
                  <svg width="20" height="10" viewBox="0 0 20 10" fill="none" aria-hidden="true">
                    <path
                      d="M9.66437 2.60207L4.80758 6.97318C4.07308 7.63423 3.11989 8 2.13172 8H0V10H20V8H17.8683C16.8801 8 15.9269 7.63423 15.1924 6.97318L10.3356 2.60207C10.0708 2.3636 9.92918 2.3636 9.66437 2.60207Z"
                      fill="currentColor"
                    />
                  </svg>
                </Menu.Arrow>

                <Menu.Group className="menu-group">
                  <Menu.Item className="menu-item" onClick={() => onNavigate('/settings')}>
                    Settings
                  </Menu.Item>

                  {!isCourse && (
                    <>
                      <Menu.Item className="menu-item" onClick={() => onNavigate('/plugins')}>
                        Plugins
                      </Menu.Item>
                      <Menu.Item className="menu-item" onClick={() => onNavigate('/community')}>
                        Community Hub
                      </Menu.Item>
                    </>
                  )}
                </Menu.Group>

                {isCourse && contribution.menuActions && contribution.menuActions.length > 0 && (
                  <>
                    <Menu.Separator className="menu-separator" />
                    <Menu.Group className="menu-group">
                      {contribution.menuActions.map(act => (
                        <Menu.Item
                          key={act.id}
                          className="menu-item"
                          onClick={act.onSelect}
                        >
                          {act.label}
                        </Menu.Item>
                      ))}
                    </Menu.Group>
                  </>
                )}

                {!isCourse && (
                  <>
                    <Menu.Separator className="menu-separator" />
                    <Menu.Group className="menu-group">
                      <Menu.Item className="menu-item" onClick={onOpenWelcome}>
                        Welcome tour
                      </Menu.Item>
                    </Menu.Group>
                  </>
                )}
              </Menu.Popup>
            </Menu.Positioner>
          </Menu.Portal>
        </Menu.Root>
      </div>
    </header>
  )
}
