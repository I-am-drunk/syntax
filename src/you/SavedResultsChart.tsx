import type { CSSProperties } from 'react'
import { useEffect, useState } from 'react'
import { activityBuckets, dateValue, daySpan, formatDate, formatRange } from './periods'
import type { Period } from './periods'
import type { ActivitySession } from './activity'
import { Info } from './YouControls'

export function SavedResultsChart({ period, start, end, sessions }: {
  period: Period; start: string; end: string; sessions: ActivitySession[]
}) {
  const [wide, setWide] = useState(() => matchMedia('(min-width: 481px)').matches)
  useEffect(() => {
    const media = matchMedia('(min-width: 481px)')
    const update = () => setWide(media.matches)
    media.addEventListener('change', update)
    return () => media.removeEventListener('change', update)
  }, [])
  const buckets = activityBuckets(period, start, end, sessions, wide ? 12 : 4)
  const maximum = Math.max(0, ...buckets.map(b => b.value)) / 4
  const magnitude = 10 ** Math.floor(Math.log10(Math.max(maximum, 1)))
  const step = Math.max(2, [1, 1.5, 2, 2.5, 3, 4, 5, 6, 8, 10]
    .map(n => n * magnitude).find(n => Number.isInteger(n) && n >= maximum) ?? 10 * magnitude)
  const ticks = Array.from({ length: 5 }, (_, i) => i * step)
  const top = step * 4
  const allTimeDateOptions: Intl.DateTimeFormatOptions = daySpan(start, end) < 28
    ? { month: 'short', day: 'numeric' } : { month: 'short', year: '2-digit' }
  function label(bucket: typeof buckets[number]) {
    if (period === 'week') return formatDate(bucket.start, { weekday: 'short' })
    if (period === 'year') return bucket.start.slice(0, 7) === bucket.end.slice(0, 7)
      ? formatDate(bucket.start, { month: 'short' })
      : `${formatDate(bucket.start, { month: 'short' })}–${formatDate(bucket.end, { month: 'short' })}`
    if (period === 'allTime') return formatDate(bucket.start, allTimeDateOptions)
    return `${formatDate(bucket.start, { month: 'short', day: 'numeric' })}–${dateValue(bucket.end).getDate()}`
  }
  return <div className="you-chart-card">
    <div className="you-chart-heading">
      <div><h3>Saved correct results</h3><p>{formatRange(start, end)}</p></div>
      <Info label="About saved correct results">
        Latest saved correct answers, grouped by each session’s last save date.
        Saving a session again can move its results to a new date or change its count.
      </Info>
    </div>
    <div className="you-chart" role="img" aria-label="Bar chart of saved correct results. A data table follows.">
      <div className="you-chart-axis" style={{ '--axis-width': `${String(top).length}ch` } as CSSProperties}>
        {ticks.map((tick, i) => <span key={tick} style={{ bottom: `${i * 25}%` }}>{tick}</span>)}
      </div>
      <div className="you-chart-plot">
        {ticks.map((tick, i) => <span className="you-gridline" key={tick} style={{ bottom: `${i * 25}%` }} />)}
        <div className="you-bars">{buckets.map(b => <div className="you-bar-slot" key={b.start}>
          <div className="you-bar" style={{ height: Math.max(2, b.value / top * 169) }} />
        </div>)}</div>
      </div>
      <div className="you-chart-labels" data-period={period}>
        {buckets.map(b => <span key={b.start}>{label(b)}</span>)}
      </div>
      {period === 'allTime' && <div className="you-chart-extents">
        <span>{formatDate(start, allTimeDateOptions)}</span><span>{formatDate(end, allTimeDateOptions)}</span>
      </div>}
    </div>
    <div className="you-sr-only"><table>
      <caption>Saved correct results over the selected period</caption>
      <thead><tr><th scope="col">Starting</th><th scope="col">Saved correct results</th></tr></thead>
      <tbody>{buckets.map(b => <tr key={b.start}>
        <th scope="row">{formatDate(b.start)}</th><td>{b.value}</td>
      </tr>)}</tbody>
    </table></div>
  </div>
}
