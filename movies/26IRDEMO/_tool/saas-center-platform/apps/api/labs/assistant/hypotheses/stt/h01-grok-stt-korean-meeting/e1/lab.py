"""h05 E1 [탐색] — grok-stt-1.0 한국어 회의 녹음: 배치(OpenRouter·xAI) vs 스트리밍(xAI wss).

실행: apps/api에서 `uv run python labs/assistant/hypotheses/h05-grok-stt-korean-meeting/e1/lab.py <mode>`
"""

import argparse
import asyncio
import difflib
import json
import os
import subprocess
import sys
import time
from pathlib import Path

import httpx

E1 = {
    "audio_src": Path.home() / "Downloads" / "상암동 8.m4a",
    "clip_seconds": 300,
    "model": "x-ai/grok-stt-1.0",
    "language": "ko",
    "price_batch_hr": 0.10,
    "price_stream_hr": 0.20,
    "openrouter_url": "https://openrouter.ai/api/v1/audio/transcriptions",
    "xai_rest_url": "https://api.x.ai/v1/stt",
    "xai_wss_url": "wss://api.x.ai/v1/stt",
    "sample_rate": 16000,  # pcm s16le mono — 스트리밍 기본값과 일치
    "repeats": 3,
}

HERE = Path(__file__).parent
AUDIO = HERE / "audio"
RESULTS = HERE / "results.jsonl"


def _env(key: str) -> str | None:
    if os.environ.get(key):
        return os.environ[key]
    env_file = HERE.parents[4] / ".env"  # apps/api/.env
    if env_file.exists():
        for line in env_file.read_text().splitlines():
            if line.startswith(f"{key}="):
                return line.split("=", 1)[1].strip().strip('"')
    return None


def _duration(path: Path) -> float:
    out = subprocess.run(
        ["ffprobe", "-v", "error", "-show_entries", "format=duration",
         "-of", "default=noprint_wrappers=1:nokey=1", str(path)],
        capture_output=True, text=True, check=True)
    return float(out.stdout.strip())


def _record(row: dict) -> None:
    row["ts"] = time.strftime("%Y-%m-%dT%H:%M:%S")
    with RESULTS.open("a") as f:
        f.write(json.dumps(row, ensure_ascii=False) + "\n")
    text = row.get("text", "")
    print(f"[{row['mode']}] wall={row.get('wall_s')}s cost=${row.get('cost_usd')} "
          f"text={len(text)}자\n--- 앞 200자 ---\n{text[:200]}")


def prep() -> None:
    AUDIO.mkdir(exist_ok=True)
    (AUDIO / ".gitignore").write_text("*.mp3\n*.wav\n*.pcm\n")
    src = E1["audio_src"]
    jobs = [
        (["-ac", "1", "-ar", "16000", "-b:a", "32k"], AUDIO / "full_16k.mp3"),
        (["-t", str(E1["clip_seconds"]), "-ac", "1", "-ar", "16000", "-b:a", "32k"], AUDIO / "clip_16k.mp3"),
        (["-ac", "1", "-ar", str(E1["sample_rate"]), "-f", "s16le"], AUDIO / "full_16k.pcm"),
        (["-t", str(E1["clip_seconds"]), "-ac", "1", "-ar", str(E1["sample_rate"]), "-f", "s16le"],
         AUDIO / "clip_16k.pcm"),
    ]
    for args, dst in jobs:
        subprocess.run(["ffmpeg", "-y", "-v", "error", "-i", str(src), *args, str(dst)], check=True)
        print(f"{dst.name}: {dst.stat().st_size / 1e6:.1f} MB")


def estimate() -> None:
    full_hr = _duration(AUDIO / "full_16k.mp3") / 3600
    clip_hr = E1["clip_seconds"] / 3600
    k = E1["repeats"]
    smoke = clip_hr * E1["price_batch_hr"]
    batch_full = full_hr * E1["price_batch_hr"]
    stream_full = full_hr * E1["price_stream_hr"]
    total = smoke + k * (2 * batch_full + stream_full)
    print(f"full={full_hr * 60:.1f}min clip={clip_hr * 60:.1f}min K={k}")
    print(f"스모크 batch-or(clip) 1회      : ${smoke:.4f}")
    print(f"batch-or full ×{k}            : ${batch_full * k:.4f}")
    print(f"batch-xai full ×{k}           : ${batch_full * k:.4f}")
    print(f"stream-xai full ×{k}          : ${stream_full * k:.4f}")
    print(f"총계                          : ${total:.4f}")


