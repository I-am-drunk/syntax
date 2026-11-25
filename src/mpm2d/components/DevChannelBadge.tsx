import { useEffect, useRef, useState } from 'react'

export function isDevEnvironment(): boolean {
  if (import.meta.env.VITE_CHANNEL === 'dev' || import.meta.env.DEV) return true
  if (typeof window !== 'undefined') {
    const host = window.location.hostname
    const path = window.location.pathname
    if (host === '127.0.0.1' || host === 'localhost' || path.startsWith('/dev') || path.includes('/dev/')) {
      return true
    }
  }
  return false
}

export function clearAllBrowserCookies() {
  if (typeof document === 'undefined') return
  const cookies = document.cookie.split(';')
  const hostname = typeof window !== 'undefined' ? window.location.hostname : ''
  const hostParts = hostname.split('.')
  const paths = ['/']
  if (typeof window !== 'undefined' && window.location.pathname && window.location.pathname !== '/') {
    paths.push(window.location.pathname)
  }
  for (const raw of cookies) {
    const eq = raw.indexOf('=')
    const name = (eq >= 0 ? raw.slice(0, eq) : raw).trim()
    if (!name) continue
    for (const p of paths) {
      document.cookie = `${name}=; expires=Thu, 01 Jan 1970 00:00:00 GMT; max-age=0; path=${p}; SameSite=Lax`
      if (hostname) {
        document.cookie = `${name}=; expires=Thu, 01 Jan 1970 00:00:00 GMT; max-age=0; path=${p}; domain=${hostname}; SameSite=Lax`
        if (hostParts.length >= 2) {
          const rootDomain = `.${hostParts.slice(-2).join('.')}`
          document.cookie = `${name}=; expires=Thu, 01 Jan 1970 00:00:00 GMT; max-age=0; path=${p}; domain=${rootDomain}; SameSite=Lax`
        }
      }
    }
  }
}

export async function resetAllDevStateAndCookies() {
  try {
    localStorage.clear()
  } catch {
    // ignore
  }
  try {
    sessionStorage.clear()
  } catch {
    // ignore
  }
  clearAllBrowserCookies()
  try {
    if (typeof indexedDB !== 'undefined' && typeof indexedDB.databases === 'function') {
      const dbs = await indexedDB.databases()
      await Promise.all(
        dbs
          .map(d => d.name)
          .filter((n): n is string => Boolean(n))
          .map(
            name =>
              new Promise<void>(resolve => {
                try {
                  const req = indexedDB.deleteDatabase(name)
                  req.onsuccess = () => resolve()
                  req.onerror = () => resolve()
                  req.onblocked = () => resolve()
                } catch {
                  resolve()
                }
              }),
          ),
      )
    }
  } catch {
    // ignore
  }
  if (typeof window !== 'undefined') {
    if (window.location.hash) {
      window.history.replaceState(null, '', window.location.pathname + window.location.search)
    }
    window.location.reload()
  }
}

export type LiveDevMetrics = {
  width: number
  height: number
  dpr: number
  fps: number
  domNodes: number
}

