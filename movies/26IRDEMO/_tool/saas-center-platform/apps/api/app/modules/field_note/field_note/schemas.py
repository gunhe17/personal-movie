import json
from datetime import datetime
from typing import Literal

from pydantic import BaseModel, Field, field_validator

from ..field_note_audio.schemas import FieldNoteAudioResponse
from ..field_note_entry.schemas import FieldNoteEntryResponse

NoteTemplateType = Literal["default", "soap", "dap", "birp", "family_center"]


class FieldNoteCreate(BaseModel):
    schedule_id: str | None = Field(None, description="일정 ID (선택 - 후속 연결 가능). 상담 회기 연결용")
    task_id: str | None = Field(None, description="검사 Task ID (선택 - 검사 항목별 연결용). schedule_id와 동시 지정 불가")


class FieldNoteFinish(BaseModel):
    total_duration: float = Field(..., ge=0, description="총 녹음 시간 (초)")
    skip_pipeline: bool = Field(False, description="True이면 후처리 파이프라인을 건너뜁니다")
    auto_pipeline: bool = Field(False, description="True이면 전체 파이프라인 자동 실행")
    skip_refine: bool = Field(True, description="True(기본)이면 LLM 보정 단계 건너뜀. False이면 보정 포함.")
    note_template_type: NoteTemplateType | None = Field(None, description="노트 서식 타입 (default, soap, dap, birp, family_center)")


class FieldNoteLinkSchedule(BaseModel):
    schedule_id: str = Field(..., description="연결할 일정 ID")


class FieldNoteLinkTask(BaseModel):
    task_id: str = Field(..., description="연결할 검사 Task ID")


class FieldNoteSpeakerMapUpdate(BaseModel):
    speaker_map: dict[str, str] = Field(..., description="화자 이름 매핑 ({speaker_id: display_name})")


# 리스트 카드용 schedule 요약 값 객체 — cross-module 조립은 application handler가 채운다.
class FieldNoteScheduleBrief(BaseModel):
    schedule_id: str
    start: datetime
    schedule_type: str
    client_names: list[str] = []
    program_name: str | None = None
    room_name: str | None = None
    session_status: str | None = None


# 리스트 카드용 검사 task 요약 값 객체 — task 연결 노트일 때 application handler가 AssessmentTaskFacade 경유로 채운다.
class FieldNoteTaskBrief(BaseModel):
    task_id: str
    client_name: str | None = None
    assessment_kor_name: str | None = None
    assessment_code: str | None = None
    case_id: str | None = None
    case_code: str | None = None
    room_name: str | None = None
    task_status: str | None = None


class FieldNoteAnalysisHighlight(BaseModel):
    t: float = 0
    text: str = ""


class FieldNoteAnalysisResponse(BaseModel):
    t: float = 0
    prompt: str = ""
    response: str = ""


# 정서 흐름 타임라인의 한 지점 — t로 재생 점프.
class FieldNoteAnalysisMoodPoint(BaseModel):
    t: float = 0
    mood: str = ""       # 그 시점의 정서 상태 (관찰 기반)
    trigger: str = ""    # 그 정서가 나온 계기/맥락 (없으면 빈 문자열)


class FieldNoteAnalysisQuote(BaseModel):
    t: float = 0
    quote: str = ""      # 내담자 발화 verbatim
    note: str = ""       # 왜 주목할 만한지 한 줄 (해석 아님 — 짚는 이유)


class FieldNoteAnalysisFollowUp(BaseModel):
    point: str = ""      # 확인·탐색할 지점
    reason: str = ""     # 왜 (이번 회기에서 미해결·열린 실타래)


# AI 분석 탭 구조화 데이터(요약 스텝 생성) — 상담 렌즈와 검사 렌즈를 함께 담되
# 채워지는 쪽은 노트 종류(task_id 유무)에 따라 다르고, 프런트는 데이터 있는 섹션만 렌더.
class FieldNoteAnalysis(BaseModel):
    title: str | None = None  # 목록 식별용 짧은 제목 (15자 내외)
    summary: str | None = None  # 목록 미리보기용 짧은 1문장
    # 상담 렌즈
    narrative: str | None = None  # 분석 탭 본문 — 회기 흐름 3-5문장(확장 요약)
    keywords: list[str] = []
    issues: list[str] = []
    mood: str | None = None  # (legacy 단발 정서 — 구버전 노트 폴백용)
    mood_flow: list[FieldNoteAnalysisMoodPoint] = []  # 시점별 정서 흐름
    key_quotes: list[FieldNoteAnalysisQuote] = []     # 의미 있는 발화
    follow_ups: list[FieldNoteAnalysisFollowUp] = []  # 살펴볼 지점
    highlights: list[FieldNoteAnalysisHighlight] = []
    # 검사 렌즈 (해석 금지 — 정리·위치 찾기)
    responses: list[FieldNoteAnalysisResponse] = []
    observations: list[FieldNoteAnalysisHighlight] = []
    quotes: list[FieldNoteAnalysisHighlight] = []


