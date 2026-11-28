# Build a Course for Syntax

This guide walks you from a fresh checkout to a published native v2 course installed in Syntax Dev and visible in **Library**.

Courses live in their own repository or package outside core Syntax. They use `@syntax/api` for host services and `@syntax/ui` for shared controls and lesson layout, while keeping lesson logic, grading, and subject-specific diagrams inside the course package.

## Prerequisites

- Node.js 24 or newer
- A local clone of `syntax-platform/syntax` for the starter generator and checker

## 1. Scaffold the subject-neutral course starter

Create a new folder outside the Syntax repository:

```bash
npm ci
npm run extension:init -- ../my-first-course --course
cd ../my-first-course
npm ci
```

The starter includes:

- `package.json`: extension metadata under `syntaxExtension` (`id`, `name`, `syntaxApi`)
- `index.tsx`: one complete interactive lesson using `@syntax/ui` (`LessonShell`, `LessonHeader`, `Card`, `ChoiceGroup`, `WorkedSteps`, `CheckBar`, `CompletionCard`) plus a bundled inline SVG diagram
- `build.mjs`: deterministic CommonJS bundler that keeps `react`, `react/jsx-runtime`, `@syntax/api`, and `@syntax/ui` external and writes `dist/manifest.json` with a SHA-256 digest of `dist/main.js`
- `syntax-api.d.ts` and `syntax-sdk.d.ts`: exact TypeScript contracts copied from core Syntax

## 2. Customize your course and lesson assets

Update `package.json` with your reverse-DNS package ID (for example `acme.everyday-logic`), display name, and version.

Keep lesson diagrams, SVGs, or data assets inside your course package so every installed lesson works offline without depending on external image servers. Keep promotional listing screenshots separate when submitting to Community Hub (see Step 5).

Register your course screen with `kind: 'course'` so Syntax lists it in **Library** and tracks progress counts when you call `ctx.reportProgress(...)`:

```tsx
export function activate(ctx: NativeExtensionContext): void {
  ctx.registerScreen({
    id: 'lesson-1',
    title: 'Lesson 1: Spotting Growing Patterns',
    kind: 'course',
    subtitle: 'One interactive lesson with a bundled diagram and saved progress.',
    component: () => <StarterLesson ctx={ctx} />,
  })
}
```

If your course requires course-owned setup or cleanup (for example a custom graph engine or keyboard shortcut layer), register it explicitly with `ctx.registerEmbedded(...)` and scope ordinary course CSS with `ctx.registerStyles({ id: 'course-styles', scope: 'scoped', css })`. If you want to recommend standalone tools such as Formula Playbook, pass `recommendedTools` on your course screen.

## 3. Build and check the release locally

```bash
npm run build
```

Run the Syntax package checker from your `syntax` clone (it validates manifest fields, `syntaxApi`, file size, and SHA-256 without executing your code):

```bash
npm --prefix ../syntax run extension:check -- --json ../my-first-course/dist/manifest.json
```

Confirm the check prints `ok: true` and rebuilds byte-identically when you run `npm run build` a second time.

## 4. Publish and install on Syntax Dev

Publish `dist/manifest.json` and `dist/main.js` together at a public HTTPS URL, such as a GitHub raw URL pinned to a commit. Both files must allow cross-origin requests from Syntax.

To try your build before review, run the local Syntax app and follow the [local install walkthrough](NATIVE-AUTHORING.md). For hosted Syntax Dev, submit the exact manifest URL, version, digest, and source commit for maintainer review in the [Syntax repository](https://github.com/syntax-platform/syntax). A maintainer adds the reviewed package to the host's approved builds and deploys that change to Dev.

Install in Syntax Dev in either of two ways:

1. **Direct manifest link**: Share or open `https://syntax-platform.github.io/syntax-dev/#/extensions?native=<URL-encoded-manifest-url>`. Syntax inspects the manifest, verifies the SHA-256 digest, shows the trust confirmation, and installs the course.
2. **Community Hub**: Submit a PR for [catalog/catalog.json](https://github.com/syntax-platform/syntax-community/blob/main/catalog/catalog.json). Include `manifestVersion: 2`, `kind: "course"`, `id`, `name`, `version`, `manifestUrl`, `syntaxApi`, `sha256`, and separate `previewImages`. Use the ID, version, and digest from the published manifest. Readers can browse screenshots and review the package before installing.

Once installed, open **Library** to launch your course and see its live progress count. Students can clear one course's local saved data at the bottom of **Profile** without affecting other courses or their account.

## 5. Separate listing screenshots from lesson assets

- **Inside your course package (`dist/main.js`)**: bundle the diagrams, SVGs, and interactive visuals students need inside lessons.
- **On your Community Hub listing (`previewImages`)**: attach 1 to 6 listing screenshots (captured from the running app or from Storybook) so students can preview your course before installing without bloating the downloaded package.

## Source links and runnable examples

- Native API types: [src/extensions/native/api.ts](../../src/extensions/native/api.ts)
- Shared `@syntax/ui` and `@syntax/api` types: [src/extensions/native/sdk-types.d.ts](../../src/extensions/native/sdk-types.d.ts)
- Subject-neutral starter template: [templates/native-course/](../../templates/native-course/)
- Official courses (MPM2D Analytic Geometry and Binary & Logic Basics): `syntax-platform/syntax-official-extensions`
- [Interactive course example](https://syntax-platform.github.io/syntax-dev/storybook/?path=/story/examples-starter-course-lesson--interactive-course)
- Companion guide: [Build a Tool](BUILD-A-TOOL.md)
