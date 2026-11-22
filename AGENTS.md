# Working on Syntax MPM2D

Syntax MPM2D is an interactive Grade 10 Analytic Geometry learning app modeled after Brilliant's lesson experience, augmented with:

1. **Pen Studio (`src/mpm2d/pen/`)** — Split-screen or full-screen `tldraw` math worksheet with paginated steps, scratch sheets, and a 3D drawer HUD.
2. **Sema (`src/mpm2d/mascot/`)** — Parametric 3D spherical-eye semicolon companion (`Sema.tsx`, `semaEngine.ts`) with 16 Bloub expressions, 8 morph shapes, elastic drag-and-stretch physics, and idle roaming.
3. **Guided Walkthrough Video System (`src/mpm2d/walkthrough/` + `manim-pipeline/`)** — Studio-grade kinetic math walkthroughs rendered with Manim Community Edition (`manim_syntax`), narrated with `en-US-AndrewNeural`, packaged into single per-lens MP4s (`visual.mp4`, `algebra.mp4`) with chapter cues and WebVTT captions, and played in React with **Video.js 10 (`@videojs/react`)** + **WinBox (`WinBoxWindow.tsx`)** + **`SemaStageRuntime.tsx`**.

## Skills & Guides

Before modifying any part of the video system, read the workspace skills:

- **`.agents/skills/syntax-walkthrough-video/SKILL.md`** — End-to-end architecture for the Video.js 10 player, WinBox floating/docked windows, `package.py` lens concatenation, and `SemaStageRuntime` overlay.
- **`.agents/skills/videojs-react/SKILL.md`** — Video.js 10 (`@videojs/react`) component and hook reference (`createPlayer`, `Container`, `Video`, `Controls`, `TimeSlider.Chapters`, `useCreateTextTrack`).
- **`manim-pipeline/SKILL.md`** — Manim Community scene authoring rules, `SyntaxGraph` isotropic 1:1 coordinate lock-on invariants, `SemaDirector` choreography API, and `SyntaxVerifier` compile gates.

## Hard Architectural Rules for Walkthrough Videos

1. **Use Video.js 10 (`@videojs/react`), never hand-rolled `<video>` scrubbers or deprecated `@vidstack/react`.**
   - Player state is created via `createPlayer({ features: videoFeatures })`.
   - Timeline scrubbing and chapter markers use `<TimeSlider.Root>` + `<TimeSlider.Chapters>` backed by a `kind: 'chapters'` text track (`useCreateTextTrack`).
2. **One continuous seekable MP4 per lens (`visual.mp4`, `algebra.mp4`), never per-beat file swapping.**
   - Individual Manim beat renders live in `manim-pipeline/beats/<pageId>/`.
   - Run `npm run package:walkthroughs` (`python manim-pipeline/package.py`) to concatenate beat clips into `public/assets/walkthroughs/<pageId>/<theme>/<lens>.mp4` with 0.5 s GOP keyframes (`-g 30`), merge `<lens>.sema.json` without duplicate timestamps, emit `<lens>.captions.vtt`, and generate `src/mpm2d/walkthrough/videoManifest.ts`.
3. **Single source of truth for step titles and captions.**
   - All human-readable step titles, equations, and bullet captions live in `src/mpm2d/walkthrough/walkthroughData.ts` keyed by `beatId` (`vis-1`, `alg-1`, etc.).
   - `videoManifest.ts` stores only asset paths and chapter time ranges (`{ beatId, start, end }`).
4. **WinBox (`WinBoxWindow.tsx`) owns the floating window titlebar.**
   - When `WalkthroughContent` or `FormulaSheetContent` is rendered with `floating={true}` inside `WinBoxWindow`, never render a duplicate inner header titlebar. Pass window actions (`Dock`, `Print`) via `WinBoxWindow`'s `headerActions` prop.
5. **Mathematical & geometric lock-on verification.**
   - Every Manim graph scene in `manim-pipeline/scenes/` must use `SyntaxGraph(..., isotropic=True)` (default) so 90° screen rotations match $m_\perp = -1/m$.
   - Every rotation or elevator slide must assert `self.verify.assert_perpendicular(...)`, `self.verify.assert_line_slope(...)`, and `self.verify.assert_line_through_points(...)` before the scene exits.
6. **Voice lock.**
   - All walkthrough narration uses `en-US-AndrewNeural` via `self.narrate("...<cue:id>...</cue>...")`. Never mix other TTS voices.

## Commands

- `npm run dev` — Start Vite dev server.
- `npm run package:walkthroughs` — Package beat renders from `manim-pipeline/beats/` into per-lens MP4s, WebVTT captions, merged Sema tracks, and `videoManifest.ts`.
- `npm run verify:walkthroughs` — Run the Manim geometric/layout compiler pass (`SyntaxVerifier`) and static no-slop linter.
- `npm run render:walkthroughs` — Render Manim scenes via Docker and automatically run `package.py`.
- `npm run build` — Run `tsc -b && vite build` (must pass with 0 errors before every commit).
