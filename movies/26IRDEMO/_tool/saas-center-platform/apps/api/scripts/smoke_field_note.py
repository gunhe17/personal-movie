# field_note 파이프라인 라이브 스모크 — 실 dev 서버 + 실 STT/LLM 관통 (자동 테스트가 가짜 recorder로 대체하는 구간)
#
#   uv run python scripts/smoke_field_note.py                      # macOS say로 한국어 음성 합성
#   uv run python scripts/smoke_field_note.py --audio 상담.wav      # 실녹음 파일 사용
#   uv run python scripts/smoke_field_note.py --refine             # LLM 보정 단계 포함
#
# 실 STT/LLM 호출 비용이 발생한다. 성공 판정 = processing 전이 관찰 + summary 산출 + failed_step 없음.
import argparse
import asyncio
import subprocess
import sys
import tempfile
import time
from pathlib import Path

import httpx

BASE = "http://localhost:3502/api/v1"
EMAIL, PASSWORD = "counselor1@mindscope.com", "test1234"
SPEECH = (
    "오늘 상담에서는 아이가 학교에서 겪는 또래 관계 어려움을 이야기했습니다. "
    "지난주보다 표정이 밝아졌고, 숙제로 내준 감정 일기를 세 번 작성해 왔습니다. "
    "다음 회기에는 어머니 면담을 함께 진행하기로 했습니다."
)
POLL_INTERVAL, POLL_TIMEOUT = 3, 300


def synthesize_wav() -> Path:
    # macOS 전용: say(AIFF) → afconvert(wav 16k mono)
    tmp = Path(tempfile.mkdtemp())
    aiff, wav = tmp / "smoke.aiff", tmp / "smoke.wav"
    subprocess.run(["say", "-v", "Yuna", "-o", str(aiff), SPEECH], check=True)
    subprocess.run(
        ["afconvert", "-f", "WAVE", "-d", "LEI16@16000", "-c", "1", str(aiff), str(wav)],
        check=True,
    )
    return wav


def audio_duration_seconds(path: Path) -> float:
    out = subprocess.run(["afinfo", str(path)], capture_output=True, text=True).stdout
    for line in out.splitlines():
        if "estimated duration" in line:
            return float(line.split(":")[1].strip().split()[0])
    return 30.0


async def main() -> int:
    parser = argparse.ArgumentParser()
    parser.add_argument("--audio", type=Path, default=None)
    parser.add_argument("--refine", action="store_true", help="LLM 보정 단계 포함 (기본 skip)")
    args = parser.parse_args()

    wav = args.audio or synthesize_wav()
    duration = audio_duration_seconds(wav)
    print(f"[1/6] 오디오 준비: {wav} ({duration:.1f}s)")

    # keep-alive 재사용 금지 — 업로드 직후 서버가 커넥션을 닫아 재사용 시 ReadError(실증)
    async with httpx.AsyncClient(
        base_url=BASE, timeout=60, limits=httpx.Limits(max_keepalive_connections=0)
    ) as api:
        r = await api.post("/auth/login", json={"email": EMAIL, "password": PASSWORD})
        r.raise_for_status()
        api.headers["Authorization"] = f"Bearer {r.json()['access_token']}"
        r = await api.get("/auth/me")
        r.raise_for_status()
        center_id = r.json()["centers"][0]["id"]
        print(f"[2/6] 로그인 완료 (center={center_id})")

        r = await api.post(f"/centers/{center_id}/field-notes", json={})
        r.raise_for_status()
        note_id = r.json()["id"]
        print(f"[3/6] 필드노트 생성: {note_id}")

        r = await api.post(
            f"/centers/{center_id}/field-notes/{note_id}/audio",
            files={"file": ("smoke.wav", wav.read_bytes(), "audio/wav")},
            data={"duration": str(duration)},
        )
        r.raise_for_status()
        r = await api.post(
            f"/centers/{center_id}/field-notes/{note_id}/finish",
            json={
                "total_duration": duration,
                "auto_pipeline": True,
                "skip_refine": not args.refine,
            },
        )
        r.raise_for_status()
        print(f"[4/6] 업로드+finish(auto_pipeline) — 파이프라인 enqueue됨")

        async def poll_until(done_fn, label: str) -> dict | None:
            seen, deadline = [], time.monotonic() + POLL_TIMEOUT
            while time.monotonic() < deadline:
                d = (await api.get(f"/centers/{center_id}/field-notes/{note_id}")).json()
                state = (d["processing_status"], d.get("processing_step"))
                if not seen or seen[-1] != state:
                    seen.append(state)
                    print(f"      전이: processing_status={state[0]} step={state[1]}")
                if d.get("failed_step"):
                    print(f"❌ {label} 실패: failed_step={d['failed_step']}")
                    return None
                if done_fn(d):
                    return d
                await asyncio.sleep(POLL_INTERVAL)
            print(f"⏱ {label} {POLL_TIMEOUT}s 내 미완료 — 마지막: {seen[-1] if seen else '없음'}")
            return None

        # 자동 파이프라인의 의도된 종결 = 전사(+옵션 보정)까지 (summary는 온디맨드 전용)
        d = await poll_until(
            lambda d: d["processing_status"] == "completed"
            and d["transcribe_status"] == "completed",
            "자동 파이프라인",
        )
        if d is None:
            return 1
        print(f"[5/6] ✅ 자동 파이프라인(전사) 완료: transcribe={d['transcribe_status']} refine={d['refine_status']}")

        r = await api.post(f"/centers/{center_id}/field-notes/{note_id}/generate-summary")
        r.raise_for_status()
        d = await poll_until(
            lambda d: d.get("summary_status") == "completed" and d.get("summary"),
            "온디맨드 요약",
        )
        if d is None:
            return 1
        print(f"[6/6] ✅ 관통 성공 — 요약 산출")
        print(f"      --- 요약 ---\n{d['summary']}")
        return 0


if __name__ == "__main__":
    sys.exit(asyncio.run(main()))
