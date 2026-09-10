from dataclasses import dataclass, field
from datetime import datetime


@dataclass(frozen=True)
class ProfileSnapshot:
    center_id: str
    center_name: str
    member_id: str
    member_name: str | None = None  # 정체성 라인용 — "내 상담" 채움의 전제 (A/B 실측 갭)
    recent_interactions: list[str] = field(default_factory=list)  # 앵커 표시명 (라이브)
    narrative: dict | None = None   # content.narrative {summary, focus}
    defaults: dict | None = None    # content.defaults {usual_room, usual_duration_min, usual_program}
    analyzed_at: datetime | None = None  # 장기 profile의 LLM 분석 시각 (stale 판정용)
