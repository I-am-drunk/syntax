---
name: syntax-graph-scenes
description: Construct mathematically exact, non-spoiling GeoScene diagrams for BrilliantGraph using deterministic scene builders.
---

# Syntax Graph Scenes

Use this skill whenever creating or editing `GeoScene` objects (`scene`, `solvedScene`, `worked.steps[*].scene`, `explanation.steps[*].scene`).

## 1. Never Spoil the Answer
- **`scene` (Question State):** Show **ONLY the given information** (given points, given line/segment, given circle). Do NOT draw the answer line, midpoint, or right-angle marker that the student is being asked to find.
- **`solvedScene` & `explanation.steps[*].scene`:** Dim the given geometry (`dim: true`) and reveal the solved line/point/right-angle in `teal` or `green`.

## 2. Compute Coordinates — Never Hand-Type
Always use `syntax_author_scene` (or `tools/syntax-mcp/src/sceneBuilders.ts`):
- `line_through(p1, p2)` -> exact integer-normalized `ax + by + c = 0`
- `perpendicular_through(baseLine, point)` -> exact perpendicular `ax + by + c = 0`
- `midpoint(p1, p2)` -> exact midpoint `GeoPoint`
- `circle_through(center, throughPoint)` -> exact radius `GeoCircle`
- `right_angle_at_intersection(l1, l2)` -> exact intersection vertex + orthogonal `dir1`, `dir2`

## 3. Graph Integrity Invariants (Checked by `syntax_audit_lesson`)
1. `xMin < xMax` and `yMin < yMax` with at least 1.5–2 units of breathing room around all points.
2. Every `GeoLine` equation label (e.g. `y = −4/3 x + 3`) must mathematically match its `{ a, b, c }` coefficients.
3. Every `GeoRightAngle` must satisfy `dir1 · dir2 = 0` and its `vertex` must lie on the true intersection of the perpendicular lines/segments.
4. Zero label collisions (`computeLabelLayout` checks pairwise distances). Keep labels short (`m = 3/4`, `P(6, 1)`).
