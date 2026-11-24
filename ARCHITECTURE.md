# Syntax Architecture

Syntax is designed around **YAGNI** ("You aren't going to need it"): keep Core small, rely on battle-tested libraries for hard problems, isolate third-party code cleanly, and make every bug immediately visible in a diagnostics log.

## 1. Core vs. Packages

### What Stays in Core (`src/core/` & `src/ui/`)
- **Router (`src/core/router.ts`)**: Wouter hash routing (`#/`, `#/hub`, `#/plugins`, `#/profile`, `#/course/:id`) so GitHub Pages never returns 404 on page refresh.
- **Package Contracts (`src/core/packages.ts`)**: Single Zod v4 schema defining `.syntaxcourse`, `.syntaxplugin`, and `.syntaxembeddedplugin`, plus local file import/export.
- **Registry (`src/core/registry.ts`)**: Zustand v5 persisted store managing installed packages, real On/Off plugin toggles, and automatic required `.syntaxembeddedplugin` resolution.
- **Accounts (`src/core/account.ts`)**: Firebase Auth (`firebase/auth`) + Zustand persistence. Requires sign-in before installing any package and resumes pending installs automatically after sign-in.
- **Sandbox (`src/core/sandbox.tsx`)**: `<iframe sandbox="allow-scripts">` host with strict Content Security Policy (`default-src 'none'`), neutral charcoal/light CSS tokens, and automatic error capture.
- **Crash Isolation & Diagnostics (`src/core/ErrorBoundary.tsx`, `src/core/logger.ts`)**: `react-error-boundary` wrappers + ring-buffer event/error logger with drop-in `registerErrorSink` (Sentry) and `registerAnalyticsSink` (PostHog) hooks.
- **Sema (`src/mpm2d/mascot/`)**: Syntax's living mascot stays in Core so every surface feels alive without depending on plugins.

### What Lives as Packages
- **Courses (`.syntaxcourse`)**: Analytic Geometry (MPM2D), Thinking in Code, and any community/imported course.
- **Embedded Course Plugins (`.syntaxembeddedplugin`)**: Shared interactive engines (`math-graph-engine`, `grid-coding-engine`, `unit-circle-lab`). Each declares an `aiUsage` card so future MCP connectors can discover and reuse them.
- **Global App Plugins (`.syntaxplugin`)**: `pen-studio`, `walkthrough-player`, `checkmark-gate`, `floating-windows`, `work-history`, `formula-playbook`. Every plugin with `touchesCore: true` shows the exact warning: **"This plugin touches core."**

## 2. Two-Repo Zero-Cost Ecosystem

1. **`I-am-drunk/syntax`**: The Syntax web app, core runtime, official built-in courses, and official plugins. Deployed free at `https://i-am-drunk.github.io/syntax/`.
2. **`I-am-drunk/syntax-community`**: The lightweight community catalog (`catalog/catalog.json`), downloadable package files (`packages/*`), automated GitHub Actions validator (`scripts/validate-catalog.mjs`), and standalone Community Hub website (`https://i-am-drunk.github.io/syntax-community/`) with Arc-style `?install=<id>` deep links back into Syntax.

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
