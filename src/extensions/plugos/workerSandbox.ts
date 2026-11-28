/**
 * PlugOS-adapted Web Worker sandbox for Syntax Extensions v1.
 * Adapted from SilverBullet PlugOS `worker_sandbox.ts` and `worker_runtime.ts` (MIT).
 *
 * Key properties:
 * - Two-Blob ESM bootstrap: host fetches cross-origin `worker.js`, wraps in a
 *   same-origin Blob module with `//# sourceURL=`, and dynamically imports it
 *   inside a tiny host bootstrap worker. Authors write plain ESM exports with
 *   zero build tools.
 * - Instant startup error reporting (<50ms) on syntax/eval/activate failure.
 * - `stop()` terminates the worker immediately and rejects every outstanding
 *   invocation with `ExtensionError('WORKER_STOPPED', 'Plug sandbox stopped')`.
 * - Non-cloneable console arguments and return values are sanitized safely.
 */

import {
  ExtensionError,
  type HostToWorkerMessage,
  type SerializedError,
  type WorkerLogLevel,
  type WorkerToHostMessage,
} from './protocol.ts'

const DEFAULT_BOOT_TIMEOUT_MS = 10_000
const MAX_WORKER_BYTES = 2 * 1024 * 1024
const MAX_IN_FLIGHT_SYSCALLS = 64

/**
 * Rewrites relative ES module specifiers (`./`, `../`, `/`) inside a fetched worker script
 * into absolute same-origin URLs against `workerUrl`, allowing multi-file and multi-chunk
 * plugins to run cleanly inside a Blob-backed module Worker.
 * Skips comments and non-import strings so literal data is never altered.
 */
export function rewriteWorkerRelativeImports(source: string, workerUrl: string): string {
  let base: URL
  try {
    base = new URL(workerUrl)
  } catch {
    return source
  }

  const resolveRel = (specifier: string): string => {
    if (
      !specifier.startsWith('./') &&
      !specifier.startsWith('../') &&
      !specifier.startsWith('/')
    ) {
      return specifier
    }
    try {
      const resolved = new URL(specifier, base)
      if (resolved.origin !== base.origin) return specifier
      if (resolved.protocol !== 'http:' && resolved.protocol !== 'https:') return specifier
      return resolved.href
    } catch {
      return specifier
    }
  }

  // Mask comments & template/string spans only to find exact rewrite ranges safely
  const len = source.length
  const out: string[] = []
  let cursor = 0
  let i = 0

  const isIdentChar = (ch: string) => /[A-Za-z0-9_$]/.test(ch)
  const skipWsAndComments = (pos: number): number => {
    let p = pos
    while (p < len) {
      const c = source[p]!
      if (c === ' ' || c === '\t' || c === '\n' || c === '\r') {
        p += 1
        continue
      }
      if (c === '/' && source[p + 1] === '/') {
        p += 2
        while (p < len && source[p] !== '\n') p += 1
        continue
      }
      if (c === '/' && source[p + 1] === '*') {
        p += 2
        while (p < len - 1 && !(source[p] === '*' && source[p + 1] === '/')) p += 1
        p = Math.min(len, p + 2)
        continue
      }
      break
    }
    return p
  }

  const readStringLiteral = (pos: number): { end: number; quote: string; value: string } | null => {
    const quote = source[pos]
    if (quote !== '"' && quote !== "'") return null
    let p = pos + 1
    let val = ''
    while (p < len) {
      const ch = source[p]!
      if (ch === '\\') {
        if (p + 1 < len) {
          val += source[p + 1]
          p += 2
          continue
        }
        return null
      }
      if (ch === quote) {
        return { end: p + 1, quote, value: val }
      }
      if (ch === '\n' || ch === '\r') return null
      val += ch
      p += 1
    }
    return null
  }

  while (i < len) {
    const ch = source[i]!

    // Skip single-line comments
    if (ch === '/' && source[i + 1] === '/') {
      i += 2
      while (i < len && source[i] !== '\n') i += 1
      continue
    }
    // Skip block comments
    if (ch === '/' && source[i + 1] === '*') {
      i += 2
      while (i < len - 1 && !(source[i] === '*' && source[i + 1] === '/')) i += 1
      i = Math.min(len, i + 2)
      continue
    }
    // Skip string & template literals (not preceded by import/from)
    if (ch === '"' || ch === "'" || ch === '`') {
      const quote = ch
      i += 1
      while (i < len) {
        if (source[i] === '\\') {
          i += 2
          continue
        }
        if (source[i] === quote) {
          i += 1
          break
        }
        i += 1
      }
      continue
    }

    // Match keyword `from` or `import` at word boundary (not preceded by `.`)
    if (
      (source.startsWith('from', i) || source.startsWith('import', i)) &&
      (i === 0 || (!isIdentChar(source[i - 1]!) && source[i - 1] !== '.'))
    ) {
      const isFrom = source.startsWith('from', i)
      const kwLen = isFrom ? 4 : 6
      const afterKw = i + kwLen
      if (afterKw < len && isIdentChar(source[afterKw]!)) {
        i += 1
        continue
      }

      const nextPos = skipWsAndComments(afterKw)
      if (isFrom) {
        // `... from './rel.js'`
        const lit = readStringLiteral(nextPos)
        if (lit) {
          const rewritten = resolveRel(lit.value)
          if (rewritten !== lit.value) {
            out.push(source.slice(cursor, nextPos), `${lit.quote}${rewritten}${lit.quote}`)
            cursor = lit.end
          }
          i = lit.end
          continue
        }
      } else {
        // Bare `import './side-effect.js'` OR dynamic `import('./chunk.js')`
        if (source[nextPos] === '"' || source[nextPos] === "'") {
          const lit = readStringLiteral(nextPos)
          if (lit) {
            const rewritten = resolveRel(lit.value)
            if (rewritten !== lit.value) {
              out.push(source.slice(cursor, nextPos), `${lit.quote}${rewritten}${lit.quote}`)
              cursor = lit.end
            }
            i = lit.end
            continue
          }
        } else if (source[nextPos] === '(') {
          const argPos = skipWsAndComments(nextPos + 1)
          const lit = readStringLiteral(argPos)
          if (lit) {
            const afterLit = skipWsAndComments(lit.end)
            if (source[afterLit] === ')' || source[afterLit] === ',') {
              const rewritten = resolveRel(lit.value)
              if (rewritten !== lit.value) {
                out.push(source.slice(cursor, argPos), `${lit.quote}${rewritten}${lit.quote}`)
                cursor = lit.end
              }
              i = lit.end
              continue
            }
          }
        }
      }
      i = afterKw
      continue
    }

    i += 1
  }

  if (cursor === 0) return source
  out.push(source.slice(cursor))
  return out.join('')
}

