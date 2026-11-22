"""
SyntaxVerifier — Hard mathematical, geometric, spatial, and motion-density compiler pass.

Unlike regex linters, SyntaxVerifier inspects the ACTUAL rendered Manim mobjects at runtime:
  1. Point-on-line accuracy (`point_on_line`) in world coordinates (< 0.04 units)
  2. True screen-space perpendicularity (`perpendicular`, 90.0° ± 0.5°)
  3. Rendered line slope in graph coordinates (`line_slope`)
  4. Frame safe-zone clipping check (zero off-screen labels/pills/equations)
  5. Foreground label/pill AABB collision check (zero overlapping text)
  6. Motion-density & voice-sync gates (max static gap <= 1.8s, AndrewNeural locked, Sema cues > 0)

Any failure raises `VerificationError`, aborting the render BEFORE broken videos can ship.
"""

from __future__ import annotations

from dataclasses import dataclass
import math
from typing import TYPE_CHECKING

from manim import Line, Mobject, config
import numpy as np

if TYPE_CHECKING:
    from .graph import SyntaxGraph
    from .scene import SyntaxScene


class VerificationError(RuntimeError):
    """Raised when a scene violates a mathematical, geometric, or layout invariant."""


@dataclass
class VerificationCheck:
    name: str
    passed: bool
    detail: str


