import { useEffect, useMemo, useState } from 'react'
import { assetUrl } from '../mpm2d/assetUrl'
import { UNIT2_LESSONS } from '../mpm2d/data/unit2Course'
import { COMMUNITY_HUB_WEB_URL } from '../core/community'
import type { SyntaxPackageManifest } from '../core/packages'
import { useInstalledPackages } from '../core/registry'
import { PackageIcon } from './PackageIcon'

const PINNED_KEY = 'syntax.library.pinned.v1'

export interface LibraryPageProps {
  mpm2dPercent: number
  mpm2dCompletedCount: number
  onOpenCourse: (courseId: string) => void
  onOpenPlugins: () => void
  onInspectCourse: (pkg: SyntaxPackageManifest) => void
}

interface LibraryCourseCardData {
  manifest: SyntaxPackageManifest
  title: string
  category: 'Math' | 'Computer Science' | 'Community'
  image?: string
  badge?: string
  percent: number
  lessonMeta: string
}

function loadPinned(): string[] {
  try {
    const raw = localStorage.getItem(PINNED_KEY)
    if (!raw) return []
    const parsed = JSON.parse(raw)
    return Array.isArray(parsed) ? parsed.filter((x): x is string => typeof x === 'string') : []
  } catch {
    return []
  }
}

function LibraryCourseTile({
  item,
  pinned,
  onTogglePin,
  onOpen,
  onInspect,
}: {
  item: LibraryCourseCardData
  pinned: boolean
  onTogglePin: () => void
  onOpen: () => void
  onInspect: () => void
}) {
  const [pressed, setPressed] = useState(false)

  return (
    <div
      className={`sx-lib-tile${pressed ? ' is-pressed' : ''}`}
      onPointerDown={() => setPressed(true)}
      onPointerUp={() => setPressed(false)}
      onPointerCancel={() => setPressed(false)}
      onPointerLeave={() => setPressed(false)}
    >
      <div className="sx-lib-art-box">
        <button
          type="button"
          className="sx-lib-art-hit"
          aria-label={`Open ${item.title}`}
          onClick={onOpen}
        >
          {item.image ? (
            <img src={item.image} alt="" width={84} height={84} />
          ) : (
            <PackageIcon svg={item.manifest.iconSvg} size={76} />
          )}
        </button>

        {item.badge && <span className="sx-lib-badge">{item.badge}</span>}

        <button
          type="button"
          className={`sx-lib-star${pinned ? ' is-pinned' : ''}`}
          aria-label={pinned ? `Unpin ${item.title}` : `Pin ${item.title}`}
          aria-pressed={pinned}
          onClick={e => {
            e.stopPropagation()
            onTogglePin()
          }}
        >
          <svg viewBox="0 0 20 20" width="15" height="15" aria-hidden="true">
            <path d="M9.1726 1.3349C9.5538 0.7217 10.4462 0.7217 10.8274 1.3349L13.3816 5.4429C13.5157 5.6586 13.7288 5.8134 13.9754 5.8743L18.6716 7.034C19.3726 7.2071 19.6484 8.0558 19.183 8.6079L16.0654 12.3065C15.9016 12.5007 15.8202 12.7512 15.8385 13.0046L16.1868 17.8293C16.2388 18.5495 15.5168 19.074 14.848 18.802L10.367 16.9799C10.1317 16.8842 9.8683 16.8842 9.633 16.9799L5.152 18.802C4.4832 19.074 3.7612 18.5495 3.8132 17.8293L4.1615 13.0046C4.1797 12.7512 4.0984 12.5007 3.9346 12.3065L0.817 8.6079C0.3516 8.0558 0.6274 7.2071 1.3283 7.034L6.0246 5.8743C6.2712 5.8134 6.4843 5.6586 6.6184 5.4429L9.1726 1.3349Z" />
          </svg>
        </button>

        {item.percent > 0 && (
          <span
            className="course-progress"
            role="progressbar"
            aria-label={`${item.title} is ${item.percent}% complete`}
            aria-valuemin={0}
            aria-valuemax={100}
            aria-valuenow={item.percent}
          >
            <span style={{ width: `${item.percent}%` }} />
          </span>
        )}
      </div>

      <div className="sx-lib-card-meta">
        <button type="button" className="sx-lib-card-title" onClick={onOpen}>
          {item.title}
        </button>
        <div className="sx-lib-card-sub">
          <span>{item.lessonMeta}</span>
          <button
            type="button"
            className="sx-lib-info-btn"
            aria-label={`Details for ${item.title}`}
            title="Course details"
            onClick={onInspect}
          >
            Details
          </button>
        </div>
      </div>
    </div>
  )
}

