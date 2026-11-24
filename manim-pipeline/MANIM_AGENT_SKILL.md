# Syntax MPM2D Manim & Real-Time Math Animation Agent Skill

> Synthesized from leading open-source Manim AI agent skills (`adithya-s-k/manim_skill`, `Yusuke710/manim-skill`, `iart-ai/manim-skills`, `paulnegz/manim-mcp`) and real-time browser math engines (`maloyan/manim-web`, `@elucim/core`, Motion Canvas / Canvas Commons), tailored specifically for **Syntax MPM2D**.

---

## 1. Architecture Decision: Real-Time Procedural Browser Engine vs. Offline MP4 Manim

| Dimension | Pre-Rendered MP4 Manim | Syntax Real-Time 144Hz Vector/Kinetic Engine (`LiveMathVideoStage.tsx`) |
| --- | --- | --- |
| **Bundle / Asset Size** | ~13 MB for 1 single page (~1.8 GB for 142 pages) | **0 MB** video assets (pure procedural math + SVG + CSS transforms) |
| **Coverage** | 1 / 142 pages | **142 / 142 pages** (both **Guided Hint Videos** & **Full Solution Videos**) |
| **Load Latency** | Network download + video decode buffering | **0 ms** instant playback |
| **Window / WinBox Resize** | Blurs, stretches, or creates dead-space letterboxes | **Infinite vector sharpness**, aspect-adaptive with zero dead space |
| **Theme Switching** | Requires dual light/dark MP4 encodes (2x storage) | **Instantaneous CSS/SVG palette swap** between Light & Charcoal Dark |
| **Guided Hints (No Spoilers)** | Hard to maintain separate non-spoiler renders | **Dedicated `mode="hint"` program** showing only given geometry, formulas & trap checks |
| **Interactivity** | Passive video pixels | **144Hz Sema spring flight, grab-and-stretch taffy physics, cursor gaze, live chapter scrubbing** |

**Rule of Thumb for Syntax Agents**:
- Default to the **Real-Time 144Hz Procedural Engine** (`src/mpm2d/walkthrough/lessonVideoDirector.ts` + `LiveMathVideoStage.tsx`) for ALL interactive course pages, Guided Hint Videos, and "Why?" Full Solution Videos.
- Reserve the offline Python ManimCE pipeline (`manim-pipeline/`) only for standalone marketing reels, YouTube exports, or complex 3D OpenGL scenes that cannot be expressed cleanly in 2D SVG/Canvas.

---

## 2. Core Choreography Rules (from `manim_skill`, `manim-skills` & 3Blue1Brown Pedagogy)

### A. Visual Geometry Lens (Show the Math Moving, Never Static Slides)
Every visual beat must animate at least one genuine geometric transformation:
1. **Rise / Run Trace (`rise-run`)**: Draw horizontal `Δx` leg first, then vertical `Δy` leg, popping badges only after each leg finishes.
2. **True 90° Rotation (`rotate-90`)**: Rotate a direction ray smoothly from `0° → 90°` around the pivot with a live sweeping wedge and live degree readout (`0° ... 90°`).
3. **Parallel Slide Lock (`slide-line`)**: Sweep `c` continuously in `ax + by + c = 0` until the line hits target point `P(x, y)` and emits a lock pulse.
4. **Midpoint Convergence (`midpoint-converge`)**: Slide glowing markers inward from both endpoints simultaneously until they collide at `M`. In **Guided Hint** mode (`hideAnswer: true`), keep the label as `M = (?, ?)`.
5. **Pythagoras Right-Triangle Build (`pythagoras-legs`)**: Animate `Δx`, then `Δy`, then the hypotenuse `d`.
6. **Circle Radius Sweep (`circle-sweep`)**: Sweep the circumference with an animated radius arm around `(cx, cy)`.

### B. Kinetic Algebra Lens (Manim `TransformMatchingTex` Mental Model)
Never dump a wall of static equations. Port kinetic algebra primitives into every beat:
1. **Parabolic Jump Across `=` (`parabolic-jump`)**: Lift a term along a smooth parabolic arc over `=`, morphing its sign mid-air (`+ 3x` → `− 3x`) with a subtle color shift.
2. **180° Circular Orbital Fraction Flip (`orbital-flip`)**: Orbit numerator and denominator 180° around the fraction bar while spinning the sign (`−` → `+`) with elastic overshoot.
3. **Color-Coded Substitution Drop (`substitute-drop`)**: Display color-matched given chips (`m`, `x`, `y`), show the symbolic template (`y = m · x + b`), drop substituted values downward into slots, then simplify.
4. **Divide-Every-Term Sweep (`divide-all`)**: Highlight the divisor badge (`÷ 2`) so students never forget to divide the constant term.
5. **Stacked Vertical Fractions Everywhere**: Always render fractions vertically (`MathText.tsx` auto-stacks `a/b`) and preserve exact radicals (`√20`, `√37`).

### C. Pacing, Subtitles & Sema Companion QA (from `Yusuke710/manim-skill`)
1. **Deliberate Pacing**: Keep each beat between **8s and 12.5s** (`durationSec`) so a Grade 10 student can read every symbol comfortably.
2. **Audio/Subtitle Sync First**: Write concise, natural spoken narration first (`narration`), derive word-level timestamps (`buildWordTimings`), and time every animation window (`startFrac`..`endFrac`) against the narration.
3. **Always-Visible Prioritized Subtitles**: Keep word-highlighted karaoke captions anchored cleanly above the non-overlapping transport bar (`bottom: 10px`) even while the user grabs/stretches Sema.
4. **Non-Spoiler Guarantee for Guided Hints**: `buildGuidedHintProgram` must ONLY read `preScene` / `scene` (never `solvedScene` or final answer values) and present formula + first setup move + common trap guard.

---

## 3. Adding a New Curated Video Lesson in Syntax MPM2D

1. Open `src/mpm2d/walkthrough/lessonVideoDirector.ts`.
2. Add a branch in `buildCuratedSolution(pageId)` returning a `LiveMathProgram` with:
   - `visual` lens: 2 to 4 `LiveMathBeat` entries using `baseScene`, `revealScene`, and `visualEffects`.
   - `algebra` lens: matching `LiveMathBeat` entries using `givenChips` and `algebraSteps` (`parabolic-jump`, `orbital-flip`, `substitute-drop`, `divide-all`, `result-pill`).
3. Verify zero answer leaks in Guided Hint mode (`buildGuidedHintProgram`) and verify exact numerical alignment with the lesson data (`unit2Level1.ts`, `unit2Level2.ts`, `catchupCourses.ts`).
4. Run `npm run build` and `npm run verify:graphs`, then verify live playback in both Light & Charcoal Dark themes with headless Playwright.

---

## 4. Offline ManimCE Checklist (When Generating Standalone Exports)

If rendering offline MP4s via `manim-pipeline/`:
- Follow the **Narration → TTS → Timing JSON → Manim Code → Render → Frame QA** loop (`Yusuke710/manim-skill`).
- Use `TransformMatchingTex` with isolated `substrings_to_isolate` tokens for algebraic morphs (`iart-ai/manim-skills`).
- Use `ValueTracker` + `always_redraw` for continuous geometry (angles, sliding lines, right-angle markers).
- Keep all active objects within safe margins (`[-6.4, 6.4] x [-3.4, 3.4]` in 16:9) and reserve the bottom strip (`y < -2.7`) exclusively for subtitles.
- Visually inspect key frames at `t = 25%, 50%, 75%, 95%` before shipping.
