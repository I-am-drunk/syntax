const IPV4_PRIVATE_10 = /^10\.\d{1,3}\.\d{1,3}\.\d{1,3}$/
const IPV4_PRIVATE_192 = /^192\.168\.\d{1,3}\.\d{1,3}$/
const IPV4_CGNAT_100 = /^100\.(6[4-9]|[7-9]\d|1[01]\d|12[0-7])\.\d{1,3}\.\d{1,3}$/

export function isDevEnvironment(): boolean {
  if (import.meta.env.VITE_CHANNEL === 'dev' || import.meta.env.DEV) return true
  if (typeof window !== 'undefined') {
    const host = window.location.hostname
    const path = window.location.pathname
    if (
      host === '127.0.0.1' ||
      host === 'localhost' ||
      IPV4_PRIVATE_10.test(host) ||
      IPV4_PRIVATE_192.test(host) ||
      IPV4_CGNAT_100.test(host) ||
      path === '/dev' ||
      path.startsWith('/dev/') ||
      path.endsWith('/dev') ||
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
  const isHttps = typeof window !== 'undefined' && window.location.protocol === 'https:'
  const hostParts = hostname.split('.')
  const pathSet = new Set<string>(['/'])
  if (typeof window !== 'undefined' && window.location.pathname) {
    const segments = window.location.pathname.split('/').filter(Boolean)
    let acc = ''
    for (const seg of segments) {
      acc += `/${seg}`
      pathSet.add(acc)
      pathSet.add(`${acc}/`)
    }
  }
  const paths = [...pathSet]
  const secureVariants = isHttps ? ['', '; Secure'] : ['']

  for (const raw of cookies) {
    const eq = raw.indexOf('=')
    const name = (eq >= 0 ? raw.slice(0, eq) : raw).trim()
    if (!name) continue
    for (const p of paths) {
      for (const sec of secureVariants) {
        document.cookie = `${name}=; expires=Thu, 01 Jan 1970 00:00:00 GMT; max-age=0; path=${p}; SameSite=Lax${sec}`
        if (hostname) {
          document.cookie = `${name}=; expires=Thu, 01 Jan 1970 00:00:00 GMT; max-age=0; path=${p}; domain=${hostname}; SameSite=Lax${sec}`
          if (hostParts.length >= 2) {
            const rootDomain = `.${hostParts.slice(-2).join('.')}`
            document.cookie = `${name}=; expires=Thu, 01 Jan 1970 00:00:00 GMT; max-age=0; path=${p}; domain=${rootDomain}; SameSite=Lax${sec}`
          }
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
