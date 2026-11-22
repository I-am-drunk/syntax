"""
SemaDirector — Deeply integrated Moving Sema choreography system inside Manim.

Authors control Sema directly against live Manim mobjects and world coordinates:
  - self.sema.enter(target, offset=..., look_at=..., state=..., prompt=...)
  - self.sema.fly_to(target, offset=..., look_at=..., state=..., prompt=...)
  - self.sema.track(mobject_or_fn, offset=..., look_at=..., state=..., prompt=...)
  - self.sema.untrack()
  - self.sema.react(state=..., expression=..., shape=..., look_at=..., prompt=...)
  - self.sema.prompt(SemaPrompt(...))

At scene end, SemaDirector writes `<beat>.track.json` containing:
  - Normalized 0..1 viewport flight path & 3D eye-gaze vectors (lookX, lookY)
  - 16 Bloub states, expressions, morph shapes, scale, and speaking status
  - Structured prompt timeline (callout tag, speech bubble copy, subtitle text, mode, accent)
  - Millisecond WordBoundary timings from en-US-AndrewNeural for live karaoke CC
  - Automated AABB clearance & motion-density QA metrics
"""

from __future__ import annotations

from dataclasses import dataclass, field
import json
import math
from pathlib import Path
from typing import Any, Callable

from manim import Mobject, ORIGIN, Scene, config
import numpy as np

from .voice import VOICE_NAME, WordTiming


TargetLike = Mobject | np.ndarray | tuple[float, float] | tuple[float, float, float] | Callable[[], np.ndarray]

# Safe viewport margins for Sema center (normalized 0..1)
SAFE_X_MIN = 0.08
SAFE_X_MAX = 0.92
SAFE_Y_MIN = 0.14
SAFE_Y_MAX = 0.86

# Approximate Sema radius in normalized viewport coordinates (52px inside ~640x360 stage)
SEMA_RX = 0.052
SEMA_RY = 0.092


@dataclass
class SemaPrompt:
    """Structured prompt payload consumed by SemaStageRuntime in React."""
    callout: str | None = None          # Crisp floating pill tag ("Rotate +90°", "m = −3")
    say: str | None = None              # Optional richer speech-bubble line for Sema
    subtitle: str | None = None         # Optional clean subtitle override for this beat
    mode: str = "callout"               # Default display hint: callout | bubble | subtitle | both | off
    accent: str = "blue"                # Semantic color token (blue|teal|amber|green|red|violet|ink)
    side: str = "auto"                  # auto | left | right | top | bottom


@dataclass
class _TrackBinding:
    target: TargetLike
    offset: np.ndarray
    look_at: TargetLike | None
    avoid_overlap: bool


@dataclass
class _SemaStateSnapshot:
    x: float = 0.16
    y: float = 0.22
    look_x: float = 0.6
    look_y: float = 0.3
    state: str = "speaking"
    expression: str | None = "attentive"
    shape: str = "circle"
    scale: float = 1.0
    speaking: bool = True


