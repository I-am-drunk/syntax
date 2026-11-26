import { useMemo } from 'react'
import {
  AppWindow,
  Atom,
  Blocks,
  BookOpen,
  Calculator,
  Compass,
  Cpu,
  FunctionSquare,
  Keyboard,
  LineChart,
  PenTool,
  PlaySquare,
  Terminal,
  Timer,
  type LucideIcon,
} from 'lucide-react'
import type { PackageKind } from '../core/packages'

const ICON_BY_ID: Record<string, LucideIcon> = {
  'mpm2d-analytic-geometry': Compass,
  'thinking-in-code': Terminal,
  'math-graph-engine': LineChart,
  'grid-coding-engine': Cpu,
  'pen-studio': PenTool,
  'walkthrough-player': PlaySquare,
  'floating-windows': AppWindow,
  'formula-playbook': BookOpen,
  'geometry-unit-circle-pack': Compass,
  'quadratic-parabola-lab': FunctionSquare,
  'pomodoro-study-timer': Timer,
  'keyboard-shortcuts-overlay': Keyboard,
  'quick-scratch-calculator': Calculator,
  'chemistry-periodic-table': Atom,
}

type PackageIconProps = {
  id?: string
  kind?: PackageKind
  svg?: string
  name?: string
  size?: number | 'sm' | 'md' | 'lg'
}

export function PackageIcon({ id, kind, svg, size = 36 }: PackageIconProps) {
  const px = typeof size === 'number' ? size : size === 'sm' ? 28 : size === 'lg' ? 52 : 38
  const BuiltInIcon = id ? ICON_BY_ID[id] : undefined

  const src = useMemo(() => {
    if (BuiltInIcon || !svg) return null
    const trimmed = svg.trim()
    if (!trimmed) return null
    return `data:image/svg+xml;utf8,${encodeURIComponent(trimmed)}`
  }, [BuiltInIcon, svg])

  if (BuiltInIcon) {
    const iconPx = Math.max(15, Math.round(px * 0.5))
    return (
      <span
        className="sx-pkg-icon is-glyph"
        style={{ width: px, height: px }}
        aria-hidden="true"
      >
        <BuiltInIcon size={iconPx} strokeWidth={1.75} aria-hidden />
      </span>
    )
  }

  if (src) {
    return (
      <span className="sx-pkg-icon" style={{ width: px, height: px }} aria-hidden="true">
        <img src={src} alt="" width={px} height={px} />
      </span>
    )
  }

  const FallbackIcon = kind === 'course' ? BookOpen : kind === 'embedded-plugin' ? Cpu : Blocks
  const iconPx = Math.max(15, Math.round(px * 0.5))
  return (
    <span className="sx-pkg-icon is-glyph" style={{ width: px, height: px }} aria-hidden="true">
      <FallbackIcon size={iconPx} strokeWidth={1.75} aria-hidden />
    </span>
  )
}
