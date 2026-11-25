<p align="center">
  <a href="https://i-am-drunk.github.io/syntax/">
    <picture>
      <source media="(prefers-color-scheme: dark)" srcset="public/assets/syntax-banner-dark.png" />
      <source media="(prefers-color-scheme: light)" srcset="public/assets/syntax-banner-light.png" />
      <img alt="Syntax: Interactive visual math lessons and guided walkthroughs" src="public/assets/syntax-banner.png" width="100%" />
    </picture>
  </a>
</p>

<p align="center">
  <a href="https://i-am-drunk.github.io/syntax/"><strong>Open Syntax</strong></a>
  &nbsp;&middot;&nbsp;
  <a href="https://i-am-drunk.github.io/syntax/dev/"><strong>Open Syntax Dev</strong></a>
  &nbsp;&middot;&nbsp;
  <a href="https://i-am-drunk.github.io/syntax-community/"><strong>Community Hub</strong></a>
  &nbsp;&middot;&nbsp;
  <a href="https://github.com/I-am-drunk/syntax/releases">Releases</a>
</p>

---

## Live Sites

Everything runs at $0/month via GitHub Pages:

| Site | Link | Channel |
| --- | --- | --- |
| **Syntax** | [i-am-drunk.github.io/syntax](https://i-am-drunk.github.io/syntax/) | Stable releases (`vX.Y.Z`) |
| **Syntax Dev** | [i-am-drunk.github.io/syntax/dev](https://i-am-drunk.github.io/syntax/dev/) | Alpha pre-releases (`vX.Y.Z-alpha.N`) |
| **Community Hub** | [i-am-drunk.github.io/syntax-community](https://i-am-drunk.github.io/syntax-community/) | Obsidian + Raycast style community directory |

## Package Architecture

Syntax separates Core from courses and tools using three clear package formats (plus theme token groundwork for future `.syntaxtheme` packages):

- **`.syntaxcourse`**: Interactive courses (for example Analytic Geometry MPM2D and Thinking in Code) with lessons, checks, and declared embedded plugin requirements.
- **`.syntaxplugin`**: Global app tools (Pen Studio, Video Walkthroughs, Checkmark Gate, Floating Windows, Formula Playbook). Plugins that touch Syntax core display a compact warning icon in lists and **"This plugin touches core."** in their detail sheet.
- **`.syntaxembeddedplugin`**: Reusable course libraries (Math Graph Engine, Grid Coding Engine, Unit Circle Lab) that include an **AI Usage Card** so AI connectors (Claude, ChatGPT, MCP) can discover and reuse them.

## Production Libraries

Built on small, maintained late-2026 libraries instead of hand-rolled plumbing:

- **`@clerk/react` & `@clerk/themes`** for hosted Google, GitHub, and Email sign-in (works free on `i-am-drunk.github.io` with a `pk_test_` key, and scales to production `pk_live_` at $0/month via a free `is-a.dev` subdomain or the GitHub Student Developer Pack)
- **`zod`** for package manifest validation and typed schemas
- **`zustand`** for persisted package registry and account state
- **`react-error-boundary`** for crash isolation and dev-channel diagnostics logging (Sentry and PostHog ready)

## Run Locally

```bash
npm install
npm run dev
```

To enable Clerk Auth locally, copy `.env.example` to `.env.local` and set `VITE_CLERK_PUBLISHABLE_KEY`. For GitHub Pages deployments, add `VITE_CLERK_PUBLISHABLE_KEY` as a GitHub Actions Repository Variable.
