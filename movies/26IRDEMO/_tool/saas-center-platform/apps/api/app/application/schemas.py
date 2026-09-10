from datetime import datetime, date
from pydantic import BaseModel, Field

from app.modules.form.form.schemas import FormSummary
from app.modules.document.document.schemas import DocumentSummary


class IndividualAssessmentCreate(BaseModel):
    client_id: str = Field(..., description="내담자 ID")
    assessment_ids: list[str] = Field(min_length=1, description="검사 ID 목록")
    is_final_report_required: bool = Field(
        default=False, description="종합보고서 필요 여부"
    )
    has_schedule: bool = Field(default=False, description="일정 생성 여부")
    scheduled_start: datetime | None = Field(None, description="일정 시작 시간")
    scheduled_end: datetime | None = Field(None, description="일정 종료 시간")
    counselor_id: str = Field(..., description="담당 검사자 ID (Member UUID)")
    room_id: str | None = Field(None, description="장소 ID")
    memo: str | None = Field(None, description="메모")
    institution_id: str | None = Field(None, description="기관 ID")
    set_id: str | None = Field(None, description="검사 세트 ID")
    tags: list[str] = Field(default_factory=list, description="케이스 태그")

    model_config = {
        "json_schema_extra": {
            "example": {
                "client_id": "c1a2b3c4-d5e6-7f8g-9h0i-1j2k3l4m5n6o",
                "assessment_ids": [
                    "5523d3a4-dce4-4a0c-8f70-1af123456789",
                    "66234b5c-ede5-5b1d-9g81-2bg234567890",
                ],
                "is_final_report_required": False,
                "has_schedule": True,
                "scheduled_start": "2026-02-10T14:00:00",
                "scheduled_end": "2026-02-10T15:30:00",
                "counselor_id": "m1a2b3c4-d5e6-7f8g-9h0i-1j2k3l4m5n6o",
                "room_id": "r1a2b3c4-d5e6-7f8g-9h0i-1j2k3l4m5n6o",
                "memo": "첫 회기 검사",
                "tags": ["urgent", "school"],
            }
        }
    }


class IndividualAssessmentResponse(BaseModel):
    case_id: str
    case_code: str
    session_id: str | None  # 온라인 검사는 None
    schedule_id: str | None
    created_at: datetime
    warnings: list[str] = []  # 일정 충돌 등 경고 메시지 (접수는 성공)


class BatchAssessmentCreate(BaseModel):
    client_ids: list[str] = Field(min_length=1, description="내담자 ID 목록")
    institution_id: str | None = Field(None, description="기관 ID (선택)")
    assessment_ids: list[str] = Field(min_length=1, description="검사 ID 목록")
    is_final_report_required: bool = Field(
        default=False, description="종합보고서 필요 여부"
    )
    has_schedule: bool = Field(default=False, description="일정 생성 여부")
    scheduled_start: datetime | None = Field(None, description="일정 시작 시간")
    scheduled_end: datetime | None = Field(None, description="일정 종료 시간")
    counselor_id: str = Field(..., description="담당 검사자 ID (Member UUID)")
    assistant_ids: list[str] = Field(
        default_factory=list, description="참여 검사자 ID 목록"
    )
    room_id: str | None = Field(None, description="장소 ID")
    memo: str | None = Field(None, description="메모")
    set_id: str | None = Field(None, description="검사 세트 ID")
    tags: list[str] = Field(default_factory=list, description="케이스 태그")

    model_config = {
        "json_schema_extra": {
            "example": {
                "client_ids": [
                    "c1a2b3c4-d5e6-7f8g-9h0i-1j2k3l4m5n6o",
                    "c2a3b4c5-d6e7-8f9g-0h1i-2j3k4l5m6n7o",
                    "c3a4b5c6-d7e8-9f0g-1h2i-3j4k5l6m7n8o",
                ],
                "institution_id": "i1a2b3c4-d5e6-7f8g-9h0i-1j2k3l4m5n6o",
                "assessment_ids": ["5523d3a4-dce4-4a0c-8f70-1af123456789"],
                "is_final_report_required": True,
                "has_schedule": True,
                "scheduled_start": "2026-02-10T10:00:00",
                "scheduled_end": "2026-02-10T12:00:00",
                "counselor_id": "m1a2b3c4-d5e6-7f8g-9h0i-1j2k3l4m5n6o",
                "assistant_ids": ["m2a3b4c5-d6e7-8f9g-0h1i-2j3k4l5m6n7o"],
                "room_id": "r1a2b3c4-d5e6-7f8g-9h0i-1j2k3l4m5n6o",
                "memo": "학교 집단 검사",
                "tags": ["school", "group"],
            }
        }
    }


