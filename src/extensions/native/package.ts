import {
  assertNativeEntrySize,
  MAX_NATIVE_ENTRY_BYTES,
  NativePackageError,
  parseNativeManifest,
  type NativeManifest,
} from './manifest.ts'

const MAX_MANIFEST_BYTES = 16 * 1024

export interface NativePackage {
  sourceUrl: string
  manifest: NativeManifest
  entry: string
}

function parseSourceUrl(input: string): URL {
  let url
  try {
    url = new URL(input)
  } catch {
    throw new NativePackageError('SOURCE_URL', 'Enter a complete URL to the extension manifest.')
  }
  const loopback = url.hostname === 'localhost' || url.hostname === '127.0.0.1' || url.hostname === '[::1]'
  if ((url.protocol !== 'https:' && !(loopback && url.protocol === 'http:')) || url.username || url.password || url.hash) {
    throw new NativePackageError('SOURCE_URL', 'Use an HTTPS manifest URL, or HTTP on localhost for testing.')
  }
  return url
}

async function download(url: URL, limit: number, fetcher: typeof fetch): Promise<Uint8Array<ArrayBuffer>> {
  try {
    const response = await fetcher(url, {
      credentials: 'omit',
      redirect: 'error',
      signal: AbortSignal.timeout(10_000),
    })
    if (!response.ok || !response.body) {
      throw new NativePackageError('DOWNLOAD_FAILED', `Could not read ${url.pathname} (HTTP ${response.status}).`)
    }
    const reader = response.body.getReader()
    const chunks: Uint8Array[] = []
    let size = 0
    try {
      for (;;) {
        const { done, value } = await reader.read()
        if (done) break
        size += value.byteLength
        if (size > limit) {
          await reader.cancel().catch(() => undefined)
          throw new NativePackageError('DOWNLOAD_SIZE', `${url.pathname} exceeds the ${limit}-byte limit.`)
        }
        chunks.push(value)
      }
    } finally {
      reader.releaseLock()
    }
    const bytes = new Uint8Array(size)
    let offset = 0
    for (const chunk of chunks) {
      bytes.set(chunk, offset)
      offset += chunk.byteLength
    }
    return bytes
  } catch (error) {
    if (error instanceof NativePackageError) throw error
    throw new NativePackageError('DOWNLOAD_FAILED', `Could not download ${url.pathname}. Check the URL and hosting permissions.`)
  }
}

export async function downloadNativePackage(source: string, fetcher: typeof fetch = fetch): Promise<NativePackage> {
  const url = parseSourceUrl(source)
  const manifestBytes = await download(url, MAX_MANIFEST_BYTES, fetcher)
  const decoder = new TextDecoder('utf-8', { fatal: true })
  let input: unknown
  try {
    input = JSON.parse(decoder.decode(manifestBytes))
  } catch {
    throw new NativePackageError('MANIFEST_INVALID', 'The extension manifest must be valid UTF-8 JSON.')
  }
  const manifest = parseNativeManifest(input)
  const entryUrl = new URL(manifest.main, url)
  const entryBytes = await download(entryUrl, MAX_NATIVE_ENTRY_BYTES, fetcher)
  assertNativeEntrySize(entryBytes.byteLength)
  const digest = new Uint8Array(await crypto.subtle.digest('SHA-256', entryBytes))
  const hex = Array.from(digest, byte => byte.toString(16).padStart(2, '0')).join('')
  if (hex !== manifest.sha256) {
    throw new NativePackageError('ENTRY_HASH_MISMATCH', 'The downloaded JavaScript does not match its manifest.')
  }
  try {
    return { sourceUrl: url.href, manifest, entry: decoder.decode(entryBytes) }
  } catch {
    throw new NativePackageError('ENTRY_INVALID', 'The JavaScript entry must be valid UTF-8.')
  }
}
