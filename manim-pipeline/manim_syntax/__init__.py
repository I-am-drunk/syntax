"""
manim_syntax — Brilliant-exact Manim Community animation library + Moving Sema director.
"""

from .algebra import (
    make_math_chip,
    make_parabolic_arc,
    make_result_pill,
    make_token,
    make_whisper,
    orbital_swap_anims,
    parabolic_jump_anim,
    spin_sign_anim,
)
from .graph import (
    ElevatorRig,
    RiseRunHandle,
    RotationRig,
    SyntaxGraph,
    make_pill_badge,
)
from .scene import CueTimeline, SyntaxScene
from .sema_director import SemaDirector, SemaPrompt
from .theme import DARK_THEME, LIGHT_THEME, SyntaxTheme, get_active_theme, math_tex, ui_text
from .verifier import SyntaxVerifier, VerificationError
from .voice import AndrewWordVoiceService, CueWindow, NarrationResult, VOICE_NAME, WordTiming

__all__ = [
    "AndrewWordVoiceService",
    "CueTimeline",
    "CueWindow",
    "DARK_THEME",
    "ElevatorRig",
    "LIGHT_THEME",
    "NarrationResult",
    "RiseRunHandle",
    "RotationRig",
    "SemaDirector",
    "SemaPrompt",
    "SyntaxGraph",
    "SyntaxScene",
    "SyntaxTheme",
    "SyntaxVerifier",
    "VerificationError",
    "VOICE_NAME",
    "WordTiming",
    "get_active_theme",
    "make_math_chip",
    "make_parabolic_arc",
    "make_pill_badge",
    "make_result_pill",
    "make_token",
    "make_whisper",
    "math_tex",
    "orbital_swap_anims",
    "parabolic_jump_anim",
    "spin_sign_anim",
    "ui_text",
]
