"""Examination Schemas (Request/Response DTOs)"""
from datetime import date, datetime
from pydantic import BaseModel, Field, field_validator

from app.core.datetime_utils import to_utc_naive
from app.modules.examination.common.state_machine import ALL_STATUSES

# 상태 목록은 상태 머신이 단일 출처다 — 여기에 다시 적으면 어긋난다.
_STATUS_PATTERN = f"^({'|'.join(ALL_STATUSES)})$"

# 접수 가능한 검사 유형 — 새 검사를 열 때 여기만 고친다.
# 검사 등록 모달(프론트)의 comingSoon 없는 항목과 일치해야 하며,
# tests/unit/test_exam_types.py 가 그 정합성을 확인한다.
SUPPORTED_EXAM_TYPES: tuple[str, ...] = ("htp", "rorschach", "sct")
_EXAM_TYPE_PATTERN = f"^({'|'.join(SUPPORTED_EXAM_TYPES)})$"


# --- Request DTOs ---

class ExaminationCreate(BaseModel):
    client_id: str
    examiner_id: str
    exam_type: str = Field(..., pattern=_EXAM_TYPE_PATTERN)
    scheduled_at: datetime | None = None
    note: str | None = None

    @field_validator("scheduled_at")
    @classmethod
    def _normalize_scheduled_at(cls, v: datetime | None) -> datetime | None:
        return to_utc_naive(v)


class ExaminationBatteryCreate(BaseModel):
    """검사 배터리(복합 검사) 생성 — 여러 검사 유형을 한 번에 등록"""
    client_id: str
    examiner_id: str
    exam_types: list[str] = Field(..., min_length=1)
    scheduled_at: datetime | None = None
    note: str | None = None
    name: str | None = None

    @field_validator("exam_types")
    @classmethod
    def _validate_types(cls, v: list[str]) -> list[str]:
        allowed = set(SUPPORTED_EXAM_TYPES)
        seen: list[str] = []
        for t in v:
            if t not in allowed:
                raise ValueError(f"허용되지 않은 검사 유형: {t}")
            if t not in seen:  # 중복 제거 (순서 유지)
                seen.append(t)
        return seen

    @field_validator("scheduled_at")
    @classmethod
    def _normalize_scheduled_at(cls, v: datetime | None) -> datetime | None:
        return to_utc_naive(v)


class ExaminationUpdate(BaseModel):
    status: str | None = Field(None, pattern=_STATUS_PATTERN)
    note: str | None = None
    scheduled_at: datetime | None = None

    @field_validator("scheduled_at")
    @classmethod
    def _normalize_scheduled_at(cls, v: datetime | None) -> datetime | None:
        return to_utc_naive(v)


# --- Response DTOs ---

class ExaminationSummary(BaseModel):
    """목록용"""
    id: str
    client_id: str
    examiner_id: str
    exam_type: str
    status: str
    scheduled_at: datetime | None = None
    created_at: datetime

    model_config = {"from_attributes": True}


class ExamProgress(BaseModel):
    """검사가 어디까지 진행됐는지 — status와는 별개의 축.

    status는 임상 워크플로(초안 → 검토 → 확정)를, 여기는 검사 자체의 진행을
    나타낸다. 세 검사 모두 '수집 완료'를 status에 남기지 않기 때문에
    (로르샤하는 ended_at, HTP는 image_url, SCT는 completedCount가 신호)
    단계 진입 판정은 이쪽을 봐야 한다.

    검사마다 수집 단위가 달라서 개수는 없을 수 있다(로르샤하는 세션 종료
    하나로 결정된다). collect_done은 항상 채워진다.
    """
    collect_done: bool
    collected_count: int | None = None
    collect_total: int | None = None
    has_result: bool = False


class ExaminationResponse(BaseModel):
    """상세용"""
    id: str
    institution_id: str
    client_id: str
    examiner_id: str
    exam_type: str
    status: str
    battery_id: str | None = None
    scheduled_at: datetime | None = None
    started_at: datetime | None = None
    completed_at: datetime | None = None
    ai_model_version: str | None = None
    note: str | None = None
    created_at: datetime
    updated_at: datetime
    # 검사별 서브모듈을 조회해 채운다. 목록 응답에는 넣지 않는다 —
    # 건마다 추가 쿼리가 되어 N+1이 된다.
    progress: ExamProgress | None = None

    model_config = {"from_attributes": True}


class ExaminationBatteryResponse(BaseModel):
    """배터리 생성 응답 — 배터리 + 생성된 검사 목록"""
    id: str
    institution_id: str
    client_id: str
    examiner_id: str
    name: str | None = None
    status: str
    examinations: list[ExaminationSummary] = []
    created_at: datetime

    model_config = {"from_attributes": True}


class ExaminationListResponse(BaseModel):
    """페이징 목록 응답"""
    items: list[ExaminationSummary]
    total: int
    page: int
    size: int
    pages: int


class ExaminationSummaryWithNames(BaseModel):
    """목록용 (이름 + 내담자 정보 포함 - 프론트 편의)"""
    id: str
    client_id: str
    client_name: str | None = None
    client_birth_date: date | None = None
    client_gender: str | None = None
    examiner_id: str
    examiner_name: str | None = None
    exam_type: str
    status: str
    battery_id: str | None = None
    scheduled_at: datetime | None = None
    started_at: datetime | None = None
    completed_at: datetime | None = None
    created_at: datetime


class ExaminationListWithNamesResponse(BaseModel):
    items: list[ExaminationSummaryWithNames]
    total: int
    page: int
    size: int
    pages: int


class DashboardStats(BaseModel):
    """대시보드 통계 — 상태머신 7단계 전부를 담는다.

    서비스는 under_review 도 집계하지만 스키마에 필드가 없어 응답에서
    누락되고 있었다(대시보드 숫자가 목록과 어긋난 원인 중 하나).
    """
    total: int = 0
    created: int = 0
    in_progress: int = 0
    ai_draft_ready: int = 0
    under_review: int = 0
    confirmed: int = 0
    report_generated: int = 0
    completed: int = 0

    # ── 기간 지표 ──
    # 목록 일부를 받아 앱에서 세면 그 범위 밖의 건이 빠지므로 DB에서 집계한다.
    today_scheduled: int = 0
    """오늘 예정된 미시작 검사"""
    week_completed: int = 0
    """이번 주(일요일 시작) 완료된 검사 — 확정·보고서·완료를 함께 센다"""
    stale_reviews: int = 0
    """검토 대기로 오래 머문 검사 (기본 5일 이상)"""
