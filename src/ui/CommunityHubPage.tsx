import { ExternalLink, Puzzle } from 'lucide-react'

const COMMUNITY_HUB_WEB_URL = 'https://syntax-platform.github.io/syntax-community/'
const OFFICIAL_PLUGINS_REPO_URL = 'https://github.com/syntax-platform/syntax-official-plugins'

interface CommunityHubPageProps {
  onOpenPlugins: () => void
}

export function CommunityHubPage({ onOpenPlugins }: CommunityHubPageProps) {
  return (
    <main className="sx-hub-page" aria-label="Community Hub">
      <header className="sx-hub-head">
        <div className="sx-workspace-head">
          <h1>Community Hub</h1>
          <span className="sx-hub-count">Plugin catalog</span>
        </div>

        <div className="sx-hub-head-actions">
          <button type="button" className="sx-btn-secondary" onClick={onOpenPlugins}>
            <Puzzle size={14} aria-hidden="true" />
            <span>Plugins</span>
          </button>
          <a
            href={COMMUNITY_HUB_WEB_URL}
            target="_blank"
            rel="noreferrer"
            className="sx-btn-secondary"
          >
            <span>Web Hub</span>
            <ExternalLink size={13} aria-hidden="true" />
          </a>
        </div>
      </header>

      <div className="sx-hub-empty">
        <p>Community Hub is waiting on the rebuilt Syntax plugin format.</p>
        <p className="sx-profile-handle">
          Once the new self-contained package format is finalized, official and community plugins will install directly from here.
        </p>
        <div className="sx-library-empty-actions">
          <a
            href={OFFICIAL_PLUGINS_REPO_URL}
            target="_blank"
            rel="noreferrer"
            className="sx-btn-secondary"
          >
            <span>Official Plugins Repo</span>
            <ExternalLink size={13} aria-hidden="true" />
          </a>
          <a
            href={COMMUNITY_HUB_WEB_URL}
            target="_blank"
            rel="noreferrer"
            className="sx-btn-secondary"
          >
            <span>Open Community Hub</span>
            <ExternalLink size={13} aria-hidden="true" />
          </a>
        </div>
      </div>
    </main>
  )
}
