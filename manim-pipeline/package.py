#!/usr/bin/env python3
"""
Package rendered walkthrough beats into one seekable video per lens.

Input  (render.py output, committed source renders):
  manim-pipeline/beats/<pageId>/<theme>/<beatId>.mp4
  manim-pipeline/beats/<pageId>/<beatId>.track.json

Output (served by the app):
  public/assets/walkthroughs/<pageId>/<theme>/<lens>.mp4   one file per lens, short GOP for instant seeking
  public/assets/walkthroughs/<pageId>/<lens>.captions.vtt  phrase captions from the word timings
  public/assets/walkthroughs/<pageId>/<lens>.sema.json     merged Sema track on the lens timeline
  src/mpm2d/walkthrough/videoManifest.ts                    typed manifest with chapter boundaries

Beat ids are `<prefix>-<n>`; prefix `vis` maps to lens `visual`, `alg` to `algebra`.
Chapter titles are NOT stored here. They live in walkthroughData.ts keyed by beat id,
so there is exactly one place to edit copy.

Usage:
  python manim-pipeline/package.py                 # package every page
  python manim-pipeline/package.py --page l1-p3-worked
  python manim-pipeline/package.py --check         # validate outputs, write nothing
"""

from __future__ import annotations

import argparse
import json
import re
import shutil
import subprocess
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
PIPELINE_DIR = Path(__file__).resolve().parent
BEATS_DIR = PIPELINE_DIR / "beats"
PUBLIC_OUT = ROOT / "public" / "assets" / "walkthroughs"
MANIFEST_TS = ROOT / "src" / "mpm2d" / "walkthrough" / "videoManifest.ts"

LENS_BY_PREFIX = {"vis": "visual", "alg": "algebra"}
THEMES = ("light", "dark")
BEAT_RE = re.compile(r"^(?P<prefix>[a-z]+)-(?P<n>\d+)$")

# Caption phrasing: break on punctuation, pauses, or length.
CAPTION_MAX_WORDS = 8
CAPTION_MAX_SEC = 3.4
CAPTION_PAUSE_SEC = 0.32


def ffmpeg_exe() -> str:
    found = shutil.which("ffmpeg")
    if found:
        return found
    try:
        import imageio_ffmpeg  # type: ignore

        return imageio_ffmpeg.get_ffmpeg_exe()
    except Exception:  # pragma: no cover
        sys.exit("ffmpeg not found. Install ffmpeg or `pip install imageio-ffmpeg`.")


FFMPEG = ffmpeg_exe()


def probe_duration(path: Path) -> float:
    """Container duration in seconds, parsed from ffmpeg's input banner."""
    proc = subprocess.run([FFMPEG, "-hide_banner", "-i", str(path)], capture_output=True, text=True)
    m = re.search(r"Duration:\s*(\d+):(\d+):(\d+(?:\.\d+)?)", proc.stderr)
    if not m:
        raise RuntimeError(f"Could not read duration of {path}")
    h, mnt, s = m.groups()
    return int(h) * 3600 + int(mnt) * 60 + float(s)


def has_audio(path: Path) -> bool:
    proc = subprocess.run([FFMPEG, "-hide_banner", "-i", str(path)], capture_output=True, text=True)
    return "Audio:" in proc.stderr


def concat_videos(clips: list[Path], out: Path) -> None:
    """Re-encode through the concat filter so boundaries are frame-exact and every
    0.5 s is a keyframe (fast, accurate scrubbing in the browser)."""
    out.parent.mkdir(parents=True, exist_ok=True)
    cmd = [FFMPEG, "-y", "-hide_banner", "-loglevel", "error"]
    for c in clips:
        cmd += ["-i", str(c)]
    audio = all(has_audio(c) for c in clips)
    streams = "".join(f"[{i}:v:0]" + (f"[{i}:a:0]" if audio else "") for i in range(len(clips)))
    graph = f"{streams}concat=n={len(clips)}:v=1:a={1 if audio else 0}[v]" + ("[a]" if audio else "")
    cmd += ["-filter_complex", graph, "-map", "[v]"]
    if audio:
        cmd += ["-map", "[a]", "-c:a", "aac", "-b:a", "128k"]
    cmd += [
        "-c:v", "libx264", "-preset", "medium", "-crf", "22",
        "-pix_fmt", "yuv420p", "-g", "30", "-keyint_min", "30", "-sc_threshold", "0",
        "-movflags", "+faststart",
        str(out),
    ]
    subprocess.run(cmd, check=True)