class BatchAssessmentResponse(BaseModel):
    schedule_id: str | None = Field(description="일정 ID (대면 검사만)")
    case_ids: list[str] = Field(description="생성된 Case ID 목록")
    total_count: int = Field(description="생성된 Case 수")
    created_at: datetime


class ClientSummaryForCase(BaseModel):
    client_id: str
    name: str
    client_code: str | None = None  # Client 모델에 없는 필드 (향후 추가 예정)
    birth_date: date | None = None
    age: int | None = None  # 만나이 (계산됨)
    gender: str | None = None
    profile_image_url: str | None = None  # 프로필 이미지(업로드 또는 기본 아바타)


class ClientDetailForCase(BaseModel):
    client_id: str
    name: str
    client_code: str | None = None  # Client.code
    birth_date: date | None = None
    age: int | None = None
    gender: str | None = None
    email: str | None = None
    phone: str | None = None
    address: str | None = None
    memo: str | None = None
    profile_image_url: str | None = None  # 프로필 이미지(업로드 또는 기본 아바타)


class AssessmentSummaryForCase(BaseModel):
    id: str
    code: str
    kor_name: str
    eng_name: str
    assessment_type: str
    duration: int | None = None


class AssessmentCaseListItem(BaseModel):
    case_id: str
    case_code: str
    status: str  # pending, processing, completed, cancelled
    case_type: str  # "individual" | "group"
    created_at: datetime

    counselor_id: str
    counselor_name: str | None = None

    clients: list[ClientSummaryForCase]

    assessments: list[AssessmentSummaryForCase]

    assessment_names: list[str]  # 하위 호환성 유지

    institution_name: str | None = None

    set_name: str | None = None

    completed_count: int = 0
    total_count: int = 0

    is_final_report_required: bool = False
    has_comprehensive_report: bool = False

    scheduled_start: datetime | None = None
    scheduled_end: datetime | None = None
    room_id: str | None = None
    room_name: str | None = None

    has_uninvoiced_sessions: bool = False


class AssessmentCaseListResponse(BaseModel):
    items: list[AssessmentCaseListItem]
    total: int
    page: int
    size: int
    pages: int


class AssessmentTaskSummary(BaseModel):
    id: str
    assessment_id: str
    assessment_code: str
    assessment_name: str  # kor_name
    status: str  # pending, in_progress, completed, refused, cancelled
    execution_method: str  # onsite, online
    progress: dict = Field(default_factory=dict, description="진행률 정보")
    completed_at: datetime | None = None
    created_at: datetime
    belongs_to_set: bool = False


class MemberSummary(BaseModel):
    member_id: str
    name: str


class CounselorDetailForCase(BaseModel):
    member_id: str
    name: str
    birth_date: date | None = None
    email: str | None = None
    phone: str | None = None
    employment_type: str | None = None  # FULLTIME, CONTRACT, FREELANCER
    hire_date: datetime | None = None  # Member.created_at
    memo: str | None = None


class ScheduleSummary(BaseModel):
    schedule_id: str
    start: datetime
    end: datetime
    room_id: str | None = None
    room_name: str | None = None
    memo: str | None = None
    is_cancelled: bool = False
    cancel_reason: str | None = None
    session_id: str | None = None


class AssessmentSessionSummary(BaseModel):
    session_id: str
    status: str  # scheduled, attended, no_show, cancelled
    schedule: ScheduleSummary | None = None


class InstitutionSummary(BaseModel):
    institution_id: str
    name: str
    phone: str | None = None


