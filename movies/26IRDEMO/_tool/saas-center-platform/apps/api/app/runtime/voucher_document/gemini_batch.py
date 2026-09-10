"""Gemini Batch API 실행 경로 — 스테이지의 gemini 유닛 묶음을 배치 잡 제출·폴링으로 실행.

realtime(OpenRouter flex −50%)과 병행 제공(사용자 결정 2026-08-31 — 이전 "Google 네이티브
batch 폐기" 결정을 뒤집음). 배치 단가 = 표준의 50%, 완료 시한 best-effort(보통 수 분, 최대 24h).
OpenRouter 에는 배치 API 가 없어 이 경로만 Google 직결 — `GEMINI_API_KEY` 필요, 키가 없으면
유닛 전부 명시적 실패(침묵 폴백 없음 — 모드는 사용자가 고른 것).

유닛 변환: OpenAI 형 messages(system + user 멀티모달 data URI) → Gemini contents/parts.
"""
from __future__ import annotations

import asyncio
import json
import os
import re
import time

import httpx

from app.core.logger import get_logger
from app.runtime.voucher_document.batch_unit import BatchUnit, UnitResult

logger = get_logger(__name__)

GEMINI_BASE = "https://generativelanguage.googleapis.com/v1beta"
# ponytail: inline 제출 20MB 제한의 여유분 — 청크 분할로 대응. 문서당 이미지 규모가 이를 넘는
# 초대형 잡이 필요해지면 File API(JSONL 업로드) 경로로 확장.
CHUNK_LIMIT_BYTES = 15 * 1024 * 1024
_DATA_URI = re.compile(r"data:([^;]+);base64,(.*)", re.S)


def to_gemini_request(unit: BatchUnit) -> dict:
    """BatchUnit(OpenAI 형 messages) → Gemini GenerateContentRequest."""
    system_parts: list[dict] = []
    contents: list[dict] = []
    for m in unit.messages:
        if m["role"] == "system":
            system_parts.append({"text": m["content"]})
            continue
        raw = m["content"]
        parts: list[dict] = []
        for item in ([{"type": "text", "text": raw}] if isinstance(raw, str) else raw):
            if item.get("type") == "image_url":
                mt = _DATA_URI.match(item["image_url"]["url"])
                if not mt:
                    raise ValueError("batch 경로는 data URI 이미지만 지원")
                parts.append({"inline_data": {"mime_type": mt.group(1), "data": mt.group(2)}})
            else:
                parts.append({"text": item.get("text", "")})
        contents.append({"role": "model" if m["role"] == "assistant" else "user", "parts": parts})
    gen: dict = {"temperature": unit.temperature, "maxOutputTokens": unit.max_tokens}
    if unit.reasoning and unit.reasoning.get("effort"):
        gen["thinkingConfig"] = {"thinkingLevel": unit.reasoning["effort"]}
    # realtime 미러(chat_json._build_payload)와 동일 규칙 — {"type":"text"} 만 JSON 강제 해제.
    rf = unit.response_format
    if rf.get("type") != "text":
        gen["responseMimeType"] = "application/json"
        schema = (rf.get("json_schema") or {}).get("schema")
        if schema:
            gen["responseJsonSchema"] = schema
    req: dict = {"contents": contents, "generationConfig": gen}
    if system_parts:
        req["systemInstruction"] = {"parts": system_parts}
    return req


def _gemini_model(model: str) -> str:
    return "models/" + model.removeprefix("google/")


def _chunks(units: list[BatchUnit]) -> list[list[BatchUnit]]:
    """inline 제출 크기 제한 아래로 유닛 묶음 분할 (제출 순서 보존)."""
    out: list[list[BatchUnit]] = [[]]
    size = 0
    for u in units:
        n = len(json.dumps(to_gemini_request(u)))
        if out[-1] and size + n > CHUNK_LIMIT_BYTES:
            out.append([])
            size = 0
        out[-1].append(u)
        size += n
    return [c for c in out if c]


