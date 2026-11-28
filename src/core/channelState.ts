const channel = import.meta.env?.VITE_CHANNEL
const pathname = typeof window !== 'undefined' ? window.location.pathname : ''
const pathChannel = /^\/syntax-dev(?:\/|$)/.test(pathname)
  ? 'dev'
  : /^\/syntax-beta(?:\/|$)/.test(pathname)
    ? 'beta'
    : /^\/syntax-infra(?:\/|$)/.test(pathname)
      ? 'preview'
      : null

const isolatedChannel = channel === 'beta' || channel === 'preview'
  ? channel
  : channel === 'dev'
    ? 'dev'
    : channel !== 'stable' ? pathChannel : null

export const channelStatePrefix = isolatedChannel ? `syntax-${isolatedChannel}-` : ''

export function channelStateKey(key: string): string {
  return channelStatePrefix + key
}
