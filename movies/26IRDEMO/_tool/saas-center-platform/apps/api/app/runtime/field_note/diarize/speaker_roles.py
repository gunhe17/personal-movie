"""화자 역할 추론 — 상담사/내담자 자동 라벨(speaker_map). 비치명적 보조 기능."""
import json

from app.modules.llm.facade.ai_facade import AIFacade
from app.modules.llm.gateway.schemas import AICallContext

SPEAKER_ROLE_SYSTEM_PROMPT = (
    "당신은 한국어 심리상담 녹취 분석가입니다. 화자분리된 대화에서 각 화자가 "
    "상담사(counselor)인지 내담자(client)인지 판별하세요.\n"
    "단서: 상담사는 열린 질문·반영·요약·회기 진행을 주로 하고, "
    "내담자는 자신의 경험·감정·고민·일상을 이야기합니다.\n"
    '반드시 JSON 객체만 출력하세요(설명·코드펜스 금지). '
    '형식 예: {"A": "counselor", "B": "client"}'
)


async def infer_speaker_roles(
    ai: AIFacade,
    ctx: AICallContext,
    diarize_result: dict,
) -> dict | None:
    segments = (diarize_result or {}).get("segments", []) or []
    speakers: list[str] = []
    for s in segments:
        sp = s.get("speaker")
        if sp and sp not in speakers:
            speakers.append(sp)
    if len(speakers) < 2:
        return None  # 단일 화자 → 역할 구분 의미 없음

    # 역할 판별용 샘플 라인 (앞부분 위주, 과도한 토큰 방지)
    lines = [
        f"{s.get('speaker', '?')}: {(s.get('text') or '').strip()}"
        for s in segments[:80]
        if (s.get('text') or '').strip()
    ]
    if not lines:
        return None

    result = await ai.generate_text(
        ctx, SPEAKER_ROLE_SYSTEM_PROMPT, "\n".join(lines), max_tokens=150,
    )
    raw = (result.content or "").strip()
    # 코드펜스/잡음 제거 후 JSON 추출
    start, end = raw.find("{"), raw.rfind("}")
    if start < 0 or end <= start:
        return None
    try:
        role_map = json.loads(raw[start:end + 1])
    except (json.JSONDecodeError, TypeError):
        return None
    if not isinstance(role_map, dict):
        return None

    def _is_counselor(v) -> bool:
        t = str(v).lower()
        return t.startswith("counsel") or "상담" in t

    client_count = sum(1 for sp in speakers if not _is_counselor(role_map.get(sp, "client")))
    speaker_map: dict[str, str] = {}
    client_idx = 0
    for sp in speakers:
        if _is_counselor(role_map.get(sp, "client")):
            speaker_map[sp] = "상담사"
        else:
            client_idx += 1
            speaker_map[sp] = f"내담자 {client_idx}" if client_count > 1 else "내담자"
    return speaker_map