def _parse_batch_response(op: dict, units: list[BatchUnit]) -> dict[str, UnitResult]:
    """완료된 operation → {key: UnitResult}. metadata.key 우선, 없으면 제출 순서."""
    body = op.get("response") or {}
    inlined = body.get("inlinedResponses") or {}
    rows = inlined.get("inlinedResponses") if isinstance(inlined, dict) else inlined
    rows = rows or []
    out: dict[str, UnitResult] = {}
    for i, u in enumerate(units):
        row = next((r for r in rows if (r.get("metadata") or {}).get("key") == u.key),
                   rows[i] if i < len(rows) else None)
        if not row:
            out[u.key] = UnitResult(ok=False, error="batch 응답 누락")
            continue
        if row.get("error"):
            out[u.key] = UnitResult(ok=False, error=str(row["error"].get("message") or row["error"]))
            continue
        resp = row.get("response") or {}
        parts = ((resp.get("candidates") or [{}])[0].get("content") or {}).get("parts") or []
        text = "".join(p.get("text", "") for p in parts)
        usage = resp.get("usageMetadata") or {}
        out[u.key] = UnitResult(
            ok=bool(text), content=text or None, error=None if text else "빈 응답",
            input_tokens=int(usage.get("promptTokenCount") or 0),
            output_tokens=int(usage.get("candidatesTokenCount") or 0),
            cost_usd=0.0,   # Google 직결 과금 — OpenRouter 크레딧 밖(계기판 미집계)
        )
    return out


async def run_units_batch(
    units: list[BatchUnit],
    *,
    api_key: str | None = None,
    poll_interval: float = 15.0,
    timeout: float = 3600.0,
    client: httpx.AsyncClient | None = None,
) -> dict[str, UnitResult]:
    """gemini 유닛들 → 배치 잡(청크당 1잡) 제출 → 완료 폴링 → {key: UnitResult}.

    ponytail: 스테이지 안 동기 폴링(기본 1h 한도) — 잡 이름을 progress 에 실어 cron 으로
    이어받는 완전 비동기 재개는 배치 지연이 실측으로 문제 될 때 확장."""
    key = api_key or os.environ.get("GEMINI_API_KEY", "")
    if not key:
        return {u.key: UnitResult(ok=False, error="GEMINI_API_KEY 없음 — batch 모드는 Google 직결 키 필요")
                for u in units}
    own_client = client is None
    client = client or httpx.AsyncClient(timeout=120.0)
    try:
        jobs: list[tuple[str, list[BatchUnit]]] = []
        for chunk in _chunks(units):
            body = {"batch": {
                "display_name": "voucher-stage",
                "input_config": {"requests": {"requests": [
                    {"request": to_gemini_request(u), "metadata": {"key": u.key}} for u in chunk
                ]}},
            }}
            r = await client.post(
                f"{GEMINI_BASE}/{_gemini_model(chunk[0].model)}:batchGenerateContent",
                params={"key": key}, json=body,
            )
            if r.status_code != 200:
                logger.error("gemini batch 제출 실패 %s: %s", r.status_code, r.text[:300])
                for u in chunk:
                    jobs.append(("", [u]))
                continue
            jobs.append((r.json()["name"], chunk))

        out: dict[str, UnitResult] = {}
        deadline = time.monotonic() + timeout
        for name, chunk in jobs:
            if not name:
                out.update({u.key: UnitResult(ok=False, error="batch 제출 실패") for u in chunk})
                continue
            while True:
                r = await client.get(f"{GEMINI_BASE}/{name}", params={"key": key})
                op = r.json() if r.status_code == 200 else {}
                if op.get("done"):
                    if op.get("error"):
                        out.update({u.key: UnitResult(ok=False, error=str(op["error"])) for u in chunk})
                    else:
                        out.update(_parse_batch_response(op, chunk))
                    break
                if time.monotonic() > deadline:
                    out.update({u.key: UnitResult(ok=False, error=f"batch 시한 초과({int(timeout)}s): {name}")
                                for u in chunk})
                    break
                await asyncio.sleep(poll_interval)
        return out
    finally:
        if own_client:
            await client.aclose()
