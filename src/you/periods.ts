import { localDate } from './activity'
import type { ActivitySession } from './activity'
export type Period = 'allTime' | 'week' | 'month' | 'year'
export const dateValue = (value: string) => new Date(value + 'T12:00:00')
export const daySpan = (start: string, end: string) =>
  Math.round((Date.parse(end) - Date.parse(start)) / 86400000) + 1
function days(date: Date, count: number) {
  const next = new Date(date); next.setDate(next.getDate() + count); return next
}
function months(date: Date, count: number) {
  const next = new Date(date.getFullYear(), date.getMonth() + count, 1, 12)
  next.setDate(Math.min(date.getDate(), new Date(next.getFullYear(), next.getMonth() + 1, 0).getDate()))
  return next
}
const monthStart = (date: Date) => new Date(date.getFullYear(), date.getMonth(), 1, 12)
const monthEnd = (date: Date) => new Date(date.getFullYear(), date.getMonth() + 1, 0, 12)

export function periodWindow(period: Period, ago: number, today: Date, first?: string) {
  if (period === 'allTime') {
    if (!first) throw new Error('All time requires a first saved date')
    return { start: first, end: localDate(today), previousStart: first, previousEnd: first }
  }
  let start: Date, end: Date, previousStart: Date, previousEnd: Date
  if (period === 'week') {
    const at = days(today, -7 * ago)
    start = days(at, -((at.getDay() + 6) % 7)); end = ago ? days(start, 6) : today
    previousStart = days(start, -7); previousEnd = days(end, -7)
  } else {
    const at = months(today, -ago * (period === 'year' ? 12 : 1))
    start = monthStart(period === 'year' ? months(at, -11) : at)
    end = ago ? monthEnd(at) : today
    previousStart = months(start, period === 'year' ? -12 : -1)
    previousEnd = months(end, period === 'year' ? -12 : -1)
    if (ago) previousEnd = monthEnd(previousEnd)
  }
  return { start: localDate(start), end: localDate(end), previousStart: localDate(previousStart), previousEnd: localDate(previousEnd) }
}

export function activityBuckets(period: Period, start: string, end: string, sessions: ActivitySession[], yearBuckets = 12) {
  const first = dateValue(start), last = dateValue(end)
  const span = daySpan(start, end)
  const monthCount = (last.getFullYear() - first.getFullYear()) * 12 + last.getMonth() - first.getMonth() + 1
  const step = Math.max(1, Math.ceil((span < 28 ? span : monthCount) / 12))
  const buckets: { start: string; end: string; value: number }[] = []
  for (let at = first; at <= last;) {
    let next: Date
    if (period === 'week') next = days(at, 1)
    else if (period === 'month') next = days(at, 7 - (at.getDay() + 6) % 7)
    else if (period === 'allTime' && span < 28) next = days(at, step)
    else next = monthStart(months(at, period === 'allTime' ? step : Math.ceil(12 / yearBuckets)))
    const bucketStart = localDate(at), bucketEnd = localDate(new Date(Math.min(+last, +days(next, -1))))
    buckets.push({ start: bucketStart, end: bucketEnd,
      value: sessions.filter(s => s.date >= bucketStart && s.date <= bucketEnd).reduce((sum, s) => sum + s.correct, 0) })
    at = next
  }
  return buckets
}

export function formatDate(value: string, options: Intl.DateTimeFormatOptions = { month: 'short', day: 'numeric', year: 'numeric' }) {
  return new Intl.DateTimeFormat('en-US', options).format(dateValue(value))
}
export function formatRange(start: string, end: string) {
  return `${formatDate(start, { month: 'short', day: 'numeric', ...(start.slice(0, 4) !== end.slice(0, 4) ? { year: 'numeric' } : {}) })} – ${formatDate(end)}`
}