export interface WorkerSandboxCallbacks {
  onSyscall: (
    extensionId: string,
    activationId: string,
    name: string,
    args: unknown[],
  ) => Promise<unknown>
  onLog: (
    extensionId: string,
    activationId: string,
    level: WorkerLogLevel,
    message: string,
    detail?: string,
  ) => void
  onRuntimeError?: (extensionId: string, activationId: string, error: SerializedError) => void
  onBlobCountChange?: (delta: number) => void
  onWorkerCountChange?: (delta: number) => void
}

export interface WorkerSandboxOptions {
  extensionId: string
  version: string
  activationId: string
  workerUrl: string
  baseUrl: string
  bootTimeoutMs?: number
  callbacks: WorkerSandboxCallbacks
}

/**
 * Self-contained module worker bootstrap script.
 * Runs inside `new Worker(bootstrapBlobUrl, { type: 'module' })`.
 */
const WORKER_BOOTSTRAP_SOURCE = `
let mod = null;
let extMeta = null;
let syscallSeq = 0;
const pendingSyscalls = new Map();

function sanitize(val, seen = new WeakSet(), depth = 0) {
  if (val === null || val === undefined) return val;
  const t = typeof val;
  if (t === 'string' || t === 'number' || t === 'boolean') return val;
  if (t === 'function') return '[Function ' + (val.name || 'anonymous') + ']';
  if (t === 'symbol') return val.toString();
  if (t === 'bigint') return val.toString() + 'n';
  if (val instanceof Error) {
    return { __error: true, name: val.name || 'Error', message: val.message || String(val), stack: val.stack };
  }
  if (depth >= 6) return '[MaxDepth]';
  if (seen.has(val)) return '[Circular]';
  seen.add(val);
  if (Array.isArray(val)) {
    return val.slice(0, 100).map((item) => sanitize(item, seen, depth + 1));
  }
  const out = {};
  for (const key of Object.keys(val).slice(0, 60)) {
    try {
      out[key] = sanitize(val[key], seen, depth + 1);
    } catch {
      out[key] = '[Unreadable]';
    }
  }
  return out;
}

function serializeErr(err) {
  if (err instanceof Error) {
    return { name: err.name || 'Error', message: err.message || String(err), stack: err.stack };
  }
  if (err && typeof err === 'object' && typeof err.message === 'string') {
    return { name: typeof err.name === 'string' ? err.name : 'Error', message: err.message, stack: typeof err.stack === 'string' ? err.stack : undefined };
  }
  return { name: 'Error', message: String(err) };
}

for (const level of ['debug', 'info', 'log', 'warn', 'error']) {
  const orig = console[level] ? console[level].bind(console) : () => {};
  const mapped = level === 'log' ? 'info' : level;
  console[level] = (...args) => {
    orig(...args);
    const hasErr = args.some((a) => a instanceof Error);
    const stack = !hasErr && (mapped === 'warn' || mapped === 'error')
      ? (new Error().stack || '').split('\\n').slice(2).join('\\n')
      : undefined;
    try {
      self.postMessage({ type: 'log', level: mapped, args: args.map((a) => sanitize(a)), stack });
    } catch {
      // ignore console transport failures
    }
  };
}

self.addEventListener('error', (ev) => {
  self.postMessage({
    type: 'runtime-error',
    error: serializeErr(ev.error || new Error(ev.message || 'Uncaught worker error')),
  });
});

self.addEventListener('unhandledrejection', (ev) => {
  self.postMessage({
    type: 'runtime-error',
    error: serializeErr(ev.reason),
  });
});

function syscall(name, ...args) {
  return new Promise((resolve, reject) => {
    const id = ++syscallSeq;
    pendingSyscalls.set(id, { resolve, reject });
    try {
      self.postMessage({ type: 'sys', id, name, args });
    } catch (err) {
      pendingSyscalls.delete(id);
      reject(new Error('Syscall arguments could not be cloned: ' + (err?.message || String(err))));
    }
  });
}

function createCtx(meta) {
  const assetUrl = (relPath) => {
    const resolved = new URL(String(relPath), meta.baseUrl);
    if (resolved.protocol !== 'http:' && resolved.protocol !== 'https:') {
      throw new Error('Disallowed asset URL protocol: ' + resolved.protocol);
    }
    return resolved.href;
  };
  const ctx = {
    extension: Object.freeze({
      id: meta.id,
      version: meta.version,
      baseUrl: meta.baseUrl,
      activationId: meta.activationId,
      assetUrl,
    }),
    syscall,
    services: Object.freeze({
      call: (serviceName, method, ...args) => syscall('services.call', serviceName, method, args),
      has: (serviceName) => syscall('services.has', serviceName),
    }),
    documents: Object.freeze({
      get: (id) => syscall('documents.get', id),
      list: (type) => syscall('documents.list', type),
      create: (input) => syscall('documents.create', input),
      save: (input) => syscall('documents.save', input),
    }),
    settings: Object.freeze({
      get: (key) => syscall('settings.get', key),
      set: (key, value) => syscall('settings.set', key, value),
      getAll: () => syscall('settings.getAll'),
    }),
    ui: Object.freeze({
      notify: (message, kind) => syscall('ui.notify', message, kind),
      openView: (viewId, docId) => syscall('ui.openView', viewId, docId),
    }),
    log: Object.freeze({
      debug: (...args) => console.debug(...args),
      info: (...args) => console.info(...args),
      warn: (...args) => console.warn(...args),
      error: (...args) => console.error(...args),
    }),
  };
  return Object.freeze(ctx);
}

self.onmessage = async (ev) => {
  const msg = ev.data;
  if (!msg || typeof msg !== 'object') return;

  if (msg.type === 'boot') {
    self.postMessage({ type: 'boot-started' });
    extMeta = msg.extensionMeta;
    const ctx = createCtx(extMeta);
    try {
      Object.defineProperty(globalThis, 'syntax', { value: ctx, writable: false, configurable: false });
    } catch {
      // already defined
    }
    try {
      mod = await import(msg.moduleBlobUrl);
    } catch (err) {
      const ser = serializeErr(err);
      if (err instanceof TypeError && /relative|hierarchical|module specifier/i.test(ser.message)) {
        ser.message += ' (Hint: relative ES imports are unsupported inside Blob Workers. Inline helpers into worker.js, use absolute CORS URLs, or bundle.)';
      }
      self.postMessage({ type: 'boot-error', phase: 'parse', error: ser });
      return;
    }

    const functions = Object.entries(mod)
      .filter(([, value]) => typeof value === 'function')
      .map(([key]) => key);
    self.postMessage({ type: 'boot-imported', functions });

    if (typeof mod.onActivate === 'function') {
      try {
        await Promise.resolve(mod.onActivate(ctx));
      } catch (err) {
        self.postMessage({ type: 'boot-error', phase: 'activate', error: serializeErr(err) });
        return;
      }
    }

    self.postMessage({ type: 'boot-ok', functions });
    return;
  }

  if (msg.type === 'inv') {
    try {
      const fn = mod && mod[msg.name];
      if (typeof fn !== 'function') {
        throw new Error('Function not found: ' + msg.name);
      }
      const result = await Promise.resolve(fn(globalThis.syntax, ...(Array.isArray(msg.args) ? msg.args : [])));
      try {
        self.postMessage({ type: 'invr', id: msg.id, result });
      } catch (cloneErr) {
        try {
          self.postMessage({ type: 'invr', id: msg.id, result: sanitize(result) });
        } catch {
          self.postMessage({
            type: 'invr',
            id: msg.id,
            error: { name: 'DataCloneError', message: 'Return value could not be cloned: ' + (cloneErr?.message || String(cloneErr)), code: 'DATA_CLONE_ERROR' },
          });
        }
      }
    } catch (err) {
      self.postMessage({ type: 'invr', id: msg.id, error: serializeErr(err) });
    }
    return;
  }

  if (msg.type === 'sysr') {
    const pending = pendingSyscalls.get(msg.id);
    if (!pending) return;
    pendingSyscalls.delete(msg.id);
    if (msg.error) {
      const e = new Error(msg.error.message || 'Syscall failed');
      e.name = msg.error.name || 'Error';
      if (msg.error.code) e.code = msg.error.code;
      pending.reject(e);
    } else {
      pending.resolve(msg.result);
    }
    return;
  }

  if (msg.type === 'settings-changed') {
    if (mod && typeof mod.onSettingsChanged === 'function') {
      try {
        await Promise.resolve(mod.onSettingsChanged(globalThis.syntax, msg.settings || {}));
      } catch (err) {
        self.postMessage({ type: 'runtime-error', error: serializeErr(err) });
      }
    }
  }
};
`

