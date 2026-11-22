#!/usr/bin/env python3
"""
Syntax Motion Studio — Automated Manim Community + Moving Sema Render & QA Pipeline.

Usage:
  python3 manim-pipeline/render.py --page l1-p3-worked --theme both --quality web
  python3 manim-pipeline/render.py --page l1-p3-worked --beat vis-1 --force
"""

from __future__ import annotations

import argparse
from concurrent.futures import ThreadPoolExecutor, as_completed
import json
import os
from pathlib import Path
import shutil
import subprocess
import sys
import time

ROOT = Path(__file__).resolve().parent.parent
PIPELINE_DIR = Path(__file__).resolve().parent
PUBLIC_OUT = ROOT / "public" / "assets" / "walkthroughs"
MANIFEST_TS = ROOT / "src" / "mpm2d" / "walkthrough" / "videoManifest.ts"
CACHE_DIR = PIPELINE_DIR / ".cache"
QA_DIR = CACHE_DIR / "qa"
DOCKER_IMAGE = os.environ.get("SYNTAX_MANIM_IMAGE", "syntax-manim:latest")

# Quality presets (60fps for silky-smooth kinetic math matching 4b065b5!)
QUALITY_FLAGS = {
    "verify": ["-r", "320,180", "--fps", "4"],
    "draft": ["-r", "640,360", "--fps", "30"],
    "web": ["-r", "1024,576", "--fps", "60"],
    "hd": ["-r", "1280,720", "--fps", "60"],
}

SCENE_REGISTRY: list[dict[str, str]] = [
    # Lesson 1 · Page 3 (Gold-standard Vertical Slice)
    {"pageId": "l1-p3-worked", "beatId": "vis-1", "file": "scenes/l1_p3_perpendicular.py", "cls": "L1P3_Vis1"},
    {"pageId": "l1-p3-worked", "beatId": "vis-2", "file": "scenes/l1_p3_perpendicular.py", "cls": "L1P3_Vis2"},
    {"pageId": "l1-p3-worked", "beatId": "vis-3", "file": "scenes/l1_p3_perpendicular.py", "cls": "L1P3_Vis3"},
    {"pageId": "l1-p3-worked", "beatId": "alg-1", "file": "scenes/l1_p3_perpendicular.py", "cls": "L1P3_Alg1"},
    {"pageId": "l1-p3-worked", "beatId": "alg-2", "file": "scenes/l1_p3_perpendicular.py", "cls": "L1P3_Alg2"},
    {"pageId": "l1-p3-worked", "beatId": "alg-3", "file": "scenes/l1_p3_perpendicular.py", "cls": "L1P3_Alg3"},
]


def run_lint(items: list[dict[str, str]]) -> None:
    import importlib.util
    spec = importlib.util.spec_from_file_location("syntax_qa", PIPELINE_DIR / "manim_syntax" / "qa.py")
    assert spec and spec.loader
    mod = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(mod)
    lint_scene_file = mod.lint_scene_file

    seen_files = sorted({PIPELINE_DIR / it["file"] for it in items})
    all_errors: list[str] = []
    for f in seen_files:
        all_errors.extend(lint_scene_file(f))
    if all_errors:
        print("NO-SLOP LINT FAILED:", file=sys.stderr)
        for err in all_errors:
            print(f"  - {err}", file=sys.stderr)
        sys.exit(2)
    print(f"[QA Lint] Passed ({len(seen_files)} scene file(s), 0 violations)")