export function LibraryPage({
  mpm2dPercent,
  mpm2dCompletedCount,
  onOpenCourse,
  onOpenPlugins,
  onInspectCourse,
}: LibraryPageProps) {
  const records = useInstalledPackages()
  const [pinnedIds, setPinnedIds] = useState<string[]>(loadPinned)
  const [filter, setFilter] = useState<'all' | 'official' | 'community'>('all')

  useEffect(() => {
    try {
      localStorage.setItem(PINNED_KEY, JSON.stringify(pinnedIds))
    } catch {
      // ignore
    }
  }, [pinnedIds])

  const courses = useMemo<LibraryCourseCardData[]>(() => {
    return records
      .filter(r => r.manifest.kind === 'course' && r.enabled)
      .map(({ manifest }) => {
        if (manifest.id === 'mpm2d-analytic-geometry') {
          return {
            manifest,
            title: 'Analytic Geometry',
            category: 'Math' as const,
            image: assetUrl('/assets/courses/Coordinate_Geometry-bgclJY.png'),
            badge:
              mpm2dPercent >= 100
                ? 'COMPLETE'
                : mpm2dPercent > 0
                  ? `${mpm2dPercent}%`
                  : 'MPM2D',
            percent: mpm2dPercent,
            lessonMeta: `${mpm2dCompletedCount}/${UNIT2_LESSONS.length} lessons`,
          }
        }
        if (manifest.id === 'thinking-in-code') {
          return {
            manifest,
            title: 'Thinking in Code',
            category: 'Computer Science' as const,
            image: assetUrl('/assets/courses/thinking-in-code-DolooX.png'),
            badge: 'CS',
            percent: 0,
            lessonMeta: '5 lessons',
          }
        }
        const totalLessons =
          manifest.customCourse?.units.reduce((acc, u) => acc + u.lessons.length, 0) ?? 0
        return {
          manifest,
          title: manifest.name,
          category: 'Community' as const,
          badge: manifest.builtIn ? 'OFFICIAL' : 'COMMUNITY',
          percent: 0,
          lessonMeta:
            totalLessons > 0
              ? `${totalLessons} ${totalLessons === 1 ? 'lesson' : 'lessons'}`
              : `@${manifest.author.handle}`,
        }
      })
  }, [records, mpm2dPercent, mpm2dCompletedCount])

  const filtered = useMemo(() => {
    if (filter === 'official') return courses.filter(c => c.manifest.builtIn)
    if (filter === 'community') return courses.filter(c => !c.manifest.builtIn)
    return courses
  }, [courses, filter])

  const pinnedCourses = useMemo(
    () => filtered.filter(c => pinnedIds.includes(c.manifest.id)),
    [filtered, pinnedIds],
  )

  const shelves = useMemo(() => {
    const groups: Array<{
      id: string
      title: string
      icon?: string
      items: LibraryCourseCardData[]
    }> = [
      {
        id: 'math',
        title: 'Math',
        icon: assetUrl('/assets/courses/Foundational_Math-wv6lLw.png'),
        items: filtered.filter(c => c.category === 'Math'),
      },
      {
        id: 'cs',
        title: 'Computer Science',
        icon: assetUrl('/assets/courses/Computer_Science-JEbqeF.png'),
        items: filtered.filter(c => c.category === 'Computer Science'),
      },
      {
        id: 'community',
        title: 'Community Courses',
        items: filtered.filter(c => c.category === 'Community'),
      },
    ]
    return groups.filter(g => g.items.length > 0)
  }, [filtered])

  function togglePin(id: string) {
    setPinnedIds(prev => (prev.includes(id) ? prev.filter(x => x !== id) : [id, ...prev]))
  }

  return (
    <main className="topics-page sx-library-page" aria-label="Library">
      <header className="sx-library-head">
        <div className="sx-library-head-copy">
          <h1>Library</h1>
          <span className="sx-library-count">
            {courses.length} installed {courses.length === 1 ? 'course' : 'courses'}
          </span>
        </div>

        <div className="sx-library-controls">
          <div className="sx-library-filters" role="tablist" aria-label="Filter library">
            {(
              [
                { id: 'all', label: 'All' },
                { id: 'official', label: 'Official' },
                { id: 'community', label: 'Community' },
              ] as const
            ).map(tab => (
              <button
                key={tab.id}
                type="button"
                role="tab"
                aria-selected={filter === tab.id}
                className={`sx-lib-filter-pill${filter === tab.id ? ' is-active' : ''}`}
                onClick={() => setFilter(tab.id)}
              >
                {tab.label}
              </button>
            ))}
          </div>

          <a
            href={COMMUNITY_HUB_WEB_URL}
            target="_blank"
            rel="noreferrer"
            className="sx-btn-ghost"
          >
            Community Hub ↗
          </a>
        </div>
      </header>

      {pinnedCourses.length > 0 && (
        <section className="sx-library-section" aria-label="Pinned courses">
          <div className="sx-library-section-head">
            <h2>Pinned</h2>
          </div>
          <div className="sx-library-shelf">
            <div className="sx-library-grid">
              {pinnedCourses.map(item => (
                <LibraryCourseTile
                  key={item.manifest.id}
                  item={item}
                  pinned
                  onTogglePin={() => togglePin(item.manifest.id)}
                  onOpen={() => onOpenCourse(item.manifest.id)}
                  onInspect={() => onInspectCourse(item.manifest)}
                />
              ))}
            </div>
          </div>
        </section>
      )}

      {shelves.length > 0 ? (
        shelves.map(shelf => (
          <section key={shelf.id} className="sx-library-section" aria-label={shelf.title}>
            <div className="sx-library-section-head">
              {shelf.icon && <img src={shelf.icon} alt="" width={40} height={40} />}
              <h2>{shelf.title}</h2>
            </div>
            <div className="sx-library-shelf">
              <div className="sx-library-grid">
                {shelf.items.map(item => (
                  <LibraryCourseTile
                    key={item.manifest.id}
                    item={item}
                    pinned={pinnedIds.includes(item.manifest.id)}
                    onTogglePin={() => togglePin(item.manifest.id)}
                    onOpen={() => onOpenCourse(item.manifest.id)}
                    onInspect={() => onInspectCourse(item.manifest)}
                  />
                ))}
              </div>
            </div>
          </section>
        ))
      ) : (
        <div className="sx-library-empty">
          <p>No courses match this filter yet.</p>
          <div className="sx-library-empty-actions">
            {filter !== 'all' && (
              <button type="button" className="sx-btn-ghost" onClick={() => setFilter('all')}>
                Show all installed
              </button>
            )}
            <a
              href={COMMUNITY_HUB_WEB_URL}
              target="_blank"
              rel="noreferrer"
              className="sx-browse-hub-btn"
            >
              <span>Browse Community Hub</span>
              <span className="sx-browse-arrow" aria-hidden="true">↗</span>
            </a>
          </div>
        </div>
      )}

      <footer className="sx-library-footer">
        <button type="button" className="sx-btn-ghost" onClick={onOpenPlugins}>
          Manage courses &amp; plugins
        </button>
      </footer>
    </main>
  )
}
