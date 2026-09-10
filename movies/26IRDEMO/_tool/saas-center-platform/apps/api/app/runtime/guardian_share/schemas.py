from dataclasses import dataclass


@dataclass(frozen=True)
class GuardianShareSource:
    """변환 입력 — 상담 일지 원문 + 톤 결정에 필요한 최소 맥락."""

    client_name: str
    session_label: str
    audience: str
    main_topic: str | None = None
    progress: str | None = None
    next_goal: str | None = None
    summary: str | None = None
    program_name: str | None = None
    client_age: int | None = None


@dataclass(frozen=True)
class GuardianShareDraft:
    content: dict
    audience: str
    llm_call_id: str | None
