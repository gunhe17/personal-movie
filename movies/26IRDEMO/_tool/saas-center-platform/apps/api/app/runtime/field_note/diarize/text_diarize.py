"""텍스트 기반 화자분리 — 음향을 다시 보지 않고 speaker 만 추론(라이브 전사 재사용).

※ 화자분리 '전' 침묵 간격 병합은 하지 않는다 — 전화상담은 화자 전환 간격이 매우
  짧아(0.2~0.5초) 같은 화자 이어말하기(0.0~0.2초)와 구분이 안 돼, 시간 간격으로 합치면
  다중 화자가 한 덩어리로 뭉쳐 오히려 망가진다(실측: 첫 덩어리가 143초 다중화자).
  파편을 줄이려면 라벨링 '후' 같은 화자 연속 구간을 합쳐야 한다(별도, 표시용).
"""
import json

from app.core.config import settings
from app.core.logger import get_logger
from app.modules.llm.facade.ai_facade import AIFacade

from .prompt import TEXT_DIARIZE_SYSTEM_PROMPT

logger = get_logger(__name__)

# 화자분리 청킹 — 긴 녹음(50분=수백 발화)을 한 번에 LLM에 보내면 출력 토큰 한도(4096)를
# 넘어 뒷부분이 잘린다. 발화를 청크로 나눠 라벨링하되, 직전 청크의 라벨된 발화 몇 개를
# 앵커로 넘겨 청크 간 화자 일관성을 유지한다(같은 사람 = 같은 라벨).
_CHUNK_SIZE = 80
_ANCHOR = 6


async def label_speakers(
    ai: AIFacade,
    segments: list[dict],
) -> list[dict]:
    segs = segments or []
    if not segs:
        return []

    model = settings.SUMMARY_MODEL

    labeled: list[dict] = []
    for ci in range(0, len(segs), _CHUNK_SIZE):
        chunk = segs[ci:ci + _CHUNK_SIZE]
        anchors = labeled[-_ANCHOR:]  # 직전 청크의 확정 라벨 (연속성)
        speaker_by_idx = await _label_chunk(ai, model, anchors, chunk)
        for j, s in enumerate(chunk):
            labeled.append({
                "speaker": speaker_by_idx.get(j, "A"),
                "text": s.get("text", ""),
                "start": s.get("start", 0.0),
                "end": s.get("end", 0.0),
            })
    return labeled


async def _label_chunk(
    ai: AIFacade,
    model: str,
    anchors: list[dict],
    chunk: list[dict],
) -> dict[int, str]:
    """반환 키는 청크 내 0-based 인덱스(프롬프트는 1-based 로 제시)."""
    parts: list[str] = []
    if anchors:
        parts.append("[직전 발화 — 이미 확정된 화자. 같은 사람은 같은 라벨을 그대로 유지하세요]")
        parts.extend(
            f"{a.get('speaker', 'A')}: {(a.get('text') or '').strip()}" for a in anchors
        )
        parts.append("")
    parts.append("[분류할 발화 — 아래 번호에 대해서만 JSON으로 화자 라벨 출력]")
    parts.extend(
        f"[{j + 1}] {(s.get('text') or '').strip()}" for j, s in enumerate(chunk)
    )
    user_prompt = "\n".join(parts)

    try:
        result = await ai.run_experiment(
            provider="openai",
            model=model,
            system_prompt=TEXT_DIARIZE_SYSTEM_PROMPT,
            user_prompt=user_prompt,
            max_tokens=4096,
        )
        raw = result.content
    except Exception as e:
        logger.warning(f"Text-diarize chunk labeling failed (non-fatal): {e}")
        raw = ""

    speaker_by_idx: dict[int, str] = {}
    start, end = raw.find("{"), raw.rfind("}")
    if start >= 0 and end > start:
        try:
            parsed = json.loads(raw[start:end + 1])
        except (ValueError, TypeError):
            parsed = None
        if isinstance(parsed, dict):
            for k, v in parsed.items():
                try:
                    idx = int(str(k).strip()) - 1
                except (ValueError, TypeError):
                    continue
                if 0 <= idx < len(chunk):
                    label = str(v).strip().upper()[:1]
                    if label.isalpha():
                        speaker_by_idx[idx] = label
    return speaker_by_idx
