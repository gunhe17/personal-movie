from datetime import datetime, date
from enum import Enum
from pydantic import BaseModel, Field, model_validator, field_validator, ConfigDict

from app.modules.person.credential.schemas import CredentialResponse




class MemberStatus(str, Enum):
    ACTIVE = "active"      # 활성 상태
    INACTIVE = "inactive"  # 비활성 (퇴사, 휴직 등)


class EmploymentType(str, Enum):
    FULLTIME = "FULLTIME"  # 정규직
    CONTRACT = "CONTRACT"  # 계약직
    FREELANCER = "FREELANCER"  # 프리랜서


# 유효한 고용 유형 값 목록
EMPLOYMENT_TYPES = {"FULLTIME", "CONTRACT", "FREELANCER"}


class MemberCreate(BaseModel):
    # 멤버 생성 (내부용 - 초대 수락 시)
    #
    # Note: permissions는 Role에서 동적 조회되므로 Member에 저장하지 않음

    person_id: str  # UUID
    role_id: str
    employment_type: str
    profile_image_url: str | None = Field(None, max_length=500)
    memo: str | None = None
    careers: list[str] | None = Field(None, description="경력 목록 (문자열 배열)")
    educations: list[str] | None = Field(None, description="학력 목록 (문자열 배열)")
    certifications: list[str] | None = Field(None, description="자격 목록 (문자열 배열)")

    @field_validator("employment_type")
    @classmethod
    def validate_employment_type(cls, v: str) -> str:
        if v not in EMPLOYMENT_TYPES:
            raise ValueError(f"employment_type은 {EMPLOYMENT_TYPES} 중 하나여야 합니다")
        return v


class MemberUpdate(BaseModel):
    # 멤버 수정
    #
    # Note: permissions는 Role에서 관리되므로 Member 수정 시 포함하지 않음
    # 권한 변경은 Role 관리 API를 통해 수행

    role_id: str | None = None
    employment_type: str | None = None
    hire_date: date | None = None
    profile_image_url: str | None = Field(None, max_length=500)
    memo: str | None = None
    careers: list[str] | None = Field(None, description="경력 목록 (문자열 배열)")
    educations: list[str] | None = Field(None, description="학력 목록 (문자열 배열)")
    certifications: list[str] | None = Field(None, description="자격 목록 (문자열 배열)")

    @field_validator("employment_type")
    @classmethod
    def validate_employment_type(cls, v: str | None) -> str | None:
        if v is not None and v not in EMPLOYMENT_TYPES:
            raise ValueError(f"employment_type은 {EMPLOYMENT_TYPES} 중 하나여야 합니다")
        return v

    @model_validator(mode="after")
    def validate_patch_nulls(self):
        if "role_id" in self.model_fields_set and self.role_id is None:
            raise ValueError("role_id cannot be null (omit the field to keep unchanged)")
        if "employment_type" in self.model_fields_set and self.employment_type is None:
            raise ValueError(
                "employment_type cannot be null (omit the field to keep unchanged)"
            )
        return self

    model_config = ConfigDict(
        json_schema_extra={
            "example": {
                "role_code": "COUNSELOR",
                "employment_type": "FULLTIME",
                "memo": "10년 경력의 상담 전문가",
                "careers": [
                    "서울심리상담센터 상담부 수석 상담사 (2018.03 - 2023.12)",
                ],
                "educations": [
                    "서울대학교 심리학과 석사 (2014.03 - 2016.02)",
                ],
                "certifications": [
                    "임상심리사 1급 (한국산업인력공단, 2016.06)",
                ],
            }
        }
    )


class PersonSummary(BaseModel):
    name: str
    phone: str | None
    gender: str | None = None
    email: str | None = None

    model_config = {"from_attributes": True}


class PersonDetail(BaseModel):
    id: str
    name: str
    phone: str | None
    gender: str | None
    birth: date | None
    email: str | None = None

    model_config = {"from_attributes": True}


class MemberResponse(BaseModel):
    # 멤버 상세 응답 (내부용)
    #
    # Note: permissions는 Role에서 동적 조회 (/me/permissions API 사용)

    id: str
    center_id: str
    person_id: str
    role_id: str
    status: str
    employment_type: str
    hire_date: date | None = None
    profile_image_url: str | None
    color: str | None = None
    memo: str | None
    careers: list[str] | None
    educations: list[str] | None
    certifications: list[str] | None
    created_at: datetime
    updated_at: datetime

    @field_validator("employment_type")
    @classmethod
    def validate_employment_type(cls, v: str) -> str:
        if v not in EMPLOYMENT_TYPES:
            raise ValueError(f"employment_type은 {EMPLOYMENT_TYPES} 중 하나여야 합니다")
        return v

    model_config = {"from_attributes": True}


