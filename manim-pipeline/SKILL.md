# Syntax Motion Studio — Non-Slop Manim + Moving Sema Skill

This skill enforces studio-grade Brilliant / 3Blue1Brown visual pedagogy across all Syntax MPM2D walkthrough videos.

## Hard Constraints (Enforced by `manim_syntax/qa.py`)

1. **Engine Lock:** Manim Community Edition (`v0.22+`) via `manim_syntax` ONLY. Never mix ManimGL syntax (`ShowCreation`, `InteractiveScene`, `manimlib`).
2. **Voice Lock:** `en-US-AndrewNeural` ONLY via `self.narrate("...<cue:name>...</cue>...")`. Never use any other voice or fallback TTS.
3. **Style Locked in Code:** Never hardcode hex colors inside scene files. Always pass semantic tokens (`"blue"`, `"teal"`, `"amber"`, `"green"`, `"red"`, `"violet"`, `"ink"`, `"muted"`) resolved from `SyntaxTheme` (synced 1:1 with `src/mpm2d/mpm2dBrilliant.css`: `#FFFFFF` light / `#141414` dark).
4. **Zero PowerPoint Slop:**
   - **BANNED:** Top boxed step banners (`make_step_banner`), boxed right-hand summary cards (`make_side_card`), bulleted text walls, or `Write()` overwriting equations.
   - The React player header already shows the step title and equation. The Manim canvas is **100% full-bleed math**.
5. **Dim vs. FadeOut (Opacity Layering):** Dim prior geometry (`opacity=0.28`) instead of wiping the canvas so students retain spatial memory.
6. **Kinetic Transformations Over Text Slides:**
   - **Graphs:** Always use physical geometric verbs from `SyntaxGraph` (`line`, `rise_run`, `make_rotation_rig`, `make_elevator_rig`, `make_lock_ripple_anims`).
   - **Algebra:** Always transform persistent tokens in-place (`parabolic_jump_anim`, `orbital_swap_anims`, `spin_sign_anim`, `make_math_chip`, or `MF_Tools.TransformByGlyphMap`).
7. **Word-Locked Motion Density:** Wrap every spoken beat with inline `<cue:name>` tags and drive animations via `self.play_until(cues["name"].end, ...)`. Flag any static dead air > 1.8s.
8. **Integrated Moving Sema (`self.sema`):**
   - Author Sema directly against live Manim mobjects or graph coordinates (`self.sema.enter`, `self.sema.fly_to`, `self.sema.track`, `self.sema.react`).
   - Populate rich `SemaPrompt(callout=..., say=..., subtitle=..., mode=..., accent=...)` fields so the browser runtime can toggle Callouts, Speech Bubbles, Word-Karaoke CC, or Quiet Mode dynamically without re-rendering.
9. **Hard Visual Acceptance Gate:** Passing exit code 0 is NOT acceptance. Always inspect the 6-frame contact sheet (`manim-pipeline/.cache/qa/`) with Sema gaze projection before shipping.


## 10. Packaging & Video.js 10 Playback Contract

- `render.py` outputs individual beat MP4s and `.track.json` files to `manim-pipeline/beats/<pageId>/` and automatically invokes `manim-pipeline/package.py`.
- `package.py` concatenates beat MP4s into one seekable H.264 MP4 per lens (`public/assets/walkthroughs/<pageId>/<theme>/visual.mp4` and `algebra.mp4`) with 0.5 s GOP keyframes (`-g 30`), merges `.sema.json` without duplicate timestamps, emits WebVTT `.captions.vtt`, and writes `src/mpm2d/walkthrough/videoManifest.ts`.
- Whenever you verify a rotation or elevator scene, use `self.verify.assert_line_through_points(graph, line_mob, p1, p2, ...)` and `self.verify.assert_pivot_on_both_lines(graph, base_line, rotated_line, pivot_xy)` so every geometric lock-on is checked in world coordinates before packaging.
