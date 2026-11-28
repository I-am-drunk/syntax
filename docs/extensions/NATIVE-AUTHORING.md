# Native extension package checks

The V1.0 package check runs from the Syntax checkout with Node.js 24 or later and the repository dependencies installed.

```sh
npm ci
npm run extension:check -- path/to/manifest.json
npm run extension:check -- --json path/to/manifest.json
```

The manifest describes one CommonJS entry. Put these fields in `manifest.json`.

- `manifestVersion` is `2`.
- `id` is a lowercase name with at least two dot-separated parts, such as `example.fixture`. Reuse it across releases of the same extension.
- `name` is the name students see in Syntax.
- `version` is the extension's three-part release version, such as `1.0.0`.
- `syntaxApi` is an exact or caret range. The foundation API version is `2.0.0`.
- `main` is a relative path to the final JavaScript file, such as `dist/main.js`. Keep the entry in the package and between 1 byte and 2 MiB.
- `sha256` is the lowercase SHA-256 digest of the final entry bytes. Recompute it after rebuilding the entry.

Use `--json` for a result another tool can read. A successful check reports the validated manifest. A failed check exits with status 1 and provides an error code and a message. For example, `ENTRY_MISSING` means the expected build file is absent, and `ENTRY_HASH_MISMATCH` means the file differs from the one described by the manifest.

The checker reads and compiles the entry to check CommonJS syntax. Activation, authoring from a separate checkout, and URL installation each have their own tests in the [foundation milestone](MASTER-PLAN.md#v10-runtime-and-authoring-foundation).

The host download code expects a direct HTTPS manifest URL. Use HTTP on localhost for tests. It downloads the entry relative to that manifest and verifies the SHA-256 digest before returning the downloaded code for activation. The host limits the manifest to 16 KiB and the entry to 2 MiB.

## Activation contract

The [foundation API types](../../src/extensions/native/api.ts) describe the CommonJS export and the context Syntax provides. Export an `activate(context)` function. Register screens, commands, and cleanup callbacks during activation. Use the host's `react` and `react/jsx-runtime` imports so the screen uses the same React instance as Syntax.

Activation can read saved data. Write data only once the extension is active, such as from a screen interaction or command. The context signal aborts when the extension is disabled or replaced. Stop ongoing work on abort and release resources with `onDispose`. The raw runtime observes cleanup failures and prevents a failed candidate from replacing the working version.

The browser host keeps verified entry bytes and saved data in channel-scoped IndexedDB. A failed replacement leaves the installed revision available, including after reload. Saves include the active revision so an older tab cannot overwrite data once another tab disables or replaces its extension.

The startup journal records an activation in the current browser tab. After a reload, Syntax quarantines the matching saved revision and starts the remaining extensions. If the journal cannot identify a suspect, Syntax skips native startup until the host explicitly acknowledges the recovery state.

The Syntax Dev installation UI and published fixture walkthrough still need their release checks.
