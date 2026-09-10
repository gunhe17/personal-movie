from datetime import date, datetime

from pydantic import BaseModel, ConfigDict, EmailStr, Field


# #
# auth

class AppSignupRequest(BaseModel):
    email: EmailStr
    password: str = Field(min_length=8, max_length=72)
    name: str = Field(min_length=1, max_length=100)
    phone: str = Field(min_length=1, max_length=20)


class AppLoginRequest(BaseModel):
    email: EmailStr
    password: str = Field(min_length=1)


class AppRefreshRequest(BaseModel):
    refresh_token: str = Field(min_length=1)


class AppTokenResponse(BaseModel):
    access_token: str
    refresh_token: str
    token_type: str = "Bearer"
    expires_in: int = 1800


# #
# me · profile

class AppAccountSummary(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: str
    email: str


class AppPersonSummary(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: str
    name: str
    phone: str | None = None


class AppFamilySummary(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: str


class AppProfileResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: str
    display_name: str
    relation: str
    birth_date: date | None = None
    gender: str | None = None
    # 보호자가 고른 것 > 연결된 센터 Client의 것 > 없음 (핸들러가 해소)
    image_url: str | None = None
    # 센터 연결 여부 = 수정·삭제 잠금 여부(연결된 프로필은 센터 명부의 투영이라 readonly)
    is_linked: bool = False


class AppProfileCreateRequest(BaseModel):
    display_name: str = Field(min_length=1, max_length=100)
    relation: str = Field(default="child", pattern="^(child|self)$")
    birth_date: date | None = None
    gender: str | None = Field(default=None, pattern="^(male|female)$")
    # 미지정이면 성별 기준 랜덤 배정 — 아바타가 빈 프로필이 생기지 않게
    default_avatar_key: str | None = None


class AppProfileImageRequest(BaseModel):
    default_avatar_key: str = Field(min_length=1)


class AppDefaultAvatarItem(BaseModel):
    key: str
    gender: str
    url: str


class AppProfileUpdateRequest(BaseModel):
    display_name: str | None = Field(default=None, min_length=1, max_length=100)
    birth_date: date | None = None
    gender: str | None = Field(default=None, pattern="^(male|female)$")


class AppProfileMergeRequest(BaseModel):
    # 경로의 프로필이 이 프로필로 흡수되고 사라진다 — 기록은 전건 따라간다
    target_profile_id: str = Field(min_length=1)


class AppLinkResponse(BaseModel):
    id: str
    profile_id: str
    center_id: str
    center_name: str | None = None
    center_phone: str | None = None
    center_logo_url: str | None = None
    client_id: str
    status: str
    linked_at: datetime | None = None


class AppMeResponse(BaseModel):
    account: AppAccountSummary
    person: AppPersonSummary
    family: AppFamilySummary | None = None
    profiles: list[AppProfileResponse] = []
    links: list[AppLinkResponse] = []


class AppOperatingTime(BaseModel):
    """요일별 운영시간 — 시간은 "HH:MM" 문자열, null이면 휴무/미설정."""

    weekday: str  # MON..SUN
    open_time: str | None = None
    close_time: str | None = None
    break_start_time: str | None = None
    break_end_time: str | None = None


class AppCenterDetailResponse(BaseModel):
    """연결된 센터 상세 — 읽기 투영(연락처·주소·커버·운영시간)."""

    id: str
    name: str
    phone: str | None = None
    address: str | None = None
    image_url: str | None = None
    operating_times: list[AppOperatingTime] = []


# #
# link

class LinkVerifyRequest(BaseModel):
    code: str = Field(min_length=6, max_length=6, pattern="^[0-9]{6}$")


class LinkCenterSummary(BaseModel):
    id: str
    name: str
    # 연결 확인 화면이 "어느 센터인지"를 이름만으로는 못 가른다(같은 이름의 분점)
    phone: str | None = None
    address: str | None = None
    image_url: str | None = None


class LinkProfileCandidate(BaseModel):
    profile_id: str
    display_name: str
    birth_date: date | None = None
    relation: str
    # strong = 앱이 미리 골라도 되는 확신 / weak = 목록에만 노출(부모가 직접 고름)
    tier: str
    # 일치 근거 — 앱이 "생년월일이 같아요" 류 칩으로 보여준다
    reasons: list[str] = []
    linked_center_names: list[str] = []
    # 값이 있으면 선택 불가 — 사유를 표시해 "왜 우리 아이가 없지?"를 막는다
    disabled_reason: str | None = None


class LinkChildCandidate(BaseModel):
    client_id: str
    name: str
    birth_date: date | None = None
    gender: str | None = None
    suggested_profile_id: str | None = None
    # 제안(strong)뿐 아니라 약한 후보까지 — 목록이 비면 부모는 새 프로필로 간다
    candidates: list[LinkProfileCandidate] = []
    # 이 아이가 이미 걸려 있는 프로필 — 앱이 "이미 연결됨"으로 그려 재매핑 시도를 막는다
    linked_profile_id: str | None = None
    # 본인 내담(후보 = 보호자 자신) — 앱이 "아이 확인" 대신 본인 문구를 쓴다
    is_self: bool = False


class LinkVerifyResponse(BaseModel):
    center: LinkCenterSummary
    guardian_name: str
    expires_at: datetime
    children: list[LinkChildCandidate]


class LinkClaimMapping(BaseModel):
    client_id: str
    profile_id: str | None = None
    new_profile: AppProfileCreateRequest | None = None


class LinkClaimRequest(BaseModel):
    code: str = Field(min_length=6, max_length=6, pattern="^[0-9]{6}$")
    mappings: list[LinkClaimMapping] = Field(min_length=1)


class LinkClaimResponse(BaseModel):
    links: list[AppLinkResponse]


# #
# read projection

class AppPendingChangeRequest(BaseModel):
    request_id: str
    requested_start: datetime
    requested_end: datetime


class AppScheduleItem(BaseModel):
    schedule_id: str
    profile_id: str
    center_id: str
    center_name: str | None = None
    kind: str
    title: str | None = None
    start_time: datetime
    end_time: datetime
    status: str
    counselor_name: str | None = None
    room_name: str | None = None
    # 담당자가 일정에 남긴 메모(Schedule.memo) — 상세 화면 노출용. 임상기록 아님(G1 무관).
    memo: str | None = None
    # 이 회기가 청구된 바우처(제도) 이름 — 바우처 청구가 있는 회기만. 없으면 null.
    voucher_name: str | None = None
    # 센터 확인을 기다리는 변경 요청. 있으면 앱은 재요청 대신 "검토 중"을 보여준다.
    pending_change_request: AppPendingChangeRequest | None = None


class AppSessionShareItem(BaseModel):
    # 상담사가 전달한 회기 내용 — 임상 원문이 아니라 읽는 사람 톤으로 옮긴 글(G3)
    text: str | None = None
    published_at: datetime | None = None


class AppCounselingSessionItem(BaseModel):
    session_id: str
    round: int | None = None
    scheduled_at: datetime | None = None
    end_at: datetime | None = None
    room_name: str | None = None
    status: str
    # 발행된 공유문이 있을 때만 채워진다(미발행 = None)
    share: AppSessionShareItem | None = None


class AppCounselingProgressItem(BaseModel):
    case_id: str
    center_id: str
    center_name: str | None = None
    counseling_type: str | None = None
    counselor_name: str | None = None
    total_sessions: int | None = None
    completed_sessions: int
    started_at: datetime | None = None
    next_session_at: datetime | None = None
    # 이 케이스 회기가 청구된 바우처(제도) 이름 — 청구가 있는 회기가 있을 때만. 없으면 null.
    voucher_name: str | None = None
    sessions: list[AppCounselingSessionItem] = []


class AppAssessmentTaskItem(BaseModel):
    task_id: str
    name: str
    status: str
    report_visible: bool = False


class AppAssessmentItem(BaseModel):
    case_id: str
    center_id: str
    center_name: str | None = None
    name: str
    status: str
    completed_count: int = 0
    total_count: int = 0
    report_visible: bool = False
    tasks: list[AppAssessmentTaskItem] = []


class AppProfileProgressResponse(BaseModel):
    counseling: list[AppCounselingProgressItem] = []
    assessments: list[AppAssessmentItem] = []


class AppAssessmentReportResponse(BaseModel):
    task_id: str
    name: str
    download_url: str
    expires_in: int


# #
# voucher catalog (공개 — 제도 정보)

class AppVoucherItem(BaseModel):
    id: str
    name: str
    program_name: str
    program_organization: str
    program_year: int
    application_method: str | None = None
    application_start_date: date | None = None
    application_end_date: date | None = None
    support_amount_text: str | None = None
    support_scope: str | None = None
    support_target: str | None = None
    contact: str | None = None
    eligibility: dict | None = None


# #
# directory center (공개 — 전국 센터 디렉토리)

class AppDirectoryCenterItem(BaseModel):
    id: str
    name: str
    address: str
    latitude: float
    longitude: float
    category: str
    phone_number: str | None = None
    operating_hours_text: str | None = None
    website_url: str | None = None
    distance_m: int


class AppClientVoucherItem(BaseModel):
    id: str
    profile_id: str
    profile_name: str | None = None
    center_id: str
    center_name: str | None = None
    name: str | None = None
    program_organization: str | None = None
    total_sessions: int
    remaining_sessions: int
    valid_from: date | None = None
    valid_until: date | None = None


# #
# notification (앱 알림함 — 센터를 가로지르는 단일 인박스)

class AppPushTokenRegisterRequest(BaseModel):
    token: str = Field(min_length=1, max_length=512)
    device_info: str | None = Field(default=None, max_length=256)
    platform: str = Field(default="ios", pattern="^(ios|android|web)$")


class AppPushTokenResponse(BaseModel):
    # token은 되돌려주지 않는다 — 기기 자격증명을 왕복시킬 이유가 없다
    id: str
    platform: str
    is_active: bool


class AppNotificationSettingItem(BaseModel):
    category: str  # "*" | assessment | counseling | system
    channel_in_app: bool
    channel_push: bool


class AppNotificationSettingUpdate(BaseModel):
    category: str = Field(default="*", max_length=30)
    channel_in_app: bool = True
    channel_push: bool = True


# #
# family (가족 초대 — 한 아이를 여러 어른이 본다)

class AppFamilyInvitationResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: str
    code: str
    expires_at: datetime
    created_at: datetime


class AppFamilyMemberItem(BaseModel):
    id: str
    person_id: str
    name: str | None = None
    role: str  # owner | member


class AppFamilyJoinRequest(BaseModel):
    code: str = Field(min_length=6, max_length=6)


class AppFamilyJoinResponse(BaseModel):
    family_id: str
    members: list[AppFamilyMemberItem] = []


# #
# billing (조회 전용 — 인앱 결제 없음)

class AppBillableResponse(BaseModel):
    id: str
    profile_id: str
    profile_name: str | None = None
    center_id: str
    center_name: str | None = None
    billable_date: date
    due_date: date | None = None
    status: str  # issued | paid | overdue (draft는 미노출)
    total_amount: int
    discount_amount: int
    subsidy_amount: int
    paid_amount: int
    unpaid_amount: int
    item_summary: str


class AppBillableItem(BaseModel):
    id: str
    description: str
    quantity: int
    unit_price: int
    amount: int
    related_type: str | None = None  # counseling* | assessment* (아이콘 분기)


class AppBillableDetailResponse(BaseModel):
    """청구서 상세(영수증) — 항목·금액·날짜·메모. 조회 전용."""

    id: str
    status: str
    billable_date: date
    issued_at: datetime | None = None
    total_amount: int
    discount_amount: int
    subsidy_amount: int
    paid_amount: int
    unpaid_amount: int
    memo: str | None = None
    items: list[AppBillableItem] = []


# #
# staff (센터 콘솔)

class AppInvitationIssueRequest(BaseModel):
    # 보호자 없는 내담자 본인 연결 — role=client를 both로 승격하고 본인에게 발급
    self_link: bool = False


class AppInvitationResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: str
    code: str
    expires_at: datetime
    created_at: datetime


class AppInvitationSmsResponse(BaseModel):
    # 마스킹된 수신 번호 (예: 010-****-5678)
    sent_to: str


class AppScheduleCancelRequest(BaseModel):
    reason: str | None = Field(default=None, max_length=500)


class AppScheduleCancelResponse(BaseModel):
    schedule_id: str


class AppAvailableSlotItem(BaseModel):
    time: str
    available: bool


class AppAvailableSlotsResponse(BaseModel):
    date: str
    slot_minutes: int
    duration_minutes: int
    slots: list[AppAvailableSlotItem]


class AppScheduleChangeRequestCreate(BaseModel):
    # 시작 시각만 받는다 — 소요 시간은 기존 일정에서 그대로 가져간다
    start_time: datetime
    reason: str | None = Field(default=None, max_length=500)


class AppScheduleChangeRequestResponse(BaseModel):
    request_id: str
    schedule_id: str
    status: str
    requested_start: datetime
    requested_end: datetime


class AppLinkedChildSummary(BaseModel):
    client_id: str
    name: str | None = None
    linked_at: datetime | None = None


class AppLinkStatusResponse(BaseModel):
    status: str  # none | invited | linked
    invitation: AppInvitationResponse | None = None
    linked_children: list[AppLinkedChildSummary] = []


# #
# records (원장)

class AppRecordCreateRequest(BaseModel):
    profile_id: str = Field(min_length=1)
    # 재전송 멱등 키 — 같은 값이면 기존 기록을 그대로 돌려준다
    client_key: str = Field(min_length=1, max_length=64)
    occurred_at: datetime
    mood: str = Field(pattern="^(excited|calm|neutral|sad|angry|anxious)$")
    body: str | None = Field(default=None, max_length=10000)
    private_memo: str | None = Field(default=None, max_length=10000)


class AppRecordUpdateRequest(BaseModel):
    occurred_at: datetime | None = None
    mood: str | None = Field(default=None, pattern="^(excited|calm|neutral|sad|angry|anxious)$")
    body: str | None = Field(default=None, max_length=10000)
    private_memo: str | None = Field(default=None, max_length=10000)


class AppRecordMoveRequest(BaseModel):
    target_profile_id: str = Field(min_length=1)


class AppRecordBookmarkRequest(BaseModel):
    bookmarked: bool


class AppRecordResponse(BaseModel):
    id: str
    profile_id: str
    occurred_at: datetime
    mood: str | None = None
    body: str | None = None
    # 작성자 본인에게만 실린다 — 타인 조회 시 None이 아니라 필드 자체가 빠진다(설계.md §15-6)
    private_memo: str | None = None
    bookmarked_at: datetime | None = None
    is_mine: bool
    author_name: str | None = None
    media: list["AppRecordMediaResponse"] = []

    @classmethod
    def of_entry(
        cls,
        entry,
        *,
        person_id: str,
        author_names: dict[str, str] | None = None,
        media: list["AppRecordMediaResponse"] | None = None,
    ) -> "AppRecordResponse":
        is_mine = entry.author_person_id == person_id
        return cls(
            id=entry.id,
            profile_id=entry.profile_id,
            occurred_at=entry.occurred_at,
            mood=entry.mood,
            body=entry.body,
            private_memo=entry.private_memo if is_mine else None,
            bookmarked_at=entry.bookmarked_at,
            is_mine=is_mine,
            author_name=(author_names or {}).get(entry.author_person_id),
            media=media or [],
        )


class AppRecordListResponse(BaseModel):
    items: list[AppRecordResponse]
    next_cursor: datetime | None = None


class AppRecordDateCountResponse(BaseModel):
    counts: dict[str, int]


class AppRecordMediaUploadRequest(BaseModel):
    media_type: str = Field(pattern="^(image|video)$")
    content_type: str = Field(min_length=1, max_length=100)
    # 영상만 필수 — 서버가 60초 상한을 예약 시점에 막는다
    duration_ms: int | None = Field(default=None, ge=1)


class AppRecordMediaCompleteRequest(BaseModel):
    checksum: str | None = Field(default=None, max_length=128)
    width: int | None = Field(default=None, ge=1)
    height: int | None = Field(default=None, ge=1)


class AppRecordMediaResponse(BaseModel):
    id: str
    media_type: str
    upload_status: str
    duration_ms: int | None = None
    width: int | None = None
    height: int | None = None
    url: str | None = None


class AppRecordMediaUploadResponse(BaseModel):
    media: AppRecordMediaResponse
    upload_url: str
    expires_in: int


AppRecordResponse.model_rebuild()
