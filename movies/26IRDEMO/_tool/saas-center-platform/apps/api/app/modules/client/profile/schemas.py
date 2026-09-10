from datetime import date, datetime
from enum import Enum
from pydantic import BaseModel, Field, field_validator, model_validator
import re


class ClientRole(str, Enum):
    CLIENT = "client"  # 상담 대상 (내담자만)
    GUARDIAN = "guardian"  # 보호자만
    BOTH = "both"  # 보호자이면서 내담자


class ClientStatus(str, Enum):
    ACTIVE = "active"  # 활성 상태
    INACTIVE = "inactive"  # 상담 종료, 장기 미방문 (6개월 이내)
    ARCHIVED = "archived"  # 장기 미방문 (6개월 이상)


class Gender(str, Enum):
    MALE = "male"
    FEMALE = "female"


class ClientCreate(BaseModel):
    person_id: str | None = Field(None, description="연동된 Person UUID")
    role: ClientRole = Field(..., description="역할")
    name: str = Field(..., min_length=1, max_length=100, description="이름")
    birth_date: date | None = Field(None, description="생년월일")
    gender: Gender | None = Field(None, description="성별")
    phone: str | None = Field(None, min_length=1, max_length=20, description="전화번호")
    email: str | None = Field(None, max_length=100, description="이메일")
    address: str | None = Field(None, max_length=500, description="주소")
    profile_image_url: str | None = Field(
        None,
        max_length=500,
        description="프로필 이미지 URL (미지정 시 성별 매칭 기본 아바타 자동 배정)",
    )
    status: ClientStatus = Field(default=ClientStatus.ACTIVE, description="상태")
    memo: str | None = Field(None, max_length=2000, description="메모")

    model_config = {
        "json_schema_extra": {
            "examples": [
                {
                    "person_id": None,
                    "role": "client",
                    "name": "김민준",
                    "birth_date": "2015-03-15",
                    "gender": "male",
                    "phone": "010-1234-5678",
                    "email": None,
                    "address": "서울특별시 강남구 테헤란로 123",
                    "status": "active",
                    "memo": "ADHD 진단 후 첫 상담 예정",
                },
                {
                    "person_id": "550e8400-e29b-41d4-a716-446655440000",
                    "role": "guardian",
                    "name": "김서연",
                    "birth_date": "1985-07-20",
                    "gender": "female",
                    "phone": "010-9876-5432",
                    "email": "kim.seoyeon@example.com",
                    "address": "서울특별시 강남구 테헤란로 123",
                    "status": "active",
                    "memo": "김민준(자녀)의 주 보호자",
                },
            ]
        }
    }

    @field_validator("phone")
    @classmethod
    def validate_phone(cls, v: str | None) -> str | None:
        if v and not re.match(r"^[\d-]+$", v):
            raise ValueError("전화번호는 숫자와 하이픈(-)만 포함해야 합니다")
        return v

    @field_validator("birth_date")
    @classmethod
    def validate_birth_date(cls, v: date | None) -> date | None:
        if v and v > date.today():
            raise ValueError("생년월일은 미래 날짜일 수 없습니다")
        return v


class ClientUpdate(BaseModel):
    role: ClientRole | None = None
    name: str | None = Field(None, min_length=1, max_length=100)
    birth_date: date | None = None
    gender: Gender | None = None
    phone: str | None = Field(None, min_length=1, max_length=20)
    email: str | None = Field(None, max_length=100)
    address: str | None = Field(None, max_length=500)
    profile_image_url: str | None = Field(
        None, max_length=500, description="프로필 이미지 URL"
    )
    status: ClientStatus | None = None
    memo: str | None = Field(None, max_length=2000)

    @model_validator(mode="after")
    def validate_patch_nulls(self):
        for field in ("role", "name", "status"):
            if field in self.model_fields_set and getattr(self, field) is None:
                raise ValueError(
                    f"{field} cannot be null (omit the field to keep unchanged)"
                )
        return self

    model_config = {
        "json_schema_extra": {
            "examples": [
                {
                    "phone": "010-8888-9999",
                    "email": "updated.email@example.com",
                    "address": "서울특별시 서초구 서초대로 78길 15",
                    "memo": "연락처 변경됨. 다음 상담 일정 조율 필요",
                },
                {"status": "inactive", "memo": "상담 종료 - 증상 호전으로 졸업"},
            ]
        }
    }

    @field_validator("phone")
    @classmethod
    def validate_phone(cls, v: str | None) -> str | None:
        if v and not re.match(r"^[\d-]+$", v):
            raise ValueError("전화번호는 숫자와 하이픈(-)만 포함해야 합니다")
        return v

    @field_validator("birth_date")
    @classmethod
    def validate_birth_date(cls, v: date | None) -> date | None:
        if v and v > date.today():
            raise ValueError("생년월일은 미래 날짜일 수 없습니다")
        return v


