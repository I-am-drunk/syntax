import { Compass, Library, Puzzle, Settings } from 'lucide-react'
import { useAccount } from '../core/account'
import type { SyntaxPrefs } from '../core/prefs'
import { Sema } from '../mascot/Sema'

export interface HomePageProps {
  prefs: SyntaxPrefs
  onOpenLibrary: () => void
  onOpenExtensions: () => void
  onOpenSettings: () => void
}

export function HomePage({
  prefs,
  onOpenLibrary,
  onOpenExtensions,
  onOpenSettings,
}: HomePageProps) {
  const account = useAccount()
  const greetingName = account?.displayName?.split(' ')[0]

  return (
    <main className="sx-workspace-page" aria-label="Home">
      <section className="sx-profile-hero">
        <div className="sx-profile-identity">
          <div
            style={{
              width: 72,
              height: 72,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              flexShrink: 0,
            }}
          >
            <Sema
              state="idle"
              shape={prefs.semaShape}
              tail={prefs.semaTail}
              expression={prefs.semaExpression}
              size={58}
              interactive
              ariaLabel="Sema companion"
            />
          </div>
          <div className="sx-profile-titles">
            <h1>{greetingName ? `Welcome back, ${greetingName}` : 'Welcome to Syntax'}</h1>
            <p className="sx-profile-handle">
              Core platform ready. Tools, workflows, and courses load through Syntax Extensions.
            </p>
          </div>
        </div>

        <div className="sx-profile-hero-actions">
          <button type="button" className="sx-btn-primary" onClick={onOpenLibrary}>
            <Library size={15} strokeWidth={2} aria-hidden="true" />
            <span>Open Library</span>
          </button>
        </div>
      </section>

      <section className="sx-profile-section" aria-label="Workspace shortcuts">
        <div className="sx-profile-section-head">
          <h2>Workspace</h2>
        </div>
        <div className="preference-rows">
          <div className="preference-row">
            <div className="syntax-pref-copy">
              <p>Library</p>
              <span>Your extension views, embedded tools, and saved documents live here</span>
            </div>
            <button type="button" className="sx-btn-secondary sx-btn-sm" onClick={onOpenLibrary}>
              <Library size={14} aria-hidden="true" />
              <span>Library</span>
            </button>
          </div>

          <div className="preference-row">
            <div className="syntax-pref-copy">
              <p>Extensions</p>
              <span>Install, reload, inspect logs, and manage standalone or embedded extensions</span>
            </div>
            <button type="button" className="sx-btn-secondary sx-btn-sm" onClick={onOpenExtensions}>
              <Puzzle size={14} aria-hidden="true" />
              <span>Extensions</span>
            </button>
          </div>

          <div className="preference-row">
            <div className="syntax-pref-copy">
              <p>Settings &amp; Sema</p>
              <span>Customize appearance, audio cues, and Sema companion style</span>
            </div>
            <button type="button" className="sx-btn-secondary sx-btn-sm" onClick={onOpenSettings}>
              <Settings size={14} aria-hidden="true" />
              <span>Settings</span>
            </button>
          </div>

          <div className="preference-row">
            <div className="syntax-pref-copy">
              <p>Official Extensions Repository</p>
              <span>First-party courses and tools live in syntax-official-plugins</span>
            </div>
            <a
              href="https://github.com/syntax-platform/syntax-official-plugins"
              target="_blank"
              rel="noreferrer"
              className="sx-btn-secondary sx-btn-sm"
            >
              <Compass size={14} aria-hidden="true" />
              <span>GitHub</span>
            </a>
          </div>
        </div>
      </section>
    </main>
  )
}
