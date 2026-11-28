import { NativePackageError } from './manifest.ts'
import type { NativeAuthorization } from './host.ts'
import type { NativePackage } from './package.ts'

type NativeMode = 'hosted-dev' | 'local-dev' | 'disabled'
type NativePin = { sourceUrl: string; manifest: NativePackage['manifest'] }

// Reviewed official builds from syntax-platform/syntax-official-extensions.
const devPins: readonly NativePin[] = [
  {
    // syntax-platform/syntax-official-extensions#1
    sourceUrl: 'https://raw.githubusercontent.com/syntax-platform/syntax-official-extensions/e5bc14968853daaf75e170917f8d7d53ffa95366/fixtures/native-foundation/v1/manifest.json',
    manifest: {
      manifestVersion: 2,
      id: 'example.native-fixture',
      name: 'Native fixture',
      version: '1.0.0',
      syntaxApi: '^2.0.0',
      main: 'main.js',
      sha256: 'b9710bcf205b5a500c12cbf0b0fd1365abc5fd87c210abfdb4b47973031edfda',
    },
  },
  {
    // syntax-platform/syntax-official-extensions#2
    sourceUrl: 'https://raw.githubusercontent.com/syntax-platform/syntax-official-extensions/1a75b19f4d92721ccfde255db28020e988616f17/extensions/quick-notes/releases/v1.0.0/manifest.json',
    manifest: {
      manifestVersion: 2,
      id: 'syntax.quick-notes',
      name: 'Quick Notes',
      version: '1.0.0',
      syntaxApi: '^2.0.0',
      main: 'main.js',
      sha256: 'ae6eef5e84b536df8caa7ee226f70f61801ed5cbde15e127d363d3a60bc36794',
    },
  },
  {
    // syntax-platform/syntax-official-extensions#3
    sourceUrl: 'https://raw.githubusercontent.com/syntax-platform/syntax-official-extensions/a35f7bc9ad5eaacfe1c5f6b1fba2bcb130ff4dd7/extensions/quick-notes/releases/v1.0.1/manifest.json',
    manifest: {
      manifestVersion: 2,
      id: 'syntax.quick-notes',
      name: 'Quick Notes',
      version: '1.0.1',
      syntaxApi: '^2.0.0',
      main: 'main.js',
      sha256: 'd28fb85849e4b3d832b6af5f74c2c01e90b4e6a6855eddff51f4af8d89c7fa14',
    },
  },
]
export const hasHostedNativePackages = devPins.length > 0

export function nativeMode(channel: string | undefined, development: boolean, location: URL): NativeMode {
  if (location.origin === 'https://syntax-platform.github.io') {
    if (channel === 'dev' && /^\/syntax-dev(?:\/|$)/.test(location.pathname)) return 'hosted-dev'
    if (channel === 'beta' && /^\/syntax-beta(?:\/|$)/.test(location.pathname)) return 'hosted-dev'
    if (channel === 'preview' && /^\/syntax-infra\/pr-\d+(?:\/|$)/.test(location.pathname)) return 'hosted-dev'
    return 'disabled'
  }
  if (!/^\/syntax-dev(?:\/|$)/.test(location.pathname)) return 'disabled'
  const loopback = ['127.0.0.1', 'localhost', '[::1]'].includes(location.hostname)
  if (channel === undefined && development && loopback) return 'local-dev'
  return 'disabled'
}

export function createNativeDevAuthorization(mode: NativeMode, pins = devPins): NativeAuthorization {
  const isApprovedPackage = (pkg: NativePackage) =>
    pkg.sourceUrl.startsWith('https://') && pins.some(pin =>
      pin.sourceUrl === pkg.sourceUrl &&
      Object.entries(pin.manifest).every(([key, value]) =>
        pkg.manifest[key as keyof NativePin['manifest']] === value),
    )

  return {
    checkSource(source) {
      if (mode === 'local-dev' || mode === 'hosted-dev' && source.startsWith('https://') &&
        pins.some(pin => pin.sourceUrl === source)) return
      throw new NativePackageError('PACKAGE_UNAPPROVED', 'This source is not approved for this Syntax build.')
    },
    checkPackage(pkg) {
      if (mode === 'local-dev') return
      if (mode === 'hosted-dev' && isApprovedPackage(pkg)) return
      throw new NativePackageError('PACKAGE_UNAPPROVED', 'This package is not approved for this Syntax build.')
    },
    allowSourceChange(previousSource, nextPkg) {
      if (mode !== 'hosted-dev') return false
      const prevApproved = pins.some(pin => pin.sourceUrl === previousSource && pin.manifest.id === nextPkg.manifest.id)
      return prevApproved && isApprovedPackage(nextPkg)
    },
  }
}