class ClientResponse(BaseModel):
    id: str
    code: str
    center_id: str
    person_id: str | None
    role: str
    name: str
    birth_date: date | None
    gender: str | None
    phone: str | None
    email: str | None
    address: str | None
    profile_image_url: str | None = None
    status: str
    memo: str | None
    deleted_at: datetime | None
    created_at: datetime
    updated_at: datetime
    # 현재 요청자(상담사)가 해당 내담자를 관심 표시했는지 — get 응답에서 채워짐
    is_favorited: bool = False

    model_config = {"from_attributes": True}


class ClientVoucherBrief(BaseModel):
    name: str = Field(description="바우처명")
    remaining_sessions: int = Field(description="잔여 회기")
    total_sessions: int = Field(description="총 회기")


class ClientSummary(BaseModel):
    id: str
    code: str
    name: str
    role: str
    phone: str | None
    status: str
    birth_date: date | None = None
    gender: str | None = None
    profile_image_url: str | None = None
    memo: str | None = None
    created_at: datetime | None = None
    # 아동의 대표 보호자 — list 응답에서 관계 조합으로 채움. 없으면 None.
    guardian_name: str | None = None
    guardian_relationship: str | None = None
    # 현재 요청자(상담사)가 해당 내담자를 관심 표시했는지 — list 응답에서만 채워짐
    is_favorited: bool = False
    # 다음 예정 회기 시작 시각(UTC naive) — list 응답에서 항상 채워짐.
    next_session_at: datetime | None = None
    # 보유 바우처 — list 응답에서 cross-module 조합으로 채움.
    # 가장 활성인 1개를 voucher_primary로, 보유 개수를 voucher_count로,
    # 전체 목록(툴팁용)을 vouchers로 제공. 없으면 None / 0 / [].
    voucher_primary: ClientVoucherBrief | None = None
    voucher_count: int = 0
    vouchers: list[ClientVoucherBrief] = []

    model_config = {"from_attributes": True}


class ClientListResponse(BaseModel):
    items: list[ClientSummary]
    total: int
    page: int
    size: int
    pages: int


class ClientSearchParams(BaseModel):
    center_id: str
    phone: str | None = None
    role: ClientRole | None = None
    status: ClientStatus | None = None
    name: str | None = None


class ClientWithRelationsSummary(BaseModel):
    id: str
    code: str
    name: str
    role: str
    phone: str | None
    primary_guardian_phone: str | None = Field(
        None, description="주 보호자 연락처 (아동용)"
    )
    status: str

    # 역할 및 우선순위
    active_roles: list[str] = Field(
        default_factory=list,
        description="활성화된 역할 (뱃지용): child_client, adult_client, guardian, client",
    )
    priority: int = Field(
        default=2, description="우선순위 (정렬용): 1=내담자, 2=보호자만"
    )

    # 메모
    memo: str | None = None

    # 관계 수
    guardian_count: int = Field(default=0, description="보호자 수")
    child_count: int = Field(default=0, description="자녀 수")
    sibling_count: int = Field(default=0, description="형제자매 수")

    model_config = {"from_attributes": True}


class ClientWithRelationsListResponse(BaseModel):
    items: list[ClientWithRelationsSummary]
    total: int
    page: int
    size: int
    pages: int