function formatConsoleArgs(args: unknown[]): string {
  return args
    .map(arg => {
      if (typeof arg === 'string') return arg
      if (arg && typeof arg === 'object' && '__error' in (arg as Record<string, unknown>)) {
        const e = arg as { name?: string; message?: string }
        return `${e.name || 'Error'}: ${e.message || ''}`
      }
      try {
        return JSON.stringify(arg)
      } catch {
        return String(arg)
      }
    })
    .join(' ')
}

export class WorkerSandbox {
  readonly extensionId: string
  readonly version: string
  readonly activationId: string
  readonly workerUrl: string
  readonly baseUrl: string

  private readonly bootTimeoutMs: number
  private readonly callbacks: WorkerSandboxCallbacks
  private worker: Worker | null = null
  private ready = false
  private disposed = false
  private reqId = 0
  private inFlightSyscalls = 0
  private exportedFunctions: string[] = []
  private outstandingInvocations = new Map<
    number,
    { resolve: (result: unknown) => void; reject: (err: Error) => void }
  >()
  private bootPromise: Promise<string[]> | null = null
  private abortBoot: ((err: Error) => void) | null = null
  private abortFetch: (() => void) | null = null

  constructor(options: WorkerSandboxOptions) {
    this.extensionId = options.extensionId
    this.version = options.version
    this.activationId = options.activationId
    this.workerUrl = options.workerUrl
    this.baseUrl = options.baseUrl
    this.bootTimeoutMs = options.bootTimeoutMs ?? DEFAULT_BOOT_TIMEOUT_MS
    this.callbacks = options.callbacks
  }

