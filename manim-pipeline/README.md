# Syntax Motion Studio (`manim_syntax`)

Reusable Manim Community (v0.22+) + Moving Sema choreography pipeline for Syntax MPM2D walkthroughs.

## Architecture
- **`manim_syntax/theme.py`** — Light (`#FFFFFF`) & Dark (`#141414`) Brilliant tokens synced 1:1 with `src/mpm2d/mpm2dBrilliant.css`.
- **`manim_syntax/graph.py`** — Full-bleed Brilliant `SyntaxGraph` + prebuilt kinetic verbs (`line`, `point`, `rise_run`, `right_angle`, `make_rotation_rig`, `make_elevator_rig`, `make_lock_ripple_anims`, `make_pill_badge`).
- **`manim_syntax/algebra.py`** — Kinetic equation tokens (`parabolic_jump_anim`, `orbital_swap_anims`, `spin_sign_anim`, `make_math_chip`, `make_result_pill`, `make_whisper`). `MF_Tools` (`TransformByGlyphMap`) is also preinstalled in `syntax-manim:latest`.
- **`manim_syntax/voice.py`** — Word-synced Edge-TTS strictly locked to `en-US-AndrewNeural` with inline `<cue:name>...</cue>` millisecond timings.
- **`manim_syntax/sema_director.py`** — In-scene Moving Sema choreographer (`self.sema.enter`, `fly_to`, `track`, `untrack`, `react`) with automatic AABB overlap avoidance and `<beat>.track.json` export.
- **`manim_syntax/qa.py`** — Pre-render no-slop linter + post-render 6-frame visual QA contact sheets with projected Sema positions & gaze arrows.
- **`SKILL.md`** — Hard non-slop design contract for human & AI scene authoring.

## Commands
```bash
# Render Lesson 1 Page 3 vertical slice (Light + Dark, 60fps + Sema track + QA sheets)
npm run render:walkthroughs -- --page l1-p3-worked --theme both --quality web

# Re-render a single beat
npm run render:walkthroughs -- --page l1-p3-worked --beat vis-2 --force
```
