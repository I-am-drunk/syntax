# Syntax Architecture

Syntax is designed around **YAGNI** ("You aren't going to need it"): keep Core small, rely on battle-tested libraries for hard problems, isolate third-party code cleanly, and surface diagnostics inside the dev channel without cluttering the main site.

## 1. Core vs. Packages

### What Stays in Core (`src/core/`, `src/courses/`, `src/mpm2d/`, `src/ui/`)
- **Course Shell & Navigation (`src/mpm2d/CourseShell.tsx`, `src/courses/HomePage.tsx`)**: Brilliant-native top bar (`Home` | active course | `Plugins`) with sliding underline, Settings wipe-in tab, pancake course switcher, and `?install=<id>` deep-link installer from the Community Hub.
- **Package Contracts (`src/core/packages.ts`)**: Single Zod v4 schema defining `.syntaxcourse`, `.syntaxplugin`, and `.syntaxembeddedplugin`, plus local file import/export.
- **Registry (`src/core/registry.ts`)**: Zustand v5 persisted store managing installed packages, real On/Off plugin toggles, and automatic required `.syntaxembeddedplugin` resolution.
- **Accounts (`src/core/clerkAuth.tsx`, `src/core/account.ts`)**: Clerk Core 3 (`@clerk/react` + `@clerk/themes`) with modal sign-in (avoiding URL hash conflicts on GitHub Pages) and a lightweight local fallback when `VITE_CLERK_PUBLISHABLE_KEY` is not yet configured.
- **Theme Token Groundwork (`src/core/themes.ts`)**: Obsidian-inspired CSS variable contract ready for future community `.syntaxtheme` packages.
- **Sandbox (`src/core/sandbox.tsx`)**: `<iframe sandbox="allow-scripts">` host with strict Content Security Policy (`default-src 'none'`), neutral charcoal/light CSS tokens, and automatic error capture.
- **Crash Isolation & Dev Diagnostics (`src/core/ErrorBoundary.tsx`, `src/core/logger.ts`, `src/mpm2d/components/DevChannelBadge.tsx`)**: `react-error-boundary` wrappers + ring-buffer event/error logger surfaced exclusively in the `/dev/` channel, with drop-in `registerErrorSink` (Sentry) and `registerAnalyticsSink` (PostHog) hooks.
- **Sema (`src/mpm2d/mascot/`)**: Syntax's living mascot stays in Core so every surface feels alive without depending on plugins.

### What Lives as Packages
- **Courses (`.syntaxcourse`)**: Analytic Geometry (MPM2D), Thinking in Code, and any community/imported course.
- **Embedded Course Plugins (`.syntaxembeddedplugin`)**: Shared interactive engines (`math-graph-engine`, `grid-coding-engine`, `unit-circle-lab`). Each clearly shows installed status on your account and declares an `aiUsage` card so future MCP connectors can discover and reuse them.
- **Global App Plugins (`.syntaxplugin`)**: `pen-studio`, `walkthrough-player`, `checkmark-gate`, `floating-windows`, `formula-playbook`. Any plugin with `touchesCore: true` shows a compact amber warning triangle in lists and **"This plugin touches core."** in its detail/install view.

## 2. Two-Repo Zero-Cost Ecosystem

1. **`I-am-drunk/syntax`**: The Syntax web app, core runtime, official built-in courses, and official plugins. Deployed free at `https://i-am-drunk.github.io/syntax/` (with `/dev/` alpha channel at `https://i-am-drunk.github.io/syntax/dev/`).
2. **`I-am-drunk/syntax-community`**: The lightweight community catalog (`catalog/catalog.json`), downloadable package files (`packages/*`), automated GitHub Actions validator (`scripts/validate-catalog.mjs`), and standalone Community Hub website (`https://i-am-drunk.github.io/syntax-community/`) modeled after Obsidian Community + Raycast Store with one-click **"Add to Syntax"** (`?install=<id>`) deep links.

## 3. Adding Sentry or PostHog Later

Both hooks already exist in `src/core/logger.ts`:

```ts
import { registerErrorSink, registerAnalyticsSink } from './core/logger'

registerErrorSink((entry, rawError) => {
  // Sentry.captureException(rawError ?? new Error(entry.message))
})

registerAnalyticsSink((name, props) => {
  // posthog.capture(name, props)
})
```