class AssessmentCaseDetailResponse(BaseModel):
    case_id: str
    case_code: str
    status: str
    case_type: str  # "individual" | "group"
    created_at: datetime
    completed_at: datetime | None = None
    tags: list[str] = Field(default_factory=list)
    is_final_report_required: bool

    counselor: CounselorDetailForCase
    assistants: list[MemberSummary] = Field(default_factory=list)
    my_role: str | None = Field(
        default=None, description="조회자의 담당 구분 (primary | assistant | null)"
    )

    clients: list[ClientDetailForCase]

    institution: InstitutionSummary | None = None

    tasks: list[AssessmentTaskSummary]

    sessions: list[AssessmentSessionSummary] = Field(default_factory=list)

    schedule: ScheduleSummary | None = None  # 첫 번째 세션 기준 — 하위 호환

    set_id: str | None = None
    set_name: str | None = None


class CounselingCaseListItem(BaseModel):
    case_id: str
    case_code: str
    status: str  # active, completed, cancelled
    case_type: str  # "초기상담" | "프로그램"
    program_name: str | None = None  # 초기상담은 null

    clients: list[ClientSummaryForCase]

    # 담당 상담사 — 대표 1명 이름 + 전체 담당자 수 + 전체 이름(드롭다운용)
    counselor_name: str | None = None
    counselor_count: int = 1
    counselor_names: list[str] = []

    completed_sessions: int = 0
    scheduled_sessions: int = 0
    total_sessions: int = 0
    next_session_start: datetime | None = None
    next_session_end: datetime | None = None
    next_session_room_name: str | None = None
    room_name: str | None = None  # 대표 상담실(첫 회기 기준, 상세와 동일)

    has_uninvoiced_sessions: bool = False

    created_at: datetime


class CounselingCaseListResponse(BaseModel):
    items: list[CounselingCaseListItem]
    total: int
    page: int
    size: int
    pages: int


class UnprocessedSessionItem(BaseModel):
    session_id: str
    case_id: str
    case_code: str
    session_number: int | None = None
    program_name: str | None = None
    client_names: list[str] = []
    counselor_name: str | None = None
    start: datetime
    end: datetime
    room_name: str | None = None


class UnprocessedSessionListResponse(BaseModel):
    items: list[UnprocessedSessionItem]
    total: int


class MyCounselingSummary(BaseModel):
    total_completed: int = Field(description="총 완료 회기 수")
    individual_completed: int = Field(description="개별 상담 완료 회기 수")
    group_completed: int = Field(description="그룹 상담 완료 회기 수")
    last_session_date: date | None = Field(description="최근 상담일")


class MyCounselingResponse(BaseModel):
    summary: MyCounselingSummary
    items: list[CounselingCaseListItem]
    total: int
    page: int
    size: int
    pages: int


class CounselingNoteListItem(BaseModel):
    # 작성됨(is_written=True)이면 note 기반, 미작성이면 완료 회기 × 내담자 페어.
    # counseling_session_id / client_id는 카드 탭 시 상담일지 시트 진입에 사용(필수).
    note_id: str | None = None  # 작성된 노트 id (미작성이면 None)
    counseling_session_id: str
    counseling_case_id: str | None = None  # 회기가 속한 케이스 id — 웹이 케이스 상세로 일지 진입할 때 사용
    client_id: str
    client_name: str | None = None
    client_gender: str | None = None  # 'male' | 'female' — 내담자 성별
    client_birth_date: date | None = None  # 내담자 생년월일 — 목록 표기 규격(생년월일 | 성별)
    client_profile_image_url: str | None = None  # 내담자 프로필 이미지 (없으면 이니셜 폴백)
    client_age: int | None = None  # 내담자 만 나이
    program_name: str | None = None
    program_type: str | None = None  # 'INDIVIDUAL' | 'GROUP' — 개별/그룹 구분(웹 유형 필터·표시용)
    session_start: datetime | None = None  # 회기 날짜 (= schedule.start)
    session_end: datetime | None = None  # 회기 종료 (= schedule.end) — 시간 범위 표시용
    schedule_id: str | None = None  # 회기의 일정 ID (연결된 필드노트 조회용)
    room_name: str | None = None  # 회기 장소(상담실) 이름
    summary: str | None = None  # 노트 요약 1줄 (AI 초안이 있을 때만 채워짐, 미작성이면 None)
    preview: str | None = None  # 목록 카드 미리보기 — 본문에서 뽑은 앞부분 (개인 메모 제외)
    is_written: bool
    created_at: datetime | None = None  # 작성일 (미작성이면 None)


