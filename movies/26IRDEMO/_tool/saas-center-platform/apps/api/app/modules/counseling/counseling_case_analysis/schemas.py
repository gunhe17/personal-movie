from datetime import datetime

from pydantic import BaseModel, Field


# #
# content (LLM 산출 + 서버가 채운 구조화 사실)
#
# 해석은 LLM이, **구조화 사실은 서버가** 채운다 — 회기 번호·날짜·출석·일지 출처·
# 커버리지는 executor가 계산해 병합하므로 LLM이 지어낼 여지가 없다.
# 옛 포맷(recurring_themes/emotional_trajectory/intervention_summary/...)으로 저장된
# 행도 그대로 남아 있어, 프론트는 두 형태를 모두 읽는다.


class PhaseItem(BaseModel):
    label: str | None = None
    from_session: int | None = Field(None, alias="from")
    to_session: int | None = Field(None, alias="to")
    focus: str | None = None
    mood: str | None = None
    trend: str | None = Field(None, description="up|flat|down")
    turning: str | None = None

    model_config = {"populate_by_name": True}


class SessionTrackItem(BaseModel):
    session: int
    date: str | None = Field(None, description="MM.DD — 서버가 채운다")
    attendance: str | None = Field(None, description="attended|absent|no_show — 서버가 채운다")
    note_source: str | None = Field(None, description="manual|ai|none — 서버가 채운다")
    topic: str | None = None
    mood: str | None = None
    intervention: str | None = None
    change: str | None = Field(None, description="up|flat|down")
    homework: str | None = Field(None, description="done|partial|none")
    turning: str | None = None


class ThemeItem(BaseModel):
    name: str
    sessions: list[int] = Field(default_factory=list, description="근거 회기 번호")
    note: str | None = None


class InterventionItem(BaseModel):
    name: str
    count: int = 0
    sessions: list[int] = Field(default_factory=list)
    response: str | None = None
    effect: str | None = Field(None, description="높음|보통|낮음|평가 보류")
    evidence: str | None = None


class FactorItem(BaseModel):
    text: str
    sessions: list[int] = Field(default_factory=list)


class DirectionContent(BaseModel):
    goals: list[str] = Field(default_factory=list)
    approaches: list[str] = Field(default_factory=list)
    closing: str | None = None
    supervision: list[str] = Field(default_factory=list)


class CoverageContent(BaseModel):
    """분석이 무엇을 읽었는지 — 서버 계산값. 사라진 섹션의 이유를 화면이 설명하는 근거."""

    completed_sessions: int = 0
    analyzed_sessions: int = 0
    note_count: int = 0
    manual_notes: int = 0
    ai_notes: int = 0
    mood_notes: int = 0
    intervention_notes: int = 0
    attendance_rate: int | None = None
    truncated_notes: int = Field(0, description="예산을 넘어 일부만 넣은 일지 수")
    per_session_chars: int | None = Field(None, description="회기당 입력 예산(자)")


class CaseAnalysisContent(BaseModel):
    # ── 신규 포맷 ──
    headline: str | None = Field(None, description="한 문장 결론")
    current_state: str | None = Field(None, description="현재 상태")
    mood_trend: str | None = Field(None, description="up|flat|down")
    phases: list[PhaseItem] = Field(default_factory=list)
    session_track: list[SessionTrackItem] = Field(default_factory=list)
    themes: dict[str, list[ThemeItem]] = Field(default_factory=dict)
    interventions: list[InterventionItem] = Field(default_factory=list)
    alliance: dict | None = Field(None, description="engagement/evidence")
    risks: list[FactorItem] = Field(default_factory=list)
    strengths: list[FactorItem] = Field(default_factory=list)
    direction: DirectionContent | None = None
    coverage: CoverageContent | None = None

    # ── 옛 포맷 (읽기 호환) ──
    recurring_themes: list[str] = Field(default_factory=list)
    emerging_themes: list[str] = Field(default_factory=list)
    emotional_trajectory: list[dict] = Field(default_factory=list)
    intervention_summary: dict = Field(default_factory=dict)
    therapeutic_alliance: dict | None = None
    progress_summary: str | None = None
    risk_factors: list[str] = Field(default_factory=list)
    recommendations: str | None = None


class CaseAnalysisResponse(BaseModel):
    id: str
    center_id: str
    counseling_case_id: str
    content: dict
    session_count: int
    status: str = Field("completed", description="processing|completed|failed")
    error_message: str | None = None
    model_used: str | None = None
    triggered_by: str
    input_tokens: int = 0
    output_tokens: int = 0
    created_at: datetime
    updated_at: datetime

    model_config = {"from_attributes": True}


class CaseAnalysisPreviewResponse(BaseModel):
    session_count: int = Field(description="분석 대상 완료 세션 수")
    note_count: int = Field(description="수집된 상담일지 수")
    has_previous_analysis: bool = Field(description="이전 분석 존재 여부")
    message: str = Field(description="안내 메시지")


class CaseAnalysisTrigger(BaseModel):
    session_take: int | None = Field(
        None,
        ge=1,
        description="최근 N개 완료 회기만 분석. 미지정이면 전체.",
    )
