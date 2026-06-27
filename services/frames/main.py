"""Pacer frames worker — turns a YouTube workout video into a step-through
routine: one clear still frame per section.

Flow (one job): yt-dlp metadata + chapters → length cap → download ~720p →
per-section seek+extract a few candidate frames → OpenCV sharpness shortlist →
gpt-4o-mini picks the frame that best shows the move → upload to Supabase Storage
→ POST the result back to the Hono api's /internal callback.

Trust boundary: this service is called only by the api with a shared
INTERNAL_TOKEN, and it holds the Supabase service-role key (used only for Storage
uploads). Never expose it publicly without the token.
"""

from __future__ import annotations

import asyncio
import base64
import json
import logging
import os
import subprocess
import tempfile
from pathlib import Path

import cv2
import httpx
from fastapi import FastAPI, Header, Request
from fastapi.responses import JSONResponse
from supabase import create_client
from yt_dlp import YoutubeDL
from yt_dlp.utils import DownloadError

from sections import build_sections

logging.basicConfig(level=logging.INFO)
log = logging.getLogger("frames")

# ── config ───────────────────────────────────────────────────────────────────
INTERNAL_TOKEN = os.environ["INTERNAL_TOKEN"]
API_BASE_URL = os.environ["API_BASE_URL"].rstrip("/")
SUPABASE_URL = os.environ["SUPABASE_URL"]
SUPABASE_SERVICE_ROLE_KEY = os.environ["SUPABASE_SERVICE_ROLE_KEY"]
OPENAI_API_KEY = os.environ.get("OPENAI_API_KEY")
YTDLP_PROXY = os.environ.get("YTDLP_PROXY")

MAX_VIDEO_MINUTES = int(os.environ.get("MAX_VIDEO_MINUTES", "45"))
MAX_CONCURRENT_JOBS = int(os.environ.get("MAX_CONCURRENT_JOBS", "2"))
MAX_SECTIONS = int(os.environ.get("MAX_SECTIONS", "24"))
FALLBACK_SECTIONS = int(os.environ.get("FALLBACK_SECTIONS", "8"))
FRAMES_PER_SECTION = int(os.environ.get("FRAMES_PER_SECTION", "5"))
BUCKET = "video-frames"

# Cookies (Netscape format) are passed as file *contents* via env so the secret
# stays out of the image; write once to a temp file for yt-dlp.
_COOKIE_FILE: str | None = None
if os.environ.get("YTDLP_COOKIES"):
    fd, _COOKIE_FILE = tempfile.mkstemp(prefix="ytcookies_", suffix=".txt")
    with os.fdopen(fd, "w") as f:
        f.write(os.environ["YTDLP_COOKIES"])

_supabase = create_client(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY)
_openai = None
if OPENAI_API_KEY:
    from openai import OpenAI

    _openai = OpenAI(api_key=OPENAI_API_KEY)

app = FastAPI()
_active = 0  # in-loop counter; only mutated in the event loop, no lock needed


class JobError(Exception):
    """Carries a user-safe message (never raw yt-dlp/ffmpeg output)."""

    def __init__(self, user_message: str):
        super().__init__(user_message)
        self.user_message = user_message


@app.get("/health")
def health():
    return {"ok": True}


@app.post("/process")
async def process(req: Request, x_internal_token: str = Header(default="")):
    if x_internal_token != INTERNAL_TOKEN:
        return JSONResponse({"error": "Unauthorized"}, status_code=401)

    global _active
    if _active >= MAX_CONCURRENT_JOBS:
        return JSONResponse({"error": "Worker busy, try again shortly."}, status_code=429)

    body = await req.json()
    routine_id, user_id, url = body.get("routineId"), body.get("userId"), body.get("youtubeUrl")
    if not (routine_id and user_id and url):
        return JSONResponse({"error": "routineId, userId, youtubeUrl required"}, status_code=400)

    _active += 1
    asyncio.create_task(_run_job(routine_id, user_id, url))
    return JSONResponse({"accepted": True}, status_code=202)


async def _run_job(routine_id: str, user_id: str, url: str) -> None:
    global _active
    try:
        result = await asyncio.to_thread(process_video, user_id, routine_id, url)
        await _post_complete(routine_id, result)
    except JobError as e:
        await _post_complete(routine_id, {"status": "error", "error": e.user_message})
    except Exception:
        log.exception("job %s failed", routine_id)
        await _post_complete(
            routine_id, {"status": "error", "error": "Something went wrong processing this video."}
        )
    finally:
        _active -= 1