  get isRunning(): boolean {
    return this.ready && this.worker !== null && !this.disposed
  }

  get functions(): readonly string[] {
    return this.exportedFunctions
  }

  /**
   * Fetch the worker ESM bundle with CORS, boot the Two-Blob sandbox,
   * run optional `onActivate(ctx)`, and resolve with exported function names.
   */
  async init(): Promise<string[]> {
    if (this.disposed) {
      throw new ExtensionError('WORKER_STOPPED', 'Plug sandbox stopped', {
        extensionId: this.extensionId,
      })
    }
    if (this.bootPromise) return this.bootPromise
    this.bootPromise = this.bootInternal()
    return this.bootPromise
  }

  private async bootInternal(): Promise<string[]> {
    const controller = new AbortController()
    this.abortFetch = () => controller.abort()
    const fetchTimer = globalThis.setTimeout(() => controller.abort(), this.bootTimeoutMs)
    let source: string
    try {
      const res = await fetch(this.workerUrl, {
        mode: 'cors',
        credentials: 'omit',
        cache: 'no-store',
        signal: controller.signal,
      })
      if (!res.ok) {
        throw new ExtensionError(
          'WORKER_FETCH_FAILED',
          `Failed to fetch worker (${res.status} ${res.statusText})`,
          { extensionId: this.extensionId, detail: this.workerUrl },
        )
      }
      const ct = (res.headers.get('content-type') || '').toLowerCase()
      if (ct.startsWith('text/html')) {
        throw new ExtensionError(
          'WORKER_FETCH_FAILED',
          'Worker URL returned HTML instead of JavaScript (check worker path or 404 fallback).',
          { extensionId: this.extensionId, detail: this.workerUrl },
        )
      }
      const declaredLen = Number(res.headers.get('content-length') || '0')
      if (declaredLen > MAX_WORKER_BYTES) {
        throw new ExtensionError(
          'WORKER_FETCH_FAILED',
          `Worker script exceeds maximum size (${Math.round(MAX_WORKER_BYTES / 1024)} KB).`,
          { extensionId: this.extensionId },
        )
      }
      source = await res.text()
      if (source.length > MAX_WORKER_BYTES) {
        throw new ExtensionError(
          'WORKER_FETCH_FAILED',
          `Worker script exceeds maximum size (${Math.round(MAX_WORKER_BYTES / 1024)} KB).`,
          { extensionId: this.extensionId },
        )
      }
    } catch (err) {
      if (this.disposed) {
        throw new ExtensionError('WORKER_STOPPED', 'Plug sandbox stopped', {
          extensionId: this.extensionId,
        })
      }
      this.disposed = true
      if (err instanceof ExtensionError) throw err
      const isAbort = err instanceof DOMException && err.name === 'AbortError'
      throw new ExtensionError(
        isAbort ? 'WORKER_BOOT_TIMEOUT' : 'WORKER_FETCH_FAILED',
        isAbort
          ? `Fetching worker timed out after ${this.bootTimeoutMs}ms.`
          : `Could not fetch worker from ${this.workerUrl} (check CORS header Access-Control-Allow-Origin: *).`,
        { extensionId: this.extensionId, cause: err },
      )
    } finally {
      globalThis.clearTimeout(fetchTimer)
      this.abortFetch = null
    }

    if (this.disposed) {
      throw new ExtensionError('WORKER_STOPPED', 'Plug sandbox stopped', {
        extensionId: this.extensionId,
      })
    }

    const safeSourceUrl = this.workerUrl.replace(/[\r\n]/g, '')
    const rewrittenSource = rewriteWorkerRelativeImports(source, this.workerUrl)
    const annotatedSource = `${rewrittenSource}\n//# sourceURL=${safeSourceUrl}\n`
    const moduleBlobUrl = URL.createObjectURL(
      new Blob([annotatedSource], { type: 'text/javascript' }),
    )
    const bootstrapBlobUrl = URL.createObjectURL(
      new Blob([WORKER_BOOTSTRAP_SOURCE], { type: 'text/javascript' }),
    )
    this.callbacks.onBlobCountChange?.(2)

    let bootRevoked = false
    let modRevoked = false
    const revokeBoot = () => {
      if (!bootRevoked) {
        bootRevoked = true
        URL.revokeObjectURL(bootstrapBlobUrl)
        this.callbacks.onBlobCountChange?.(-1)
      }
    }
    const revokeMod = () => {
      if (!modRevoked) {
        modRevoked = true
        URL.revokeObjectURL(moduleBlobUrl)
        this.callbacks.onBlobCountChange?.(-1)
      }
    }
    const revokeAll = () => {
      revokeBoot()
      revokeMod()
    }

    let worker: Worker
    try {
      worker = new Worker(bootstrapBlobUrl, { type: 'module', name: `syntax-ext:${this.extensionId}` })
    } catch (err) {
      revokeAll()
      this.disposed = true
      throw new ExtensionError(
        'WORKER_PARSE_ERROR',
        `Failed to create extension worker: ${err instanceof Error ? err.message : String(err)}`,
        { extensionId: this.extensionId, cause: err },
      )
    }
    this.worker = worker
    this.callbacks.onWorkerCountChange?.(1)

    return await new Promise<string[]>((resolve, reject) => {
      let settled = false
      const settleOk = (fns: string[]) => {
        if (settled) return
        settled = true
        this.abortBoot = null
        globalThis.clearTimeout(bootTimer)
        revokeAll()
        this.exportedFunctions = fns
        this.ready = true
        resolve(fns)
      }
      const settleErr = (err: Error) => {
        if (settled) return
        settled = true
        this.abortBoot = null
        this.disposed = true
        this.ready = false
        globalThis.clearTimeout(bootTimer)
        revokeAll()
        this.terminateWorkerOnly()
        reject(err)
      }

      this.abortBoot = settleErr

      const bootTimer = globalThis.setTimeout(() => {
        settleErr(
          new ExtensionError(
            'WORKER_BOOT_TIMEOUT',
            `Extension worker timed out during startup (${this.bootTimeoutMs}ms).`,
            { extensionId: this.extensionId },
          ),
        )
      }, this.bootTimeoutMs)

      worker.onerror = ev => {
        const msg = ev.message || 'Worker crashed while loading'
        if (!settled) {
          settleErr(
            new ExtensionError('WORKER_PARSE_ERROR', msg, {
              extensionId: this.extensionId,
              detail: ev.filename ? `${ev.filename}:${ev.lineno}:${ev.colno}` : undefined,
            }),
          )
        } else {
          this.callbacks.onRuntimeError?.(this.extensionId, this.activationId, {
            name: 'WorkerError',
            message: msg,
          })
        }
      }

      worker.onmessageerror = () => {
        const err = new ExtensionError('DATA_CLONE_ERROR', 'Worker sent an unreadable message.', {
          extensionId: this.extensionId,
        })
        if (!settled) settleErr(err)
      }

      worker.onmessage = ev => {
        if (this.disposed || this.worker !== worker) return
        const msg = ev.data as WorkerToHostMessage
        if (!msg || typeof msg !== 'object') return

        switch (msg.type) {
          case 'boot-started':
            revokeBoot()
            break
          case 'boot-imported':
            revokeMod()
            this.exportedFunctions = msg.functions
            break
          case 'boot-ok':
            settleOk(msg.functions)
            break
          case 'boot-error':
            settleErr(
              new ExtensionError(
                msg.phase === 'activate' ? 'WORKER_ACTIVATE_ERROR' : 'WORKER_PARSE_ERROR',
                `${msg.error.name}: ${msg.error.message}`,
                { extensionId: this.extensionId, detail: msg.error.stack },
              ),
            )
            break
          case 'log':
            this.callbacks.onLog(
              this.extensionId,
              this.activationId,
              msg.level,
              formatConsoleArgs(msg.args),
              msg.stack,
            )
            break
          case 'runtime-error':
            this.callbacks.onLog(
              this.extensionId,
              this.activationId,
              'error',
              `${msg.error.name}: ${msg.error.message}`,
              msg.error.stack,
            )
            this.callbacks.onRuntimeError?.(this.extensionId, this.activationId, msg.error)
            break
          case 'invr': {
            const pending = this.outstandingInvocations.get(msg.id)
            this.outstandingInvocations.delete(msg.id)
            if (!pending) break
            if (msg.error) {
              const code =
                msg.error.code ??
                (msg.error.message.startsWith('Function not found:')
                  ? 'FUNCTION_NOT_FOUND'
                  : 'WORKER_RUNTIME_ERROR')
              pending.reject(
                new ExtensionError(code, msg.error.message, {
                  extensionId: this.extensionId,
                  detail: msg.error.stack,
                }),
              )
            } else {
              pending.resolve(msg.result)
            }
            break
          }
          case 'sys':
            void this.handleSyscall(worker, msg.id, msg.name, msg.args)
            break
        }
      }

      const bootMsg: HostToWorkerMessage = {
        type: 'boot',
        moduleBlobUrl,
        extensionMeta: {
          id: this.extensionId,
          version: this.version,
          baseUrl: this.baseUrl,
          activationId: this.activationId,
        },
      }
      worker.postMessage(bootMsg)
    })
  }

