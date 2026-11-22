"""
SyntaxGraph — Full-bleed Brilliant-exact coordinate plane & prebuilt kinetic geometry verbs.

Design contract:
  - Matches BrilliantGraph.tsx / mpm2dBrilliant.css 1:1 (zero boxes, zero chrome)
  - Sparse axis tick numbers with surface-knockout halos
  - Every geometric verb returns live trackable handles for SemaDirector
"""

from __future__ import annotations

from dataclasses import dataclass
import math
from typing import Callable

from manim import (
    BOLD,
    DOWN,
    DR,
    LEFT,
    ORIGIN,
    PI,
    RIGHT,
    UL,
    UP,
    UR,
    AnimationGroup,
    CapStyleType,
    Circle,
    Create,
    DashedLine,
    Dot,
    FadeIn,
    FadeOut,
    Line,
    ManimColor,
    MathTex,
    Mobject,
    Polygon,
    RoundedRectangle,
    Sector,
    Text,
    Triangle,
    UpdateFromAlphaFunc,
    VGroup,
    VMobject,
    ValueTracker,
    always_redraw,
    interpolate_color,
    rate_functions,
)
import numpy as np

from .theme import SANS_TEX_TEMPLATE, SyntaxTheme, UI_FONT, math_tex, ui_text


def _mark_bg(mob: Mobject) -> Mobject:
    mob._sema_ignore = True  # type: ignore[attr-defined]
    return mob


def _halo_label(mob: VMobject, theme: SyntaxTheme, stroke_width: float = 7.0) -> VMobject:
    mob.set_stroke(color=theme.surface_halo, width=stroke_width, background=True)
    return mob


def make_pill_badge(
    content: str,
    theme: SyntaxTheme,
    *,
    accent: str = "blue",
    is_math: bool = False,
    font_size: float = 30,
    fill_opacity: float = 0.14,
    pad_x: float = 0.34,
    pad_y: float = 0.16,
) -> VGroup:
    col = theme.color(accent)
    label: VMobject
    if is_math:
        label = math_tex(content, theme=theme, color=accent, font_size=font_size)
    else:
        label = ui_text(content, theme, color=accent, font_size=font_size * 0.72, weight=BOLD)

    bg = RoundedRectangle(
        width=max(1.5, label.width + pad_x * 2),
        height=max(0.62, label.height + pad_y * 2),
        corner_radius=0.18,
        fill_color=col,
        fill_opacity=fill_opacity,
        stroke_color=col,
        stroke_width=2.2,
    )
    # Crisp opaque canvas backing underneath tint so grid lines never bleed through badges
    backing = RoundedRectangle(
        width=bg.width,
        height=bg.height,
        corner_radius=0.18,
        fill_color=theme.bg,
        fill_opacity=0.96,
        stroke_width=0,
    )
    label.move_to(bg.get_center())
    return VGroup(backing, bg, label)


@dataclass
class RiseRunHandle:
    shade: Polygon
    run_line: DashedLine
    rise_line: DashedLine
    run_label: VMobject
    rise_label: VMobject
    corner_pt: np.ndarray

    @property
    def group(self) -> VGroup:
        return VGroup(self.shade, self.run_line, self.rise_line, self.run_label, self.rise_label)


@dataclass
class RotationRig:
    angle_deg: ValueTracker
    pivot_pt: np.ndarray
    sector: VMobject
    rotating_line: VMobject
    badge: VMobject
    tip_point: Callable[[], np.ndarray]


@dataclass
class ElevatorRig:
    b_tracker: ValueTracker
    lock_tracker: ValueTracker
    rail: DashedLine
    gliding_line: VMobject
    y_bead: VMobject
    b_label: VMobject
    bead_point: Callable[[], np.ndarray]


