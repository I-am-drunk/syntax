import { z } from 'zod'
import { satisfiesSemver } from '../manifest.ts'

export const NATIVE_EXTENSION_API_VERSION = '2.0.0'
export const MAX_NATIVE_ENTRY_BYTES = 2 * 1024 * 1024

const releaseVersion = /^(0|[1-9]\d*)\.(0|[1-9]\d*)\.(0|[1-9]\d*)$/
const apiRange = /^\^?(0|[1-9]\d*)\.(0|[1-9]\d*)\.(0|[1-9]\d*)$/

export const nativeManifestSchema = z.strictObject({
  manifestVersion: z.literal(2),
  id: z.string().max(100).regex(/^[a-z][a-z0-9-]+(?:\.[a-z][a-z0-9-]+)+$/),
  name: z.string().trim().min(1).max(80),
  version: z.string().regex(releaseVersion),
  syntaxApi: z.string().regex(apiRange),
  main: z.string().max(160).regex(/^(?:[a-zA-Z0-9_-]+\/)*[a-zA-Z0-9_-]+\.js$/),
  sha256: z.string().regex(/^[0-9a-f]{64}$/),
})

export type NativeManifest = z.infer<typeof nativeManifestSchema>

export class NativePackageError extends Error {
  readonly code: string

  constructor(code: string, message: string) {
    super(message)
    this.name = 'NativePackageError'
    this.code = code
  }
}

export function parseNativeManifest(input: unknown): NativeManifest {
  const result = nativeManifestSchema.safeParse(input)
  if (!result.success) {
    const issues = result.error.issues.map(issue =>
      `${issue.path.join('.') || 'manifest'}: ${issue.message}`,
    )
    throw new NativePackageError('MANIFEST_INVALID', issues.join('. '))
  }
  if (!satisfiesSemver(NATIVE_EXTENSION_API_VERSION, result.data.syntaxApi)) {
    throw new NativePackageError(
      'API_INCOMPATIBLE',
      `This extension requires Syntax API ${result.data.syntaxApi}. This build provides ${NATIVE_EXTENSION_API_VERSION}.`,
    )
  }
  return result.data
}

export function assertNativeEntrySize(size: number): void {
  if (size < 1 || size > MAX_NATIVE_ENTRY_BYTES) {
    throw new NativePackageError('ENTRY_SIZE', 'Build a JavaScript entry between 1 byte and 2 MiB.')
  }
}
