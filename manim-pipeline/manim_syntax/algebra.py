"""
SyntaxAlgebra — Brilliant-exact kinetic equation choreography.

No static PowerPoint line-dumps! Every algebraic move is physical:
  - Parabolic term arc over '=' with mid-air sign & color morph
  - True 180-degree orbital fraction flip around the fraction bar
  - Spinning '-' -> '+' bounce with scale overshoot
  - Color-coded rounded math chips for substitution cascades
"""

from __future__ import annotations

import math

from manim import (
    BOLD,
    DOWN,
    LEFT,
    ORIGIN,
    PI,
    RIGHT,
    UP,
    CubicBezier,
    Line,
    RoundedRectangle,
    UpdateFromAlphaFunc,
    VGroup,
    VMobject,
    rate_functions,
)
import numpy as np

from .theme import SyntaxTheme, ui_text


def make_whisper(text: str, theme: SyntaxTheme) -> VMobject:
    """Ultra-quiet single-line top whisper (replaces noisy boxed banners)."""
    lbl = ui_text(text, theme, color="muted", font_size=24, weight=BOLD)
    lbl.to_edge(UP, buff=0.58)
    return lbl


def make_token(
    text: str,
    theme: SyntaxTheme,
    *,
    color: str = "ink",
    font_size: float = 72,
) -> VMobject:
    return ui_text(text, theme, color=color, font_size=font_size, weight=BOLD)


def make_math_chip(
    text: str,
    theme: SyntaxTheme,
    *,
    accent: str = "amber",
    font_size: float = 42,
    pad_x: float = 0.30,
    pad_y: float = 0.16,
) -> VGroup:
    """Exact Brilliant/4b065b5 color-coded rounded substitution token chip."""
    col = theme.color(accent)
    lbl = ui_text(text, theme, color=accent, font_size=font_size, weight=BOLD)
    box = RoundedRectangle(
        width=max(0.88, lbl.width + pad_x * 2),
        height=max(0.84, lbl.height + pad_y * 2),
        corner_radius=0.18,
        fill_color=col,
        fill_opacity=0.14,
        stroke_color=col,
        stroke_width=2.6,
    )
    lbl.move_to(box.get_center())
    return VGroup(box, lbl)


def make_result_pill(
    text: str,
    theme: SyntaxTheme,
    *,
    accent: str = "green",
    font_size: float = 36,
) -> VGroup:
    """Crisp rounded final answer pill centered cleanly below the algebra canvas."""
    col = theme.color(accent)
    lbl = ui_text(text, theme, color=accent, font_size=font_size, weight=BOLD)
    bg = RoundedRectangle(
        width=max(2.6, lbl.width + 0.85),
        height=max(0.92, lbl.height + 0.40),
        corner_radius=0.26,
        fill_color=col,
        fill_opacity=0.15,
        stroke_color=col,
        stroke_width=2.8,
    )
    lbl.move_to(bg.get_center())
    return VGroup(bg, lbl)


def make_parabolic_arc(start: np.ndarray, end: np.ndarray, lift: float = 1.85) -> CubicBezier:
    mid_x = (start[0] + end[0]) * 0.5
    apex_y = max(start[1], end[1]) + lift
    c1 = np.array([start[0] + (mid_x - start[0]) * 0.55, apex_y, 0.0])
    c2 = np.array([end[0] - (end[0] - mid_x) * 0.55, apex_y, 0.0])
    return CubicBezier(start, c1, c2, end)


def parabolic_jump_anim(
    mover: VMobject,
    *,
    start_pos: np.ndarray,
    end_pos: np.ndarray,
    after_template: VMobject,
    lift: float = 1.85,
) -> UpdateFromAlphaFunc:
    """
    Smoothly lifts a term on a parabolic arc over '=' and morphs it mid-air
    (at t = 0.52) into `after_template` (e.g., blue '3x' -> teal '−3x').
    """
    before_copy = mover.copy()
    after_copy = after_template.copy()

    def _upd(mob: VMobject, alpha: float) -> None:
        t = rate_functions.ease_in_out_cubic(alpha)
        x = start_pos[0] + (end_pos[0] - start_pos[0]) * t
        y = start_pos[1] + (end_pos[1] - start_pos[1]) * t + math.sin(t * PI) * lift
        scale_bump = 1.0 + 0.14 * math.sin(t * PI)
        src = after_copy if t > 0.52 else before_copy
        mob.become(src.copy().scale(scale_bump).move_to(np.array([x, y, 0.0])))

    return UpdateFromAlphaFunc(mover, _upd)


def orbital_swap_anims(
    num_mob: VMobject,
    den_mob: VMobject,
    center: np.ndarray,
    *,
    rx: float = 0.78,
    ry: float = 0.74,
) -> tuple[UpdateFromAlphaFunc, UpdateFromAlphaFunc]:
    """
    True 180-degree circular orbital swap around a fraction bar:
      - numerator swings right & down to denominator
      - denominator swings left & up to numerator
    """
    def _upd_num(mob: VMobject, alpha: float) -> None:
        t = rate_functions.ease_in_out_cubic(alpha)
        theta = t * PI
        pos = center + np.array([math.sin(theta) * rx, math.cos(theta) * ry, 0.0])
        mob.move_to(pos)

    def _upd_den(mob: VMobject, alpha: float) -> None:
        t = rate_functions.ease_in_out_cubic(alpha)
        theta = t * PI
        pos = center + np.array([-math.sin(theta) * rx, -math.cos(theta) * ry, 0.0])
        mob.move_to(pos)

    return UpdateFromAlphaFunc(num_mob, _upd_num), UpdateFromAlphaFunc(den_mob, _upd_den)


def spin_sign_anim(
    sign_mob: VMobject,
    *,
    plus_template: VMobject,
    anchor: np.ndarray,
) -> UpdateFromAlphaFunc:
    """
    Physically spins '−' 180 degrees with an elastic scale bounce into green '+'.
    """
    minus_copy = sign_mob.copy()
    plus_copy = plus_template.copy()

    def _upd(mob: VMobject, alpha: float) -> None:
        t = rate_functions.ease_in_out_cubic(alpha)
        angle = -t * PI
        scale = 1.0 + 0.30 * math.sin(t * PI)
        src = plus_copy if t > 0.50 else minus_copy
        cur = src.copy().scale(scale).rotate(angle)
        cur.move_to(anchor)
        mob.become(cur)

    return UpdateFromAlphaFunc(sign_mob, _upd)
