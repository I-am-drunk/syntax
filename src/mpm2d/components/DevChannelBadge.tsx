import { useEffect } from 'react'

export function DevChannelBadge() {
  const version = (import.meta.env.VITE_RELEASE_TAG as string | undefined) || 'alpha'

  useEffect(() => {
    if (typeof document === 'undefined') return
    const prevTitle = document.title
    if (!prevTitle.startsWith('Dev · ')) {
      document.title = `Dev · ${prevTitle}`
    }
    return () => {
      if (document.title.startsWith('Dev · ')) {
        document.title = document.title.slice('Dev · '.length)
      }
    }
  }, [])

  return (
    <div
      role="status"
      style={{
        position: 'fixed',
        left: 10,
        bottom: 8,
        zIndex: 400,
        padding: '3px 8px',
        borderRadius: 999,
        background: 'rgba(245, 158, 11, 0.92)',
        color: '#1b1406',
        fontSize: 10.5,
        fontWeight: 800,
        letterSpacing: '0.03em',
        boxShadow: '0 2px 8px rgba(0, 0, 0, 0.2)',
        pointerEvents: 'none',
        userSelect: 'none',
      }}
      aria-label={`Dev build ${version}`}
    >
      dev {version}
    </div>
  )
}
