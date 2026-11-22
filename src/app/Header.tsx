import { Menu } from '@base-ui/react/menu'
import { useEffect, useState } from 'react'

const links = [
  { name: 'Home', icon: 'home', href: '/home/' },
  { name: 'Topics', icon: 'topics', href: '/courses/' },
  { name: 'You', icon: 'you', href: '/you/' },
]
export function Header() {
  const [open, setOpen] = useState(false)
  const activePath = location.pathname === '/' ? '/home/'
    : location.pathname.startsWith('/courses/') ? '/courses/' : location.pathname.replace(/\/?$/, '/')
  useEffect(() => {
    const media = matchMedia('(min-width: 769px)')
    const close = () => setOpen(false)
    media.addEventListener('change', close)
    return () => media.removeEventListener('change', close)
  }, [])
  return <header className="app-header">
    <a className="wordmark" href="/" aria-label="Syntax home">Syntax</a>
    <nav className="primary-nav" aria-label="Main navigation">
      {links.map(link => <a href={link.href} key={link.name} aria-label={link.name}
        aria-current={activePath === link.href ? 'page' : undefined}>
        <span className={`icon icon-${link.icon}`} aria-hidden="true" /><span>{link.name}</span>
      </a>)}
    </nav>
    <div className="header-actions">
      <a className="streak" href="/you/" aria-label="Your streak: 0 days">0
        <span className="icon icon-lightning" aria-hidden="true" />
      </a>
      <Menu.Root open={open} onOpenChange={setOpen}>
        <Menu.Trigger aria-label="Menu" className="menu-trigger">
          <span className="icon icon-menu" aria-hidden="true" />
        </Menu.Trigger>
        <Menu.Portal>
          <Menu.Positioner sideOffset={32} align="end" className="menu-positioner">
            <Menu.Popup className="menu-popup">
              <Menu.Arrow className="menu-arrow"><svg width="20" height="10" viewBox="0 0 20 10" fill="none">
                <path d="M9.66437 2.60207L4.80758 6.97318C4.07308 7.63423 3.11989 8 2.13172 8H0V10H20V8H17.8683C16.8801 8 15.9269 7.63423 15.1924 6.97318L10.3356 2.60207C10.0708 2.3636 9.92918 2.3636 9.66437 2.60207Z" fill="currentColor" />
              </svg></Menu.Arrow>
              <Menu.Group className="menu-group">
                <Menu.Item className="menu-item" render={<a href="/settings/account/" />}>Settings</Menu.Item>
              </Menu.Group>
              <Menu.Separator className="menu-separator" />
              <Menu.Group className="menu-group">
                <Menu.Item className="menu-item" render={<a href="/about/" />}>About</Menu.Item>
                <Menu.Item className="menu-item" render={<a href="/careers/" />}>Work at Syntax!</Menu.Item>
                <Menu.Item className="menu-item" render={<a href="/help/" />}>Help</Menu.Item>
              </Menu.Group>
              <Menu.Separator className="menu-separator" />
              <Menu.Group className="menu-group">
                <Menu.Item className="menu-item" disabled title="Local sign-in is not implemented">Log out</Menu.Item>
              </Menu.Group>
            </Menu.Popup>
          </Menu.Positioner>
        </Menu.Portal>
      </Menu.Root>
    </div>
  </header>
}
