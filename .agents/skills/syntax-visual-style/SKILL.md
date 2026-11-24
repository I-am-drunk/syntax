---
name: syntax-visual-style
description: Enforce Brilliant-grade visual calm, semantic color tokens, neutral dark mode, and clean math typography across Syntax MPM2D.
---

# Syntax Visual Style

Use this skill when styling UI components, graph scenes, or walkthrough videos in `syntax-learning`.

## 1. Color System (No Cold Blue-Slate Dark Mode)
- **Surfaces:** Pure white (`#FFFFFF`) in light mode; neutral warm-charcoal (`#141414` / `#1C1C1C`) in dark mode. Never use cold blue-slate dark backgrounds (`#0f172a`, `#1e293b`).
- **Semantic Geometry Tokens (`GeoColor`):**
  - `blue`: Given / primary reference line or segment
  - `teal`: Target / solved line, perpendicular, or midpoint
  - `amber`: Highlighted anchor point or y-intercept
  - `green`: Verified right-angle marker (`90°`) or merged convergence
  - `violet`: Secondary comparison object
  - `red`: Error / contradiction highlight
  - `muted` / `dim: true`: Prior geometry dimmed to ~28% opacity for spatial memory

## 2. Typography & Math Formatting
- Use `MathText` (`src/mpm2d/components/MathText.tsx`) for all prompts, options, and math lines.
- Prefer stacked fractions (`stackedFractions={true}`) in display equations and formula cards rather than raw `"0/5"` text.
- **No em dashes (`—`)** anywhere in user-facing copy.
- Keep cards uncluttered: generous whitespace, clear visual hierarchy, and strict 1:1 aspect ratio on all coordinate grids.
