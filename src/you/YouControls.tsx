import { Radio } from '@base-ui/react/radio'
import { RadioGroup } from '@base-ui/react/radio-group'
import { Popover } from '@base-ui/react/popover'
import type { ReactNode } from 'react'
import { formatDate, formatRange } from './periods'
import type { Period } from './periods'

export function PreferencesIcon() {
  return <svg width="28" height="24" viewBox="0 0 28 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
    <path d="M13.875 7.75C16.1525 7.75019 18 9.59688 18 11.875C18 14.1531 16.1525 15.9998 13.875 16C11.597 16 9.75 14.1529 9.75 11.875C9.75 9.59705 11.597 7.75 13.875 7.75Z" />
    <path d="M6.91941 1.98254C7.27924 1.3736 7.93395 1 8.64126 1L19.3587 1C20.0661 1 20.7208 1.3736 21.0806 1.98254L26.3988 10.9825C26.7696 11.6102 26.7696 12.3898 26.3988 13.0175L21.0806 22.0175C20.7208 22.6264 20.0661 23 19.3587 23H8.64126C7.93395 23 7.27924 22.6264 6.91941 22.0175L1.60122 13.0175C1.23036 12.3898 1.23036 11.6102 1.60123 10.9825L6.91941 1.98254Z" />
  </svg>
}

export function PeriodArrow({ next = false }: { next?: boolean }) {
  return <svg width="16" height="16" viewBox="0 0 16 16" fill="currentColor" aria-hidden="true">
    <path d={next ? 'M13.3713 7.95711L5.41421 15.9142L4 14.5L10.5429 7.95711L4 1.41421L5.41421 0L13.3713 7.95711Z'
      : 'M3 7.95711L10.9571 15.9142L12.3713 14.5L5.82843 7.95711L12.3713 1.41421L10.9571 0L3 7.95711Z'} />
  </svg>
}

const options = [{ value: 'allTime', label: 'All time' }, { value: 'week', label: 'Week' },
  { value: 'month', label: 'Month' }, { value: 'year', label: 'Year' }] as const

export function Info({ label, children }: { label: string; children: ReactNode }) {
  return <Popover.Root>
    <Popover.Trigger className="you-info" aria-label={label} openOnHover>
      <svg width="12" height="12" viewBox="0 0 16 16" fill="currentColor" aria-hidden="true">
        <path fillRule="evenodd" d="M14 8C14 11.3137 11.3137 14 8 14C4.68629 14 2 11.3137 2 8C2 4.68629 4.68629 2 8 2C11.3137 2 14 4.68629 14 8ZM16 8C16 12.4183 12.4183 16 8 16C3.58172 16 0 12.4183 0 8C0 3.58172 3.58172 0 8 0C12.4183 0 16 3.58172 16 8ZM7 6V4H9V6H7ZM9 12V9V7H7H6V9H7V12H9Z" />
      </svg>
    </Popover.Trigger>
    <Popover.Portal><Popover.Positioner side="top" sideOffset={8} className="you-info-positioner">
      <Popover.Popup className="you-info-popup" aria-label={label}>{children}</Popover.Popup>
    </Popover.Positioner></Popover.Portal>
  </Popover.Root>
}

export function PeriodControls({ period, start, end, canPrevious, canNext, allTime, onPeriod, onMove }: {
  period: Period; start: string; end: string; canPrevious: boolean; canNext: boolean
  allTime: boolean; onPeriod: (period: Period) => void; onMove: (delta: number) => void
}) {
  const week = start.slice(0, 7) === end.slice(0, 7)
    ? `${formatDate(start, { month: 'short', day: 'numeric' })}–${formatDate(end, { day: 'numeric' })}, ${end.slice(0, 4)}`
    : formatRange(start, end)
  return <div className="you-period-controls">
    <RadioGroup className="you-periods" aria-label="Report period" value={period}
      onValueChange={value => { if (options.some(o => o.value === value)) onPeriod(value as Period) }}>
      {options.filter(o => allTime || o.value !== 'allTime').map(o =>
        <Radio.Root className="you-period" key={o.value} value={o.value}>{o.label}</Radio.Root>)}
    </RadioGroup>
    {period !== 'allTime' && <div className="you-period-navigation">
      <button aria-label="Previous period" disabled={!canPrevious} onClick={() => onMove(1)}><PeriodArrow /></button>
      <span aria-live="polite">{period === 'week' ? `Week of ${week}` : formatRange(start, end)}</span>
      <button aria-label="Next period" disabled={!canNext} onClick={() => onMove(-1)}><PeriodArrow next /></button>
    </div>}
  </div>
}
