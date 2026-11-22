import type { GeoColor } from '../types'

export const BG_COLORS: Record<GeoColor, string> = {
  blue: 'var(--bg-blue)',
  teal: 'var(--bg-teal)',
  amber: 'var(--bg-orange)',
  violet: 'var(--bg-violet)',
  green: 'var(--bg-green)',
  red: 'var(--bg-red)',
  muted: 'var(--bg-muted)',
  ink: 'var(--bg-ink)',
}

export function resolveColor(color: GeoColor | undefined, fallback: GeoColor = 'blue'): string {
  return BG_COLORS[color ?? fallback]
}

export const HANDLE_METRICS = {
  regular: {
    dotRadius: 5,
    hitRadius: 24,
    discRadius: 20,
    shadowRadius: 32,
    pillWidth: 50,
    pillHeight: 26,
    pillRx: 13,
    pressScaleFree: 3,
    pressScaleDirectional: 1.5,
  },
  compact: {
    dotRadius: 4,
    hitRadius: 22,
    discRadius: 16,
    shadowRadius: 24,
    pillWidth: 44,
    pillHeight: 22,
    pillRx: 11,
    pressScaleFree: 3,
    pressScaleDirectional: 1.5,
  },
} as const

export const SPRING_CLICK_TRANSITION = 'transform 0.35s cubic-bezier(0.34, 1.56, 0.64, 1)'
export const SPRING_SETTLE_TRANSITION = 'transform 0.24s cubic-bezier(0.34, 1.56, 0.64, 1)'

export const STROKE = {
  grid: 1,
  axis: 1.5,
  tickHalf: 5,
  lineDefault: 2.1,
  lineDim: 1.5,
  lineHighlight: 2.85,
  dashArray: '6 7',
  dotArray: '2.5 5.5',
  polygonFillOpacity: 0.18,
  polygonDimFillOpacity: 0.08,
} as const

export const ARROWHEAD_PATH =
  'M6 0L0.226497 10L11.7735 10L6 0ZM6 10L7 10L7 9L6 9L5 9L5 10L6 10Z'

export const CHEVRON_LEFT = 'M-12 4 L-16 0 L-12 -4'
export const CHEVRON_RIGHT = 'M12 4 L16 0 L12 -4'
