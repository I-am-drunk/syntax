import { useEffect, useMemo, useState } from 'react'
import {
  AppWindow,
  Atom,
  BookOpen,
  Calculator,
  Compass,
  Cpu,
  FunctionSquare,
  Keyboard,
  LineChart,
  PenTool,
  PlaySquare,
  Puzzle,
  Terminal,
  Timer,
  type LucideIcon,
} from 'lucide-react'
import { isSafeSvgIcon, type PackageKind } from '../core/packages'

const FALLBACK_META_BY_ID: Record<string, { Icon: LucideIcon; bg: string; fg: string }> = {
  'mpm2d-analytic-geometry': {
    Icon: Compass,
    bg: 'linear-gradient(135deg, #2563eb, #1d4ed8)',
    fg: '#ffffff',
  },
  'thinking-in-code': {
    Icon: Terminal,
    bg: 'linear-gradient(135deg, #7c3aed, #5b21b6)',
    fg: '#ffffff',
  },
  'math-graph-engine': {
    Icon: LineChart,
    bg: 'linear-gradient(135deg, #059669, #047857)',
    fg: '#ffffff',
  },
  'grid-coding-engine': {
    Icon: Cpu,
    bg: 'linear-gradient(135deg, #0891b2, #0e7490)',
    fg: '#ffffff',
  },
  'pen-studio': {
    Icon: PenTool,
    bg: 'linear-gradient(135deg, #d97706, #b45309)',
    fg: '#ffffff',
  },
  'walkthrough-player': {
    Icon: PlaySquare,
    bg: 'linear-gradient(135deg, #db2777, #be185d)',
    fg: '#ffffff',
  },
  'floating-windows': {
    Icon: AppWindow,
    bg: 'linear-gradient(135deg, #4f46e5, #4338ca)',
    fg: '#ffffff',
  },
  'formula-playbook': {
    Icon: BookOpen,
    bg: 'linear-gradient(135deg, #ea580c, #c2410c)',
    fg: '#ffffff',
  },
  'geometry-unit-circle-pack': {
    Icon: Compass,
    bg: 'linear-gradient(135deg, #2563eb, #1e40af)',
    fg: '#ffffff',
  },
  'quadratic-parabola-lab': {
    Icon: FunctionSquare,
    bg: 'linear-gradient(135deg, #7c3aed, #6d28d9)',
    fg: '#ffffff',
  },
  'pomodoro-study-timer': {
    Icon: Timer,
    bg: 'linear-gradient(135deg, #e11d48, #be123c)',
    fg: '#ffffff',
  },
  'keyboard-shortcuts-overlay': {
    Icon: Keyboard,
    bg: 'linear-gradient(135deg, #0284c7, #0369a1)',
    fg: '#ffffff',
  },
  'quick-scratch-calculator': {
    Icon: Calculator,
    bg: 'linear-gradient(135deg, #16a34a, #15803d)',
    fg: '#ffffff',
  },
  'chemistry-periodic-table': {
    Icon: Atom,
    bg: 'linear-gradient(135deg, #0d9488, #0f766e)',
    fg: '#ffffff',
  },
}

const FALLBACK_BY_KIND: Record<PackageKind, { Icon: LucideIcon; bg: string; fg: string }> = {
  course: { Icon: BookOpen, bg: 'linear-gradient(135deg, #3b82f6, #1d4ed8)', fg: '#ffffff' },
  'embedded-plugin': {
    Icon: Cpu,
    bg: 'linear-gradient(135deg, #10b981, #047857)',
    fg: '#ffffff',
  },
  plugin: { Icon: Puzzle, bg: 'linear-gradient(135deg, #8b5cf6, #6d28d9)', fg: '#ffffff' },
}

type PackageIconProps = {
  id?: string
  kind?: PackageKind
  svg?: string
  name?: string
  size?: number | 'sm' | 'md' | 'lg'
}

export function PackageIcon({ id, kind = 'plugin', svg, size = 36 }: PackageIconProps) {
  const px = typeof size === 'number' ? size : size === 'sm' ? 28 : size === 'lg' ? 52 : 38
  const radius = Math.max(8, Math.round(px * 0.25))
  const [imgFailed, setImgFailed] = useState(false)

  const src = useMemo(() => {
    if (!svg) return null
    const trimmed = svg.trim()
    if (!isSafeSvgIcon(trimmed)) return null
    return `data:image/svg+xml;utf8,${encodeURIComponent(trimmed)}`
  }, [svg])

  useEffect(() => {
    setImgFailed(false)
  }, [src])

  // Always prefer custom colorful SVG artwork first
  if (src && !imgFailed) {
    return (
      <span
        className="sx-pkg-icon is-art"
        style={{ width: px, height: px, borderRadius: radius }}
        aria-hidden="true"
      >
        <img src={src} alt="" width={px} height={px} onError={() => setImgFailed(true)} />
      </span>
    )
  }

  const meta = (id ? FALLBACK_META_BY_ID[id] : undefined) ?? FALLBACK_BY_KIND[kind]
  const FallbackIcon = meta.Icon
  const iconPx = Math.max(15, Math.round(px * 0.5))

  return (
    <span
      className="sx-pkg-icon is-glyph"
      style={{
        width: px,
        height: px,
        borderRadius: radius,
        background: meta.bg,
        color: meta.fg,
      }}
      aria-hidden="true"
    >
      <FallbackIcon size={iconPx} strokeWidth={2} aria-hidden />
    </span>
  )
}