def render_one(item: dict[str, str], theme: str, quality: str, make_qa: bool) -> dict:
    page_id = item["pageId"]
    beat_id = item["beatId"]
    scene_file = item["file"]
    scene_cls = item["cls"]

    out_dir = PUBLIC_OUT / page_id / theme
    out_dir.mkdir(parents=True, exist_ok=True)
    final_mp4 = out_dir / f"{beat_id}.mp4"
    track_json = PUBLIC_OUT / page_id / f"{beat_id}.track.json"

    job_media = CACHE_DIR / "media" / f"{page_id}_{beat_id}_{theme}"
    if job_media.exists():
        shutil.rmtree(job_media)
    job_media.mkdir(parents=True, exist_ok=True)

    rel_media = job_media.relative_to(PIPELINE_DIR)
    rel_track = f"/out/{page_id}/{beat_id}.track.json"
    qflags = QUALITY_FLAGS[quality]

    env_flags = [
        "-e", "PYTHONPATH=/workspace",
        "-e", f"SYNTAX_THEME={theme}",
        "-e", "SYNTAX_VOICE_CACHE=/workspace/.cache/voice_v2",
    ]
    # Emit canonical Sema track JSON on light theme (or if track doesn't exist yet)
    if theme == "light" or not track_json.exists():
        env_flags += ["-e", f"SYNTAX_TRACK_OUT={rel_track}"]

    t0 = time.monotonic()
    cmd = [
        "docker", "run", "--rm",
        "--user", f"{os.getuid()}:{os.getgid()}",
        *env_flags,
        "-v", f"{PIPELINE_DIR}:/workspace",
        "-v", f"{PUBLIC_OUT}:/out",
        DOCKER_IMAGE,
        "manim",
        "--disable_caching",
        "--media_dir", f"/workspace/{rel_media}",
        *qflags,
        f"/workspace/{scene_file}",
        scene_cls,
    ]
    proc = subprocess.run(cmd, capture_output=True, text=True)
    if proc.returncode != 0:
        raise RuntimeError(
            f"Render failed for {page_id}/{theme}/{beat_id}:\n{proc.stdout[-1200:]}\n{proc.stderr[-1200:]}"
        )

    mp4s = list(job_media.rglob(f"{scene_cls}.mp4"))
    if not mp4s:
        raise RuntimeError(f"Expected {scene_cls}.mp4 in {job_media}, found none.")
    src_mp4 = mp4s[0]

    # Transcode with faststart + clean H.264/AAC for instant browser streaming
    ff_cmd = [
        "docker", "run", "--rm",
        "--user", f"{os.getuid()}:{os.getgid()}",
        "-v", f"{PIPELINE_DIR}:/workspace",
        "-v", f"{PUBLIC_OUT}:/out",
        DOCKER_IMAGE,
        "ffmpeg", "-y", "-loglevel", "error",
        "-i", f"/workspace/{src_mp4.relative_to(PIPELINE_DIR)}",
        "-c:v", "libx264", "-preset", "veryfast", "-crf", "21",
        "-pix_fmt", "yuv420p", "-movflags", "+faststart",
        "-c:a", "aac", "-b:a", "128k",
        f"/out/{page_id}/{theme}/{beat_id}.mp4",
    ]
    subprocess.run(ff_cmd, check=True)
    shutil.rmtree(job_media, ignore_errors=True)

    qa_report: dict = {}
    if make_qa and theme == "light":
        QA_DIR.mkdir(parents=True, exist_ok=True)
        qa_cmd = [
            "docker", "run", "--rm",
            "--user", f"{os.getuid()}:{os.getgid()}",
            "-e", "PYTHONPATH=/workspace",
            "-v", f"{PIPELINE_DIR}:/workspace",
            "-v", f"{PUBLIC_OUT}:/out",
            DOCKER_IMAGE,
            "python3", "-c",
            (
                "import json; from pathlib import Path; "
                "from manim_syntax.qa import build_contact_sheet; "
                f"r = build_contact_sheet(Path('/out/{page_id}/{theme}/{beat_id}.mp4'), "
                f"Path('/out/{page_id}/{beat_id}.track.json'), "
                f"Path('/workspace/.cache/qa/{page_id}_{beat_id}_{theme}.png')); "
                "print(json.dumps(r))"
            ),
        ]
        qa_out = subprocess.check_output(qa_cmd, text=True).strip().splitlines()[-1]
        qa_report = json.loads(qa_out)

    elapsed = round(time.monotonic() - t0, 1)
    size_kb = round(final_mp4.stat().st_size / 1024, 1)
    return {
        "key": f"{page_id}/{theme}/{beat_id}",
        "elapsed": elapsed,
        "sizeKb": size_kb,
        "qa": qa_report,
    }