class CounselingNoteListResponse(BaseModel):
    items: list[CounselingNoteListItem]
    total: int
    page: int
    size: int
    pages: int


class SessionParticipantInfo(BaseModel):
    session_participant_id: str
    participant_type: str  # client
    participant_id: str
    participant_name: str
    attendance_status: str  # scheduled, attended, absent, late, excused
    is_consumed: bool
    memo: str | None
    has_note: bool = Field(default=False, description="일지 작성 여부")


class SessionCounselorInfo(BaseModel):
    counselor_id: str
    counselor_name: str


class SessionDetailInfo(BaseModel):
    session_id: str
    session_number: int
    schedule_id: str
    start: datetime
    end: datetime
    room_id: str | None
    room_name: str | None
    status: str  # scheduled, completed, no_show, cancelled

    clients: list[SessionParticipantInfo] = Field(
        default_factory=list, description="내담자 참여 정보 (출석 상태 포함)"
    )
    counselors: list[SessionCounselorInfo] = Field(
        default_factory=list, description="상담사 정보 (이름만)"
    )


class CounselingCaseDetailResponse(BaseModel):
    case_id: str
    case_code: str
    status: str  # active, completed, cancelled
    chief_complaint: str | None
    memo: str | None
    total_sessions: int | None

    # 회기 생성 규칙 (반복 패턴)
    session_rule: dict | None = None

    program_id: str
    program_name: str
    case_type: str  # individual, group (from ProgramType)

    # 담당자 정보 (하위 호환을 위해 첫 번째 상담사 단일 필드 유지 + 전체 목록 추가)
    counselor_id: str
    counselor_name: str
    counselors: list[SessionCounselorInfo] = Field(
        default_factory=list, description="담당 상담사 전체 목록"
    )
    my_role: str | None = Field(
        default=None, description="조회자의 담당 구분 (primary | assistant | null)"
    )

    clients: list[ClientSummaryForCase]

    sessions: list[SessionDetailInfo]

    first_session_start: datetime | None  # 첫 회기 시작 시간
    room_name: str | None  # 첫 회기 장소

    created_at: datetime
    updated_at: datetime
    completed_at: datetime | None  # completed 상태일 때


class ClientFormInstanceItem(BaseModel):
    mapping_id: str
    instance: FormSummary
    created_at: datetime


class ClientFormInstanceListResponse(BaseModel):
    items: list[ClientFormInstanceItem]
    total: int
    page: int
    size: int
    pages: int


class VoucherClientVoucherBrief(BaseModel):
    client_voucher_id: str
    program_name: str
    remaining_sessions: int
    total_sessions: int
    valid_until: date | None = None


class VoucherClientItem(BaseModel):
    client_id: str
    name: str
    birth_date: date | None = None
    gender: str | None = None
    profile_image_url: str | None = None
    status: str  # active | completed
    vouchers: list[VoucherClientVoucherBrief]


class VoucherClientListResponse(BaseModel):
    items: list[VoucherClientItem]
    total: int
    page: int
    size: int
    pages: int


class ClientDocumentItem(BaseModel):
    mapping_id: str
    document: DocumentSummary
    resource_type: str
    created_at: datetime


class ClientDocumentListResponse(BaseModel):
    items: list[ClientDocumentItem]
    total: int
    page: int
    size: int
    pages: int


