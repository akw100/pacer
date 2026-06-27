"""Pure section-building logic: YouTube chapters → routine sections, with an
even-interval fallback when a video has no chapters. Kept separate from main.py
so it can be unit-tested without yt-dlp/ffmpeg/network (see test_sections.py)."""

from __future__ import annotations


def _mmss(seconds: int) -> str:
    m, s = divmod(int(seconds), 60)
    return f"{m}:{s:02d}"


def build_sections(
    chapters: list[dict] | None,
    duration_sec: float,
    max_sections: int,
    fallback_n: int,
) -> list[dict]:
    """Return [{idx, title, start_sec, end_sec}] (no frames yet).

    chapters: yt-dlp's parsed chapters (each {start_time, end_time?, title?}).
    Falls back to `fallback_n` equal slices when there are no usable chapters.
    """
    duration = int(max(0, duration_sec))
    sections: list[dict] = []

    if chapters:
        usable = [c for c in chapters if c.get("start_time") is not None]
        for i, c in enumerate(usable[:max_sections]):
            start = int(c["start_time"])
            end = c.get("end_time")
            if end is None:
                # Last chapter, or one missing its end: run to the next start or EOF.
                end = usable[i + 1]["start_time"] if i + 1 < len(usable) else duration
            end = int(end)
            if end <= start:
                end = min(start + 1, duration) or start + 1
            sections.append(
                {"idx": i, "title": (c.get("title") or f"Section {i + 1}").strip(), "start_sec": start, "end_sec": end}
            )

    if not sections:
        # No chapters → even slices.
        n = max(1, min(fallback_n, max_sections))
        if duration <= 0:
            duration = n  # degenerate; avoid div-by-zero, 1s slices
        step = max(1, duration // n)
        for i in range(n):
            start = i * step
            end = duration if i == n - 1 else min(duration, (i + 1) * step)
            if start >= duration:
                break
            sections.append(
                {"idx": i, "title": f"Section {i + 1} · {_mmss(start)}", "start_sec": start, "end_sec": end}
            )

    return sections
