---
name: syntax-course-authoring
description: Design and author Brilliant-style Grade 10 Analytic Geometry (MPM2D) lessons and catch-up rescue lessons using the Syntax MCP toolkit.
---

# Syntax Course Authoring

Use this skill whenever designing, auditing, or improving a `GeoLesson` or `CatchupLesson` in `src/mpm2d/data/`.

## 1. The Brilliant Lesson Arc (4 Stages)
Every core lesson in `UNIT2_LESSONS` follows a tight 4-stage arc:
1. **See It (`explore`):** One interactive drag-and-discover widget (`CompactExploration`). Let the student see the geometric invariant before naming formulas.
2. **Worked Example (`worked`):** One real problem from Alex Ivey's classroom notes, starting with a numbered `plan: string[]` (2–4 short steps) and stepping through the algebra alongside progressive `GeoScene` diagrams.
3. **Guided Practice (`choice`, `math-input`, `multi-step`):** Real problems from Handouts W2/W4 and Ch. 2 Test. Each page tests **one** micro-skill or walks a multi-step ledger (`① ② ③`).
4. **Mastery Checks (`checks[]`):** Separated from `pages[]`! Independent problems with no hand-holding that verify transfer.

## 2. Catch-Up Rescue Lessons (`src/mpm2d/data/catchupCourses.ts`)
- Each `CatchupLesson` targets **one** prerequisite bottleneck (`supportsLessonId`, `branchSide: 'left' | 'right'`, `minutes: 2–3`, `skillTag`).
- Structure: 1 quick visual intuition or diagnostic `choice` -> 1 crystal-clear `worked` card -> 1 `choice` or `math-input` practice -> 1 `checks[]` item.
- Never dump a wall of algebra rules. Show one concrete numerical example, then let the student try immediately.

## 3. Mandatory MCP Workflow (Inspect -> Audit -> Author -> Verify)
1. Call `syntax_inspect_courses` and `syntax_inspect_lesson` to see the current lesson structure.
2. Call `syntax_inspect_sources` to match Alex Ivey's exact classroom wording and intent.
3. Call `syntax_audit_lesson` to surface math, geometry, pedagogy, and UI issues.
4. Use `syntax_author_scene` to compute all `GeoScene` coordinates, lines, midpoints, circles, and right-angle markers — never hand-type `ax + by + c = 0` or intersections.
5. Call `syntax_verify` (`tsc -b && vite build` + full audit) before committing.