export function useLiveDevMetrics(enabled: boolean): LiveDevMetrics {
  const [metrics, setMetrics] = useState<LiveDevMetrics>(() => ({
    width: typeof window !== 'undefined' ? window.innerWidth : 1440,
    height: typeof window !== 'undefined' ? window.innerHeight : 900,
    dpr: typeof window !== 'undefined' ? Math.round((window.devicePixelRatio || 1) * 10) / 10 : 1,
    fps: 60,
    domNodes: typeof document !== 'undefined' ? document.getElementsByTagName('*').length : 0,
  }))

  useEffect(() => {
    if (!enabled || typeof window === 'undefined') return
    let raf = 0
    let frames = 0
    let lastSample = performance.now()
    let alive = true

    const onResize = () => {
      if (!alive) return
      setMetrics(prev => ({
        ...prev,
        width: window.innerWidth,
        height: window.innerHeight,
        dpr: Math.round((window.devicePixelRatio || 1) * 10) / 10,
      }))
    }

    const tick = (now: number) => {
      if (!alive) return
      frames++
      const dt = now - lastSample
      if (dt >= 400) {
        const fps = Math.max(1, Math.round((frames * 1000) / dt))
        frames = 0
        lastSample = now
        const domNodes = document.getElementsByTagName('*').length
        setMetrics(prev =>
          prev.fps === fps && prev.domNodes === domNodes
            ? prev
            : {
                ...prev,
                width: window.innerWidth,
                height: window.innerHeight,
                dpr: Math.round((window.devicePixelRatio || 1) * 10) / 10,
                fps,
                domNodes,
              },
        )
      }
      raf = requestAnimationFrame(tick)
    }

    window.addEventListener('resize', onResize, { passive: true })
    raf = requestAnimationFrame(tick)
    return () => {
      alive = false
      cancelAnimationFrame(raf)
      window.removeEventListener('resize', onResize)
    }
  }, [enabled])

  return metrics
}

export function DevMetricsMicroBar({ compact = false }: { compact?: boolean }) {
  const isDev = isDevEnvironment()
  const m = useLiveDevMetrics(isDev)
  if (!isDev) return null
  const fpsTone = m.fps >= 55 ? 'is-good' : m.fps >= 30 ? 'is-warn' : 'is-low'
  return (
    <div
      className={`dev-metrics-micro${compact ? ' is-compact' : ''}`}
      aria-label={`Viewport ${m.width} by ${m.height}, ${m.fps} frames per second`}
    >
      <span className={`dev-fps-dot ${fpsTone}`} aria-hidden="true" />
      <span>{m.fps} FPS</span>
      <span className="dev-metrics-sep" aria-hidden="true">·</span>
      <span>{m.width}×{m.height}</span>
      {!compact && (
        <>
          <span className="dev-metrics-sep" aria-hidden="true">·</span>
          <span>{m.dpr}x</span>
          <span className="dev-metrics-sep" aria-hidden="true">·</span>
          <span>{m.domNodes} DOM</span>
        </>
      )}
    </div>
  )
}

export function DevChannelBadge({ onOpenDiagnostics }: { onOpenDiagnostics?: () => void } = {}) {
  const version = (import.meta.env.VITE_RELEASE_TAG as string | undefined) || 'alpha'
  const [side, setSide] = useState<'left' | 'right'>('left')
  const swapCooldownRef = useRef(0)

  useEffect(() => {
    if (typeof document === 'undefined') return
    const prevTitle = document.title
    if (!prevTitle.startsWith('Syntax Dev · ')) {
      document.title = `Syntax Dev · ${prevTitle.replace(/^Dev · /, '')}`
    }
    return () => {
      if (document.title.startsWith('Syntax Dev · ')) {
        document.title = document.title.slice('Syntax Dev · '.length)
      }
    }
  }, [])

  const handleSwapSide = () => {
    const now = performance.now()
    if (now - swapCooldownRef.current < 260) return
    swapCooldownRef.current = now
    setSide(prev => (prev === 'left' ? 'right' : 'left'))
  }

  return (
    <div
      role="status"
      className={`dev-corner-pill is-${side}`}
      onPointerEnter={handleSwapSide}
      aria-label={`Syntax Dev build ${version}`}
    >
      <span className="dev-corner-dot" aria-hidden="true" />
      <span className="dev-corner-brand">
        Syntax <span className="dev-rainbow-text">Dev</span>
      </span>
      <span className="dev-corner-ver">{version}</span>
      {onOpenDiagnostics && (
        <button
          type="button"
          className="dev-reset-btn"
          style={{ marginLeft: 4, padding: '2px 8px', fontSize: 11, pointerEvents: 'auto' }}
          onClick={e => {
            e.stopPropagation()
            onOpenDiagnostics()
          }}
        >
          Diagnostics
        </button>
      )}
    </div>
  )
}