class MemberDetailResponse(BaseModel):
    # 멤버 상세 응답 (API 응답용 - Person 정보 포함)
    #
    # Note: permissions는 Role에서 동적 조회 (/me/permissions API 사용)

    id: str
    center_id: str
    person_id: str
    role_code: str
    role_name: str
    status: str
    employment_type: str
    hire_date: date | None = None
    profile_image_url: str | None
    memo: str | None
    careers: list[str] | None
    educations: list[str] | None
    certifications: list[str] | None
    is_certified: bool = False  # Person.is_certified 캐시 컬럼 미러
    created_at: datetime
    updated_at: datetime
    person: PersonDetail  # Person 상세 정보 (email 포함)

    @field_validator("employment_type")
    @classmethod
    def validate_employment_type(cls, v: str) -> str:
        if v not in EMPLOYMENT_TYPES:
            raise ValueError(f"employment_type은 {EMPLOYMENT_TYPES} 중 하나여야 합니다")
        return v


class MemberWithPerson(BaseModel):
    # 멤버 + Person 정보 (목록용)
    #
    # Note: permissions는 Role에서 동적 조회 (/me/permissions API 사용)

    id: str
    role_id: str
    employment_type: str
    profile_image_url: str | None
    color: str | None = None
    certifications: list[str] | None
    person: PersonSummary

    @field_validator("employment_type")
    @classmethod
    def validate_employment_type(cls, v: str) -> str:
        if v not in EMPLOYMENT_TYPES:
            raise ValueError(f"employment_type은 {EMPLOYMENT_TYPES} 중 하나여야 합니다")
        return v

    model_config = {"from_attributes": True}


class MemberSummary(BaseModel):
    id: str
    person_id: str
    role_id: str
    employment_type: str
    color: str | None = None

    @field_validator("employment_type")
    @classmethod
    def validate_employment_type(cls, v: str) -> str:
        if v not in EMPLOYMENT_TYPES:
            raise ValueError(f"employment_type은 {EMPLOYMENT_TYPES} 중 하나여야 합니다")
        return v

    model_config = {"from_attributes": True}


class MemberListSummary(BaseModel):
    id: str
    role_code: str
    role_name: str
    status: str
    employment_type: str
    color: str | None = None
    memo: str | None
    is_active: bool
    person: PersonSummary
    # 프로필 이미지 URL (업로드 사진 또는 기본 아바타). 목록 카드 아바타용
    profile_image_url: str | None = None
    # 인증된 전문가 여부 (Person credentials 기준, 백엔드 정책)
    is_certified: bool = False
    # 센터 등록 시점 (목록 '등록일' 컬럼용)
    created_at: datetime

    @field_validator("employment_type")
    @classmethod
    def validate_employment_type(cls, v: str) -> str:
        if v not in EMPLOYMENT_TYPES:
            raise ValueError(f"employment_type은 {EMPLOYMENT_TYPES} 중 하나여야 합니다")
        return v

    model_config = {"from_attributes": True}


class MeMemberResponse(BaseModel):
    id: str  # member_id
    name: str  # person.name


class MemberListResponse(BaseModel):
    items: list[MemberListSummary]
    total: int
    page: int
    size: int
    pages: int


class MemberCredentialsLegacy(BaseModel):
    educations: list[str] = []
    careers: list[str] = []
    certifications: list[str] = []


class MemberCredentialsResponse(BaseModel):
    # 멤버 자격 정보 응답
    #
    # - 본인 조회: 모든 status 항목 + legacy 함께
    # - 다른 사람 조회: verified만, legacy는 비어있음

    structured: list[CredentialResponse]
    legacy: MemberCredentialsLegacy
    is_self: bool


class MonthlySessionMetric(BaseModel):
    # 이번 달 세션 지표 (완료/예정 분해 + 지난달 대비)
    #
    # - completed: 이번 달 완료된 세션 수
    # - scheduled: 이번 달 예정된(아직 미완료) 세션 수
    # - total: 이번 달 잡힌 전체 세션 수 (취소·노쇼 포함)
    # - prev_total: 지난 달 잡힌 전체 세션 수 (증감 비교용)

    completed: int
    scheduled: int
    total: int
    prev_total: int


class MemberMetricsResponse(BaseModel):
    # 구성원 활동 지표 응답 (상세 패널 요약용)
    #
    # - assigned_clients_count: 담당 케이스의 활성 내담자 수 (중복 제거)
    # - counseling: 이번 달 상담 세션 지표 (완료/예정 분해)
    # - assessment: 이번 달 검사 세션 지표 (완료/예정 분해)
    #
    # '이번 달' 기준은 Schedule.start (KST) — 예정 포함 전체.

    assigned_clients_count: int
    counseling: MonthlySessionMetric
    assessment: MonthlySessionMetric
