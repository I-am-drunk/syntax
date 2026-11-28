import { useEffect, useMemo, useRef, useState } from 'react'
import {
  Cloud,
  CloudOff,
  ExternalLink,
  Flame,
  KeyRound,
  RefreshCw,
  ShieldCheck,
} from 'lucide-react'
import { useAccount } from '../core/account'
import {
  computeActivityStats,
  formatLocalDateKey,
  loadActivityHistory,
  subscribeActivityChanged,
  type ActivityHistoryMap,
} from '../core/activity'
import { useAuthActions } from '../core/clerkAuth'
import { useCloudSyncStore } from '../core/clerkSync'
import type { SyntaxPrefs } from '../core/prefs'
import { useContributionStore } from '../extensions/contributions.ts'
import { documentStore, subscribeDocumentsChanged } from '../extensions/documents.ts'
import { resolveExtensionAssets } from '../extensions/manifest.ts'
import { useExtensionStore } from '../extensions/store.ts'
import { Sema } from '../mascot/Sema'
import { ExtensionIcon } from './ExtensionIcon'

export interface ProfilePageProps {
  prefs: SyntaxPrefs
  onNavigate?: (path: string) => void
  onOpenExtensions: () => void
}

type ActivityFilter = 'all' | 'course' | 'extension' | 'document'
type ActivityRange = 'past-year' | 'current-year'
type ChartWindow = '7d' | '30d' | '12m'

interface HeatmapDay {
  key: string
  date: Date
  count: number
  level: 0 | 1 | 2 | 3 | 4
  inRange: boolean
}

const MONTH_NAMES = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']

function formatSyncTime(iso: string | null): string {
  if (!iso) return 'Not synced yet'
  try {
    return `Last synced ${new Date(iso).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' })}`
  } catch {
    return 'Synced'
  }
}

function getFilteredCount(
  map: ActivityHistoryMap,
  key: string,
  filter: ActivityFilter,
): number {
  const rec = map[key]
  if (!rec) return 0
  if (filter === 'all') return rec.total
  return rec[filter] ?? 0
}

function intensityLevel(count: number, maxCount: number): 0 | 1 | 2 | 3 | 4 {
  if (count <= 0) return 0
  if (maxCount <= 1) return 2
  const ratio = count / maxCount
  if (ratio <= 0.25) return 1
  if (ratio <= 0.5) return 2
  if (ratio <= 0.75) return 3
  return 4
}