class SyntaxGraph:
    """
    Full-bleed coordinate plane matching Syntax's BrilliantGraph visual system.
    """

    def __init__(
        self,
        theme: SyntaxTheme,
        *,
        x_range: tuple[float, float] = (-6, 9),
        y_range: tuple[float, float] = (-4.5, 4.5),
        x_ticks: tuple[int, ...] = (-3, 3, 6),
        y_ticks: tuple[int, ...] = (-3, 3),
        max_width: float = 12.8,
        max_height: float = 6.95,
        isotropic: bool = True,
        center: np.ndarray = ORIGIN,
    ) -> None:
        self.theme = theme
        self.x_min, self.x_max = float(x_range[0]), float(x_range[1])
        self.y_min, self.y_max = float(y_range[0]), float(y_range[1])
        x_span = self.x_max - self.x_min
        y_span = self.y_max - self.y_min
        if isotropic:
            # Strict 1:1 square unit scale so 90-degree rotations ALWAYS match m_perp = -1/m!
            unit = min(max_width / x_span, max_height / y_span)
            self.sx = unit
            self.sy = unit
            self.width = unit * x_span
            self.height = unit * y_span
        else:
            self.width = max_width
            self.height = max_height
            self.sx = max_width / x_span
            self.sy = max_height / y_span
        self.center = np.array(center, dtype=float)

        self.root = self._build_grid(x_ticks, y_ticks)
        _mark_bg(self.root)

    # ------------------------------------------------------------------
    # Coordinate transforms
    # ------------------------------------------------------------------
    def pt(self, x: float, y: float) -> np.ndarray:
        wx = self.center[0] - self.width / 2.0 + (x - self.x_min) * self.sx
        wy = self.center[1] - self.height / 2.0 + (y - self.y_min) * self.sy
        return np.array([wx, wy, 0.0], dtype=float)

    def _build_grid(self, x_ticks: tuple[int, ...], y_ticks: tuple[int, ...]) -> VGroup:
        th = self.theme
        grid_lines = VGroup()

        for x in range(int(math.ceil(self.x_min)), int(math.floor(self.x_max)) + 1):
            if x == 0:
                continue
            grid_lines.add(
                Line(
                    self.pt(x, self.y_min),
                    self.pt(x, self.y_max),
                    color=th.grid,
                    stroke_width=1.25,
                    stroke_opacity=0.88,
                )
            )
        for y in range(int(math.ceil(self.y_min)), int(math.floor(self.y_max)) + 1):
            if y == 0:
                continue
            grid_lines.add(
                Line(
                    self.pt(self.x_min, y),
                    self.pt(self.x_max, y),
                    color=th.grid,
                    stroke_width=1.25,
                    stroke_opacity=0.88,
                )
            )

        # Crisp Brilliant axes with centered cross-ticks & sharp triangular arrowheads
        axes = VGroup()
        x_start = self.pt(self.x_min, 0)
        x_end = self.pt(self.x_max, 0)
        y_start = self.pt(0, self.y_min)
        y_end = self.pt(0, self.y_max)

        axes.add(Line(x_start, x_end, color=th.axis, stroke_width=2.1))
        axes.add(Line(y_start, y_end, color=th.axis, stroke_width=2.1))

        # Brilliant-style 12x10 arrowheads
        x_tip = Triangle(fill_color=th.axis, fill_opacity=1, stroke_width=0).scale(0.11).rotate(-PI / 2)
        x_tip.move_to(x_end)
        y_tip = Triangle(fill_color=th.axis, fill_opacity=1, stroke_width=0).scale(0.11)
        y_tip.move_to(y_end)
        axes.add(x_tip, y_tip)

        # Quiet x / y axis names
        x_name = _halo_label(
            ui_text("x", th, color="muted", font_size=22, weight=BOLD), th
        ).next_to(x_end, DOWN + LEFT * 0.2, buff=0.14)
        y_name = _halo_label(
            ui_text("y", th, color="muted", font_size=22, weight=BOLD), th
        ).next_to(y_end, RIGHT + DOWN * 0.15, buff=0.14)
        axes.add(x_name, y_name)

        # Sparse clean tick marks + haloed numbers (minimal visual noise!)
        ticks = VGroup()
        for xv in x_ticks:
            if self.x_min < xv < self.x_max and xv != 0:
                p = self.pt(xv, 0)
                ticks.add(Line(p + UP * 0.08, p + DOWN * 0.08, color=th.axis, stroke_width=1.8))
                lbl = _halo_label(
                    ui_text(str(xv).replace("-", "−"), th, color="muted", font_size=19, weight=BOLD),
                    th,
                ).next_to(p, DOWN, buff=0.16)
                ticks.add(lbl)
        for yv in y_ticks:
            if self.y_min < yv < self.y_max and yv != 0:
                p = self.pt(0, yv)
                ticks.add(Line(p + LEFT * 0.08, p + RIGHT * 0.08, color=th.axis, stroke_width=1.8))
                lbl = _halo_label(
                    ui_text(str(yv).replace("-", "−"), th, color="muted", font_size=19, weight=BOLD),
                    th,
                ).next_to(p, LEFT, buff=0.16)
                ticks.add(lbl)

        return VGroup(grid_lines, axes, ticks)

    # ------------------------------------------------------------------
    # Clipped lines & points
    # ------------------------------------------------------------------
    def clipped_line_xy(self, m: float, b: float) -> tuple[tuple[float, float], tuple[float, float]]:
        pts: list[tuple[float, float]] = []
        eps = 1e-6
        for x in (self.x_min, self.x_max):
            y = m * x + b
            if self.y_min - eps <= y <= self.y_max + eps:
                pts.append((x, max(self.y_min, min(self.y_max, y))))
        if abs(m) > 1e-9:
            for y in (self.y_min, self.y_max):
                x = (y - b) / m
                if self.x_min - eps <= x <= self.x_max + eps:
                    pts.append((max(self.x_min, min(self.x_max, x)), y))
        unique: list[tuple[float, float]] = []
        for p in pts:
            if not any(math.hypot(p[0] - q[0], p[1] - q[1]) < 1e-3 for q in unique):
                unique.append(p)
        if len(unique) < 2:
            return (self.x_min, m * self.x_min + b), (self.x_max, m * self.x_max + b)
        unique.sort(key=lambda t: (t[0], t[1]))
        return unique[0], unique[-1]

    def line(
        self,
        m: float,
        b: float,
        *,
        color: str = "blue",
        stroke_width: float = 5.0,
        opacity: float = 1.0,
    ) -> Line:
        p1, p2 = self.clipped_line_xy(m, b)
        ln = Line(
            self.pt(*p1),
            self.pt(*p2),
            color=self.theme.color(color),
            stroke_width=stroke_width,
            stroke_opacity=opacity,
        )
        ln.set_cap_style(CapStyleType.ROUND)  # round cap
        return ln

    def point(
        self,
        x: float,
        y: float,
        *,
        label: str | None = None,
        direction: np.ndarray = UR,
        color: str = "amber",
        radius: float = 0.115,
        buff: float = 0.18,
    ) -> VGroup:
        col = self.theme.color(color)
        pos = self.pt(x, y)
        halo = Dot(pos, radius=radius + 0.055, color=self.theme.surface_halo, fill_opacity=0.95)
        dot = Dot(pos, radius=radius, color=col)
        grp = VGroup(halo, dot)
        if label:
            txt = _halo_label(
                ui_text(label, self.theme, color="ink", font_size=22, weight=BOLD),
                self.theme,
            ).next_to(dot, direction, buff=buff)
            grp.add(txt)
        return grp

    # ------------------------------------------------------------------
    # Kinetic Verb 1: Rise / Run Slope Triangle
    # ------------------------------------------------------------------
    def rise_run(
        self,
        p1: tuple[float, float],
        p2: tuple[float, float],
        *,
        run_label: str = "run +1",
        rise_label: str = "rise −3",
        run_color: str = "amber",
        rise_color: str = "red",
        shade_color: str = "blue",
        run_dir: np.ndarray = UP,
        rise_dir: np.ndarray = RIGHT,
    ) -> RiseRunHandle:
        a = self.pt(*p1)
        corner = self.pt(p2[0], p1[1])
        b = self.pt(*p2)

        shade = Polygon(
            a,
            corner,
            b,
            fill_color=self.theme.color(shade_color),
            fill_opacity=0.11,
            stroke_width=0,
        )
        run_line = DashedLine(
            a,
            corner,
            color=self.theme.color(run_color),
            stroke_width=4.0,
            dash_length=0.16,
            dashed_ratio=0.62,
        )
        rise_line = DashedLine(
            corner,
            b,
            color=self.theme.color(rise_color),
            stroke_width=4.0,
            dash_length=0.16,
            dashed_ratio=0.62,
        )
        run_txt = _halo_label(
            ui_text(run_label, self.theme, color=run_color, font_size=21, weight=BOLD),
            self.theme,
        ).next_to(run_line, run_dir, buff=0.16)
        rise_txt = _halo_label(
            ui_text(rise_label, self.theme, color=rise_color, font_size=21, weight=BOLD),
            self.theme,
        ).next_to(rise_line, rise_dir, buff=0.16)

        return RiseRunHandle(
            shade=shade,
            run_line=run_line,
            rise_line=rise_line,
            run_label=run_txt,
            rise_label=rise_txt,
            corner_pt=corner,
        )

    # ------------------------------------------------------------------
    # Kinetic Verb 2: Right Angle Square
    # ------------------------------------------------------------------
    def right_angle(
        self,
        vertex_xy: tuple[float, float],
        dir1_xy: tuple[float, float],
        dir2_xy: tuple[float, float],
        *,
        size: float = 0.34,
        color: str = "green",
    ) -> VMobject:
        v = self.pt(*vertex_xy)
        u1 = self.pt(vertex_xy[0] + dir1_xy[0], vertex_xy[1] + dir1_xy[1]) - v
        u2 = self.pt(vertex_xy[0] + dir2_xy[0], vertex_xy[1] + dir2_xy[1]) - v
        u1 = u1 / np.linalg.norm(u1) * size
        u2 = u2 / np.linalg.norm(u2) * size
        elbow = VMobject(color=self.theme.color(color), stroke_width=3.6)
        elbow.set_points_as_corners([v + u1, v + u1 + u2, v + u2])
        return elbow

    # ------------------------------------------------------------------
    # Kinetic Verb 3: 90-Degree Rotation + Sweeping Green Sector Wedge + Live Readout
    # ------------------------------------------------------------------
    def make_rotation_rig(
        self,
        pivot_xy: tuple[float, float],
        base_slope: float,
        *,
        line_color: str = "teal",
        sector_color: str = "green",
        badge_xy: tuple[float, float] = (4.4, 2.9),
        final_label: str = "m⊥ = +1/3",
    ) -> RotationRig:
        if abs(self.sx - self.sy) > 1e-6:
            raise ValueError(
                f"make_rotation_rig requires isotropic 1:1 grid (sx={self.sx:.4f} != sy={self.sy:.4f}); "
                "non-square grids distort 90-degree perpendicular slopes!"
            )
        pivot_pt = self.pt(*pivot_xy)
        angle_deg = ValueTracker(0.0)

        # Base direction angle in screen space (accounting for sx/sy!)
        p_next = self.pt(pivot_xy[0] + 1.0, pivot_xy[1] + base_slope)
        base_vec = p_next - pivot_pt
        base_angle = math.atan2(base_vec[1], base_vec[0])

        def _make_sector() -> VMobject:
            deg = angle_deg.get_value()
            if deg < 0.8:
                return VGroup()
            rad = math.radians(deg)
            sec = Sector(
                radius=1.18,
                start_angle=base_angle,
                angle=rad,
                arc_center=pivot_pt,
                fill_color=self.theme.color(sector_color),
                fill_opacity=0.20,
                stroke_color=self.theme.color(sector_color),
                stroke_width=2.6,
            )
            return sec

        def _make_rot_line() -> Line:
            rad = base_angle + math.radians(angle_deg.get_value())
            u = np.array([math.cos(rad), math.sin(rad), 0.0])
            # Clip against plane bounds in world space
            x0 = self.center[0] - self.width / 2.0
            x1 = self.center[0] + self.width / 2.0
            y0 = self.center[1] - self.height / 2.0
            y1 = self.center[1] + self.height / 2.0
            t_vals: list[float] = []
            if abs(u[0]) > 1e-6:
                for xb in (x0, x1):
                    t = (xb - pivot_pt[0]) / u[0]
                    yp = pivot_pt[1] + t * u[1]
                    if y0 - 1e-3 <= yp <= y1 + 1e-3:
                        t_vals.append(t)
            if abs(u[1]) > 1e-6:
                for yb in (y0, y1):
                    t = (yb - pivot_pt[1]) / u[1]
                    xp = pivot_pt[0] + t * u[0]
                    if x0 - 1e-3 <= xp <= x1 + 1e-3:
                        t_vals.append(t)
            if len(t_vals) >= 2:
                tmin, tmax = min(t_vals), max(t_vals)
            else:
                tmin, tmax = -6.0, 6.0
            ln = Line(
                pivot_pt + u * tmin,
                pivot_pt + u * tmax,
                color=self.theme.color(line_color),
                stroke_width=5.2,
            )
            ln.set_cap_style(CapStyleType.ROUND)
            return ln

        badge_anchor = self.pt(*badge_xy)

        def _make_badge() -> VGroup:
            deg = angle_deg.get_value()
            if deg < 82.0:
                txt = f"Rotating {int(round(deg))}°"
                b = make_pill_badge(txt, self.theme, accent=line_color, font_size=29)
            else:
                b = make_pill_badge(final_label, self.theme, accent=sector_color, font_size=30)
            b.move_to(badge_anchor)
            return b

        def _tip_point() -> np.ndarray:
            rad = base_angle + math.radians(angle_deg.get_value())
            return pivot_pt + np.array([math.cos(rad) * 2.1, math.sin(rad) * 2.1, 0.0])

        return RotationRig(
            angle_deg=angle_deg,
            pivot_pt=pivot_pt,
            sector=always_redraw(_make_sector),
            rotating_line=always_redraw(_make_rot_line),
            badge=always_redraw(_make_badge),
            tip_point=_tip_point,
        )

    # ------------------------------------------------------------------
    # Kinetic Verb 4: Vertical Elevator Slide + Live b Bead + Lock-On Ripple
    # ------------------------------------------------------------------
    def make_elevator_rig(
        self,
        slope: float,
        b_start: float,
        b_target: float,
        *,
        line_color: str = "teal",
        lock_color: str = "green",
    ) -> ElevatorRig:
        b_tracker = ValueTracker(b_start)
        lock_tracker = ValueTracker(0.0)  # 0 = sliding (teal), 1 = locked (green)

        rail = DashedLine(
            self.pt(0, b_start),
            self.pt(0, b_target),
            color=self.theme.color(line_color),
            stroke_width=3.0,
            stroke_opacity=0.55,
            dash_length=0.14,
            dashed_ratio=0.55,
        )

        c_from = ManimColor(self.theme.color(line_color))
        c_to = ManimColor(self.theme.color(lock_color))

        def _cur_color() -> ManimColor:
            return interpolate_color(c_from, c_to, lock_tracker.get_value())

        def _make_line() -> Line:
            b = b_tracker.get_value()
            p1, p2 = self.clipped_line_xy(slope, b)
            ln = Line(
                self.pt(*p1),
                self.pt(*p2),
                color=_cur_color(),
                stroke_width=5.4,
            )
            ln.set_cap_style(CapStyleType.ROUND)
            return ln

        def _make_bead() -> VGroup:
            pos = self.pt(0, b_tracker.get_value())
            halo = Dot(pos, radius=0.175, color=self.theme.surface_halo, fill_opacity=0.95)
            dot = Dot(pos, radius=0.12, color=_cur_color())
            return VGroup(halo, dot)

        def _make_b_label() -> VMobject:
            bv = b_tracker.get_value()
            pos = self.pt(0, bv)
            sign_str = f"−{abs(bv):.1f}" if bv < -0.05 else f"{abs(bv):.1f}"
            accent = lock_color if lock_tracker.get_value() > 0.35 else line_color
            lbl = _halo_label(
                ui_text(f"b = {sign_str}", self.theme, color=accent, font_size=22, weight=BOLD),
                self.theme,
            )
            lbl.next_to(pos, LEFT, buff=0.28)
            return lbl

        def _bead_pt() -> np.ndarray:
            return self.pt(0, b_tracker.get_value())

        return ElevatorRig(
            b_tracker=b_tracker,
            lock_tracker=lock_tracker,
            rail=rail,
            gliding_line=always_redraw(_make_line),
            y_bead=always_redraw(_make_bead),
            b_label=always_redraw(_make_b_label),
            bead_point=_bead_pt,
        )

    def make_lock_ripple_anims(
        self,
        xy: tuple[float, float],
        *,
        color: str = "green",
        max_radius: float = 0.85,
    ) -> list[UpdateFromAlphaFunc]:
        """Dual expanding radar lock-on rings around a target coordinate."""
        center = self.pt(*xy)
        col = self.theme.color(color)
        anims: list[UpdateFromAlphaFunc] = []
        for idx in range(2):
            ring = Circle(radius=0.12, color=col, stroke_width=3.6 - idx * 0.8).move_to(center)
            delay = idx * 0.18

            def _make_updater(r_delay: float):
                def _upd(mob: Circle, alpha: float) -> None:
                    local = max(0.0, min(1.0, (alpha - r_delay) / (1.0 - r_delay)))
                    if local <= 0.001 or local >= 0.999:
                        mob.set_stroke(opacity=0.0)
                        return
                    eased = rate_functions.ease_out_cubic(local)
                    r = 0.12 + eased * max_radius
                    mob.become(
                        Circle(
                            radius=r,
                            color=col,
                            stroke_width=3.6 * (1.0 - eased * 0.55),
                            stroke_opacity=1.0 - eased,
                        ).move_to(center)
                    )
                return _upd

            anims.append(UpdateFromAlphaFunc(ring, _make_updater(delay)))
        return anims
