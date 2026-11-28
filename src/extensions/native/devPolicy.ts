import { NativePackageError } from './manifest.ts'
import type { NativeAuthorization } from './host.ts'
import type { NativePackage } from './package.ts'

type NativeMode = 'hosted-dev' | 'local-dev' | 'disabled'
type NativePin = { sourceUrl: string; manifest: NativePackage['manifest'] }

// Add an entry only after reviewing the exact executable artifact.
const devPins: readonly NativePin[] = []
export const hasHostedNativePackages = devPins.length > 0

export function nativeMode(channel: string | undefined, development: boolean, location: URL): NativeMode {
  if (!/^\/syntax-dev(?:\/|$)/.test(location.pathname)) return 'disabled'
  if (channel === 'dev' && location.origin === 'https://syntax-platform.github.io') return 'hosted-dev'
  const loopback = ['127.0.0.1', 'localhost', '[::1]'].includes(location.hostname)
  if (channel === undefined && development && loopback) return 'local-dev'
  return 'disabled'
}

export function createNativeDevAuthorization(mode: NativeMode, pins = devPins): NativeAuthorization {
  return {
    checkSource(source) {
      if (mode === 'local-dev' || mode === 'hosted-dev' && source.startsWith('https://') &&
        pins.some(pin => pin.sourceUrl === source)) return
      throw new NativePackageError('PACKAGE_UNAPPROVED', 'This source is not approved for this Syntax build.')
    },
    checkPackage(pkg) {
      if (mode === 'local-dev') return
      if (mode === 'hosted-dev' && pkg.sourceUrl.startsWith('https://') && pins.some(pin =>
        pin.sourceUrl === pkg.sourceUrl &&
        Object.entries(pin.manifest).every(([key, value]) =>
          pkg.manifest[key as keyof NativePin['manifest']] === value),
      )) return
      throw new NativePackageError('PACKAGE_UNAPPROVED', 'This package is not approved for this Syntax build.')
    },
  }
}
