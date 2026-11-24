import { useMemo } from 'react'

type PackageIconProps = {
  svg: string
  name: string
  size?: 'sm' | 'md' | 'lg'
}

/**
 * Renders a package SVG icon safely as an isolated data URL image so third-party
 * icons can never execute scripts or leak styles into the app DOM.
 */
export function PackageIcon({ svg, size = 'md' }: PackageIconProps) {
  const src = useMemo(() => {
    const trimmed = svg.trim()
    return `data:image/svg+xml;utf8,${encodeURIComponent(trimmed)}`
  }, [svg])

  const sizeClass = size === 'sm' ? 'is-sm' : size === 'lg' ? 'is-lg' : ''

  return (
    <span className={`sx-pkg-icon ${sizeClass}`} aria-hidden="true">
      <img src={src} alt="" width="100%" height="100%" />
    </span>
  )
}
