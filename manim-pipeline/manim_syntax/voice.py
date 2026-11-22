"""
Word-synced Edge-TTS narration engine strictly locked to en-US-AndrewNeural.
Supports inline <cue:name>...</cue> spans mapped to exact WordBoundary millisecond timings.
"""

from __future__ import annotations

import asyncio
from dataclasses import dataclass
import hashlib
import json
import os
from pathlib import Path
import re
import subprocess
import time
import uuid

import edge_tts

VOICE_NAME = "en-US-AndrewNeural"
VOICE_RATE = "+5%"

_CUE_OPEN_RE = re.compile(r"<cue:([a-zA-Z0-9_-]+)>")
_CUE_CLOSE_RE = re.compile(r"</cue>")


@dataclass(frozen=True)
class WordTiming:
    text: str
    start: float
    end: float


@dataclass(frozen=True)
class CueWindow:
    name: str
    start: float
    end: float

    @property
    def duration(self) -> float:
        return max(0.15, self.end - self.start)


@dataclass(frozen=True)
class NarrationResult:
    audio_path: Path
    duration: float
    plain_text: str
    words: list[WordTiming]
    cues: dict[str, CueWindow]


def _default_cache_dir() -> Path:
    env_dir = os.environ.get("SYNTAX_VOICE_CACHE")
    if env_dir:
        return Path(env_dir)
    return Path(__file__).resolve().parent.parent / ".cache" / "voice_v2"


def probe_duration_sec(audio_path: Path) -> float:
    cmd = [
        "ffprobe",
        "-v",
        "error",
        "-show_entries",
        "format=duration",
        "-of",
        "json",
        str(audio_path),
    ]
    out = subprocess.check_output(cmd, text=True)
    return float(json.loads(out)["format"]["duration"])


def parse_cued_script(script: str) -> tuple[str, dict[str, tuple[int, int]]]:
    """
    Parse inline `<cue:name>phrase</cue>` tags into clean plain text plus character spans.
    """
    plain_parts: list[str] = []
    open_starts: dict[str, int] = {}
    stack: list[str] = []
    spans: dict[str, tuple[int, int]] = {}
    pos = 0
    plain_len = 0

    token_re = re.compile(r"<cue:([a-zA-Z0-9_-]+)>|</cue>")
    for m in token_re.finditer(script):
        chunk = script[pos : m.start()]
        if chunk:
            plain_parts.append(chunk)
            plain_len += len(chunk)
        if m.group(1):
            name = m.group(1)
            stack.append(name)
            open_starts[name] = plain_len
        else:
            if stack:
                name = stack.pop()
                spans[name] = (open_starts[name], plain_len)
        pos = m.end()

    tail = script[pos:]
    if tail:
        plain_parts.append(tail)
        plain_len += len(tail)

    while stack:
        name = stack.pop()
        spans[name] = (open_starts[name], plain_len)

    raw_plain = "".join(plain_parts)
    # Normalize whitespace while tracking char remapping
    clean_chars: list[str] = []
    index_map: list[int] = []
    prev_space = True
    for i, ch in enumerate(raw_plain):
        is_ws = ch.isspace()
        if is_ws:
            if not prev_space:
                clean_chars.append(" ")
            index_map.append(len(clean_chars))
            prev_space = True
        else:
            clean_chars.append(ch)
            index_map.append(len(clean_chars) - 1)
            prev_space = False
    clean_plain = "".join(clean_chars).strip()
    max_idx = max(1, len(clean_plain))

    norm_spans: dict[str, tuple[int, int]] = {}
    for name, (s, e) in spans.items():
        cs = index_map[min(s, len(index_map) - 1)] if index_map else 0
        ce = index_map[min(max(0, e - 1), len(index_map) - 1)] + 1 if index_map else max_idx
        norm_spans[name] = (max(0, min(cs, max_idx)), max(0, min(ce, max_idx)))

    return clean_plain, norm_spans


