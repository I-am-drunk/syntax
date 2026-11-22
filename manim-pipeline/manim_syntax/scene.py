"""
SyntaxScene — Base Manim Community scene integrating:
  - Brilliant-exact Light & Dark SyntaxTheme
  - Word-synced en-US-AndrewNeural narration with <cue:name> markers
  - Live 20Hz SemaDirector choreography + <beat>.track.json export
  - Motion-density tracking so scenes never drift into dead static slides
"""

from __future__ import annotations

from contextlib import contextmanager
from dataclasses import dataclass
import os
from pathlib import Path
from typing import Iterator

from manim import Mobject, Scene

from .sema_director import SemaDirector
from .verifier import SyntaxVerifier
from .theme import SyntaxTheme, get_active_theme
from .voice import AndrewWordVoiceService, CueWindow, NarrationResult, VOICE_NAME


@dataclass
class CueTimeline:
    narration: NarrationResult
    scene_start_time: float
    scene: "SyntaxScene"

    def __getitem__(self, name: str) -> CueWindow:
        if name not in self.narration.cues:
            raise KeyError(
                f"Unknown cue {name!r}. Available cues: {sorted(self.narration.cues)}"
            )
        cw = self.narration.cues[name]
        return CueWindow(
            name=cw.name,
            start=self.scene_start_time + cw.start,
            end=self.scene_start_time + cw.end,
        )

    @property
    def end(self) -> float:
        return self.scene_start_time + self.narration.duration

    def remaining(self, buff: float = 0.0) -> float:
        return max(0.0, self.end - float(self.scene.renderer.time) + buff)

    def time_until(self, target_scene_time: float, min_dur: float = 0.25) -> float:
        return max(min_dur, target_scene_time - float(self.scene.renderer.time))


class SyntaxScene(Scene):
    voice_name: str = VOICE_NAME

    def setup(self) -> None:
        super().setup()
        self.theme: SyntaxTheme = get_active_theme()
        self.camera.background_color = self.theme.bg
        self.voice_service = AndrewWordVoiceService(voice=self.voice_name)
        self.sema = SemaDirector(self)
        self.verify = SyntaxVerifier(self)

        # Invisible heartbeat mobject so SemaDirector samples live moving mobjects every frame
        self._sema_heartbeat = Mobject()
        self._sema_heartbeat._sema_ignore = True  # type: ignore[attr-defined]
        self._sema_heartbeat.add_updater(lambda _m, dt: self.sema.sample_live())
        self.add(self._sema_heartbeat)

    def wait_until(self, target_scene_time: float) -> None:
        delta = target_scene_time - float(self.renderer.time)
        if delta > 0.04:
            self.sema.record_static_wait(delta)
            self.wait(delta)

    def play_until(self, target_scene_time: float, *animations, min_run_time: float = 0.35, **kwargs) -> None:
        """Play animations stretched smoothly to land on an exact word cue timestamp."""
        rt = max(min_run_time, target_scene_time - float(self.renderer.time))
        kwargs["run_time"] = rt
        self.play(*animations, **kwargs)

    @contextmanager
    def narrate(self, script: str, pad_after: float = 0.28) -> Iterator[CueTimeline]:
        """
        Play en-US-AndrewNeural narration and expose exact word-aligned <cue:name> windows.
        """
        nar = self.voice_service.synthesize(script)
        start_time = float(self.renderer.time)
        self.add_sound(str(nar.audio_path))
        self.sema.record_words(start_time, nar.words, len(nar.cues))
        timeline = CueTimeline(narration=nar, scene_start_time=start_time, scene=self)
        yield timeline
        rem = timeline.remaining(buff=pad_after)
        if rem > 0.04:
            self.sema.record_static_wait(rem)
            self.wait(rem)

    def tear_down(self) -> None:
        super().tear_down()
        track_data = self.sema.export_dict()
        self.verify.audit_scene_end(track_data)
        report = self.verify.raise_if_failed()
        track_data["verification"] = report
        track_out = os.environ.get("SYNTAX_TRACK_OUT")
        if track_out:
            import json
            out_p = Path(track_out)
            out_p.parent.mkdir(parents=True, exist_ok=True)
            out_p.write_text(json.dumps(track_data, indent=2), encoding="utf-8")
