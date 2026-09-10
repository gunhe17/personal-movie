from dataclasses import dataclass, field


@dataclass
class AICallContext:
    # 모든 AI 호출에 필요한 컨텍스트.
    #
    # 각 호출 사이트가 "누가, 왜, 어디서" 호출하는지 명시.
    # quota 체크와 사용량 기록에 사용.

    center_id: str
    source_type: str  # "field_note" | "counseling" | "agent"
    source_id: str | None = None  # field_note_id, case_id 등
    purpose: str = ""  # "field_note_stt_diarize", "case_analysis" 등
    pipeline_step: str | None = None  # ProductionAIConfig 조회용
    member_id: str | None = None  # 호출한 멤버 (비정규화 기록용)
    session_id: str | None = None  # 대화/세션 단위 집계용 (agent conversation 등)


@dataclass
class LLMCallResult:
    content: str
    model: str
    input_tokens: int = 0
    output_tokens: int = 0
    latency_ms: float = 0.0
    # 사용량 기록 실패 시 None — 과금 내역과 산출물을 잇는 용도라 필수는 아니다
    llm_call_id: str | None = None


@dataclass
class STTCallResult:
    text: str
    model: str
    audio_duration_seconds: float
    segments: list[dict] = field(default_factory=list)
    latency_ms: float = 0.0


def redact_image_messages(messages: list[dict]) -> list[dict]:
    """llm_calls.meta 저장용 변환 — image_url 데이터(base64, 페이지당 수백KB)는 바이트 길이만
    남기고 뺀다. 원문 그대로 저장하면 파이프라인 하나에 수백MB(213페이지×이미지)가 쌓인다."""
    redacted = []
    for msg in messages:
        content = msg.get("content")
        if isinstance(content, str):
            redacted.append(msg)
            continue
        new_content = []
        for block in content or []:
            if block.get("type") == "image_url":
                new_content.append({
                    "type": "image_url",
                    "image_url": {"omitted_bytes": len(block["image_url"]["url"])},
                })
            else:
                new_content.append(block)
        redacted.append({**msg, "content": new_content})
    return redacted
