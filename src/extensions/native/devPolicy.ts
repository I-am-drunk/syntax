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
  {
    // syntax-platform/syntax-official-extensions#5
    sourceUrl: 'https://raw.githubusercontent.com/syntax-platform/syntax-official-extensions/a43fb295e5af1b6a003bf71d3015038066df7c13/extensions/analytic-geometry-mpm2d/releases/v1.0.1/manifest.json',
    manifest: {
      manifestVersion: 2,
      id: 'syntax.mpm2d-analytic-geometry',
      name: 'Analytic Geometry (MPM2D)',
      version: '1.0.1',
      syntaxApi: '^2.0.0',
      main: 'main.js',
      sha256: 'a18df6e42e1c0fcc54482732dd5aeed34421115dfe76a450d26fcb96b5293553',
    },
  },
  {
    // syntax-platform/syntax-official-extensions#7
    sourceUrl: 'https://raw.githubusercontent.com/syntax-platform/syntax-official-extensions/fcf313f56cb82141603a012780b674286b3aef87/extensions/analytic-geometry-mpm2d/releases/v1.1.0/manifest.json',
    manifest: {
      manifestVersion: 2,
      id: 'syntax.mpm2d-analytic-geometry',
      name: 'Analytic Geometry (MPM2D)',
      version: '1.1.0',
      syntaxApi: '^2.0.0',
      main: 'main.js',
      sha256: '220336d91714b4c75a179de2f2808a39fa02f051a656ae986d8da4f88c1b4e75',
    },
  },
  {
    // syntax-platform/syntax-official-extensions#5
    sourceUrl: 'https://raw.githubusercontent.com/syntax-platform/syntax-official-extensions/a43fb295e5af1b6a003bf71d3015038066df7c13/extensions/binary-basics/releases/v1.0.1/manifest.json',
    manifest: {
      manifestVersion: 2,
      id: 'syntax.binary-basics',
      name: 'Binary & Logic Basics',
      version: '1.0.1',
      syntaxApi: '^2.0.0',
      main: 'main.js',
      sha256: '002dc701e629480abeb9de0b304fac1fb4ffded6f2070d0f2e543553a2237141',
    },
  },
  {
    // syntax-platform/syntax-official-extensions#6
    sourceUrl: 'https://raw.githubusercontent.com/syntax-platform/syntax-official-extensions/b95da21145bc80361597001b1f480606067e9bea/extensions/formula-playbook/releases/v1.0.0/manifest.json',
    manifest: {
      manifestVersion: 2,
      id: 'syntax.formula-playbook',
      name: 'Formula Playbook',
      version: '1.0.0',
      syntaxApi: '^2.0.0',
      main: 'main.js',
      sha256: '4ceb76b5fda02dcfe3860131572fa4c25b185ced358b3bb89b6c30aec0495429',
    },
  },
  {
    // syntax-platform/syntax-official-extensions#6
    sourceUrl: 'https://raw.githubusercontent.com/syntax-platform/syntax-official-extensions/b95da21145bc80361597001b1f480606067e9bea/extensions/warm-paper-theme/releases/v1.0.0/manifest.json',
    manifest: {
      manifestVersion: 2,
      id: 'syntax.warm-paper-theme',
      name: 'Warm Paper Theme',
      version: '1.0.0',
      syntaxApi: '^2.0.0',
      main: 'main.js',
      sha256: '1eb5d9c33aad740295fef153e82651734fb3197e9c132997c77d06f275268601',
    },
  },
  {
    // syntax-platform/syntax-official-extensions#8
    sourceUrl: 'https://raw.githubusercontent.com/syntax-platform/syntax-official-extensions/1ed1a144af4980f676174be6da41baa85f6c404d/fixtures/authoring-examples/course/v1.0.0/manifest.json',
    manifest: {
      manifestVersion: 2,
      id: 'syntax.authoring-course',
      name: 'Growing Patterns',
      version: '1.0.0',
      syntaxApi: '^2.0.0',
      main: 'main.js',
      sha256: '1250b8b1460bc2e29c2c56e054f1254da3f9a9eed81e68137033868ed7c18a31',
    },
  },
  {
    // syntax-platform/syntax-official-extensions#8
    sourceUrl: 'https://raw.githubusercontent.com/syntax-platform/syntax-official-extensions/1ed1a144af4980f676174be6da41baa85f6c404d/fixtures/authoring-examples/course/v1.1.0/manifest.json',
    manifest: {
      manifestVersion: 2,
      id: 'syntax.authoring-course',
      name: 'Growing Patterns',
      version: '1.1.0',
      syntaxApi: '^2.0.0',
      main: 'main.js',
      sha256: '08082a6450bd370ab85ea9ed7fb850392815af58cc37820402495326ad2a48ef',
    },
  },
  {
    // syntax-platform/syntax-official-extensions#8
    sourceUrl: 'https://raw.githubusercontent.com/syntax-platform/syntax-official-extensions/1ed1a144af4980f676174be6da41baa85f6c404d/fixtures/authoring-examples/tool/v1.0.0/manifest.json',
    manifest: {
      manifestVersion: 2,
      id: 'syntax.authoring-tool',
      name: 'Starter Tool',
      version: '1.0.0',
      syntaxApi: '^2.0.0',
      main: 'main.js',
      sha256: 'b9710bcf205b5a500c12cbf0b0fd1365abc5fd87c210abfdb4b47973031edfda',
    },
  },
  {
    // syntax-platform/syntax-official-extensions#8
    sourceUrl: 'https://raw.githubusercontent.com/syntax-platform/syntax-official-extensions/1ed1a144af4980f676174be6da41baa85f6c404d/fixtures/authoring-examples/tool/v1.1.0/manifest.json',
    manifest: {
      manifestVersion: 2,
      id: 'syntax.authoring-tool',
      name: 'Starter Tool',
      version: '1.1.0',
      syntaxApi: '^2.0.0',
      main: 'main.js',
      sha256: 'c00ae3152b46c596ff323909aa986f94cd112745acfe29f8532d245ed652d0d6',
    },
  },
]
export const approvedNativeDevPins: readonly NativePin[] = devPins
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