  private async handleSyscall(worker: Worker, id: number, name: string, args: unknown[]) {
    if (this.inFlightSyscalls >= MAX_IN_FLIGHT_SYSCALLS) {
      if (!this.disposed && this.worker === worker) {
        const resMsg: HostToWorkerMessage = {
          type: 'sysr',
          id,
          error: {
            name: 'ExtensionError',
            code: 'SYSCALL_DENIED',
            message: `Too many concurrent worker syscalls (limit ${MAX_IN_FLIGHT_SYSCALLS}).`,
          },
        }
        worker.postMessage(resMsg)
      }
      return
    }
    this.inFlightSyscalls += 1
    try {
      const result = await this.callbacks.onSyscall(
        this.extensionId,
        this.activationId,
        name,
        args,
      )
      if (!this.disposed && this.worker === worker) {
        const resMsg: HostToWorkerMessage = { type: 'sysr', id, result }
        worker.postMessage(resMsg)
      }
    } catch (err) {
      if (!this.disposed && this.worker === worker) {
        const ser: SerializedError =
          err instanceof ExtensionError
            ? { name: err.name, message: err.message, code: err.code, stack: err.detail }
            : err instanceof Error
              ? { name: err.name, message: err.message, stack: err.stack }
              : { name: 'Error', message: String(err) }
        const resMsg: HostToWorkerMessage = { type: 'sysr', id, error: ser }
        worker.postMessage(resMsg)
      }
    } finally {
      this.inFlightSyscalls = Math.max(0, this.inFlightSyscalls - 1)
    }
  }

