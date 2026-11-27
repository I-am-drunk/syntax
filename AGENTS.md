# Working on Syntax

Syntax is an open-source, extensible browser-based learning platform.

## Repository Boundaries

- **`syntax-platform/syntax` (this repo)**: Core web application shell, routing, Clerk auth and cloud sync, WCAG theme pack engine, Sema companion (`src/mascot/`), preferences, and the plugin runtime host.
- **`syntax-platform/syntax-official-plugins`**: First-party courses, interactive engines, and workspace tools (Analytic Geometry, Thinking in Code, Pen Studio, Video Walkthroughs / Manim pipeline, Formula Playbook). Do not hardcode courses or plugins back into core `syntax`.
- **`syntax-platform/syntax-community`**: Community catalog and discovery site.
- **`syntax-platform/syntax-dev`**: Nightly pre-release deployment target and pre-release tags.

## Core Architecture

- `src/shell/` (`AppShell.tsx`, `AppHeader.tsx`): Hash routing (`wouter`), top navigation, theme and sound management, and dev inspector loading.
- `src/core/`: Clerk auth and cloud sync (`clerkAuth.tsx`, `clerkSync.ts`, `account.ts`), WCAG theme packs (`themePacks.ts`), preferences (`prefs.ts`), host slots (`hostSlots.tsx`), error boundaries, logging, and dev environment utilities.
- `src/mascot/`: Core Sema companion (`Sema.tsx`, `TopBarSema.tsx`, `bloub/`).
- `src/ui/`: Core platform pages (`HomePage.tsx`, `LibraryPage.tsx`, `PluginsPage.tsx`, `CommunityHubPage.tsx`, `ProfilePage.tsx`, `ProfilePopover.tsx`, `SettingsPage.tsx`, `OnboardingModal.tsx`, `AccountModal.tsx`).

## Commands

- `npm run dev`: Start Vite dev server on port 5189.
- `npm run build`: Run `tsc -b && vite build` (must pass with 0 errors before committing).
- `npm run preview`: Preview the production bundle locally.
