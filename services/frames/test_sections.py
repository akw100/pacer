"""Self-check for the only non-trivial pure logic in the worker: turning yt-dlp
chapters into sections, and the no-chapter fallback. Run: `python test_sections.py`."""

from sections import build_sections


def test_chapters_mapped():
    chapters = [
        {"start_time": 0, "end_time": 120, "title": "Warm up"},
        {"start_time": 120, "end_time": 300, "title": "Squats"},
    ]
    secs = build_sections(chapters, 300, max_sections=24, fallback_n=8)
    assert [s["title"] for s in secs] == ["Warm up", "Squats"]
    assert secs[0]["start_sec"] == 0 and secs[0]["end_sec"] == 120
    assert secs[1]["start_sec"] == 120 and secs[1]["end_sec"] == 300
    assert [s["idx"] for s in secs] == [0, 1]


def test_missing_end_time_uses_next_start_then_duration():
    chapters = [
        {"start_time": 0, "title": "A"},
        {"start_time": 60, "title": "B"},  # last one, no end_time
    ]
    secs = build_sections(chapters, 200, max_sections=24, fallback_n=8)
    assert secs[0]["end_sec"] == 60  # next start
    assert secs[1]["end_sec"] == 200  # EOF


def test_max_sections_caps_chapters():
    chapters = [{"start_time": i * 10, "end_time": i * 10 + 10, "title": str(i)} for i in range(30)]
    secs = build_sections(chapters, 300, max_sections=5, fallback_n=8)
    assert len(secs) == 5


def test_no_chapters_falls_back_to_even_slices():
    secs = build_sections(None, 480, max_sections=24, fallback_n=8)
    assert len(secs) == 8
    assert secs[0]["start_sec"] == 0
    assert secs[-1]["end_sec"] == 480  # last slice runs to EOF
    # contiguous, non-overlapping
    for a, b in zip(secs, secs[1:]):
        assert a["end_sec"] == b["start_sec"]
    assert "·" in secs[0]["title"]  # fallback labels carry a timestamp


def test_empty_chapters_treated_as_none():
    secs = build_sections([], 120, max_sections=24, fallback_n=4)
    assert len(secs) == 4


def test_degenerate_zero_duration_does_not_crash():
    secs = build_sections(None, 0, max_sections=24, fallback_n=3)
    assert len(secs) >= 1


if __name__ == "__main__":
    for name, fn in sorted(globals().items()):
        if name.startswith("test_") and callable(fn):
            fn()
            print(f"ok  {name}")
    print("all passed")
