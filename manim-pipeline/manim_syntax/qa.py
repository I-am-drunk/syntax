"""
Automated Non-Slop Linter & 6-Frame Contact Sheet Visual QA Generator.

Inspired by gqy20/manim-agent (layout-safety), AmitSubhash/3brown1blue,
and DominikPeters/manim-skill (frame review contact sheets).
"""

from __future__ import annotations

import json
import math
from pathlib import Path
import re
import subprocess
import tempfile


BANNED_PATTERNS = [
    (re.compile(r"make_step_banner"), "Banned PowerPoint top banner (UI header already shows title)"),
    (re.compile(r"make_side_card"), "Banned PowerPoint side card (keep stage full-bleed)"),
    (re.compile(r"AvaNeural|AriaNeural|GuyNeural|JennyNeural"), "Voice lock violation: only en-US-AndrewNeural allowed"),
    (re.compile(r"from\s+manimlib\b|ShowCreation\("), "Engine lock violation: use ManimCE only"),
    (re.compile(r"#[0-9a-fA-F]{6}\b"), "Hardcoded hex color found in scene; use SyntaxTheme semantic tokens"),
]


def lint_scene_file(path: Path) -> list[str]:
    text = path.read_text(encoding="utf-8")
    errors: list[str] = []
    for lineno, line in enumerate(text.splitlines(), start=1):
        stripped = line.strip()
        if stripped.startswith("#"):
            continue
        for regex, msg in BANNED_PATTERNS:
            if regex.search(line):
                errors.append(f"{path.name}:{lineno}: {msg}")
    return errors


def _interp_sema(keyframes: list[dict], t: float) -> dict | None:
    if not keyframes:
        return None
    if t <= keyframes[0]["t"]:
        return keyframes[0]
    if t >= keyframes[-1]["t"]:
        return keyframes[-1]
    for i in range(len(keyframes) - 1):
        a, b = keyframes[i], keyframes[i + 1]
        if a["t"] <= t <= b["t"]:
            span = max(1e-5, b["t"] - a["t"])
            u = (t - a["t"]) / span
            return {
                "x": a["x"] + (b["x"] - a["x"]) * u,
                "y": a["y"] + (b["y"] - a["y"]) * u,
                "lookX": a["lookX"] + (b["lookX"] - a["lookX"]) * u,
                "lookY": a["lookY"] + (b["lookY"] - a["lookY"]) * u,
                "state": a["state"],
            }
    return keyframes[-1]