async def _post_complete(routine_id: str, payload: dict) -> None:
    url = f"{API_BASE_URL}/internal/video-routines/{routine_id}/complete"
    try:
        async with httpx.AsyncClient(timeout=30) as client:
            await client.post(url, json=payload, headers={"x-internal-token": INTERNAL_TOKEN})
    except Exception:
        log.exception("callback for %s failed (row will time out)", routine_id)


# ── the actual work (blocking; runs in a thread) ───────────────────────────────
def process_video(user_id: str, routine_id: str, url: str) -> dict:
    info = _probe(url)
    duration = info.get("duration") or 0
    if duration and duration > MAX_VIDEO_MINUTES * 60:
        raise JobError(f"This video is longer than {MAX_VIDEO_MINUTES} minutes — try a shorter one.")

    sections = build_sections(info.get("chapters"), duration, MAX_SECTIONS, FALLBACK_SECTIONS)
    if not sections:
        raise JobError("Couldn't find anything to extract from this video.")

    with tempfile.TemporaryDirectory() as tmp:
        video_path = _download(url, Path(tmp))
        out: list[dict] = []
        for sec in sections:
            chosen = _best_frame_for_section(video_path, sec, Path(tmp))
            if chosen is None:
                continue  # section yielded no usable frame; skip it
            best_path, label = chosen
            object_path = f"{user_id}/{routine_id}/{sec['idx']}.jpg"
            _upload(object_path, best_path)
            out.append(
                {
                    "idx": sec["idx"],
                    "title": sec["title"],
                    "start_sec": sec["start_sec"],
                    "end_sec": sec["end_sec"],
                    "frame_path": object_path,
                    "move_label": label,
                }
            )

    if not out:
        raise JobError("Couldn't extract clear frames from this video.")

    return {
        "status": "ready",
        "title": info.get("title"),
        "video_id": info.get("id"),
        "sections": out,
    }


def _ydl_opts(tmp: Path | None = None) -> dict:
    opts: dict = {
        "quiet": True,
        "no_warnings": True,
        "noplaylist": True,
        # Impersonate YouTube's mobile/TV apps — these clients often bypass the
        # "sign in to confirm you're not a bot" check that hits datacenter IPs,
        # without needing cookies or a proxy. Cat-and-mouse: if YouTube starts
        # blocking these too, fall back to YTDLP_COOKIES / YTDLP_PROXY.
        # ponytail: free no-cookie bypass; proxy is the durable fix if it breaks.
        "extractor_args": {"youtube": {"player_client": ["ios", "android", "tv"]}},
    }
    if _COOKIE_FILE:
        opts["cookiefile"] = _COOKIE_FILE
    if YTDLP_PROXY:
        opts["proxy"] = YTDLP_PROXY
    if tmp is not None:
        opts["format"] = "bestvideo[height<=720]+bestaudio/best[height<=720]/best"
        opts["merge_output_format"] = "mp4"
        opts["outtmpl"] = str(tmp / "video.%(ext)s")
    return opts


def _probe(url: str) -> dict:
    try:
        with YoutubeDL(_ydl_opts()) as ydl:
            return ydl.extract_info(url, download=False)
    except DownloadError as e:
        raise JobError(_friendly_ytdlp_error(str(e)))


def _download(url: str, tmp: Path) -> Path:
    try:
        with YoutubeDL(_ydl_opts(tmp)) as ydl:
            ydl.download([url])
    except DownloadError as e:
        raise JobError(_friendly_ytdlp_error(str(e)))
    files = list(tmp.glob("video.*"))
    if not files:
        raise JobError("Couldn't download this video.")
    return files[0]


def _friendly_ytdlp_error(msg: str) -> str:
    m = msg.lower()
    if "private video" in m:
        return "This video is private."
    if "members-only" in m or "join this channel" in m:
        return "This is a members-only video."
    if "confirm your age" in m or "age" in m and "restrict" in m:
        return "This video is age-restricted and can't be processed."
    if "not available in your country" in m or "geo" in m:
        return "This video isn't available in this region."
    if "sign in to confirm" in m or "bot" in m:
        return "YouTube blocked this request — try again later."
    return "Couldn't fetch this video — it may be private, region-locked, or unavailable."