def write_manifest() -> None:
    manifest: dict[str, dict[str, dict[str, str]]] = {}
    if PUBLIC_OUT.exists():
        for page_dir in sorted(PUBLIC_OUT.iterdir()):
            if not page_dir.is_dir():
                continue
            page_id = page_dir.name
            beats: dict[str, dict[str, str]] = {}
            for theme in ("light", "dark"):
                tdir = page_dir / theme
                if not tdir.is_dir():
                    continue
                for mp4 in sorted(tdir.glob("*.mp4")):
                    beat_id = mp4.stem
                    entry = beats.setdefault(beat_id, {})
                    entry[theme] = f"/assets/walkthroughs/{page_id}/{theme}/{beat_id}.mp4"
                    track_file = page_dir / f"{beat_id}.track.json"
                    if track_file.exists():
                        entry["track"] = f"/assets/walkthroughs/{page_id}/{beat_id}.track.json"
            if beats:
                manifest[page_id] = beats

    ts = (
        "// Auto-generated by manim-pipeline/render.py — do not edit manually.\n"
        "export type WalkthroughVideoEntry = {\n"
        "  light?: string\n"
        "  dark?: string\n"
        "  track?: string\n"
        "}\n\n"
        f"export const WALKTHROUGH_VIDEO_MANIFEST: Record<string, Record<string, WalkthroughVideoEntry>> = "
        f"{json.dumps(manifest, indent=2)}\n\n"
        "export function getWalkthroughVideoEntry(\n"
        "  pageId: string,\n"
        "  beatId: string,\n"
        "): WalkthroughVideoEntry | null {\n"
        "  return WALKTHROUGH_VIDEO_MANIFEST[pageId]?.[beatId] ?? null\n"
        "}\n"
    )
    MANIFEST_TS.write_text(ts, encoding="utf-8")
    print(f"[Manifest] Updated {MANIFEST_TS.relative_to(ROOT)} ({sum(len(v) for v in manifest.values())} beats)")


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("--page", help="Filter by pageId (e.g. l1-p3-worked)")
    parser.add_argument("--beat", help="Filter by beatId (e.g. vis-1)")
    parser.add_argument("--theme", choices=["light", "dark", "both"], default="both")
    parser.add_argument("--quality", choices=["verify", "draft", "web", "hd"], default="web")
    parser.add_argument("--verify-only", action="store_true", help="Fast compiler verification pass (geometry, bounds, overlaps, voice sync) without overwriting MP4s")
    parser.add_argument("--workers", type=int, default=2)
    parser.add_argument("--force", action="store_true")
    parser.add_argument("--no-qa", action="store_true")
    parser.add_argument("--manifest-only", action="store_true")
    args = parser.parse_args()

    if args.manifest_only:
        write_manifest()
        return

    if args.verify_only:
        items = [
            it for it in SCENE_REGISTRY
            if (not args.page or it["pageId"] == args.page)
            and (not args.beat or it["beatId"] == args.beat)
        ]
        run_lint(items)
        print(f"[Verify] Running hard geometric + layout compiler pass on {len(items)} scene(s)...")
        for it in items:
            job_media = CACHE_DIR / "verify" / f"{it['pageId']}_{it['beatId']}"
            if job_media.exists():
                shutil.rmtree(job_media)
            job_media.mkdir(parents=True, exist_ok=True)
            rel_media = job_media.relative_to(PIPELINE_DIR)
            track_tmp = job_media / "verify.track.json"
            rel_track = track_tmp.relative_to(PIPELINE_DIR)
            cmd = [
                "docker", "run", "--rm",
                "--user", f"{os.getuid()}:{os.getgid()}",
                "-e", "PYTHONPATH=/workspace",
                "-e", "SYNTAX_THEME=light",
                "-e", "SYNTAX_VOICE_CACHE=/workspace/.cache/voice_v2",
                "-e", f"SYNTAX_TRACK_OUT=/workspace/{rel_track}",
                "-v", f"{PIPELINE_DIR}:/workspace",
                DOCKER_IMAGE,
                "manim", "--disable_caching", "--media_dir", f"/workspace/{rel_media}",
                "-r", "320,180", "--fps", "4",
                f"/workspace/{it['file']}", it["cls"],
            ]
            proc = subprocess.run(cmd, capture_output=True, text=True)
            if proc.returncode != 0:
                print(f"  ✗ FAIL {it['pageId']}/{it['beatId']}:", file=sys.stderr)
                print(proc.stderr[-1500:], file=sys.stderr)
                sys.exit(1)
            data = json.loads(track_tmp.read_text(encoding="utf-8"))
            checks = data.get("verification", [])
            print(f"  ✓ PASS {it['pageId']}/{it['beatId']} ({len(checks)} geometric & layout invariants verified)")
            shutil.rmtree(job_media, ignore_errors=True)
        return

    items = [
        it for it in SCENE_REGISTRY
        if (not args.page or it["pageId"] == args.page)
        and (not args.beat or it["beatId"] == args.beat)
    ]
    if not items:
        print("No matching scenes in SCENE_REGISTRY.", file=sys.stderr)
        sys.exit(1)

    run_lint(items)

    themes = ["light", "dark"] if args.theme == "both" else [args.theme]
    # Always render light before dark so voice cache + track.json are populated cleanly
    jobs = [
        (it, th)
        for th in themes
        for it in items
        if args.force
        or not (PUBLIC_OUT / it["pageId"] / th / f"{it['beatId']}.mp4").exists()
        or (PUBLIC_OUT / it["pageId"] / th / f"{it['beatId']}.mp4").stat().st_size < 16000
    ]
    if not jobs:
        print("All matching videos already rendered.")
        write_manifest()
        return

    print(f"[Render] Starting {len(jobs)} job(s) @ {args.quality} ({QUALITY_FLAGS[args.quality]})...")
    # Render light jobs first (populates voice cache), then dark jobs in parallel
    light_jobs = [(it, th) for it, th in jobs if th == "light"]
    dark_jobs = [(it, th) for it, th in jobs if th == "dark"]

    for batch_name, batch in (("light", light_jobs), ("dark", dark_jobs)):
        if not batch:
            continue
        with ThreadPoolExecutor(max_workers=max(1, args.workers)) as pool:
            futs = {
                pool.submit(render_one, it, th, args.quality, not args.no_qa): (it, th)
                for it, th in batch
            }
            for fut in as_completed(futs):
                res = fut.result()
                qa = res["qa"]
                qa_str = ""
                if qa:
                    qa_str = (
                        f" | dur={qa.get('duration')}s"
                        f" words={qa.get('wordCount')}"
                        f" kf={qa.get('keyframeCount')}"
                        f" maxGap={qa.get('maxStaticGapSec')}s"
                        f" nudges={qa.get('overlapNudges')}"
                    )
                print(f"  ✓ {res['key']} ({res['sizeKb']} KB, {res['elapsed']}s){qa_str}")

    write_manifest()


if __name__ == "__main__":
    main()
