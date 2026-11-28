---
name: syntax-build-course
description: Build, check, and publish a native v2 Syntax course outside core Syntax using @syntax/api, @syntax/ui, bundled lesson assets, and Community Hub listing screenshots.
---

# Build a Syntax Course

Use this skill whenever asked to create, update, or debug a native v2 course for Syntax.

## Canonical Sources (Read First)

1. Authoring guide: `docs/extensions/BUILD-A-COURSE.md`
2. Native API contract: `src/extensions/native/api.ts`
3. Shared UI and host hooks contract: `src/extensions/native/sdk-types.d.ts`
4. Subject-neutral course starter: `templates/native-course/`
5. Live `@syntax/ui` Storybook stories: `src/ui/sdk/stories/`

## Rules

- Keep all course content, grading, and subject engines outside core `syntax` (in a standalone repo or `syntax-platform/syntax-official-extensions`). Never hardcode a course into core `syntax`.
- Always scaffold with `npm run extension:init -- <target-dir> --course` so `syntax-api.d.ts`, `syntax-sdk.d.ts`, `build.mjs`, and `tsconfig.json` match the current host build.
- Keep `react`, `react/jsx-runtime`, `@syntax/api`, and `@syntax/ui` external in `build.mjs` so installed courses pick up live host UI updates without rebuilding.
- Register at least one screen with `kind: 'course'`, persist learner state with `ctx.saveData(...)` (handling load/save errors clearly), and report progress counts with `ctx.reportProgress({ completed, total, label })`.
- Keep lesson visuals (SVGs, diagrams, data) bundled inside the course download. Put listing preview screenshots in `previewImages` on the Community Hub catalog entry instead of inside the course bundle.
- Use `ctx.registerEmbedded(...)` for required course-owned setup/cleanup and `ctx.registerStyles({ scope: 'scoped', ... })` for course-only styles. Never use `scope: 'global'` in a course.
- Before publishing, run `npm run build` twice to confirm deterministic output, then run `npm run extension:check -- <path>/dist/manifest.json` from `syntax`.
