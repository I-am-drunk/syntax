---
name: syntax-question-writing
description: Write clear, Grade 10 plain-English math questions, non-spoiling hints, targeted distractors, and verified StepAnswerSpec definitions for Syntax MPM2D.
---

# Syntax Question Writing

Use this skill when writing or revising prompts, options, hints, plans, and explanations in `src/mpm2d/data/`.

## 1. Wording Rules (Grade 10 Plain English)
- **One clear ask per page.** Keep prompts to 1–2 crisp sentences.
- **Bold key math objects** (`**A(−2, 1)**`, `**perpendicular**`, `**y = mx + b**`) so students can scan the givens in 2 seconds.
- **Match Alex Ivey's classroom terminology:** "negative reciprocal", "right bisector", "altitude", "median", "isolate y", "slope y-intercept form".
- **No em dashes (`—`).** Use commas, colons, or short sentences instead.
- **Use true minus signs (`−`)** in display text and labels (e.g., `y = −3x − 3`), while `mathParser.ts` accepts standard ASCII `-` from student keyboards.

## 2. Distractors & Non-Spoiling Hints
- Every wrong option in `choice` and `multi-choice` MUST have a targeted `hint` that diagnoses the specific mistake (e.g., flipped without negating, negated without flipping, swapped `x` and `y`, forgot to divide the constant term).
- Never write generic hints like "Try again."
- On `math-input` and `multi-step` pages, provide a non-spoiling `nudge` (points to Step 1 without giving away the answer) and `commonMistakes` for predictable sign/reciprocal errors.

## 3. Answer Spec Verification
- Every `math-input` and `multi-step` answer uses `StepAnswerSpec` (`number | point | line | circle`).
- `answer.display` must be clean and consistent with `expected` (verified automatically by `syntax_audit_lesson` via `gradeAnswer`).
- For lines requiring `y = mx + b`, set `requireSlopeIntercept: true`.
- For exact radical lengths, set `exactRequired: true` and mention "exact length" in the prompt.