  async invoke(name: string, args: unknown[] = []): Promise<unknown> {
    if (this.disposed) {
      throw new ExtensionError('WORKER_STOPPED', 'Plug sandbox stopped', {
        extensionId: this.extensionId,
      })
    }
    if (!this.ready) {
      await this.init()
    }
    if (this.disposed || !this.worker) {
      throw new ExtensionError('WORKER_STOPPED', 'Plug sandbox stopped', {
        extensionId: this.extensionId,
      })
    }
    const id = ++this.reqId
    return await new Promise<unknown>((resolve, reject) => {
      this.outstandingInvocations.set(id, { resolve, reject })
      try {
        const msg: HostToWorkerMessage = { type: 'inv', id, name, args }
        this.worker!.postMessage(msg)
      } catch (err) {
        this.outstandingInvocations.delete(id)
        reject(
          new ExtensionError(
            'DATA_CLONE_ERROR',
            `Could not serialize arguments for ${name}: ${err instanceof Error ? err.message : String(err)}`,
            { extensionId: this.extensionId, cause: err },
          ),
        )
      }
    })
  }

  notifySettingsChanged(settings: Record<string, boolean | string | number>) {
    if (!this.isRunning || !this.worker) return
    try {
      const msg: HostToWorkerMessage = { type: 'settings-changed', settings }
      this.worker.postMessage(msg)
    } catch {
      // ignore postMessage errors on closing worker
    }
  }

  private terminateWorkerOnly() {
    if (this.worker) {
      this.worker.onmessage = null
      this.worker.onerror = null
      this.worker.onmessageerror = null
      this.worker.terminate()
      this.worker = null
      this.callbacks.onWorkerCountChange?.(-1)
    }
  }

  /**
   * Immediately terminates the Web Worker and rejects all outstanding invocations
   * (including an in-flight startup/onActivate) with `Plug sandbox stopped`.
   */
  stop() {
    this.disposed = true
    this.ready = false
    this.abortFetch?.()
    this.abortFetch = null
    const stopErr = new ExtensionError('WORKER_STOPPED', 'Plug sandbox stopped', {
      extensionId: this.extensionId,
    })
    this.abortBoot?.(stopErr)
    this.terminateWorkerOnly()
    if (this.outstandingInvocations.size > 0) {
      for (const { reject } of this.outstandingInvocations.values()) {
        reject(stopErr)
      }
      this.outstandingInvocations.clear()
    }
  }
}
