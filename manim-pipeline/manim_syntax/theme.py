"""
Brilliant-exact Light & Dark visual themes synced 1:1 with src/mpm2d/mpm2dBrilliant.css.
Style is enforced in code so every generated scene matches the Syntax course player seamlessly.
"""

from __future__ import annotations

from dataclasses import dataclass
import os

from manim import BOLD, MathTex, Text, TexTemplate


@dataclass(frozen=True)
class SyntaxTheme:
    name: str
    bg: str           # Matches --bg-surface (#ffffff / #141414) seamlessly
    surface: str      # Subtle elevated pill/chip fill
    surface_halo: str # Label knockout halo matching canvas bg
    border: str
    grid: str         # Matches --bg-grid (10% ink light, 20% ink dark)
    axis: str         # Matches --bg-ink
    ink: str
    muted: str        # Matches --bg-muted
    blue: str         # Matches --bg-blue
    teal: str         # Matches --bg-teal
    amber: str        # Matches --bg-orange
    violet: str       # Matches --bg-violet
    green: str        # Matches --bg-green
    red: str          # Matches --bg-red

    def color(self, token: str) -> str:
        key = token.strip().lower()
        mapping = {
            "blue": self.blue,
            "teal": self.teal,
            "amber": self.amber,
            "orange": self.amber,
            "violet": self.violet,
            "purple": self.violet,
            "green": self.green,
            "red": self.red,
            "rose": self.red,
            "ink": self.ink,
            "muted": self.muted,
            "axis": self.axis,
            "bg": self.bg,
            "surface": self.surface,
            "border": self.border,
        }
        if key in mapping:
            return mapping[key]
        raise ValueError(
            f"Off-brand color token {token!r}. Use semantic SyntaxTheme tokens: {sorted(mapping)}"
        )


LIGHT_THEME = SyntaxTheme(
    name="light",
    bg="#FFFFFF",
    surface="#F4F6FB",
    surface_halo="#FFFFFF",
    border="#DCE2EE",
    grid="#E5E7EB",
    axis="#141414",
    ink="#141414",
    muted="#666666",
    blue="#375CE3",
    teal="#279B8D",
    amber="#E77A16",
    violet="#7C5CE6",
    green="#15B441",
    red="#E14B4B",
)

DARK_THEME = SyntaxTheme(
    name="dark",
    bg="#141414",
    surface="#1E2028",
    surface_halo="#141414",
    border="#303442",
    grid="#363636",
    axis="#F3F4F6",
    ink="#FFFFFF",
    muted="#B3B3B3",
    blue="#7491FF",
    teal="#61C4B8",
    amber="#FFA95A",
    violet="#A78BFA",
    green="#5ED981",
    red="#FF8585",
)


def get_active_theme() -> SyntaxTheme:
    mode = os.environ.get("SYNTAX_THEME", "light").strip().lower()
    return DARK_THEME if mode == "dark" else LIGHT_THEME


def build_sans_tex_template() -> TexTemplate:
    tpl = TexTemplate()
    tpl.add_to_preamble(r"\usepackage{lmodern}")
    tpl.add_to_preamble(r"\renewcommand{\familydefault}{\sfdefault}")
    return tpl


SANS_TEX_TEMPLATE = build_sans_tex_template()
UI_FONT = "Noto Sans"


def ui_text(
    text: str,
    theme: SyntaxTheme,
    *,
    color: str = "ink",
    font_size: float = 26,
    weight: str = BOLD,
) -> Text:
    return Text(
        text,
        font=UI_FONT,
        weight=weight,
        font_size=font_size,
        color=theme.color(color),
    )


def math_tex(
    *tex_strings: str,
    theme: SyntaxTheme,
    color: str = "ink",
    font_size: float = 48,
    sans: bool = True,
) -> MathTex:
    parts = [rf"\mathsf{{{s}}}" if sans else s for s in tex_strings]
    return MathTex(
        *parts,
        tex_template=SANS_TEX_TEMPLATE,
        font_size=font_size,
        color=theme.color(color),
    )