def vtt_time(sec: float) -> str:
    sec = max(0.0, sec)
    h = int(sec // 3600)
    m = int((sec % 3600) // 60)
    s = sec % 60
    return f"{h:02d}:{m:02d}:{s:06.3f}"


def build_caption_cues(words: list[dict]) -> list[tuple[float, float, str]]:
    cues: list[tuple[float, float, str]] = []
    cur: list[dict] = []

    def flush() -> None:
        if cur:
            text = " ".join(w["text"] for w in cur).strip()
            text = re.sub(r"\s+([,.;:!?])", r"\1", text)
            cues.append((cur[0]["start"], cur[-1]["end"], text))
            cur.clear()

    for w in words:
        if cur:
            gap = w["start"] - cur[-1]["end"]
            span = w["end"] - cur[0]["start"]
            if gap > CAPTION_PAUSE_SEC or len(cur) >= CAPTION_MAX_WORDS or span > CAPTION_MAX_SEC:
                flush()
        cur.append(w)
        if re.search(r"[.!?;:,]$", w["text"]) and len(cur) >= 3:
            flush()
    flush()
    # Hold each cue until the next one starts (no flicker between phrases), capped.
    held: list[tuple[float, float, str]] = []
    for i, (s, e, t) in enumerate(cues):
        nxt = cues[i + 1][0] if i + 1 < len(cues) else e + 0.6
        held.append((s, max(e, min(nxt, e + 0.8)), t))
    return held


def merge_tracks(tracks: list[tuple[float, dict]], total: float) -> dict:
    keyframes: list[dict] = []
    prompts: list[dict] = []
    words: list[dict] = []
    for offset, tr in tracks:
        kfs = sorted(tr.get("keyframes", []), key=lambda k: k["t"])
        # Duplicate timestamps (the old tracks had two t=0 frames) make Sema teleport.
        # Keep the last frame for any timestamp.
        dedup: dict[float, dict] = {}
        for k in kfs:
            dedup[round(k["t"], 4)] = k
        for t in sorted(dedup):
            k = dict(dedup[t])
            k["t"] = round(t + offset, 4)
            keyframes.append(k)
        for p in tr.get("prompts", []):
            q = dict(p)
            q["start"] = round(p["start"] + offset, 3)
            q["end"] = round(p["end"] + offset, 3)
            prompts.append(q)
        for w in tr.get("words", []):
            words.append({"text": w["text"], "start": round(w["start"] + offset, 3), "end": round(w["end"] + offset, 3)})
    first = tracks[0][1] if tracks else {}
    return {
        "version": 3,
        "voice": first.get("voice", "en-US-AndrewNeural"),
        "aspectRatio": first.get("aspectRatio", 1.7778),
        "duration": round(total, 3),
        "keyframes": keyframes,
        "prompts": prompts,
        "words": words,
    }


def discover(page_dir: Path) -> dict[str, list[str]]:
    """lens -> ordered beat ids, using the light renders as the reference set."""
    lenses: dict[str, list[tuple[int, str]]] = {}
    ref = page_dir / "light"
    if not ref.is_dir():
        ref = page_dir / "dark"
    for mp4 in ref.glob("*.mp4"):
        m = BEAT_RE.match(mp4.stem)
        if not m or m["prefix"] not in LENS_BY_PREFIX:
            continue
        lenses.setdefault(LENS_BY_PREFIX[m["prefix"]], []).append((int(m["n"]), mp4.stem))
    return {lens: [b for _, b in sorted(items)] for lens, items in lenses.items()}


def package_page(page_id: str, check: bool) -> dict:
    page_dir = BEATS_DIR / page_id
    out_dir = PUBLIC_OUT / page_id
    entry: dict[str, dict] = {}
    for lens, beat_ids in sorted(discover(page_dir).items()):
        ref_theme = "light" if (page_dir / "light").is_dir() else "dark"
        durations = [probe_duration(page_dir / ref_theme / f"{b}.mp4") for b in beat_ids]
        chapters, t = [], 0.0
        for b, d in zip(beat_ids, durations):
            chapters.append({"beatId": b, "start": round(t, 3), "end": round(t + d, 3)})
            t += d
        total = t

        lens_entry: dict = {"duration": round(total, 3), "chapters": chapters}
        for theme in THEMES:
            clips = [page_dir / theme / f"{b}.mp4" for b in beat_ids]
            if not all(c.exists() for c in clips):
                continue
            out = out_dir / theme / f"{lens}.mp4"
            if not check:
                concat_videos(clips, out)
                got = probe_duration(out)
                if abs(got - total) > 0.12:
                    raise RuntimeError(f"{out}: duration {got:.3f}s drifted from chapter sum {total:.3f}s")
            lens_entry[theme] = f"/assets/walkthroughs/{page_id}/{theme}/{lens}.mp4"

        tracks = []
        for b, ch in zip(beat_ids, chapters):
            tp = page_dir / f"{b}.track.json"
            if tp.exists():
                tracks.append((ch["start"], json.loads(tp.read_text(encoding="utf-8"))))
        if tracks:
            merged = merge_tracks(tracks, total)
            if not check:
                (out_dir / f"{lens}.sema.json").write_text(json.dumps(merged, separators=(",", ":")), encoding="utf-8")
                cues = build_caption_cues(merged["words"])
                vtt = "WEBVTT\n\n" + "\n\n".join(
                    f"{i + 1}\n{vtt_time(s)} --> {vtt_time(e)}\n{text}" for i, (s, e, text) in enumerate(cues)
                ) + "\n"
                (out_dir / f"{lens}.captions.vtt").write_text(vtt, encoding="utf-8")
            lens_entry["sema"] = f"/assets/walkthroughs/{page_id}/{lens}.sema.json"
            lens_entry["captions"] = f"/assets/walkthroughs/{page_id}/{lens}.captions.vtt"
        entry[lens] = lens_entry
        print(f"  {page_id}/{lens}: {len(beat_ids)} chapters, {total:.2f}s")
    return entry


def write_manifest(manifest: dict) -> None:
    ts = (
        "// Generated by manim-pipeline/package.py. Do not edit by hand.\n"
        "// Re-run `npm run package:walkthroughs` after rendering.\n"
        "import type { WalkthroughVideoManifest } from './videoTypes'\n\n"
        f"export const WALKTHROUGH_VIDEO_MANIFEST: WalkthroughVideoManifest = {json.dumps(manifest, indent=2)}\n"
    )
    MANIFEST_TS.write_text(ts, encoding="utf-8")
    print(f"[manifest] {MANIFEST_TS.relative_to(ROOT)} ({len(manifest)} page(s))")


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("--page", help="Only package this pageId")
    parser.add_argument("--check", action="store_true", help="Validate inputs and print the plan; write nothing")
    args = parser.parse_args()

    if not BEATS_DIR.is_dir():
        sys.exit(f"No beat renders found in {BEATS_DIR}")

    pages = sorted(p.name for p in BEATS_DIR.iterdir() if p.is_dir())
    if args.page:
        if args.page not in pages:
            sys.exit(f"Unknown page {args.page}. Known: {', '.join(pages)}")
        pages = [args.page]

    # Packaging one page must not drop the others from the manifest.
    manifest: dict = {}
    for page_id in sorted(p.name for p in BEATS_DIR.iterdir() if p.is_dir()):
        if page_id in pages:
            manifest[page_id] = package_page(page_id, args.check)
        else:
            manifest[page_id] = package_page(page_id, True)

    if not args.check:
        write_manifest(manifest)


if __name__ == "__main__":
    main()
