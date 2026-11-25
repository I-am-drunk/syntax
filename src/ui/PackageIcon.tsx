import { useMemo } from 'react'

type PackageIconProps = {
  svg: string
  name?: string
  size?: number | 'sm' | 'md' | 'lg'
}

export function PackageIcon({ svg, size = 36 }: PackageIconProps) {
  const src = useMemo(() => {
    const trimmed = svg.trim()
    return `data:image/svg+xml;utf8,${encodeURIComponent(trimmed)}`
  }, [svg])

  const px = typeof size === 'number' ? size : size === 'sm' ? 28 : size === 'lg' ? 52 : 38

  return (
    <span className="sx-pkg-icon" style={{ width: px, height: px }} aria-hidden="true">
      <img src={src} alt="" width={px} height={px} />
    </span>
  )
}