class GuardianInput(BaseModel):
    existing_client_id: str | None = Field(
        None, description="기존 보호자 Client ID (재사용)"
    )
    name: str = Field(..., min_length=1, max_length=100, description="이름")
    birth_date: date | None = Field(None, description="생년월일")
    gender: Gender | None = Field(None, description="성별")
    phone: str = Field(..., min_length=1, max_length=20, description="전화번호")
    email: str | None = Field(None, max_length=100, description="이메일")
    address: str | None = Field(None, max_length=500, description="주소")
    relation_type: str = Field(default="parent", description="관계 유형 (parent)")
    relation_detail: str | None = Field(
        None,
        description="관계 상세 (guardian만): mother, father, grandmother, grandfather, aunt, uncle, caregiver 등",
    )
    is_primary: bool = Field(..., description="주 보호자 여부")
    memo: str | None = Field(None, max_length=2000, description="메모")

    @field_validator("phone")
    @classmethod
    def validate_phone(cls, v: str) -> str:
        if not re.match(r"^[\d-]+$", v):
            raise ValueError("전화번호는 숫자와 하이픈(-)만 포함해야 합니다")
        return v


class ChildInput(BaseModel):
    name: str = Field(..., min_length=1, max_length=100, description="이름")
    birth_date: date = Field(..., description="생년월일")
    gender: Gender = Field(..., description="성별")
    phone: str | None = Field(None, min_length=1, max_length=20, description="연락처")
    memo: str | None = Field(None, max_length=2000, description="메모")

    @field_validator("phone")
    @classmethod
    def validate_phone(cls, v: str | None) -> str | None:
        if v and not re.match(r"^[\d-]+$", v):
            raise ValueError("전화번호는 숫자와 하이픈(-)만 포함해야 합니다")
        return v

    @field_validator("birth_date")
    @classmethod
    def validate_birth_date(cls, v: date) -> date:
        if v > date.today():
            raise ValueError("생년월일은 미래 날짜일 수 없습니다")
        return v


class CreateClientsRequest(BaseModel):
    guardians: list[GuardianInput] = Field(..., min_length=1, description="보호자 목록")
    children: list[ChildInput] = Field(..., min_length=1, description="자녀 목록")

    model_config = {
        "json_schema_extra": {
            "example": {
                "guardians": [
                    {
                        "name": "박엄마",
                        "phone": "010-2222-3333",
                        "relation_type": "parent",
                        "is_primary": True,
                    },
                    {
                        "name": "박아빠",
                        "phone": "010-2222-4444",
                        "relation_type": "parent",
                        "is_primary": False,
                    },
                ],
                "children": [
                    {"name": "박첫째", "birth_date": "2014-05-01", "gender": "male"},
                    {"name": "박둘째", "birth_date": "2017-09-15", "gender": "female"},
                ],
            }
        }
    }


class BatchRelationsSummary(BaseModel):
    client_relations: int = Field(..., description="생성된 ClientRelation 개수")
    sibling_relations: int = Field(..., description="생성된 SiblingRelation 개수")


class CreateClientsResponse(BaseModel):
    guardians: list[ClientResponse] = Field(..., description="생성된 보호자 목록")
    children: list[ClientResponse] = Field(..., description="생성된 자녀 목록")
    relations: BatchRelationsSummary = Field(..., description="생성된 관계 요약")


# 배치 수정 (내담자 + 보호자 동시 수정)


class GuardianUpdateInput(BaseModel):
    client_id: str | None = Field(
        None, description="기존 보호자 Client ID (None이면 신규 추가)"
    )
    name: str = Field(..., min_length=1, max_length=100, description="이름")
    birth_date: date | None = Field(None, description="생년월일")
    gender: Gender | None = Field(None, description="성별")
    phone: str = Field(..., min_length=1, max_length=20, description="전화번호")
    email: str | None = Field(None, max_length=100, description="이메일")
    address: str | None = Field(None, max_length=500, description="주소")
    relation_detail: str | None = Field(
        None,
        description="관계 상세: mother, father, grandmother, grandfather, aunt, uncle, caregiver 등",
    )
    is_primary: bool = Field(..., description="주 보호자 여부")
    memo: str | None = Field(None, max_length=2000, description="메모")

    @field_validator("phone")
    @classmethod
    def validate_phone(cls, v: str) -> str:
        if not re.match(r"^[\d-]+$", v):
            raise ValueError("전화번호는 숫자와 하이픈(-)만 포함해야 합니다")
        return v


