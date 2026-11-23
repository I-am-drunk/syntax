import { useEffect } from 'react'

export function DevChannelBadge() {
  const version = (import.meta.env.VITE_RELEASE_TAG as string | undefined) || 'alpha'

  useEffect(() => {
    if (typeof document === 'undefined') return
    if (!document.title.startsWith('Dev · ')) {
      document.title = `Dev · ${document.title}`
    }
  }, [])

  return (
    <div
      style={{
        position: 'fixed',
        right: 12,
        bottom: 12,
        zIndex: 9999,
        padding: '4px 9px',
        borderRadius: 999,
        background: 'rgba(245, 158, 11, 0.92)',
        color: '#1b1406',
        fontSize: 11,
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
