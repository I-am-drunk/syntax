import { useEffect, useMemo, useState } from 'react'
import { readSavedActivity } from '../services/activity'
import type { SavedActivity } from '../services/activity'
import { localDate, projectActivity, totalActivity } from './activity'
import { daySpan, periodWindow } from './periods'
import type { Period } from './periods'
import { Info, PeriodControls, PreferencesIcon } from './YouControls'
import { SavedResultsChart } from './SavedResultsChart'
import { YouCourseProgress } from './YouCourseProgress'
import './you.css'

export function YouPage() {
  const [today] = useState(() => new Date())
  const [activity, setActivity] = useState<SavedActivity | null>(null)
  const [error, setError] = useState(false)
  const [load, setLoad] = useState(0)
  const [period, setPeriod] = useState<Period>('week')
  const [ago, setAgo] = useState(0)
  const sessions = useMemo(() => projectActivity(activity ?? { records: [] }), [activity])
  const first = sessions.map(s => s.date).filter(date => date <= localDate(today)).sort()[0]
  const allTime = !!first && daySpan(first, localDate(today)) > 7
  useEffect(() => {
    const request = new AbortController()
    setError(false); setPeriod('week'); setAgo(0); setActivity(null)
    void readSavedActivity(request.signal).then(result => {
      if (request.signal.aborted) return
      const firstDate = projectActivity(result).map(s => s.date).sort()[0]
      setPeriod(firstDate && daySpan(firstDate, localDate(today)) > 7 ? 'allTime' : 'week')
      setAgo(0); setActivity(result)
    }).catch(() => { if (!request.signal.aborted) setError(true) })
    return () => request.abort()
  }, [load, today])
  const range = periodWindow(period, ago, today, first)
  const current = totalActivity(sessions, range.start, range.end)
  const previous = totalActivity(sessions, range.previousStart, range.previousEnd)
  const currentAccuracy = current.accuracy === null ? null : Math.round(current.accuracy * 1000) / 1000
  const previousAccuracy = previous.accuracy === null ? null : Math.round(previous.accuracy * 1000) / 1000
  const difference = period !== 'allTime' && currentAccuracy !== null && previousAccuracy !== null
    && (currentAccuracy !== 0 || previousAccuracy !== 0)
    ? Math.round((currentAccuracy - previousAccuracy) * 1000) / 1000 : null
  const percent = (value: number) => new Intl.NumberFormat('en-US', {
    style: 'percent', minimumFractionDigits: 1, maximumFractionDigits: 1,
  }).format(value)
  return <main className="you-page" aria-busy={!activity && !error}>
    <div className="you-layout">
      <h1 className="you-sr-only">Your progress</h1>
      <div className="you-profile">
        <span className="you-avatar" aria-hidden="true">Y</span><strong>You</strong>
        <a href="/settings/preferences/" aria-label="Preferences" className="you-profile-settings"><PreferencesIcon /></a>
      </div>
      <h2>Your learning activity</h2>
      {error ? <div className="you-load-error" role="alert">
        <p>We couldn’t load your saved activity.</p>
        <button className="plain-button" onClick={() => setLoad(n => n + 1)}>Try again</button>
      </div> : !activity ? <div className="you-loading" role="status" aria-label="Loading activity">
        <div /><div /><div />
      </div> : <>
        <div className="you-activity">
          <PeriodControls period={period} start={range.start} end={range.end}
            allTime={allTime} canPrevious={!!first && range.start > first} canNext={ago > 0}
            onPeriod={value => { setPeriod(value); setAgo(0) }}
            onMove={delta => setAgo(value => Math.max(0, value + delta))} />
          <section className="you-snapshot" aria-labelledby="you-snapshot-heading">
            <h2 id="you-snapshot-heading" className="you-sr-only">Your activity snapshot</h2>
            <div className="you-stats">
              <div className="you-stat">
                <div className="you-stat-label"><span>Activities completed</span>
                  <Info label="About activities completed">Completed lessons and practice sets in saved sessions.
                    Each completed lesson or practice set counts once per session. Dates reflect that session’s last save.</Info>
                </div><strong>{current.activities.toLocaleString('en-US')}</strong>
              </div>
              <div className="you-stat">
                <div className="you-stat-label"><span>Practice accuracy</span>
                  <Info label="About practice accuracy">Correct answers divided by recorded answers in saved practice sets.
                    Ordinary lesson answers are excluded. A dash means no practice answers are saved for this period.</Info>
                </div>
                <div className="you-stat-value"><strong>{current.accuracy === null ? '–' : percent(current.accuracy)}</strong>
                  {difference !== null && <div className="you-stat-change" data-direction={Math.sign(difference)}>
                    <span>{difference === 0 ? '−' : difference > 0 ? '▴' : '▾'} {percent(Math.abs(difference))}</span>
                    <small>From last {period}</small>
                  </div>}
                </div>
              </div>
            </div>
            <SavedResultsChart period={period} start={range.start} end={range.end} sessions={sessions} />
          </section>
          <section className="you-strengths" aria-labelledby="you-strengths-heading">
            <h2 id="you-strengths-heading">Learning strengths</h2>
            <p>We couldn’t load this section.</p>
          </section>
        </div>
        <YouCourseProgress activity={activity} />
      </>}
    </div>
  </main>
}
