import { useEffect, useState } from 'react'
import { BookOpen, Puzzle } from 'lucide-react'

export interface ExtensionIconProps {
  src?: string | null
  name: string
  kind?: 'extension' | 'course'
  size?: number
}

export function ExtensionIcon({
  src,
  name,
  kind = 'extension',
  size = 36,
}: ExtensionIconProps) {
  const [failed, setFailed] = useState(false)

  useEffect(() => {
    setFailed(false)
  }, [src])

  const iconSize = Math.max(14, Math.round(size * 0.48))

  return (
    <span
      className={`sx-ext-icon-box${kind === 'course' ? ' is-course' : ''}`}
      style={{ width: size, height: size }}
      aria-hidden="true"
    >
      {src && !failed ? (
        <img
          src={src}
          alt=""
          width={size}
          height={size}
          loading="lazy"
          referrerPolicy="no-referrer"
          className="sx-ext-icon-img"
          onError={() => setFailed(true)}
        />
      ) : kind === 'course' ? (
        <BookOpen size={iconSize} strokeWidth={1.9} />
      ) : (
        <Puzzle size={iconSize} strokeWidth={1.9} />
      )}
    </span>
  )
}