export function ProfilePage({
  prefs,
  onNavigate,
  onOpenExtensions,
}: ProfilePageProps) {
  const account = useAccount()
  const auth = useAuthActions()
  const cloudSync = useCloudSyncStore()
  const records = useExtensionStore(s => s.records)
  const views = useContributionStore(s => s.views)

  const [avatarFailed, setAvatarFailed] = useState(false)
  const [activityMap, setActivityMap] = useState<ActivityHistoryMap>(() => loadActivityHistory())
  const [docCount, setDocCount] = useState(0)
  const [activityFilter, setActivityFilter] = useState<ActivityFilter>('all')
  const [activityRange, setActivityRange] = useState<ActivityRange>('past-year')
  const [chartWindow, setChartWindow] = useState<ChartWindow>('12m')
  const [hoveredDay, setHoveredDay] = useState<HeatmapDay | null>(null)
  const heatmapScrollRef = useRef<HTMLDivElement | null>(null)

  useEffect(() => {
    setAvatarFailed(false)
  }, [account?.avatarUrl])

  useEffect(() => {
    const syncAct = () => setActivityMap(loadActivityHistory())
    syncAct()
    return subscribeActivityChanged(syncAct)
  }, [])

  useEffect(() => {
    let cancelled = false
    const syncDocs = () => {
      void documentStore.list().then(list => {
        if (!cancelled) setDocCount(list.length)
      })
    }
    syncDocs()
    const unsub = subscribeDocumentsChanged(syncDocs)
    return () => {
      cancelled = true
      unsub()
    }
  }, [])

  const today = useMemo(() => {
    const d = new Date()
    return new Date(d.getFullYear(), d.getMonth(), d.getDate())
  }, [])
  const currentYear = today.getFullYear()

  const stats = useMemo(() => computeActivityStats(activityMap, today), [activityMap, today])

  // Build 52-53 week grid (Sunday -> Saturday rows) matching GitHub / Atsumaru heatmap ergonomics
  const heatmap = useMemo(() => {
    let start: Date
    let end: Date
    if (activityRange === 'current-year') {
      start = new Date(currentYear, 0, 1)
      end = new Date(currentYear, 11, 31)
    } else {
      end = new Date(today)
      start = new Date(today)
      start.setDate(start.getDate() - 364)
    }

    const gridStart = new Date(start)
    gridStart.setDate(gridStart.getDate() - gridStart.getDay()) // align Sunday

    const gridEnd = new Date(end)
    gridEnd.setDate(gridEnd.getDate() + (6 - gridEnd.getDay())) // align Saturday

    const rawDays: Array<{ key: string; date: Date; count: number; inRange: boolean }> = []
    let maxCount = 0
    let activeDaysInRange = 0

    const cursor = new Date(gridStart)
    while (cursor <= gridEnd) {
      const d = new Date(cursor)
      const inRange = d >= start && d <= end
      const key = formatLocalDateKey(d)
      const count = inRange ? getFilteredCount(activityMap, key, activityFilter) : 0
      if (inRange && count > 0) {
        activeDaysInRange += 1
        if (count > maxCount) maxCount = count
      }
      rawDays.push({ key, date: d, count, inRange })
      cursor.setDate(cursor.getDate() + 1)
    }

    const weeks: HeatmapDay[][] = []
    for (let i = 0; i < rawDays.length; i += 7) {
      weeks.push(
        rawDays.slice(i, i + 7).map(day => ({
          ...day,
          level: intensityLevel(day.count, maxCount),
        })),
      )
    }

    const monthLabels: Array<{ col: number; label: string }> = []
    let lastMonth = -1
    weeks.forEach((week, col) => {
      const firstInRange = week.find(d => d.inRange)
      if (!firstInRange) return
      const m = firstInRange.date.getMonth()
      if (m !== lastMonth) {
        if (monthLabels.length === 0 || col - monthLabels[monthLabels.length - 1]!.col >= 3) {
          monthLabels.push({ col, label: MONTH_NAMES[m]! })
        }
        lastMonth = m
      }
    })

    return { weeks, monthLabels, activeDaysInRange }
  }, [activityMap, activityFilter, activityRange, currentYear, today])

  // Keep the most recent months visible on narrow viewports by scrolling to the right edge
  useEffect(() => {
    const el = heatmapScrollRef.current
    if (!el) return
    el.scrollLeft = el.scrollWidth
  }, [activityRange, heatmap.weeks.length])

  // Activity breakdown bars (7 days / 30 days / 12 months)
  const barSeries = useMemo(() => {
    const buckets: Array<{
      label: string
      course: number
      extension: number
      document: number
      visit: number
      total: number
    }> = []

    if (chartWindow === '7d' || chartWindow === '30d') {
      const days = chartWindow === '7d' ? 7 : 30
      for (let i = days - 1; i >= 0; i -= 1) {
        const d = new Date(today)
        d.setDate(d.getDate() - i)
        const rec = activityMap[formatLocalDateKey(d)]
        buckets.push({
          label:
            chartWindow === '7d'
              ? d.toLocaleDateString(undefined, { weekday: 'short' })
              : i % 5 === 0 || i === 0
                ? `${MONTH_NAMES[d.getMonth()]} ${d.getDate()}`
                : '',
          course: rec?.course ?? 0,
          extension: rec?.extension ?? 0,
          document: rec?.document ?? 0,
          visit: rec?.visit ?? 0,
          total: rec?.total ?? 0,
        })
      }
    } else {
      for (let i = 11; i >= 0; i -= 1) {
        const d = new Date(today.getFullYear(), today.getMonth() - i, 1)
        const ymPrefix = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-`
        let course = 0
        let extension = 0
        let document = 0
        let visit = 0
        for (const [k, rec] of Object.entries(activityMap)) {
          if (!k.startsWith(ymPrefix)) continue
          course += rec.course
          extension += rec.extension
          document += rec.document
          visit += rec.visit
        }
        buckets.push({
          label: MONTH_NAMES[d.getMonth()]!,
          course,
          extension,
          document,
          visit,
          total: course + extension + document + visit,
        })
      }
    }

    const total = buckets.reduce((acc, b) => acc + b.total, 0)
    const max = Math.max(1, ...buckets.map(b => b.total))
    return { buckets, total, max }
  }, [activityMap, chartWindow, today])

  const initials = account
    ? account.displayName.trim().slice(0, 1).toUpperCase() || 'S'
    : 'G'

  const isClerkUser = Boolean(account && account.provider === 'clerk' && auth.isClerkActive)
  const courseCount = records.filter(r => r.manifest.kind === 'course').length
  const extensionCount = records.length - courseCount

  const iconUrlById = useMemo(
    () =>
      new Map(
        records.map(r => {
          try {
            return [r.id, resolveExtensionAssets(r.manifestUrl, r.manifest).iconUrl] as const
          } catch {
            return [r.id, null] as const
          }
        }),
      ),
    [records],
  )

  return (
    <main className="sx-profile-page" aria-label="Profile">
      <section className="sx-profile-hero">
        <div className="sx-profile-identity">
          <div className="sx-profile-avatar-wrap">
            {account?.avatarUrl && !avatarFailed ? (
              <img
                src={account.avatarUrl}
                alt={account.displayName}
                className="sx-profile-avatar-img"
                width={72}
                height={72}
                onError={() => setAvatarFailed(true)}
              />
            ) : (
              <div className="sx-profile-avatar-fallback" aria-hidden="true">
                {initials}
              </div>
            )}
            <div className="sx-profile-sema-chip" title="Your Sema companion">
              <Sema
                state="idle"
                shape={prefs.semaShape}
                tail={prefs.semaTail}
                expression={prefs.semaExpression}
                size={22}
                followCursor={false}
                ariaLabel="Sema companion preview"
              />
            </div>
          </div>

          <div className="sx-profile-titles">
            <h1>{account ? account.displayName : 'Guest learner'}</h1>
            <p className="sx-profile-handle">
              {account
                ? `@${account.handle}`
                : 'Sign in with Passkey, Google, or Apple to cloud-sync your preferences'}
              {account?.email ? ` · ${account.email}` : ''}
            </p>
          </div>
        </div>

        <div className="sx-profile-hero-actions">
          {account ? (
            <>
              <button
                type="button"
                className="sx-btn-secondary"
                onClick={() => auth.openAccount()}
              >
                Manage account
              </button>
              <button
                type="button"
                className="sx-btn-secondary"
                onClick={() => void auth.signOut()}
              >
                Sign out
              </button>
            </>
          ) : (
            <button
              type="button"
              className="sx-btn-primary"
              onClick={() => auth.openSignIn()}
            >
              Sign in
            </button>
          )}
        </div>
      </section>

      <section className="sx-profile-stats-grid" aria-label="Learning statistics">
        <div className="sx-stat-card">
          <span className="sx-stat-label">
            <Flame size={13} aria-hidden="true" />
            <span>Current streak</span>
          </span>
          <strong className="sx-stat-value">{stats.currentStreak}</strong>
          <small className="sx-stat-sub">Best: {stats.bestStreak} {stats.bestStreak === 1 ? 'day' : 'days'}</small>
        </div>
        <div className="sx-stat-card">
          <span className="sx-stat-label">Days active</span>
          <strong className="sx-stat-value">{stats.activeDays}</strong>
          <small className="sx-stat-sub">{stats.totalEvents} total actions</small>
        </div>
        <div className="sx-stat-card">
          <span className="sx-stat-label">Installed</span>
          <strong className="sx-stat-value">{records.length}</strong>
          <small className="sx-stat-sub">
            {courseCount} {courseCount === 1 ? 'course' : 'courses'} · {extensionCount}{' '}
            {extensionCount === 1 ? 'ext' : 'exts'}
          </small>
        </div>
        <div className="sx-stat-card">
          <span className="sx-stat-label">Documents</span>
          <strong className="sx-stat-value">{docCount}</strong>
          <small className="sx-stat-sub">Saved locally</small>
        </div>
      </section>

      <section className="sx-activity-card" aria-label="Activity heatmap">
        <div className="sx-activity-head">
          <div className="sx-activity-head-copy">
            <h2>Activity</h2>
            <strong>
              {heatmap.activeDaysInRange}{' '}
              {heatmap.activeDaysInRange === 1 ? 'day' : 'days'}
            </strong>
          </div>

          <div className="sx-pill-switch" role="tablist" aria-label="Activity range">
            <button
              type="button"
              role="tab"
              aria-selected={activityRange === 'past-year'}
              className={`sx-pill-switch-btn${activityRange === 'past-year' ? ' is-active' : ''}`}
              onClick={() => setActivityRange('past-year')}
            >
              Past year
            </button>
            <button
              type="button"
              role="tab"
              aria-selected={activityRange === 'current-year'}
              className={`sx-pill-switch-btn${activityRange === 'current-year' ? ' is-active' : ''}`}
              onClick={() => setActivityRange('current-year')}
            >
              {currentYear}
            </button>
          </div>
        </div>

        <div className="sx-activity-filters">
          <div className="sx-pill-switch" role="tablist" aria-label="Filter activity category">
            {(
              [
                ['all', 'All'],
                ['course', 'Courses'],
                ['extension', 'Extensions'],
                ['document', 'Documents'],
              ] as const
            ).map(([id, label]) => (
              <button
                key={id}
                type="button"
                role="tab"
                aria-selected={activityFilter === id}
                className={`sx-pill-switch-btn${activityFilter === id ? ' is-active' : ''}`}
                onClick={() => setActivityFilter(id)}
              >
                {label}
              </button>
            ))}
          </div>

          <span className="sx-activity-hover-readout" aria-live="polite">
            {hoveredDay
              ? `${hoveredDay.count} ${hoveredDay.count === 1 ? 'action' : 'actions'} on ${hoveredDay.date.toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' })}`
              : 'Hover a day to inspect'}
          </span>
        </div>

        <div className="sx-heatmap-shell">
          <div className="sx-heatmap-weekdays" aria-hidden="true">
            <span />
            <span>Mon</span>
            <span />
            <span>Wed</span>
            <span />
            <span>Fri</span>
            <span />
          </div>

          <div ref={heatmapScrollRef} className="sx-heatmap-scroll">
            <div className="sx-heatmap-inner">
              <div
                className="sx-heatmap-months"
                style={{ gridTemplateColumns: `repeat(${heatmap.weeks.length}, 12px)` }}
                aria-hidden="true"
              >
                {heatmap.monthLabels.map(m => (
                  <span key={`${m.col}-${m.label}`} style={{ gridColumnStart: m.col + 1 }}>
                    {m.label}
                  </span>
                ))}
              </div>

              <div className="sx-heatmap-grid">
                {heatmap.weeks.map((week, wIdx) => (
                  <div key={wIdx} className="sx-heatmap-col">
                    {week.map(day => (
                      <button
                        key={day.key}
                        type="button"
                        disabled={!day.inRange}
                        className={`sx-heatmap-cell is-lvl-${day.level}${!day.inRange ? ' is-out' : ''}`}
                        aria-label={`${day.count} actions on ${day.key}`}
                        onMouseEnter={() => day.inRange && setHoveredDay(day)}
                        onFocus={() => day.inRange && setHoveredDay(day)}
                        onMouseLeave={() => setHoveredDay(null)}
                      />
                    ))}
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      </section>

      <section className="sx-activity-card" aria-label="Activity sessions">
        <div className="sx-activity-head">
          <div className="sx-activity-head-copy">
            <h2>Sessions</h2>
            <strong>{barSeries.total}</strong>
          </div>

          <div className="sx-pill-switch" role="tablist" aria-label="Session timeframe">
            {(
              [
                ['7d', '7 days'],
                ['30d', '30 days'],
                ['12m', '12 months'],
              ] as const
            ).map(([id, label]) => (
              <button
                key={id}
                type="button"
                role="tab"
                aria-selected={chartWindow === id}
                className={`sx-pill-switch-btn${chartWindow === id ? ' is-active' : ''}`}
                onClick={() => setChartWindow(id)}
              >
                {label}
              </button>
            ))}
          </div>
        </div>

        <div className="sx-bar-chart" role="img" aria-label={`${barSeries.total} actions in selected window`}>
          {barSeries.buckets.map((bucket, idx) => {
            const pct = Math.round((bucket.total / barSeries.max) * 100)
            return (
              <div key={`${bucket.label}-${idx}`} className="sx-bar-col" title={`${bucket.label || 'Day'}: ${bucket.total}`}>
                <div className="sx-bar-track">
                  {bucket.total > 0 && (
                    <span className="sx-bar-count">{bucket.total}</span>
                  )}
                  <div
                    className={`sx-bar-fill${bucket.total === 0 ? ' is-empty' : ''}`}
                    style={{ height: bucket.total > 0 ? `${Math.max(10, pct)}%` : '3px' }}
                  />
                </div>
                <span className="sx-bar-label">{bucket.label}</span>
              </div>
            )
          })}
        </div>
      </section>

      {records.length > 0 && (
        <section className="sx-profile-section" aria-label="Installed packages">
          <div className="sx-profile-section-head">
            <h2>Installed Packages</h2>
            <button type="button" className="sx-section-link" onClick={onOpenExtensions}>
              Manage all
            </button>
          </div>
          <div className="sx-ext-card-grid">
            {records.slice(0, 6).map(rec => {
              const primaryView = views.find(v => v.ownerId === rec.id && v.placement !== 'embed')
              return (
                <button
                  key={rec.id}
                  type="button"
                  className="sx-ext-launch-card"
                  onClick={() => {
                    if (primaryView && onNavigate) {
                      onNavigate(`/ext/${encodeURIComponent(rec.id)}/${encodeURIComponent(primaryView.id)}`)
                    } else {
                      onOpenExtensions()
                    }
                  }}
                >
                  <span className="sx-ext-launch-head">
                    <ExtensionIcon
                      src={iconUrlById.get(rec.id)}
                      name={rec.manifest.name}
                      kind={rec.manifest.kind}
                      size={32}
                    />
                    <span className="sx-ext-launch-copy">
                      <span className="sx-ext-launch-title">
                        <strong>{rec.manifest.name}</strong>
                        <ExternalLink size={14} aria-hidden="true" />
                      </span>
                      <small>
                        v{rec.manifest.version} · {rec.manifest.kind === 'course' ? 'Course' : 'Extension'}
                      </small>
                    </span>
                  </span>
                </button>
              )
            })}
          </div>
        </section>
      )}

      <section className="sx-profile-section" aria-label="Cloud Sync and Security">
        <div className="sx-profile-section-head">
          <h2>Account &amp; Cloud Sync</h2>
        </div>
        <div className="preference-rows">
          <div className="preference-row">
            <div className="syntax-pref-copy">
              <p className="sx-inline-icon-label">
                {isClerkUser && cloudSync.status !== 'error' ? (
                  <Cloud size={15} aria-hidden="true" />
                ) : (
                  <CloudOff size={15} aria-hidden="true" />
                )}
                <span>
                  {isClerkUser
                    ? cloudSync.status === 'syncing'
                      ? 'Syncing to your Clerk account...'
                      : cloudSync.status === 'error'
                        ? 'Cloud sync paused (changes saved locally)'
                        : 'Clerk Cloud Sync active'
                    : 'Local device storage'}
                </span>
              </p>
              <span>
                {isClerkUser
                  ? `${formatSyncTime(cloudSync.lastSyncedAt)} · Syncs your theme, sound, installed extensions, and extension settings across devices`
                  : 'Sign in to sync your preferences and installed extensions across devices'}
              </span>
            </div>
            {isClerkUser ? (
              <button
                type="button"
                className="sx-btn-secondary sx-btn-sm"
                disabled={cloudSync.status === 'syncing'}
                onClick={() => void auth.syncNow()}
              >
                <RefreshCw
                  size={13}
                  className={cloudSync.status === 'syncing' ? 'sx-spin' : undefined}
                  aria-hidden="true"
                />
                <span>Sync now</span>
              </button>
            ) : (
              <button
                type="button"
                className="sx-btn-secondary sx-btn-sm"
                onClick={() => auth.openSignIn()}
              >
                Sign in
              </button>
            )}
          </div>

          {isClerkUser && (
            <div className="preference-row">
              <div className="syntax-pref-copy">
                <p className="sx-inline-icon-label">
                  {auth.security.passkeyCount > 0 || auth.security.twoFactorEnabled ? (
                    <ShieldCheck size={15} aria-hidden="true" />
                  ) : (
                    <KeyRound size={15} aria-hidden="true" />
                  )}
                  <span>Sign-in &amp; Security</span>
                </p>
                <span>
                  {auth.security.passkeyCount > 0
                    ? `${auth.security.passkeyCount} ${auth.security.passkeyCount === 1 ? 'Passkey' : 'Passkeys'}`
                    : 'No passkey yet'}
                  {' · '}
                  {auth.security.twoFactorEnabled ? '2FA enabled' : '2FA optional'}
                  {auth.security.connectedProviders.length > 0
                    ? ` · Connected: ${auth.security.connectedProviders.join(', ')}`
                    : ''}
                </span>
              </div>
              <button
                type="button"
                className="sx-btn-secondary sx-btn-sm"
                onClick={() => auth.openSecurity()}
              >
                Passkeys &amp; 2FA
              </button>
            </div>
          )}
        </div>
      </section>
    </main>
  )
}