class SyntaxVerifier:
    def __init__(self, scene: "SyntaxScene") -> None:
        self.scene = scene
        self.checks: list[VerificationCheck] = []
        self._tracked_labels: list[tuple[str, Mobject]] = []

    def register_label(self, name: str, mob: Mobject) -> Mobject:
        self._tracked_labels.append((name, mob))
        return mob

    def _record(self, name: str, passed: bool, detail: str) -> None:
        self.checks.append(VerificationCheck(name=name, passed=bool(passed), detail=detail))

    # ------------------------------------------------------------------
    # 1. Mathematical & Geometric Invariants (live mobject inspection)
    # ------------------------------------------------------------------
    def assert_isotropic(self, graph: "SyntaxGraph", label: str = "graph") -> None:
        diff = abs(graph.sx - graph.sy)
        ok = diff < 1e-5
        self._record(
            f"isotropic:{label}",
            ok,
            f"sx={graph.sx:.4f}, sy={graph.sy:.4f} (diff={diff:.6f})",
        )

    def assert_point_on_line(
        self,
        graph: "SyntaxGraph",
        line_mob: Mobject,
        xy: tuple[float, float],
        *,
        name: str = "line",
        tol: float = 0.04,
    ) -> None:
        if hasattr(line_mob, "update"):
            line_mob.update()
        a = np.asarray(line_mob.get_start(), dtype=float)
        b = np.asarray(line_mob.get_end(), dtype=float)
        vec = b - a
        norm = float(np.linalg.norm(vec))
        if norm < 1e-6:
            self._record(f"point_on_line:{name}@{xy}", False, "degenerate zero-length line")
            return
        d = vec / norm
        p = graph.pt(*xy)
        dist = float(np.linalg.norm(np.cross(p - a, d)))
        self._record(
            f"point_on_line:{name}@{xy}",
            dist <= tol,
            f"distance={dist:.5f} world units (tol={tol})",
        )

    def assert_perpendicular(
        self,
        line_a: Mobject,
        line_b: Mobject,
        *,
        name: str = "perp",
        tol_deg: float = 0.5,
    ) -> None:
        for ln in (line_a, line_b):
            if hasattr(ln, "update"):
                ln.update()
        va = np.asarray(line_a.get_end(), dtype=float) - np.asarray(line_a.get_start(), dtype=float)
        vb = np.asarray(line_b.get_end(), dtype=float) - np.asarray(line_b.get_start(), dtype=float)
        na, nb = float(np.linalg.norm(va)), float(np.linalg.norm(vb))
        if na < 1e-6 or nb < 1e-6:
            self._record(f"perpendicular:{name}", False, "degenerate zero-length line")
            return
        cos_theta = abs(float(np.dot(va, vb)) / (na * nb))
        angle_deg = math.degrees(math.acos(max(-1.0, min(1.0, cos_theta))))
        err = abs(90.0 - angle_deg)
        self._record(
            f"perpendicular:{name}",
            err <= tol_deg,
            f"screen_angle={angle_deg:.3f}° (error={err:.3f}°, tol={tol_deg}°)",
        )

    def assert_line_slope(
        self,
        graph: "SyntaxGraph",
        line_mob: Mobject,
        expected_slope: float,
        *,
        name: str = "slope",
        tol: float = 0.02,
    ) -> None:
        if hasattr(line_mob, "update"):
            line_mob.update()
        a = np.asarray(line_mob.get_start(), dtype=float)
        b = np.asarray(line_mob.get_end(), dtype=float)
        dx_math = (b[0] - a[0]) / graph.sx
        dy_math = (b[1] - a[1]) / graph.sy
        if abs(dx_math) < 1e-6:
            self._record(f"line_slope:{name}", False, "vertical line (dx=0)")
            return
        actual = dy_math / dx_math
        err = abs(actual - expected_slope)
        self._record(
            f"line_slope:{name}",
            err <= tol,
            f"actual={actual:.4f}, expected={expected_slope:.4f} (err={err:.4f}, tol={tol})",
        )

    # ------------------------------------------------------------------
    # 2. Automatic Frame-Bounds, Overlap, Audio & Motion-Density Audits
    # ------------------------------------------------------------------
    def audit_scene_end(self, track_data: dict) -> None:
        fw = float(config.frame_width)
        fh = float(config.frame_height)
        half_w = fw / 2.0 - 0.12
        half_h = fh / 2.0 - 0.10

        # A. Frame clipping check for registered foreground labels/pills
        for name, mob in self._tracked_labels:
            try:
                if mob.width < 1e-4 and mob.height < 1e-4:
                    continue
                left = float(mob.get_left()[0])
                right = float(mob.get_right()[0])
                bottom = float(mob.get_bottom()[1])
                top = float(mob.get_top()[1])
                inside = (left >= -half_w) and (right <= half_w) and (bottom >= -half_h) and (top <= half_h)
                self._record(
                    f"in_frame:{name}",
                    inside,
                    f"bbox=({left:.2f}..{right:.2f}, {bottom:.2f}..{top:.2f}) vs safe=({-half_w:.2f}..{half_w:.2f}, {-half_h:.2f}..{half_h:.2f})",
                )
            except Exception as exc:  # noqa: BLE001
                self._record(f"in_frame:{name}", False, f"failed bbox inspection: {exc}")

        # B. Pairwise AABB overlap check between registered foreground labels/pills
        active_boxes: list[tuple[str, float, float, float, float]] = []
        for name, mob in self._tracked_labels:
            if mob not in self.scene.mobjects:
                continue
            try:
                active_boxes.append(
                    (
                        name,
                        float(mob.get_left()[0]),
                        float(mob.get_bottom()[1]),
                        float(mob.get_right()[0]),
                        float(mob.get_top()[1]),
                    )
                )
            except Exception:  # noqa: BLE001
                continue

        for i in range(len(active_boxes)):
            n1, x0, y0, x1, y1 = active_boxes[i]
            for j in range(i + 1, len(active_boxes)):
                n2, u0, v0, u1, v1 = active_boxes[j]
                ox = max(0.0, min(x1, u1) - max(x0, u0))
                oy = max(0.0, min(y1, v1) - max(y0, v0))
                area = ox * oy
                if area > 0.04:
                    self._record(
                        f"no_overlap:{n1}<->{n2}",
                        False,
                        f"foreground labels overlap by {area:.3f} sq units!",
                    )

        # C. Voice, Sema choreography & motion density checks
        qa = track_data.get("qa", {})
        max_gap = float(qa.get("maxStaticGapSec", 0.0))
        self._record(
            "motion_density",
            max_gap <= 1.8,
            f"maxStaticGapSec={max_gap:.3f}s (limit=1.8s)",
        )
        word_count = int(qa.get("wordCount", 0))
        self._record(
            "voice_word_sync",
            word_count >= 5 and track_data.get("voice") == "en-US-AndrewNeural",
            f"voice={track_data.get('voice')}, words={word_count}",
        )
        kf_count = int(qa.get("keyframeCount", 0))
        prompt_count = int(qa.get("promptCount", 0))
        self._record(
            "sema_choreography",
            kf_count >= 2 and prompt_count >= 1,
            f"keyframes={kf_count}, prompts={prompt_count}",
        )

    def raise_if_failed(self) -> list[dict]:
        failures = [c for c in self.checks if not c.passed]
        report = [{"name": c.name, "passed": c.passed, "detail": c.detail} for c in self.checks]
        if failures:
            lines = [f"SCENE VERIFICATION FAILED ({len(failures)} error(s)):"]
            for f in failures:
                lines.append(f"  [FAIL] {f.name}: {f.detail}")
            raise VerificationError("\n".join(lines))
        return report
