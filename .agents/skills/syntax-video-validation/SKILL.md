---
name: syntax-video-validation
description: Validate Manim walkthrough videos, Sema choreography tracks, AndrewNeural narration, and 6-frame QA contact sheets before shipping.
---

# Syntax Video Validation

Use this skill after authoring or rendering any Manim walkthrough scene in `manim-pipeline/`.

## 1. Hard Quality Bar
The reference bar is the original voiced walkthrough (`en-US-AndrewNeural` narration, crisp step synchronization, zero PowerPoint slop).

## 2. Automated Verification Gates
1. **Static & Geometric Verifier:** Run `npm run verify:walkthroughs` (`python3 manim-pipeline/render.py --verify-only`) or `syntax_verify(suite="video")`:
   - Enforces Manim CE (`manim_syntax`) only (no ManimGL).
   - Enforces `en-US-AndrewNeural` voice lock.
   - Enforces `SyntaxGraph(..., isotropic=True)` and `assert_perpendicular` / `assert_line_slope` / `assert_line_through_points` / `assert_pivot_on_both_lines`.
   - Bans PowerPoint slop (`make_step_banner`, `make_side_card`, text walls).
2. **Packaging Contract:** Run `npm run package:walkthroughs` (`python manim-pipeline/package.py`):
   - One continuous seekable MP4 per lens (`visual.mp4`, `algebra.mp4`) with `-g 30` (0.5 s GOP).
   - Merged `<lens>.sema.json` without duplicate timestamps.
   - Word-timed `<lens>.captions.vtt` and updated `src/mpm2d/walkthrough/videoManifest.ts`.
3. **Visual Contact-Sheet Acceptance Gate:**
   - Passing exit code 0 is NOT acceptance.
   - Run `syntax_video_status(pageId)` to locate the 6-frame contact sheets under `manim-pipeline/.cache/qa/` and visually inspect them for label overlap, Sema placement/gaze, and clean dark/light contrast before shipping.
