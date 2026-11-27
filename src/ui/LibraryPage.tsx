import { Compass, Puzzle } from 'lucide-react'

export interface LibraryPageProps {
  onOpenPlugins: () => void
  onOpenCommunityHub: () => void
}

export function LibraryPage({ onOpenPlugins, onOpenCommunityHub }: LibraryPageProps) {
  return (
    <main className="sx-workspace-page sx-library-page" aria-label="Library">
      <header className="sx-library-head">
        <div className="sx-library-head-copy">
          <h1>Library</h1>
          <span className="sx-library-count">0 installed courses</span>
        </div>

        <div className="sx-library-controls">
          <button type="button" className="sx-btn-secondary" onClick={onOpenPlugins}>
            <Puzzle size={15} strokeWidth={2} aria-hidden="true" />
            <span>Plugins</span>
          </button>
          <button
            type="button"
            className="sx-browse-hub-btn"
            onClick={onOpenCommunityHub}
          >
            <Compass size={15} strokeWidth={2} aria-hidden="true" />
            <span>Community Hub</span>
          </button>
        </div>
      </header>

      <div className="sx-library-empty">
        <p>No courses installed yet.</p>
        <p className="sx-profile-handle">
          Courses and study engines are decoupled from core Syntax and will install through the new plugin system.
        </p>
        <div className="sx-library-empty-actions">
          <button type="button" className="sx-btn-secondary" onClick={onOpenPlugins}>
            <Puzzle size={15} strokeWidth={2} aria-hidden="true" />
            <span>Plugins &amp; Themes</span>
          </button>
          <button
            type="button"
            className="sx-browse-hub-btn"
            onClick={onOpenCommunityHub}
          >
            <Compass size={15} strokeWidth={2} aria-hidden="true" />
            <span>Community Hub</span>
          </button>
        </div>
      </div>
    </main>
  )
}
