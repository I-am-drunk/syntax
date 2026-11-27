# Upstream Provenance: SilverBullet PlugOS

- **Repository:** `https://github.com/silverbulletmd/silverbullet`
- **Commit:** `53452e220a9b4e5643fb2b9a7ca2151be51b3ab3`
- **License:** MIT (see `LICENSE.md` in this directory)
- **Files adapted:**
  - `client/plugos/protocol.ts` -> `protocol.ts`
  - `client/plugos/sandboxes/worker_sandbox.ts` + `client/plugos/worker_runtime.ts` + `client/plugos/util.ts` -> `workerSandbox.ts`

## Intentional Syntax Adaptations

1. **Removed SilverBullet-specific couplings:** Dropped `AssetBundle`, `sandboxFetch` proxy, `fsEndpoint`, `LuaStackFrame`, `builtinPlugNames`, and Deno esbuild plug compilation.
2. **Host-authoritative manifests:** The worker reports its exported function names (`boot-imported`), never overwriting the host's Zod-validated `extension.json` manifest or extension ID.
3. **Cross-origin Two-Blob ESM bootstrap:** Host fetches `worker.js` with `mode: 'cors', credentials: 'omit'`, appends `//# sourceURL=`, and boots a tiny module worker that runs `await import(moduleBlobUrl)`. Revokes both Blob URLs only after worker confirmation or failure.
4. **Instant startup error detection:** Wired `worker.onerror`, `worker.onmessageerror`, and bootstrap `try/catch` around `import()` and `onActivate(ctx)` so syntax/eval errors reject in <50ms instead of waiting for the 5s timeout.
5. **Fixed upstream missing-function hang:** Missing function lookups run inside `try/catch` so callers always receive an `invr` rejection instead of hanging.
6. **Non-cloneable console/return sanitization:** Sanitizes functions, symbols, circular objects, and `Error` stacks before `postMessage` so worker logs and return values never fail with `DataCloneError`.
