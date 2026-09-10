import math
from datetime import datetime

from pydantic import BaseModel


class AdminAccountCenter(BaseModel):
    center_id: str
    center_name: str
    role_name: str
    status: str


class AdminAccountCredentialStats(BaseModel):
    # 계정의 자격 검증 통계 (목록 컬럼 노출용)
    #
    # is_certified 정책 (C안):
    # 자격증(credential_type=certification) 1개 이상 verified
    # AND 학력(credential_type=education) 1개 이상 verified
    total: int = 0
    pending: int = 0
    verified: int = 0
    rejected: int = 0

    # is_certified 판정용
    verified_certifications: int = 0
    verified_educations: int = 0
    is_certified: bool = False


class AdminAccountSummary(BaseModel):
    id: str
    email: str
    name: str | None
    phone: str | None
    provider: str
    is_active: bool
    is_verified: bool
    last_login_at: datetime | None
    created_at: datetime
    centers: list[AdminAccountCenter]
    credentials: AdminAccountCredentialStats = AdminAccountCredentialStats()


class AdminAccountDetailResponse(BaseModel):
    id: str
    email: str
    name: str | None
    phone: str | None
    provider: str
    is_active: bool
    is_verified: bool
    last_login_at: datetime | None
    created_at: datetime
    centers: list[AdminAccountCenter]
    credentials: AdminAccountCredentialStats = AdminAccountCredentialStats()


class AdminAccountListResponse(BaseModel):
    items: list[AdminAccountSummary]
    total: int
    page: int
    size: int
    pages: int

    @classmethod
    def build(
        cls,
        items: list[AdminAccountSummary],
        total: int,
        page: int,
        size: int,
    ) -> "AdminAccountListResponse":
        return cls(
            items=items,
            total=total,
            page=page,
            size=size,
            pages=math.ceil(total / size) if size > 0 else 0,
        )
