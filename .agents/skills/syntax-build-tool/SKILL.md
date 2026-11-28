---
name: syntax-build-tool
description: Build, check, and publish a native v2 Syntax tool, optional course tool, or opt-in theme outside core Syntax using @syntax/api and @syntax/ui.
---

# Build a Syntax Tool

Use this skill whenever asked to create, update, or debug a native v2 tool, optional course tool, or theme extension for Syntax.

## Canonical Sources (Read First)

1. Authoring guide: `docs/extensions/BUILD-A-TOOL.md`
2. Runtime reference: `docs/extensions/NATIVE-AUTHORING.md`
3. Native API contract: `src/extensions/native/api.ts`
4. Shared UI and host hooks contract: `src/extensions/native/sdk-types.d.ts`
5. Tool starter template: `templates/native-extension/`
6. Live `@syntax/ui` Storybook stories: `src/ui/sdk/stories/`

## Rules

- Keep tools and themes in their own repository or `syntax-platform/syntax-official-extensions`, never hardcoded inside core `syntax`.
- Scaffold with `npm run extension:init -- <target-dir>` and keep `react`, `react/jsx-runtime`, `@syntax/api`, and `@syntax/ui` external in `build.mjs`.
- Standalone tools register screens (`ctx.registerScreen`) and commands (`ctx.registerCommand`) so they appear in **Extensions** and `Ctrl+K`.
- Optional tools that augment a course register `ctx.registerCourseTool({ id, title, buttonLabel, targetCourses, component })` so the course can use them when installed and stay fully functional when disabled.
- Ordinary tool styles must use `scope: 'scoped'`. Reserve `scope: 'global'` strictly for opt-in theme extensions, and clean up every DOM/document side effect inside `ctx.onDispose(...)`.
- Never overwrite saved data during startup before `ctx.loadData()` settles, and handle save failures gracefully in UI.
- Before publishing, verify deterministic builds with `npm run build` and validate with `npm run extension:check -- <path>/dist/manifest.json`.
