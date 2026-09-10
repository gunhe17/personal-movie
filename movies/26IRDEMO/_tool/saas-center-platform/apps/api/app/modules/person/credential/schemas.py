from datetime import date, datetime
from typing import Literal

from .models import CredentialStatus, CredentialType
from pydantic import BaseModel, ConfigDict, Field, model_validator


EducationDegree = Literal["bachelor", "master", "doctorate", "other"]


# Metadata (kind별 추가 필드)

class EducationMeta(BaseModel):
    major: str = Field(..., min_length=1, max_length=100, description="전공")
    degree: EducationDegree = Field(..., description="학위 (bachelor/master/doctorate/other)")


class CareerMeta(BaseModel):
    position: str = Field(..., min_length=1, max_length=100, description="직책")


class CertificationMeta(BaseModel):
    certificate_number: str = Field(
        ..., min_length=1, max_length=100, description="자격증 번호",
    )


# Attachment 응답

class CredentialAttachment(BaseModel):
    url: str
    filename: str
    content_type: str
    size: int


# Verification 응답

class CredentialVerification(BaseModel):
    status: CredentialStatus
    requested_at: datetime | None = None
    reviewed_at: datetime | None = None
    reviewed_by: str | None = None
    reject_reason: str | None = None


# 요청 스키마

class CredentialCreate(BaseModel):
    # Credential 생성 요청
    #
    # kind에 따라 metadata 구조가 달라진다 (model_validator에서 검증).
    credential_type: CredentialType = Field(..., description="종류 (education/career/certification)")
    title: str = Field(..., min_length=1, max_length=200, description="제목")
    organization: str = Field(..., min_length=1, max_length=200, description="소속 기관")
    description: str | None = Field(None, description="부가 설명")

    start_date: date | None = Field(None, description="시작일 (입학/입사/발급)")
    end_date: date | None = Field(None, description="종료일 (졸업/퇴사/만료)")
    is_current: bool = Field(False, description="재학·재직 중 여부 (자격증은 항상 False)")

    meta: dict = Field(..., description="kind별 추가 필드 (degree/position/certificate_number)")

    @model_validator(mode="after")
    def validate_by_kind(self):
        # 자격증은 재직 개념 없음
        if self.credential_type == "certification" and self.is_current:
            raise ValueError("자격증은 is_current=True가 될 수 없습니다")

        # 종료일이 시작일보다 빠르면 안 됨
        if self.start_date and self.end_date and self.end_date < self.start_date:
            raise ValueError("종료일은 시작일보다 빠를 수 없습니다")

        # is_current=True이면 end_date는 None이어야 함
        if self.is_current and self.end_date is not None:
            raise ValueError("재학/재직 중이면 종료일은 비어 있어야 합니다")

        # kind별 metadata 검증 (Pydantic으로 파싱하면서 자동 검증)
        if self.credential_type == "education":
            EducationMeta(**self.meta)
        elif self.credential_type == "career":
            CareerMeta(**self.meta)
        elif self.credential_type == "certification":
            CertificationMeta(**self.meta)

        return self

    model_config = ConfigDict(
        json_schema_extra={
            "examples": [
                {
                    "credential_type": "education",
                    "title": "심리학과 학사",
                    "organization": "서울대학교",
                    "start_date": "2015-03-01",
                    "end_date": "2019-02-28",
                    "is_current": False,
                    "meta": {"major": "심리학과", "degree": "bachelor"},
                },
                {
                    "credential_type": "career",
                    "title": "선임상담사",
                    "organization": "○○상담센터",
                    "description": "성인 정신건강 상담",
                    "start_date": "2020-03-01",
                    "is_current": True,
                    "meta": {"position": "선임상담사"},
                },
                {
                    "credential_type": "certification",
                    "title": "임상심리사 1급",
                    "organization": "한국심리학회",
                    "start_date": "2020-08-15",
                    "is_current": False,
                    "meta": {"certificate_number": "제2020-12345호"},
                },
            ]
        }
    )


class CredentialUpdate(BaseModel):
    # Credential 부분 수정 요청
    #
    # kind는 변경 불가. metadata는 전체를 새 값으로 덮어쓴다 (부분 머지 X).
    # 수정 시 status는 자동으로 'unverified'로 리셋 (Service에서 처리).
    title: str | None = Field(None, min_length=1, max_length=200)
    organization: str | None = Field(None, min_length=1, max_length=200)
    description: str | None = None

    start_date: date | None = None
    end_date: date | None = None
    is_current: bool | None = None

    meta: dict | None = None

    @model_validator(mode="after")
    def validate_dates(self):
        if self.start_date and self.end_date and self.end_date < self.start_date:
            raise ValueError("종료일은 시작일보다 빠를 수 없습니다")
        if self.is_current is True and self.end_date is not None:
            raise ValueError("재학/재직 중이면 종료일은 비어 있어야 합니다")
        return self


class CredentialRejectRequest(BaseModel):
    reason: str = Field(..., min_length=1, max_length=1000, description="반려 사유")


# 응답 스키마

class CredentialResponse(BaseModel):
    id: str
    person_id: str
    credential_type: CredentialType

    title: str
    organization: str
    description: str | None

    start_date: date | None
    end_date: date | None
    is_current: bool

    meta: dict | None = None

    attachment: CredentialAttachment | None = None
    verification: CredentialVerification

    created_at: datetime
    updated_at: datetime

    model_config = ConfigDict(from_attributes=True)

    @classmethod
    def from_orm_model(cls, m) -> "CredentialResponse":
        """ORM 모델을 응답 DTO로 변환

        attachment_* 컬럼과 verification_* 컬럼을 중첩 객체로 묶는다.
        """
        attachment = None
        if m.attachment_url:
            attachment = CredentialAttachment(
                url=m.attachment_url,
                filename=m.attachment_filename or "",
                content_type=m.attachment_content_type or "",
                size=m.attachment_size or 0,
            )

        return cls(
            id=m.id,
            person_id=m.person_id,
            credential_type=m.credential_type,
            title=m.title,
            organization=m.organization,
            description=m.description,
            start_date=m.start_date,
            end_date=m.end_date,
            is_current=m.is_current,
            meta=m.meta,
            attachment=attachment,
            verification=CredentialVerification(
                status=m.status,
                requested_at=m.requested_at,
                reviewed_at=m.reviewed_at,
                reviewed_by=m.reviewed_by,
                reject_reason=m.reject_reason,
            ),
            created_at=m.created_at,
            updated_at=m.updated_at,
        )


# Stats + 목록 응답 (인증 정책은 백엔드에서만 판정)

class CredentialStats(BaseModel):
    # Credential 통계 (목록 응답에 함께 내려감)
    #
    # is_certified 정책 (C안): 자격증 ≥1 verified AND 학력 ≥1 verified
    # 백엔드 한 곳에서만 판정 — 프론트는 이 값을 그대로 사용.
    total: int = 0
    pending: int = 0
    verified: int = 0
    rejected: int = 0
    verified_certifications: int = 0
    verified_educations: int = 0
    is_certified: bool = False


class CredentialListResponse(BaseModel):
    items: list[CredentialResponse]
    stats: CredentialStats