def _parse_analysis_value(v):
    if v is None or v == "":
        return None
    if isinstance(v, str):
        try:
            return json.loads(v)
        except (json.JSONDecodeError, TypeError):
            return None
    return v


class FieldNoteResponse(BaseModel):
    id: str
    center_id: str
    schedule_id: str | None
    task_id: str | None = None
    author_id: str
    note_number: int | None = None
    status: str
    total_duration: float
    processing_status: str = "idle"
    processing_step: str | None = None
    failed_step: str | None = None
    refined_transcript: str | None = None
    refinement_model: str | None = None
    transcribe_status: str = "pending"
    refine_status: str = "none"
    diarization_status: str = "none"
    note_status: str = "none"
    speaker_map: str | None = None
    nonverbal_markers: str | None = None
    note_template_type: str | None = None
    summary: str | None = None
    summary_status: str = "none"
    summary_generated_at: datetime | None = None
    summary_model: str | None = None
    analysis: FieldNoteAnalysis | None = None
    # Application handler 가 list 응답 enrich 시 채워 넣음 (schedule_id 가 있는 경우).
    schedule: FieldNoteScheduleBrief | None = None
    # 검사 연결 노트(task_id)일 때 application handler 가 채워 넣음.
    task: FieldNoteTaskBrief | None = None
    created_at: datetime
    updated_at: datetime

    model_config = {"from_attributes": True}

    @field_validator("analysis", mode="before")
    @classmethod
    def _coerce_analysis(cls, v):
        return _parse_analysis_value(v)


class TokenUsageItem(BaseModel):
    purpose: str | None = None
    model: str | None = None
    calls: int = 0
    input_tokens: int = 0
    output_tokens: int = 0


class FieldNoteDetailResponse(BaseModel):
    id: str
    center_id: str
    schedule_id: str | None
    task_id: str | None = None
    author_id: str
    note_number: int | None = None
    status: str
    total_duration: float
    processing_status: str = "idle"
    processing_step: str | None = None
    failed_step: str | None = None
    refined_transcript: str | None = None
    refinement_model: str | None = None
    transcribe_status: str = "pending"
    refine_status: str = "none"
    diarization_status: str = "none"
    note_status: str = "none"
    speaker_map: str | None = None
    nonverbal_markers: str | None = None
    note_template_type: str | None = None
    summary: str | None = None
    summary_status: str = "none"
    summary_generated_at: datetime | None = None
    summary_model: str | None = None
    analysis: FieldNoteAnalysis | None = None
    # 검사 연결 노트(task_id)일 때 application handler 가 채워 넣음 (case_id 등).
    task: FieldNoteTaskBrief | None = None
    audios: list[FieldNoteAudioResponse] = []
    entries: list[FieldNoteEntryResponse] = []
    token_usage: list[TokenUsageItem] = []
    created_at: datetime
    updated_at: datetime

    model_config = {"from_attributes": True}

    @field_validator("analysis", mode="before")
    @classmethod
    def _coerce_analysis(cls, v):
        return _parse_analysis_value(v)


    @classmethod
    def build(cls, field_note, audios, entries) -> "FieldNoteDetailResponse":
        data = FieldNoteResponse.model_validate(field_note).model_dump()
        data["audios"] = [FieldNoteAudioResponse.model_validate(a).model_dump() for a in audios]
        data["entries"] = [FieldNoteEntryResponse.model_validate(e).model_dump() for e in entries]
        return cls.model_validate(data)

class FieldNoteListResponse(BaseModel):
    items: list[FieldNoteResponse]
    total: int
    page: int
    size: int
    pages: int


class FieldNoteStatusItem(BaseModel):
    id: str | None = None
    schedule_id: str | None = None
    task_id: str | None = None
    status: str
    processing_status: str = "idle"

    model_config = {"from_attributes": True}


class LinkableAssessmentTask(BaseModel):
    task_id: str
    case_id: str
    case_code: str | None = None
    client_name: str = ""
    assessment_code: str | None = None
    assessment_kor_name: str | None = None
    execution_method: str
    task_status: str
    created_at: datetime
    session_start: datetime | None = None  # 검사 세션(일정) 예약 시각 — 시트 표시용

    model_config = {"from_attributes": True}


class AudioDownloadUrlResponse(BaseModel):
    download_url: str
    expires_in: int
    audio_id: str
    chunk_index: int
    duration: float
