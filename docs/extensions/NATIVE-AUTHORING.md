# Build and check a native extension

## Build the starter

From the Syntax checkout, use Node.js 24 or later. These commands create a project next to Syntax, install its locked dependencies, and build and check its package.

```sh
npm ci
npm run extension:init -- ../syntax-fixture
npm --prefix ../syntax-fixture ci
npm --prefix ../syntax-fixture run build
npm run extension:check -- ../syntax-fixture/dist/manifest.json
```

Use a destination folder that does not exist yet. In that folder, edit `index.tsx` to change the screen and command. Edit `syntaxExtension` and the release version in `package.json` to identify your extension. The starter gets its TypeScript declarations from the host and computes the entry hash on each build.

Publish only the files in `dist` to a static HTTPS host. Keep `manifest.json` and `main.js` together. Allow cross-origin GET requests from Syntax. The direct manifest file URL identifies the install. Publish changed JavaScript with a new version.

## Install and run the fixture

For the local walkthrough, start Syntax from the checkout. Use a fresh browser profile.

```sh
npm run dev -- --host localhost --base /syntax-dev/
```

Open the server address printed by Vite with `/syntax-dev/#/extensions` as the path. Under **Native extensions**, paste the fixture's manifest URL and select **Review native package**. Check its name, version, and source URL, then select **Install native package**. Use **Open** to see the screen. Press Ctrl+K or Command+K and select **Save sample** to run the command.

The same walkthrough runs in Chromium with `node --test tests/e2e/native-starter.test.mjs`. Install Chromium or Microsoft Edge first. If the test cannot find the browser, set `SYNTAX_E2E_BROWSER` to the full path to its executable. The test serves the build on a separate loopback origin and follows the Extensions page, opening the screen and running the command.

Hosted Syntax Dev shares a browser origin with Stable. It may execute only packages approved in the source for that build. An approved source must serve the exact reviewed manifest and JavaScript digest. The published fixture walkthrough is still pending.

## Package checks

Run the package check from the Syntax checkout with the repository dependencies installed.

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

If a native screen or command freezes the browser after startup, close the tab, then reopen Syntax Dev with `?safeMode=1#/extensions` after `/syntax-dev/`. Disable the extension before exiting Safe Mode.