class UpdateClientWithRelationsRequest(BaseModel):
    client: ClientUpdate = Field(..., description="내담자 프로필 수정 데이터")
    guardians: list[GuardianUpdateInput] = Field(
        default_factory=list,
        description="보호자 전체 목록 (화면에 표시된 상태 그대로 전송)",
    )


class UpdateClientWithRelationsChangesSummary(BaseModel):
    guardians_added: int = Field(default=0, description="추가된 보호자 수")
    guardians_updated: int = Field(default=0, description="수정된 보호자 수")
    guardians_removed: int = Field(
        default=0, description="제거된 보호자 수 (관계만 삭제)"
    )


class UpdateClientWithRelationsResponse(BaseModel):
    client: ClientResponse = Field(..., description="수정된 내담자")
    guardians: list[ClientResponse] = Field(..., description="현재 보호자 목록")
    changes: UpdateClientWithRelationsChangesSummary = Field(
        ..., description="변경 요약"
    )


# 중복 체크 (엑셀 일괄 등록 프리뷰용)


class DuplicateClientItem(BaseModel):
    name: str = Field(..., description="이름")
    birth_date: date | None = Field(None, description="생년월일 (없으면 체크 제외)")
    guardian_phone: str | None = Field(
        None, description="보호자 연락처 (high/low 구분용)"
    )
    guardian_birth_date: date | None = Field(
        None, description="보호자 생년월일 (high/low 구분용)"
    )


class ValidateDuplicateClientsRequest(BaseModel):
    clients: list[DuplicateClientItem] = Field(
        ..., min_length=1, description="체크할 내담자 목록"
    )


class MatchedClientInfo(BaseModel):
    id: str
    name: str
    birth_date: date | None
    phone: str | None
    created_at: datetime

    model_config = {"from_attributes": True}


class DuplicateClientResult(BaseModel):
    index: int = Field(..., description="요청 배열 인덱스")
    duplicate_level: str = Field(
        ...,
        description="중복 수준: 'high'(이름+생년월일+연락처 일치), 'low'(이름+생년월일 일치), 'none'(없음)",
    )
    matched_client: MatchedClientInfo | None = Field(
        None, description="매칭된 기존 내담자 정보"
    )


class ValidateDuplicateClientsResponse(BaseModel):
    results: list[DuplicateClientResult]


class AttendancePatternItem(BaseModel):
    session_id: str
    attendance_status: str = Field(
        ...,
        description="회기 출석 상태 (attended·absent·late·excused·no_show)",
    )
    session_at: datetime | None = Field(
        None,
        description="회기 시각 (completed_at 우선, 없으면 created_at 폴백)",
    )


class AttendancePatternResponse(BaseModel):
    items: list[AttendancePatternItem]
    total: int
    page: int
    size: int
    pages: int


class BillingSummaryResponse(BaseModel):
    unpaid_count: int = Field(..., description="미수 청구 건수 (status='pending')")
    unpaid_amount: int = Field(..., description="미수 합계 (원)")
    oldest_issued_at: datetime | None = Field(
        None,
        description="가장 오래된 미수 청구 발행일 (경과 일수 계산용)",
    )


class MonthlySessionMetric(BaseModel):
    completed: int = Field(0, description="이번 달 완료 세션 수")
    scheduled: int = Field(0, description="이번 달 예정(미완료) 세션 수")
    total: int = Field(0, description="이번 달 전체 세션 수 (취소·노쇼 포함)")
    prev_total: int = Field(0, description="지난 달 전체 세션 수 (증감 비교용)")


class ClientMetricsResponse(BaseModel):
    # 내담자 활동 요약 (상세 페이지 좌측 대시보드용).
    #
    # 내담자가 '받은' 상담/검사 관점의 집계. 구성원 지표(MemberMetrics)와
    # 대칭이되, 담당 내담자 수 대신 누적 케이스 수를 제공한다.

    counseling_case_count: int = Field(0, description="참여 중인 상담 케이스 누적 수")
    assessment_case_count: int = Field(0, description="참여 중인 검사 케이스 누적 수")
    counseling: MonthlySessionMetric = Field(..., description="이번 달 상담 세션 지표")
    assessment: MonthlySessionMetric = Field(..., description="이번 달 검사 세션 지표")
