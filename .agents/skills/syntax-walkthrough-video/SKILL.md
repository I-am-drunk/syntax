---
name: syntax-walkthrough-video
description: Architecture and workflow for Syntax MPM2D's guided walkthrough video system — Video.js 10 (@videojs/react) chapter player, WinBox floating/docked window, SemaStageRuntime interactive mascot overlay, and the Manim Community + package.py render pipeline. Use whenever editing src/mpm2d/walkthrough/*, WinBoxWindow.tsx, or manim-pipeline/*.
---

# Syntax Walkthrough Video System Skill

This skill documents the end-to-end architecture of Syntax MPM2D's guided walkthrough video system so you can debug, extend, or add new walkthrough videos without introducing timeline bugs, header duplication, or geometric drift.

## 1. Architecture Overview

The video system has three layers:

1. **Authoring & Verification (`manim-pipeline/scenes/*.py`, `manim_syntax/`)**
   - Each beat (`vis-1`, `vis-2`, `vis-3`, `alg-1`, `alg-2`, `alg-3`) is a `SyntaxScene` subclass rendered in both `light` (`#FFFFFF`) and `dark` (`#141414`) themes with `en-US-AndrewNeural` voiceover and word-boundary timestamps.
   - `self.sema` (`SemaDirector`) records 20 Hz normalized viewport trajectories, 3D eye-gaze targets (`lookX`, `lookY`), Bloub expressions, and prompt cues (`callout`, `say`, `subtitle`) into `manim-pipeline/beats/<pageId>/<beatId>.track.json`.
   - `self.verify` (`SyntaxVerifier`) enforces isotropic 1:1 coordinate grids, point-on-line lock-on (`<= 0.04` world units), 90° perpendicularity (`±0.5°`), AABB label non-overlap, and motion density (`maxStaticGapSec <= 1.8s`).

2. **Lens Packager (`manim-pipeline/package.py` / `npm run package:walkthroughs`)**
   - Concatenates the per-beat MP4s in `manim-pipeline/beats/<pageId>/<theme>/` into **one continuous, frame-accurate H.264 MP4 per lens**:
     - `public/assets/walkthroughs/<pageId>/<theme>/visual.mp4`
     - `public/assets/walkthroughs/<pageId>/<theme>/algebra.mp4`
   - Encodes with `-g 30 -keyint_min 30 -sc_threshold 0 -movflags +faststart` (keyframe every 0.5 s) so dragging the scrubber seeks instantaneously.
   - Merges beat `.track.json` files into `<lens>.sema.json` on the continuous lens timeline and deduplicates same-timestamp keyframes so Sema never teleports at beat boundaries.
   - Generates `<lens>.captions.vtt` phrase cues from the word timings.
   - Writes `src/mpm2d/walkthrough/videoManifest.ts` with exact chapter ranges (`{ beatId, start, end }`).

3. **React Player & Interactive Overlay (`src/mpm2d/walkthrough/`)**
   - `WalkthroughPlayer.tsx` uses **Video.js 10 (`@videojs/react`)** (`createPlayer({ features: videoFeatures })`, `<Container>`, `<Video>`, `<Controls>`, `<TimeSlider.Chapters>`, `<PlayButton>`, `<PlaybackRateButton>`, `<MuteButton>`, `<FullscreenButton>`).
   - Registers chapter ranges with `useCreateTextTrack({ kind: 'chapters', cues })` so `<TimeSlider.Chapters>` renders segmented chapter rails and hover chapter titles natively.
   - Overlays `<SemaStageRuntime>` inside the Video.js `<Container>` so Sema flies across the video at 60–120 fps, tracks math features with 3D eyes, and can be grabbed and stretched elastically with a rubber-band tether without pausing the video.
   - Wraps floating mode in `<WinBoxWindow>` (`src/mpm2d/components/WinBoxWindow.tsx`) with `headerActions` portaled directly into the WinBox titlebar.

## 2. Adding or Updating a Walkthrough

1. **Author or edit the Manim scene** in `manim-pipeline/scenes/<lesson_page>.py` following `manim-pipeline/SKILL.md`.
   - Always keep `isotropic=True` on `SyntaxGraph`.
   - Ensure rotation pivots lie on both the original and perpendicular lines, and add `self.verify.assert_line_through_points(...)` for every key point.
2. **Register the scenes** in `SCENE_REGISTRY` inside `manim-pipeline/render.py`.
3. **Render & verify** (requires Docker with `syntax-manim:latest`):
   ```bash
   npm run verify:walkthroughs
   npm run render:walkthroughs
   ```
4. **Package lenses** (runs with local Python + `ffmpeg` or `imageio-ffmpeg`, no Docker required):
   ```bash
   npm run package:walkthroughs
   ```
5. **Add step metadata** in `src/mpm2d/walkthrough/walkthroughData.ts` using `lens(pageId, 'visual', 'Visual', [...])` and `beat(beatId, stepIndex, title, caption)`.
6. **Verify TypeScript and production bundle**:
   ```bash
   npm run build
   ```

## 3. UI & Interaction Rules

- **No duplicate window headers:** When `floating={true}`, `WinBoxWindow` renders the titlebar (`Guided walkthrough · <Title>`), with eyebrow-first CSS truncation (`.wb-title-eyebrow` shrinks before `.wb-title-main`). Never render a second title header inside `WalkthroughContent`.
- **Single active-step banner:** Show only the active step banner (`.wt-active-step-bar`) above the video stage. As the video plays or scrubs across chapter boundaries, `beatIndex` updates automatically from `currentTime`.
- **Auto-dim controls when pointer leaves the window:** `.wt-shell.is-playing:not(:hover):not(:focus-within) .wt-vjs-controls` dims playback controls to `opacity: 0.22` so the math canvas stays unobstructed while watching.
- **No Framer Motion `layoutId` inside draggable WinBox windows:** Use pure CSS transitions for `.wt-lens-tab` so dragging the window never causes the active pill to lag behind the cursor.