class BulkSessionUpdateRequest(BaseModel):
    session_ids: list[str] = Field(..., min_length=1, max_length=50)
    start: str | None = Field(
        None, pattern=r"^\d{2}:\d{2}$", description="시작 시간 HH:MM"
    )
    end: str | None = Field(
        None, pattern=r"^\d{2}:\d{2}$", description="종료 시간 HH:MM"
    )
    day_offset: int | None = Field(
        None, description="날짜 이동 (일 단위, 예: +1 = 하루 뒤로, -2 = 이틀 앞으로)"
    )
    room_id: str | None = Field(None, description="상담실 ID")
    member_id: str | None = Field(None, description="담당자 member_id")
    # 참여자 변경 (None=변경없음, []=전체제거)
    client_ids: list[str] | None = Field(None, description="내담자 ID (전체 교체)")
    counselor_ids: list[str] | None = Field(None, description="상담사 ID (전체 교체)")


class BulkSessionConflict(BaseModel):
    date_kst: str = Field(description="충돌 날짜/시간 (KST, YYYY-MM-DD HH:MM)")
    session_id: str = Field(description="해당 세션 ID")
    conflicting_titles: list[str] = Field(description="겹치는 일정 제목 목록")


class BulkSessionValidateResponse(BaseModel):
    has_conflicts: bool
    conflicts: list[BulkSessionConflict] = Field(default_factory=list)


class BulkSessionUpdateResponse(BaseModel):
    updated_count: int
    warnings: list[str] = Field(default_factory=list)


class AddSessionsRequest(BaseModel):
    case_id: str = Field(..., description="상담 케이스 ID")
    # 모드 1: 규칙대로 (기존)
    count: int | None = Field(
        None, ge=1, le=50, description="추가할 회기 수 (규칙대로 모드)"
    )
    # 모드 2: 직접 선택 (신규)
    dates: list[datetime] | None = Field(
        None, max_length=50, description="직접 선택 날짜 목록"
    )
    start_time: str | None = Field(
        None, pattern=r"^\d{2}:\d{2}$", description="시작 시간 (HH:MM)"
    )
    end_time: str | None = Field(
        None, pattern=r"^\d{2}:\d{2}$", description="종료 시간 (HH:MM)"
    )
    room_id: str | None = Field(None, description="상담실 ID")
    counselor_ids: list[str] | None = Field(
        None, description="담당 상담사 ID 목록 (member_id)"
    )


class AddSessionsResponse(BaseModel):
    created_count: int = Field(description="생성된 회기 수")
    total_sessions: int = Field(description="전체 회기 수 (기존 + 추가)")
    warnings: list[str] = Field(default_factory=list, description="충돌 경고 목록")


class ApplyCaseEditsRequest(BaseModel):
    # CounselingCaseEditModal 전체 상태를 한 번에 받아 단일 tx 반영 — 서버가 현재 상태와 diff 계산.
    client_ids: list[str] = Field(
        ..., description="최종 내담자 Client ID 목록 (전체 교체)"
    )
    counselor_ids: list[str] = Field(
        ...,
        min_length=1,
        description="최종 담당자 Member ID 목록 (전체 교체, 첫 번째가 case.counselor_id)",
    )
    room_id: str | None = Field(None, description="장소 ID (null 허용)")
    start_time: str = Field(
        ..., pattern=r"^\d{2}:\d{2}$", description="시작 시간 HH:MM (KST)"
    )
    end_time: str = Field(
        ..., pattern=r"^\d{2}:\d{2}$", description="종료 시간 HH:MM (KST)"
    )
    session_dates: list[str] = Field(
        ...,
        description="최종 회기 날짜 YYYY-MM-DD (KST) 목록. 기존 scheduled 회기와 diff 계산 후 add/delete",
    )
    sync_clients_to_scheduled_sessions: bool = Field(
        False,
        description="True 면 내담자 변경을 기존 scheduled 세션 participants 에도 반영",
    )


class ApplyCaseEditsResponse(BaseModel):
    case_id: str
    clients_added: int = Field(description="추가된 case participant(client) 수")
    clients_removed: int = Field(description="제거된 case participant(client) 수")
    sessions_added: int = Field(description="새로 생성된 회기 수")
    sessions_removed: int = Field(description="삭제된 회기 수")
    sessions_updated: int = Field(
        description="수정된 기존 회기 수 (시간/장소/담당자/내담자)"
    )
    warnings: list[str] = Field(default_factory=list, description="일정 충돌 등 경고")