class SemaDirector:
    def __init__(self, scene: Scene) -> None:
        self.scene = scene
        self._cur = _SemaStateSnapshot()
        self._binding: _TrackBinding | None = None
        self._keyframes: list[dict[str, Any]] = []
        self._prompts: list[dict[str, Any]] = []
        self._words: list[dict[str, Any]] = []
        self._last_sample_t: float = -1.0
        self._sample_interval: float = 1.0 / 20.0  # 20Hz path sampling (browser springs smooth to 120Hz)
        self._overlap_nudges: int = 0
        self._static_gaps: list[float] = []
        self._cue_count: int = 0

    # ------------------------------------------------------------------
    # Coordinate & AABB helpers
    # ------------------------------------------------------------------
    def _world_to_vp(self, pt: np.ndarray) -> tuple[float, float]:
        fw = float(config.frame_width)
        fh = float(config.frame_height)
        nx = (float(pt[0]) + fw / 2.0) / fw
        ny = (fh / 2.0 - float(pt[1])) / fh
        return nx, ny

    def _resolve_world_point(self, target: TargetLike) -> np.ndarray:
        if callable(target):
            val = target()
            return self._resolve_world_point(val)
        if isinstance(target, Mobject):
            return np.array(target.get_center(), dtype=float)
        arr = np.asarray(target, dtype=float)
        if arr.shape[0] == 2:
            return np.array([arr[0], arr[1], 0.0], dtype=float)
        return arr[:3].astype(float)

    def _active_obstacle_boxes(self) -> list[tuple[float, float, float, float]]:
        """Return viewport AABBs (x0, y0, x1, y1) of foreground non-grid mobjects."""
        boxes: list[tuple[float, float, float, float]] = []
        for mob in self.scene.mobjects:
            if getattr(mob, "_sema_ignore", False):
                continue
            try:
                if mob.width < 1e-4 and mob.height < 1e-4:
                    continue
                # Skip huge full-canvas background groups (planes/grids)
                if mob.width > config.frame_width * 0.72 and mob.height > config.frame_height * 0.72:
                    continue
                x_min = float(mob.get_left()[0])
                x_max = float(mob.get_right()[0])
                y_min = float(mob.get_bottom()[1])
                y_max = float(mob.get_top()[1])
                vx0, vy0 = self._world_to_vp(np.array([x_min, y_max, 0.0]))
                vx1, vy1 = self._world_to_vp(np.array([x_max, y_min, 0.0]))
                boxes.append((vx0, vy0, vx1, vy1))
            except Exception:  # noqa: BLE001
                continue
        return boxes

    def _box_overlap_area(
        self,
        cx: float,
        cy: float,
        boxes: list[tuple[float, float, float, float]],
    ) -> float:
        sx0, sy0 = cx - SEMA_RX, cy - SEMA_RY
        sx1, sy1 = cx + SEMA_RX, cy + SEMA_RY
        total = 0.0
        for bx0, by0, bx1, by1 in boxes:
            ox = max(0.0, min(sx1, bx1) - max(sx0, bx0))
            oy = max(0.0, min(sy1, by1) - max(sy0, by0))
            total += ox * oy
        return total

    def _clamp_safe(self, nx: float, ny: float) -> tuple[float, float]:
        return (
            max(SAFE_X_MIN, min(SAFE_X_MAX, nx)),
            max(SAFE_Y_MIN, min(SAFE_Y_MAX, ny)),
        )

    def _resolve_clear_vp(
        self,
        nx: float,
        ny: float,
        avoid_overlap: bool = True,
    ) -> tuple[float, float]:
        nx, ny = self._clamp_safe(nx, ny)
        if not avoid_overlap:
            return nx, ny
        boxes = self._active_obstacle_boxes()
        if not boxes:
            return nx, ny
        base_overlap = self._box_overlap_area(nx, ny, boxes)
        if base_overlap < 0.0008:
            return nx, ny

        # Search small concentric rings for nearest clear perch
        best = (nx, ny)
        best_score = base_overlap
        for radius in (0.06, 0.11, 0.16):
            for k in range(12):
                ang = (2.0 * math.pi * k) / 12.0
                cand_x, cand_y = self._clamp_safe(
                    nx + math.cos(ang) * radius,
                    ny + math.sin(ang) * radius * 1.15,
                )
                ov = self._box_overlap_area(cand_x, cand_y, boxes)
                dist_penalty = math.hypot(cand_x - nx, cand_y - ny) * 0.004
                score = ov + dist_penalty
                if score < best_score:
                    best_score = score
                    best = (cand_x, cand_y)
                if ov < 0.0002:
                    self._overlap_nudges += 1
                    return cand_x, cand_y
        if best != (nx, ny):
            self._overlap_nudges += 1
        return best

    def _compute_look(self, sx: float, sy: float, look_at: TargetLike | None) -> tuple[float, float]:
        if look_at is None:
            # Look gracefully toward canvas center
            lx, ly = 0.5 - sx, 0.5 - sy
        else:
            tx, ty = self._world_to_vp(self._resolve_world_point(look_at))
            lx, ly = tx - sx, ty - sy
        mag = math.hypot(lx, ly)
        if mag < 1e-4:
            return 0.0, 0.0
        scale = min(1.0, mag * 2.8)
        return (lx / mag) * scale, (ly / mag) * scale

    # ------------------------------------------------------------------
    # Recording helpers
    # ------------------------------------------------------------------
    def _now(self) -> float:
        return round(float(self.scene.renderer.time), 4)

    def _emit_keyframe(self, force: bool = False) -> None:
        t = self._now()
        if not force and self._keyframes and abs(t - self._keyframes[-1]["t"]) < 0.015:
            # Overwrite same-timestamp keyframe with latest state
            self._keyframes[-1] = self._snapshot_dict(t)
            return
        self._keyframes.append(self._snapshot_dict(t))
        self._last_sample_t = t

    def _snapshot_dict(self, t: float) -> dict[str, Any]:
        return {
            "t": round(t, 4),
            "x": round(self._cur.x, 4),
            "y": round(self._cur.y, 4),
            "lookX": round(self._cur.look_x, 3),
            "lookY": round(self._cur.look_y, 3),
            "state": self._cur.state,
            "expression": self._cur.expression,
            "shape": self._cur.shape,
            "scale": round(self._cur.scale, 3),
            "speaking": bool(self._cur.speaking),
        }

    def _close_open_prompt(self, t: float) -> None:
        if self._prompts and self._prompts[-1]["end"] is None:
            self._prompts[-1]["end"] = round(max(t, self._prompts[-1]["start"] + 0.12), 4)

    def set_prompt(self, prompt: SemaPrompt | None) -> None:
        t = self._now()
        self._close_open_prompt(t)
        if prompt is None:
            return
        self._prompts.append(
            {
                "start": t,
                "end": None,
                "callout": prompt.callout,
                "say": prompt.say,
                "subtitle": prompt.subtitle,
                "mode": prompt.mode,
                "accent": prompt.accent,
                "side": prompt.side,
            }
        )

    # ------------------------------------------------------------------
    # Public Choreographer API (used directly in every Manim scene!)
    # ------------------------------------------------------------------
    def enter(
        self,
        target: TargetLike,
        *,
        offset: np.ndarray = ORIGIN,
        look_at: TargetLike | None = None,
        state: str = "speaking",
        expression: str | None = "attentive",
        shape: str = "circle",
        scale: float = 1.0,
        prompt: SemaPrompt | None = None,
        avoid_overlap: bool = True,
    ) -> None:
        """Place Sema at the scene start relative to a world point or Mobject."""
        self.fly_to(
            target,
            offset=offset,
            look_at=look_at,
            state=state,
            expression=expression,
            shape=shape,
            scale=scale,
            prompt=prompt,
            avoid_overlap=avoid_overlap,
        )

    def fly_to(
        self,
        target: TargetLike,
        *,
        offset: np.ndarray = ORIGIN,
        look_at: TargetLike | None = None,
        state: str | None = None,
        expression: str | None = None,
        shape: str | None = None,
        scale: float | None = None,
        speaking: bool | None = None,
        prompt: SemaPrompt | None = None,
        avoid_overlap: bool = True,
    ) -> None:
        """Fly Sema smoothly to a point or Mobject (spring-animated in browser)."""
        self._binding = None
        world = self._resolve_world_point(target) + np.asarray(offset, dtype=float)
        nx, ny = self._world_to_vp(world)
        nx, ny = self._resolve_clear_vp(nx, ny, avoid_overlap=avoid_overlap)
        lx, ly = self._compute_look(nx, ny, look_at if look_at is not None else target)

        self._cur.x = nx
        self._cur.y = ny
        self._cur.look_x = lx
        self._cur.look_y = ly
        if state is not None:
            self._cur.state = state
        if expression is not None:
            self._cur.expression = expression
        if shape is not None:
            self._cur.shape = shape
        if scale is not None:
            self._cur.scale = scale
        if speaking is not None:
            self._cur.speaking = speaking
        if prompt is not None:
            self.set_prompt(prompt)

        self._emit_keyframe(force=True)

    def track(
        self,
        target: TargetLike,
        *,
        offset: np.ndarray = ORIGIN,
        look_at: TargetLike | None = None,
        state: str | None = None,
        expression: str | None = None,
        shape: str | None = None,
        prompt: SemaPrompt | None = None,
        avoid_overlap: bool = False,
    ) -> None:
        """
        Continuously track a moving Mobject or callable coordinate during Manim plays.
        """
        self._binding = _TrackBinding(
            target=target,
            offset=np.asarray(offset, dtype=float),
            look_at=look_at,
            avoid_overlap=avoid_overlap,
        )
        if state is not None:
            self._cur.state = state
        if expression is not None:
            self._cur.expression = expression
        if shape is not None:
            self._cur.shape = shape
        if prompt is not None:
            self.set_prompt(prompt)
        self.sample_live(force=True)

    def untrack(self) -> None:
        if self._binding is not None:
            self.sample_live(force=True)
            self._binding = None

    def react(
        self,
        *,
        state: str | None = None,
        expression: str | None = None,
        shape: str | None = None,
        scale: float | None = None,
        look_at: TargetLike | None = None,
        prompt: SemaPrompt | None = None,
        speaking: bool | None = None,
    ) -> None:
        """Update Sema's state, expression, shape, gaze, or prompt in place."""
        if state is not None:
            self._cur.state = state
        if expression is not None:
            self._cur.expression = expression
        if shape is not None:
            self._cur.shape = shape
        if scale is not None:
            self._cur.scale = scale
        if speaking is not None:
            self._cur.speaking = speaking
        if look_at is not None:
            lx, ly = self._compute_look(self._cur.x, self._cur.y, look_at)
            self._cur.look_x = lx
            self._cur.look_y = ly
        if prompt is not None:
            self.set_prompt(prompt)
        self._emit_keyframe(force=True)

    def point_at(self, target: TargetLike, *, prompt: SemaPrompt | None = None) -> None:
        self.react(look_at=target, prompt=prompt)

    def sample_live(self, force: bool = False) -> None:
        """Called by SyntaxScene updater during plays to sample tracked targets."""
        if self._binding is None:
            return
        t = self._now()
        if not force and (t - self._last_sample_t) < self._sample_interval:
            return
        world = self._resolve_world_point(self._binding.target) + self._binding.offset
        nx, ny = self._world_to_vp(world)
        nx, ny = self._resolve_clear_vp(nx, ny, avoid_overlap=self._binding.avoid_overlap)
        look_target = self._binding.look_at if self._binding.look_at is not None else self._binding.target
        lx, ly = self._compute_look(nx, ny, look_target)
        self._cur.x = nx
        self._cur.y = ny
        self._cur.look_x = lx
        self._cur.look_y = ly
        self._emit_keyframe(force=force)

    # ------------------------------------------------------------------
    # Narration word timeline & QA telemetry
    # ------------------------------------------------------------------
    def record_words(self, start_offset: float, words: list[WordTiming], cue_count: int) -> None:
        self._cue_count += cue_count
        for w in words:
            self._words.append(
                {
                    "text": w.text,
                    "start": round(start_offset + w.start, 4),
                    "end": round(start_offset + w.end, 4),
                }
            )

    def record_static_wait(self, wait_sec: float) -> None:
        if wait_sec > 0.05:
            self._static_gaps.append(round(wait_sec, 3))

    def export_dict(self) -> dict[str, Any]:
        total_dur = round(float(self.scene.renderer.time), 4)
        self._close_open_prompt(total_dur)
        if not self._keyframes:
            self._emit_keyframe(force=True)
        # Ensure final anchor keyframe at exact duration
        if self._keyframes[-1]["t"] < total_dur - 0.02:
            self._keyframes.append(self._snapshot_dict(total_dur))

        return {
            "version": 2,
            "voice": VOICE_NAME,
            "fps": int(config.frame_rate),
            "duration": total_dur,
            "aspectRatio": round(float(config.frame_width) / float(config.frame_height), 4),
            "keyframes": self._keyframes,
            "prompts": self._prompts,
            "words": self._words,
            "qa": {
                "maxStaticGapSec": round(max(self._static_gaps, default=0.0), 3),
                "overlapNudges": self._overlap_nudges,
                "cueCount": self._cue_count,
                "keyframeCount": len(self._keyframes),
                "promptCount": len(self._prompts),
                "wordCount": len(self._words),
            },
        }

    def write_track(self, path: Path) -> None:
        path.parent.mkdir(parents=True, exist_ok=True)
        path.write_text(json.dumps(self.export_dict(), indent=2), encoding="utf-8")
