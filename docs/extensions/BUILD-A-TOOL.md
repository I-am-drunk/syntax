# Build a Tool for Syntax

This guide walks you from a fresh checkout to a published native v2 tool installed in Syntax Dev, accessible from **Extensions** and the `Ctrl+K` command palette.

Tools can add standalone screens and commands, attach optional panels inside targeted courses (`registerCourseTool`), or provide opt-in global themes (`registerStyles({ scope: 'global' })`).

## Prerequisites

- Node.js 24 or newer
- A local clone of `syntax-platform/syntax` for the starter generator and checker

## 1. Scaffold the tool starter

Create a new folder outside the Syntax repository:

```bash
npm ci
npm run extension:init -- ../my-first-tool
cd ../my-first-tool
npm ci
```

The starter includes:

- `package.json`: extension metadata under `syntaxExtension` (`id`, `name`, `syntaxApi`)
- `index.tsx`: a working screen, command, and persisted data example using host React
- `build.mjs`: deterministic CommonJS bundler that keeps `react`, `react/jsx-runtime`, `@syntax/api`, and `@syntax/ui` external and generates `dist/manifest.json` with SHA-256 verification
- `syntax-api.d.ts` and `syntax-sdk.d.ts`: exact TypeScript contracts copied from core Syntax

## 2. Register your screen, command, and optional course hooks

Update `package.json` with your reverse-DNS package ID (for example `acme.study-timer`), display name, and version.

Register your standalone screen and command inside `activate(ctx)`:

```tsx
import { Button, Card } from '@syntax/ui'
import type { NativeExtensionContext } from './syntax-api'

export function activate(ctx: NativeExtensionContext): void {
  ctx.registerScreen({
    id: 'main',
    title: 'Study Timer',
    component: () => (
      <Card>
        <h2>Study Timer</h2>
        <Button variant="primary" onClick={() => ctx.saveData({ startedAt: Date.now() })}>
          Start session
        </Button>
      </Card>
    ),
  })

  ctx.registerCommand({
    id: 'open-timer',
    title: 'Open Study Timer',
    run: () => ctx.openScreen('main'),
  })
}
```

### Optional course tools

To make a standalone tool appear inside specific courses without bundling it into each course, call `ctx.registerCourseTool(...)`:

```tsx
ctx.registerCourseTool({
  id: 'quick-formulas',
  title: 'Formula Sheet',
  buttonLabel: 'Formulas',
  targetCourses: ['syntax.mpm2d-analytic-geometry'],
  component: ({ onClose }) => <FormulaDrawer onClose={onClose} />,
})
```

Each optional course tool renders inside its own error boundary and style root. If the tool is disabled or throws an error, Syntax removes only the tool while the course keeps running.

### Opt-in themes

Ordinary tool and course styles default to `scope: 'scoped'`. Only user-enabled theme extensions should pass `scope: 'global'` to `ctx.registerStyles(...)` and register cleanup hooks with `ctx.onDispose(...)` so disabling the theme restores the app cleanly.

## 3. Build and check the release locally

```bash
npm run build
npm --prefix ../syntax run extension:check -- --json ../my-first-tool/dist/manifest.json
```

Verify that `extension:check` reports `ok: true` with zero manifest or bundle errors.

## 4. Publish and install on Syntax Dev

Publish `dist/manifest.json` and `dist/main.js` together at a public HTTPS URL with CORS enabled.

To try your build before review, follow the [local install walkthrough](NATIVE-AUTHORING.md). For hosted Syntax Dev, submit the exact manifest URL, version, digest, and source commit for maintainer review in the [Syntax repository](https://github.com/syntax-platform/syntax). A maintainer adds the reviewed package to the host's approved builds and deploys that change to Dev.

Install in Syntax Dev in either of two ways:

1. **Direct manifest link**: Open `https://syntax-platform.github.io/syntax-dev/#/extensions?native=<URL-encoded-manifest-url>` and confirm the review panel. Click **Open** from the install banner, **Open** on the extension card in **Extensions**, or run your command from `Ctrl+K`.
2. **Community Hub**: Submit a PR for [catalog/catalog.json](https://github.com/syntax-platform/syntax-community/blob/main/catalog/catalog.json). Include `manifestVersion: 2`, `kind: "extension"`, `id`, `name`, `version`, `manifestUrl`, `syntaxApi`, `sha256`, and listing `previewImages`. Use the ID, version, and digest from the published manifest.

During alpha, compatible newer versions of installed extensions can update automatically in the background. If a new build fails integrity, compatibility, or startup checks, Syntax rejects the candidate and leaves your working version active.

## Source links and runnable examples

- Native API types: [src/extensions/native/api.ts](../../src/extensions/native/api.ts)
- Shared `@syntax/ui` and `@syntax/api` types: [src/extensions/native/sdk-types.d.ts](../../src/extensions/native/sdk-types.d.ts)
- Tool starter template: [templates/native-extension/](../../templates/native-extension/)
- Official tools (Quick Notes, Formula Playbook, Warm Paper Theme): `syntax-platform/syntax-official-extensions`
- [Interactive tool example](https://syntax-platform.github.io/syntax-dev/storybook/?path=/story/examples-standalone-tool--quick-notes-tool)
- Companion guide: [Build a Course](BUILD-A-COURSE.md)
