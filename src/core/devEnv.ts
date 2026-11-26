export function isDevEnvironment(): boolean {
  if (import.meta.env.VITE_CHANNEL === 'dev' || import.meta.env.DEV) return true
  if (typeof window !== 'undefined') {
    const host = window.location.hostname
    const path = window.location.pathname
    if (
      host === '127.0.0.1' ||
      host === 'localhost' ||
      host.startsWith('10.') ||
      host.startsWith('192.168.') ||
      host.startsWith('100.') ||
      path.startsWith('/dev') ||
      path.includes('/dev/')
    ) {
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
  if (
    typeof window !== 'undefined' &&
    window.location.pathname &&
    window.location.pathname !== '/'
  ) {
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