def _candidate_timestamps(sec: dict) -> list[float]:
    start, end = sec["start_sec"], sec["end_sec"]
    span = max(0, end - start)
    if span <= 1:
        return [start + span / 2]
    lo, hi = start + 0.2 * span, start + 0.8 * span
    k = max(1, FRAMES_PER_SECTION)
    if k == 1:
        return [(lo + hi) / 2]
    return [lo + (hi - lo) * i / (k - 1) for i in range(k)]


def _extract_frame(video: Path, t: float, dest: Path) -> bool:
    # -ss before -i = fast seek; one high-quality frame.
    r = subprocess.run(
        ["ffmpeg", "-nostdin", "-ss", str(t), "-i", str(video), "-frames:v", "1", "-q:v", "2", str(dest), "-y"],
        capture_output=True,
    )
    return r.returncode == 0 and dest.exists() and dest.stat().st_size > 0


def _sharpness(path: Path) -> float:
    img = cv2.imread(str(path))
    if img is None:
        return -1.0
    gray = cv2.cvtColor(img, cv2.COLOR_BGR2GRAY)
    return float(cv2.Laplacian(gray, cv2.CV_64F).var())


def _best_frame_for_section(video: Path, sec: dict, tmp: Path) -> tuple[Path, str | None] | None:
    """Extract candidates, shortlist the 3 sharpest, let the vision model pick the
    one that best shows the move. Returns (frame_path, move_label) or None."""
    candidates: list[tuple[Path, float]] = []
    for j, t in enumerate(_candidate_timestamps(sec)):
        dest = tmp / f"cand_{sec['idx']}_{j}.jpg"
        if _extract_frame(video, t, dest):
            candidates.append((dest, _sharpness(dest)))
    if not candidates:
        return None

    candidates.sort(key=lambda c: c[1], reverse=True)
    shortlist = [c[0] for c in candidates[:3]]

    best_idx, label = _vision_pick(shortlist, sec["title"])
    return shortlist[best_idx], label


def _vision_pick(frames: list[Path], section_title: str) -> tuple[int, str | None]:
    """Pick the frame that best shows the exercise. Falls back to the sharpest
    (index 0, already sorted) if the vision model is unavailable or errors."""
    if _openai is None or len(frames) == 1:
        return 0, None
    try:
        content: list[dict] = [
            {
                "type": "text",
                "text": (
                    f"These are candidate still frames from one section of a workout video "
                    f'titled "{section_title}". Pick the ONE frame that most clearly shows the '
                    f"exercise or pose being performed — full body visible, mid-movement, not a "
                    f"title card, transition, or talking head. Reply with JSON only: "
                    f'{{"best": <0-based index>, "label": "<2-4 word name of the move>"}}.'
                ),
            }
        ]
        for i, p in enumerate(frames):
            content.append({"type": "text", "text": f"Index {i}:"})
            content.append(
                {"type": "image_url", "image_url": {"url": _data_url(p), "detail": "low"}}
            )
        resp = _openai.chat.completions.create(
            model="gpt-4o-mini",
            messages=[{"role": "user", "content": content}],
            response_format={"type": "json_object"},
            max_tokens=60,
        )
        data = json.loads(resp.choices[0].message.content or "{}")
        best = int(data.get("best", 0))
        if not 0 <= best < len(frames):
            best = 0
        label = data.get("label") or None
        return best, label
    except Exception:
        log.exception("vision pick failed; using sharpest")
        return 0, None


def _data_url(path: Path) -> str:
    # Downscale to <=512px before sending — the model doesn't need full res to choose.
    img = cv2.imread(str(path))
    h, w = img.shape[:2]
    scale = 512 / max(h, w)
    if scale < 1:
        img = cv2.resize(img, (int(w * scale), int(h * scale)))
    ok, buf = cv2.imencode(".jpg", img, [cv2.IMWRITE_JPEG_QUALITY, 80])
    b64 = base64.b64encode(buf.tobytes()).decode()
    return f"data:image/jpeg;base64,{b64}"


def _upload(object_path: str, file_path: Path) -> None:
    data = file_path.read_bytes()
    _supabase.storage.from_(BUCKET).upload(
        path=object_path,
        file=data,
        file_options={"content-type": "image/jpeg", "upsert": "true"},
    )