class BillableTargetReference(BaseModel):
    # 청구 항목 자동 채움용 reference(단가표 매칭 키 + 표시 정보).
    # BillableTarget 하나가 여러 reference 보유 가능(예: 세트 1개 + 세트 밖 단일 검사 N개).
    reference_id: str = Field(
        description="단가표 매칭용 ID (set_id, assessment_id, program_id)"
    )
    label: str = Field(
        description="항목 표시명 (예: '세트명', 'XX 검사', '상담 프로그램명')"
    )
    item_type: str = Field(
        default="service",
        description="제안 item_type: 'service' | 'package'",
    )


class BillableTarget(BaseModel):
    # 청구 연동 대상(검사/상담 세션 통합) — 청구서 생성 모달에서 세션/검사를 골라 연동.
    # 단가표 매칭은 프론트가 price-list/by-references 엔드포인트로 별도 조회.
    type: str = Field(description="유형: assessment | counseling")
    case_id: str = Field(description="케이스 ID")
    case_code: str | None = Field(
        default=None, description="케이스 코드 (C00001 / A00001 등)"
    )
    session_id: str | None = Field(
        default=None,
        description="세션 ID (일정 없이 접수된 검사 등 세션 없는 케이스면 null)",
    )
    # client 정보 (today-missing에서 여러 내담자 섞일 때 식별용, 기본은 null)
    client_id: str | None = Field(default=None, description="내담자 ID")
    client_name: str | None = Field(default=None, description="내담자 이름")
    # 목록 행의 내담자 표기(아바타 + 이름 + 생년월일|성별)를 전체 탭과 같은 규격으로 맞추기 위한 동반 필드.
    # 이름과 같은 조회(get_clients_by_ids)에서 함께 나오므로 추가 쿼리 없음.
    client_birth_date: date | None = Field(default=None, description="내담자 생년월일")
    client_gender: str | None = Field(default=None, description="내담자 성별")
    client_profile_image_url: str | None = Field(
        default=None, description="내담자 프로필 이미지 URL"
    )
    title: str = Field(description="표시명 (검사명 또는 'N회차 상담')")
    subtitle: str | None = Field(
        default=None, description="부가 정보 (세트명, 프로그램명 등)"
    )
    scheduled_at: datetime | None = Field(
        default=None, description="일정 시작 시간 (없으면 null)"
    )
    created_at: datetime = Field(description="생성 시각 (정렬 fallback)")
    status: str = Field(description="세션 상태")
    references: list[BillableTargetReference] = Field(
        default_factory=list,
        description=(
            "청구 항목 자동 채움용 references. "
            "검사: 세트 + belongs_to_set이 아닌 task들 각각, "
            "상담: program 1개. "
            "프론트에서 reference_id로 단가표 매칭 후 items 자동 추가."
        ),
    )


class BillableTargetCounts(BaseModel):
    all: int = Field(default=0, description="전체")
    assessment: int = Field(default=0, description="검사 세션")
    counseling: int = Field(default=0, description="상담 세션")


class BillableTargetListResponse(BaseModel):
    # total_counts=필터(type) 적용 전 전체 카운트(탭 숫자용), total/page/size/pages=필터 후 페이지 메타.
    items: list[BillableTarget] = Field(description="청구 연동 대상 목록 (최신순)")
    total_counts: BillableTargetCounts = Field(description="타입별 총 개수 (필터 전)")
    total: int = Field(description="필터 적용 후 전체 개수")
    page: int = Field(description="현재 페이지 (1-based)")
    size: int = Field(description="페이지 크기")
    pages: int = Field(description="전체 페이지 수")


class TransmissionItem(BaseModel):
    uid: str
    type: str
    method: str
    sent_at: datetime
    client_name: str | None = None
    client_code: str | None = None
    client_birth_date: date | None = None
    client_age: int | None = None
    recipient_relation: str | None = None
    recipient_name: str | None = None
    recipient_phone: str | None = None
    assessment_name: str = ""
    status: str


class TransmissionListResponse(BaseModel):
    items: list[TransmissionItem]
    total: int
    page: int
    size: int
    pages: int
