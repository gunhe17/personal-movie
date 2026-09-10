from datetime import datetime
from enum import Enum
from pydantic import BaseModel, Field, ConfigDict

from ..member.schemas import EmploymentType
from app.modules.role.role.schemas import RoleCode


class InvitationStatus(str, Enum):
    PENDING = "pending"
    ACCEPTED = "accepted"
    EXPIRED = "expired"


class MemberInvitationCreate(BaseModel):
    # 멤버 초대 생성
    #
    # 최소 정보만 저장, 나머지는 수락(회원가입) 시 수집

    name: str = Field(..., min_length=1, max_length=100)
    email: str = Field(..., pattern=r"^[a-zA-Z0-9_.+-]+@[a-zA-Z0-9-]+\.[a-zA-Z0-9-.]+$")
    role_code: RoleCode = Field(..., description="역할 코드 (ADMIN/MANAGER/STAFF/COUNSELOR)")
    employment_type: EmploymentType = Field(
        ...,
        description="고용형태 (FULLTIME/CONTRACT/FREELANCER)"
    )

    model_config = ConfigDict(
        json_schema_extra={
            "example": {
                "name": "이상담",
                "email": "newcounselor@example.com",
                "role_code": "COUNSELOR",
                "employment_type": "FULLTIME"
            }
        }
    )


class MemberInvitationResponse(BaseModel):
    id: str
    center_id: str
    invited_by: str
    name: str
    email: str
    role_code: str
    role_name: str
    employment_type: str | None
    member_id: str | None
    accepted_at: datetime | None
    expires_at: datetime
    created_at: datetime


class MemberInvitationSummary(BaseModel):
    id: str
    name: str
    email: str
    role_code: str
    role_name: str
    employment_type: str | None
    member_id: str | None
    accepted_at: datetime | None
    expires_at: datetime
    created_at: datetime


# Bulk 관련 스키마
class MemberInvitationBulkCreate(BaseModel):
    items: list[MemberInvitationCreate] = Field(
        ..., min_length=1, max_length=20, description="초대 목록 (최대 20명)"
    )

    model_config = ConfigDict(
        json_schema_extra={
            "example": {
                "items": [
                    {
                        "name": "이상담",
                        "email": "counselor1@example.com",
                        "role_code": "COUNSELOR",
                        "employment_type": "FULLTIME",
                    },
                    {
                        "name": "박상담",
                        "email": "counselor2@example.com",
                        "role_code": "COUNSELOR",
                        "employment_type": "CONTRACT",
                    },
                ]
            }
        }
    )


class BulkInvitationResult(BaseModel):
    email: str
    success: bool
    invitation: MemberInvitationResponse | None = None
    error: str | None = None


class MemberInvitationBulkResponse(BaseModel):
    total: int = Field(..., description="전체 요청 수")
    success_count: int = Field(..., description="성공 수")
    failure_count: int = Field(..., description="실패 수")
    results: list[BulkInvitationResult] = Field(..., description="개별 결과")


class MemberInvitationListResponse(BaseModel):
    items: list[MemberInvitationSummary]
    total: int
    page: int
    size: int
    pages: int