def build_contact_sheet(
    mp4_path: Path,
    track_path: Path | None,
    out_png: Path,
    *,
    frames: int = 6,
    cols: int = 3,
    tile_w: int = 440,
) -> dict:
    """
    Extract evenly-spaced frames from `mp4_path`, overlay projected Sema position & gaze
    from `track_path`, and stitch into a visual QA contact sheet PNG.
    """
    from PIL import Image, ImageDraw
    probe = subprocess.check_output(
        [
            "ffprobe",
            "-v",
            "error",
            "-show_entries",
            "format=duration",
            "-of",
            "json",
            str(mp4_path),
        ],
        text=True,
    )
    duration = max(0.5, float(json.loads(probe)["format"]["duration"]))
    track = json.loads(track_path.read_text(encoding="utf-8")) if track_path and track_path.exists() else None
    keyframes = track.get("keyframes", []) if track else []

    timestamps = [round(duration * (0.08 + 0.84 * (i / max(1, frames - 1))), 2) for i in range(frames)]
    rows = math.ceil(frames / cols)

    with tempfile.TemporaryDirectory() as tmpdir:
        imgs: list[tuple[float, Image.Image]] = []
        for idx, ts in enumerate(timestamps):
            frame_file = Path(tmpdir) / f"f_{idx}.png"
            subprocess.run(
                [
                    "ffmpeg",
                    "-y",
                    "-loglevel",
                    "error",
                    "-ss",
                    str(ts),
                    "-i",
                    str(mp4_path),
                    "-frames:v",
                    "1",
                    str(frame_file),
                ],
                check=True,
            )
            im = Image.open(frame_file).convert("RGBA")
            aspect = im.height / im.width
            tile_h = int(round(tile_w * aspect))
            im = im.resize((tile_w, tile_h), Image.Resampling.LANCZOS)

            draw = ImageDraw.Draw(im)
            # Draw actual Sema mascot preview (body + comma tail + 3D looking eyes + callout pill)
            sema = _interp_sema(keyframes, ts)
            if sema:
                cx = int(sema["x"] * tile_w)
                cy = int(sema["y"] * tile_h)
                r = 14
                # Soft drop halo
                draw.ellipse((cx - r + 2, cy + r + 5, cx + r - 2, cy + r + 11), fill=(20, 20, 20, 48))
                # Semicolon tail
                draw.polygon([(cx - 4, cy + r - 1), (cx + 4, cy + r - 1), (cx + 1, cy + r + 7), (cx - 5, cy + r + 9)], fill=(20, 20, 20, 245))
                # Sema body with white rim
                draw.ellipse((cx - r - 2, cy - r - 2, cx + r + 2, cy + r + 2), fill=(255, 255, 255, 235))
                draw.ellipse((cx - r, cy - r, cx + r, cy + r), fill=(20, 20, 20, 255))
                # Looking eyes shifted toward (lookX, lookY)
                ex_off = int(sema["lookX"] * 4.5)
                ey_off = int(sema["lookY"] * 3.5)
                draw.ellipse((cx - 6 + ex_off, cy - 4 + ey_off, cx - 2 + ex_off, cy + 2 + ey_off), fill=(255, 255, 255, 255))
                draw.ellipse((cx + 2 + ex_off, cy - 4 + ey_off, cx + 6 + ex_off, cy + 2 + ey_off), fill=(255, 255, 255, 255))
                # Active callout pill beside Sema
                active_callout = None
                if track:
                    for pr in track.get("prompts", []):
                        if pr["start"] - 0.05 <= ts <= pr["end"] + 0.08:
                            active_callout = pr.get("callout")
                tag = active_callout or sema["state"]
                tw = max(46, len(tag) * 6 + 18)
                if cx > tile_w * 0.62:
                    px0, px1 = cx - r - 6 - tw, cx - r - 6
                else:
                    px0, px1 = cx + r + 6, cx + r + 6 + tw
                draw.rounded_rectangle((px0, cy - 10, px1, cy + 10), radius=9, fill=(20, 20, 20, 232))
                draw.ellipse((px0 + 6, cy - 3, px0 + 12, cy + 3), fill=(94, 217, 129, 255))
                draw.text((px0 + 16, cy - 6), tag, fill=(255, 255, 255, 255))

            # Timestamp stamp in top-left corner
            draw.rectangle((6, 6, 74, 24), fill=(20, 20, 20, 185))
            draw.text((12, 9), f"t={ts:.1f}s", fill=(255, 255, 255, 255))
            imgs.append((ts, im))

        tile_h = imgs[0][1].height
        pad = 10
        sheet_w = cols * tile_w + (cols + 1) * pad
        sheet_h = rows * tile_h + (rows + 1) * pad
        sheet = Image.new("RGBA", (sheet_w, sheet_h), (28, 30, 38, 255))
        for idx, (_ts, im) in enumerate(imgs):
            r = idx // cols
            c = idx % cols
            sheet.paste(im, (pad + c * (tile_w + pad), pad + r * (tile_h + pad)))

        out_png.parent.mkdir(parents=True, exist_ok=True)
        sheet.convert("RGB").save(out_png)

    qa = track.get("qa", {}) if track else {}
    return {
        "duration": round(duration, 2),
        "contactSheet": str(out_png),
        "maxStaticGapSec": qa.get("maxStaticGapSec", 0.0),
        "overlapNudges": qa.get("overlapNudges", 0),
        "wordCount": qa.get("wordCount", 0),
        "keyframeCount": qa.get("keyframeCount", 0),
    }