def batch_openrouter(clip: bool) -> None:
    key = _env("OPENROUTER_API_KEY")
    assert key, "OPENROUTER_API_KEY 없음"
    path = AUDIO / ("clip_16k.mp3" if clip else "full_16k.mp3")
    t0 = time.monotonic()
    try:
        # ponytail: 타임아웃 180s — 업스트림 60s 컷 관측이 목적이라 클라이언트가 먼저 끊으면 안 됨
        r = httpx.post(
            E1["openrouter_url"],
            headers={"Authorization": f"Bearer {key}"},
            files={"file": (path.name, path.read_bytes(), "audio/mpeg")},
            data={"model": E1["model"], "language": E1["language"]},
            timeout=180)
        wall = round(time.monotonic() - t0, 2)
        body = r.json() if r.status_code == 200 else {"error": r.text[:500]}
        _record({
            "mode": "batch-or", "clip": clip, "status": r.status_code, "wall_s": wall,
            "text": body.get("text", ""), "usage": body.get("usage"),
            "cost_usd": (body.get("usage") or {}).get("cost"), "error": body.get("error"),
        })
    except httpx.TimeoutException:
        _record({"mode": "batch-or", "clip": clip, "status": "client-timeout",
                 "wall_s": round(time.monotonic() - t0, 2), "text": ""})


def batch_xai(clip: bool) -> None:
    key = _env("XAI_API_KEY") or _env("GROK_API_KEY")
    assert key, "XAI_API_KEY/GROK_API_KEY 없음 — console.x.ai 발급 후 apps/api/.env에 추가"
    path = AUDIO / ("clip_16k.mp3" if clip else "full_16k.mp3")
    t0 = time.monotonic()
    # 계약: file 필드는 반드시 마지막 (계약.md 경로 2)
    r = httpx.post(
        E1["xai_rest_url"],
        headers={"Authorization": f"Bearer {key}"},
        data={"language": E1["language"], "format": "true", "diarize": "true"},
        files={"file": (path.name, path.read_bytes(), "audio/mpeg")},
        timeout=300)
    wall = round(time.monotonic() - t0, 2)
    body = r.json() if r.status_code == 200 else {"error": r.text[:500]}
    dur = body.get("duration") or 0
    _record({
        "mode": "batch-xai", "clip": clip, "status": r.status_code, "wall_s": wall,
        "text": body.get("text", ""), "duration_s": dur,
        "n_words": len(body.get("words") or []),
        "n_speakers": len({w.get("speaker") for w in body.get("words") or [] if "speaker" in w}),
        "cost_usd": round(dur / 3600 * E1["price_batch_hr"], 5), "error": body.get("error"),
    })


async def _stream_xai(
    clip: bool,
    pace: str,
) -> None:
    import websockets

    key = _env("XAI_API_KEY") or _env("GROK_API_KEY")
    assert key, "XAI_API_KEY/GROK_API_KEY 없음 — console.x.ai 발급 후 apps/api/.env에 추가"
    pcm = (AUDIO / ("clip_16k.pcm" if clip else "full_16k.pcm")).read_bytes()
    sr = E1["sample_rate"]
    chunk = sr * 2 // 10  # 100ms @ s16le mono
    uri = f"{E1['xai_wss_url']}?sample_rate={sr}&encoding=pcm&language={E1['language']}&interim_results=true"
    headers = {"Authorization": f"Bearer {key}"}
    t0 = time.monotonic()
    first_partial = None
    finals: list[str] = []
    try:
        conn = websockets.connect(uri, additional_headers=headers)
    except TypeError:  # websockets<13은 extra_headers
        conn = websockets.connect(uri, extra_headers=headers)
    async with conn as ws:
        async def sender():
            for i in range(0, len(pcm), chunk):
                await ws.send(pcm[i:i + chunk])
                if pace == "realtime":
                    await asyncio.sleep(0.1)
            await ws.send(json.dumps({"type": "audio.done"}))

        send_task = asyncio.create_task(sender())
        async for msg in ws:
            ev = json.loads(msg)
            if ev.get("type") == "transcript.partial" and first_partial is None:
                first_partial = round(time.monotonic() - t0, 2)
            if ev.get("type") == "transcript.done":
                finals.append(ev.get("text", ""))
                break
            if ev.get("type") == "error":
                finals.append(f"[error] {ev.get('message')}")
                break
        await send_task
    dur = len(pcm) / (sr * 2)
    _record({
        "mode": "stream-xai", "clip": clip, "pace": pace,
        "wall_s": round(time.monotonic() - t0, 2), "first_partial_s": first_partial,
        "text": " ".join(finals), "duration_s": round(dur, 1),
        "cost_usd": round(dur / 3600 * E1["price_stream_hr"], 5),
    })


BENCH60_OFFSETS = [0, 300, 600, 1200, 1800, 2280]
BENCH60_REFS = ["openai/whisper-1", "openai/gpt-4o-transcribe"]


