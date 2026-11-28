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