def _map_cues_to_words(
    plain_text: str,
    cue_spans: dict[str, tuple[int, int]],
    words: list[WordTiming],
    total_duration: float,
) -> dict[str, CueWindow]:
    if not words:
        total_chars = max(1, len(plain_text))
        return {
            name: CueWindow(
                name=name,
                start=(s / total_chars) * total_duration,
                end=(e / total_chars) * total_duration,
            )
            for name, (s, e) in cue_spans.items()
        }

    # Align each WordTiming to its char span in plain_text sequentially
    word_char_spans: list[tuple[int, int, WordTiming]] = []
    cursor = 0
    lower_plain = plain_text.lower()
    for w in words:
        wt = w.text.strip().lower()
        idx = lower_plain.find(wt, cursor) if wt else cursor
        if idx == -1:
            idx = cursor
        end_idx = idx + len(wt)
        word_char_spans.append((idx, end_idx, w))
        cursor = end_idx

    cues: dict[str, CueWindow] = {}
    total_chars = max(1, len(plain_text))
    for name, (cs, ce) in cue_spans.items():
        matched = [w for (ws, we, w) in word_char_spans if we > cs and ws < ce]
        if matched:
            cues[name] = CueWindow(
                name=name,
                start=matched[0].start,
                end=matched[-1].end,
            )
        else:
            cues[name] = CueWindow(
                name=name,
                start=(cs / total_chars) * total_duration,
                end=(ce / total_chars) * total_duration,
            )
    return cues


class AndrewWordVoiceService:
    """
    Strictly locked to en-US-AndrewNeural. Generates MP3 + WordBoundary JSON cache.
    """

    def __init__(
        self,
        voice: str = VOICE_NAME,
        rate: str = VOICE_RATE,
        cache_dir: Path | None = None,
    ) -> None:
        if voice != VOICE_NAME:
            raise ValueError(
                f"Voice lock violation: only {VOICE_NAME!r} is allowed (got {voice!r})."
            )
        self.voice = voice
        self.rate = rate
        self.cache_dir = cache_dir or _default_cache_dir()
        self.cache_dir.mkdir(parents=True, exist_ok=True)

    def _cache_key(self, plain_text: str) -> str:
        payload = f"v2|{self.voice}|{self.rate}|{plain_text.strip()}"
        return hashlib.sha256(payload.encode("utf-8")).hexdigest()[:20]

    def synthesize(self, script: str) -> NarrationResult:
        plain_text, cue_spans = parse_cued_script(script)
        key = self._cache_key(plain_text)
        mp3_path = self.cache_dir / f"andrew_{key}.mp3"
        meta_path = self.cache_dir / f"andrew_{key}.meta.json"

        words: list[WordTiming] = []
        if not (mp3_path.exists() and mp3_path.stat().st_size > 2048 and meta_path.exists()):
            last_err: Exception | None = None
            for attempt in range(1, 7):
                try:
                    words = asyncio.run(self._generate_async(plain_text, mp3_path))
                    if mp3_path.exists() and mp3_path.stat().st_size > 2048:
                        duration = probe_duration_sec(mp3_path)
                        meta_tmp = meta_path.with_name(f".tmp_{uuid.uuid4().hex[:8]}.json")
                        meta_tmp.write_text(
                            json.dumps(
                                {
                                    "voice": self.voice,
                                    "rate": self.rate,
                                    "plainText": plain_text,
                                    "duration": duration,
                                    "words": [
                                        {
                                            "text": w.text,
                                            "start": round(w.start, 4),
                                            "end": round(w.end, 4),
                                        }
                                        for w in words
                                    ],
                                },
                                indent=2,
                            ),
                            encoding="utf-8",
                        )
                        os.replace(meta_tmp, meta_path)
                        break
                except Exception as exc:  # noqa: BLE001
                    last_err = exc
                    time.sleep(0.9 * attempt)
            else:
                raise RuntimeError(
                    f"Failed to synthesize {self.voice} for {plain_text!r}: {last_err}"
                )

        meta = json.loads(meta_path.read_text(encoding="utf-8"))
        duration = float(meta["duration"])
        words = [
            WordTiming(text=w["text"], start=float(w["start"]), end=float(w["end"]))
            for w in meta.get("words", [])
        ]
        cues = _map_cues_to_words(plain_text, cue_spans, words, duration)
        return NarrationResult(
            audio_path=mp3_path,
            duration=duration,
            plain_text=plain_text,
            words=words,
            cues=cues,
        )

    async def _generate_async(self, plain_text: str, out_path: Path) -> list[WordTiming]:
        tmp = out_path.with_name(f".tmp_{uuid.uuid4().hex[:8]}_{out_path.name}")
        comm = edge_tts.Communicate(
            plain_text,
            self.voice,
            rate=self.rate,
            boundary="WordBoundary",
        )
        words: list[WordTiming] = []
        with open(tmp, "wb") as f:
            async for chunk in comm.stream():
                ctype = chunk.get("type")
                if ctype == "audio":
                    f.write(chunk["data"])
                elif ctype == "WordBoundary":
                    start = float(chunk["offset"]) / 1e7
                    dur = float(chunk["duration"]) / 1e7
                    words.append(WordTiming(text=str(chunk["text"]), start=start, end=start + dur))
        os.replace(tmp, out_path)
        return words