def _transcribe(
    path: Path,
    model: str,
) -> dict:
    t0 = time.monotonic()
    r = httpx.post(
        E1["openrouter_url"],
        headers={"Authorization": f"Bearer {_env('OPENROUTER_API_KEY')}"},
        files={"file": (path.name, path.read_bytes(), "audio/mpeg")},
        data={"model": model, "language": E1["language"]},
        timeout=180)
    if r.status_code != 200 and model.startswith("openai/"):
        # ponytail: 레퍼런스 모델이 OpenRouter에 미등재면 OpenAI 직결 폴백
        t0 = time.monotonic()
        r = httpx.post(
            "https://api.openai.com/v1/audio/transcriptions",
            headers={"Authorization": f"Bearer {_env('OPENAI_API_KEY')}"},
            files={"file": (path.name, path.read_bytes(), "audio/mpeg")},
            data={"model": model.removeprefix("openai/"), "language": E1["language"]},
            timeout=180)
    body = r.json() if r.status_code == 200 else {"error": r.text[:300]}
    return {"status": r.status_code, "wall_s": round(time.monotonic() - t0, 2),
            "text": body.get("text", ""), "usage": body.get("usage"), "error": body.get("error")}


def bench60() -> None:
    models = [E1["model"], *BENCH60_REFS]
    texts: dict[int, dict[str, str]] = {}
    for off in BENCH60_OFFSETS:
        clip = AUDIO / f"bench60_{off}.mp3"
        if not clip.exists():
            subprocess.run(
                ["ffmpeg", "-y", "-v", "error", "-ss", str(off), "-t", "60",
                 "-i", str(E1["audio_src"]), "-ac", "1", "-ar", "16000", "-b:a", "32k", str(clip)],
                check=True)
        texts[off] = {}
        for model in models:
            res = _transcribe(clip, model)
            texts[off][model] = res["text"]
            _record({"mode": "bench60", "model": model, "offset_s": off, **res})
    g, w, f = models
    print(f"\n{'offset':<8}{'grok자':<7}{'whis자':<7}{'4o자':<7}{'grok↔whis':<11}{'grok↔4o':<10}{'whis↔4o'}")
    pairs = {"gw": [], "gf": [], "wf": []}
    for off in BENCH60_OFFSETS:
        t = texts[off]
        if not all(t.values()):
            print(f"{off:<8}(실패 세그먼트 — 분모 제외: { {m: len(x) for m, x in t.items()} })")
            continue
        gw, gf, wf = _cer(t[g], t[w]), _cer(t[g], t[f]), _cer(t[w], t[f])
        pairs["gw"].append(gw); pairs["gf"].append(gf); pairs["wf"].append(wf)
        print(f"{off:<8}{len(t[g]):<7}{len(t[w]):<7}{len(t[f]):<7}{gw:<11}{gf:<10}{wf}")
    if pairs["gw"]:
        mean = lambda xs: round(sum(xs) / len(xs), 4)
        print(f"\n평균     grok↔whis {mean(pairs['gw'])} · grok↔4o {mean(pairs['gf'])} · whis↔4o {mean(pairs['wf'])}")


def _cer(
    a: str,
    b: str,
) -> float:
    a, b = "".join(a.split()), "".join(b.split())
    return round(1 - difflib.SequenceMatcher(None, a, b).ratio(), 4)


def report() -> None:
    rows = [json.loads(line) for line in RESULTS.read_text().splitlines() if line.strip()]
    by_mode: dict[str, list[dict]] = {}
    for r in rows:
        key = r["mode"] + ("-clip" if r.get("clip") else "")
        by_mode.setdefault(key, []).append(r)
    print(f"{'mode':<12}{'n':<3}{'wall_s':<10}{'cost_usd':<10}{'반복간 CER'}")
    for mode, rs in by_mode.items():
        walls = [r["wall_s"] for r in rs if isinstance(r.get("wall_s"), (int, float))]
        costs = [r["cost_usd"] for r in rs if r.get("cost_usd")]
        texts = [r["text"] for r in rs if r.get("text")]
        stability = [_cer(texts[i], texts[i + 1]) for i in range(len(texts) - 1)]
        print(f"{mode:<12}{len(rs):<3}{str(walls):<10}{str(costs):<10}{stability}")
    texts_of = {m: rs[-1].get("text", "") for m, rs in by_mode.items()}
    modes = [m for m, t in texts_of.items() if t]
    for i, a in enumerate(modes):
        for b in modes[i + 1:]:
            print(f"상호 CER {a} vs {b}: {_cer(texts_of[a], texts_of[b])}")


def main() -> None:
    p = argparse.ArgumentParser()
    p.add_argument("cmd", choices=["prep", "estimate", "batch-or", "batch-xai", "stream-xai", "bench60", "report"])
    p.add_argument("--clip", action="store_true", help="2분 스모크 클립 사용")
    p.add_argument("--pace", choices=["fast", "realtime"], default="fast",
                   help="스트리밍 송출 속도 — realtime이어야 지연 수치가 유효")
    a = p.parse_args()
    if a.cmd == "prep":
        prep()
    elif a.cmd == "estimate":
        estimate()
    elif a.cmd == "batch-or":
        batch_openrouter(a.clip)
    elif a.cmd == "batch-xai":
        batch_xai(a.clip)
    elif a.cmd == "stream-xai":
        asyncio.run(_stream_xai(a.clip, a.pace))
    elif a.cmd == "bench60":
        bench60()
    elif a.cmd == "report":
        report()


if __name__ == "__main__":
    sys.exit(main())
