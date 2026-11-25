import { useMemo, useRef, useState } from 'react'
import { Toggle } from '../settings/Controls'
import { COMMUNITY_HUB_WEB_URL } from '../core/community'
import { OFFICIAL_BY_ID } from '../packages/catalog'
import {
  sanitizeUntrustedManifest,
  validatePackageManifest,
  type SyntaxPackageManifest,
} from '../core/packages'
import { useInstalledPackages, useRegistryStore } from '../core/registry'
import { PackageIcon } from './PackageIcon'
import { CoreTouchIcon } from './CoreTouchWarning'

type PluginSectionId = 'app-plugins' | 'embedded' | 'courses'

const OFFICIAL_ID_SET = new Set(OFFICIAL_BY_ID.keys())

interface PluginsPageProps {
  onBack: () => void
  onSelectPackage: (pkg: SyntaxPackageManifest) => void
  onOpenCourse: (courseId: string) => void
  onImportPackage: (pkg: SyntaxPackageManifest) => void
}

export function PluginsPage({
  onBack,
  onSelectPackage,
  onOpenCourse,
  onImportPackage,
}: PluginsPageProps) {
  const entries = useInstalledPackages()
  const setPackageEnabled = useRegistryStore(s => s.setPackageEnabled)
  const [activeSection, setActiveSection] = useState<PluginSectionId>('app-plugins')
  const [importError, setImportError] = useState('')
  const fileInputRef = useRef<HTMLInputElement>(null)

  const appPlugins = useMemo(
    () => entries.filter(e => e.manifest.kind === 'plugin'),
    [entries],
  )
  const embeddedPlugins = useMemo(
    () => entries.filter(e => e.manifest.kind === 'embedded-plugin'),
    [entries],
  )
  const courses = useMemo(
    () => entries.filter(e => e.manifest.kind === 'course'),
    [entries],
  )

  function scrollTo(id: PluginSectionId) {
    setActiveSection(id)
    const el = document.getElementById(`plugins-${id}`)
    if (el) {
      const top = Math.max(0, el.getBoundingClientRect().top + window.scrollY - 88)
      window.scrollTo({ top, behavior: 'smooth' })
    }
  }

  async function handleImportFile(file: File) {
    setImportError('')
    try {
      const text = await file.text()
      const raw = JSON.parse(text) as unknown
      const parsed = validatePackageManifest(raw)
      if (!parsed.ok) {
        setImportError(parsed.errors[0] || 'Invalid package file.')
        return
      }
      onImportPackage(
        sanitizeUntrustedManifest(parsed.manifest, OFFICIAL_ID_SET, { isLocalFile: true }),
      )
    } catch {
      setImportError('Could not read package file.')
    }
  }

  return (
    <main className="settings-layout sx-plugins-page" aria-label="Plugins">
      <nav className="settings-nav" aria-label="Plugins sections">
        <a
          href="#back-home"
          className="settings-nav-back-link"
          onClick={e => {
            e.preventDefault()
            onBack()
          }}
        >
          ← Back
        </a>
        <a
          href="#plugins-app-plugins"
          aria-current={activeSection === 'app-plugins' ? 'location' : undefined}
          onClick={e => {
            e.preventDefault()
            scrollTo('app-plugins')
          }}
        >
          App Plugins
        </a>
        <a
          href="#plugins-embedded"
          aria-current={activeSection === 'embedded' ? 'location' : undefined}
          onClick={e => {
            e.preventDefault()
            scrollTo('embedded')
          }}
        >
          Embedded
        </a>
        <a
          href="#plugins-courses"
          aria-current={activeSection === 'courses' ? 'location' : undefined}
          onClick={e => {
            e.preventDefault()
            scrollTo('courses')
          }}
        >
          Courses
        </a>
      </nav>

      <div className="preferences">
        <header className="sx-plugins-header">
          <div className="sx-plugins-title-row">
            <h2>Plugins</h2>
            <div className="sx-plugins-cta-group">
              <button
                type="button"
                className="sx-btn-ghost"
                onClick={() => fileInputRef.current?.click()}
              >
                Import
              </button>
              <a
                href={COMMUNITY_HUB_WEB_URL}
                target="_blank"
                rel="noreferrer"
                className="sx-browse-hub-btn"
              >
                <svg
                  width="16"
                  height="16"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2.1"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  aria-hidden="true"
                >
                  <circle cx="12" cy="12" r="10" />
                  <path d="M2 12h20" />
                  <path d="M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10Z" />
                </svg>
                <span>Browse Community Hub</span>
                <span className="sx-browse-arrow" aria-hidden="true">↗</span>
              </a>
            </div>
          </div>
          <input
            ref={fileInputRef}
            type="file"
            accept=".syntaxcourse,.syntaxplugin,.syntaxembeddedplugin,.json"
            style={{ display: 'none' }}
            onChange={e => {
              const file = e.target.files?.[0]
              if (file) void handleImportFile(file)
              e.target.value = ''
            }}
          />
          {importError && <p className="sx-field-error">{importError}</p>}
        </header>

        <section id="plugins-app-plugins">
          <h3>App Plugins</h3>
          <div className="preference-rows">
            {appPlugins.map(({ manifest, enabled }) => (
              <div key={manifest.id} className="preference-row sx-plugin-row">
                <button
                  type="button"
                  className="sx-plugin-row-main"
                  onClick={() => onSelectPackage(manifest)}
                >
                  <PackageIcon svg={manifest.iconSvg} size={34} />
                  <span className="sx-plugin-name">{manifest.name}</span>
                  {manifest.touchesCore && <CoreTouchIcon />}
                  <span className="sx-plugin-ver">v{manifest.version}</span>
                </button>
                <Toggle
                  label={`Enable ${manifest.name}`}
                  checked={enabled}
                  onChange={next => setPackageEnabled(manifest.id, next)}
                />
              </div>
            ))}
          </div>
        </section>

        <hr />

        <section id="plugins-embedded">
          <h3>Embedded Plugins</h3>
          <div className="preference-rows">
            {embeddedPlugins.map(({ manifest, enabled }) => (
              <div key={manifest.id} className="preference-row sx-plugin-row">
                <button
                  type="button"
                  className="sx-plugin-row-main"
                  onClick={() => onSelectPackage(manifest)}
                >
                  <PackageIcon svg={manifest.iconSvg} size={34} />
                  <span className="sx-plugin-name">{manifest.name}</span>
                  <span className="sx-status-pill is-ok">Installed</span>
                </button>
                <Toggle
                  label={`Enable ${manifest.name}`}
                  checked={enabled}
                  onChange={next => setPackageEnabled(manifest.id, next)}
                />
              </div>
            ))}
          </div>
        </section>

        <hr />

        <section id="plugins-courses">
          <h3>Courses</h3>
          <div className="preference-rows">
            {courses.map(({ manifest }) => (
              <div key={manifest.id} className="preference-row sx-plugin-row">
                <button
                  type="button"
                  className="sx-plugin-row-main"
                  onClick={() => onSelectPackage(manifest)}
                >
                  <PackageIcon svg={manifest.iconSvg} size={34} />
                  <span className="sx-plugin-name">{manifest.name}</span>
                  <span className="sx-plugin-ver">@{manifest.author.handle}</span>
                </button>
                <button
                  type="button"
                  className="sx-btn-ghost"
                  onClick={() => onOpenCourse(manifest.id)}
                >
                  Open
                </button>
              </div>
            ))}
          </div>
        </section>
      </div>
    </main>
  )
}
