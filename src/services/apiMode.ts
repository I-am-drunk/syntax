let backendDisabled = false

/**
 * Syntax runs as a static SPA on GitHub Pages and Vite preview unless an API
 * backend is explicitly enabled via VITE_API_ENABLED=true.
 */
export function isBackendApiEnabled(): boolean {
  if (backendDisabled) return false
  return import.meta.env.VITE_API_ENABLED === 'true'
}

export function markBackendApiUnavailable(): void {
  backendDisabled = true
}

export function isJsonResponse(response: Response): boolean {
  const ct = response.headers.get('content-type') || ''
  return ct.toLowerCase().includes('application/json')
}
