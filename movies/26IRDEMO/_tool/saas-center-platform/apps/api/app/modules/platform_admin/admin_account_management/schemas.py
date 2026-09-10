from datetime import datetime
from pydantic import BaseModel, ConfigDict, field_validator

from app.modules.platform_admin.admin_account.models import AdminRole
from app.modules.platform_admin.admin_account.schemas import validate_admin_password


# ─── Response ───

class AdminAccountSummary(BaseModel):
    id: str
    email: str
    name: str
    role: str
    is_active: bool
    last_login_at: datetime | None

    model_config = ConfigDict(from_attributes=True)


class AdminAccountDetail(BaseModel):
    id: str
    email: str
    name: str
    role: str
    is_active: bool
    failed_login_count: int
    locked_until: datetime | None
    last_login_at: datetime | None
    created_at: datetime
    updated_at: datetime

    model_config = ConfigDict(from_attributes=True)


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
        pages = max(1, -(-total // size))  # ceiling division
        return cls(items=items, total=total, page=page, size=size, pages=pages)


# ─── Request ───

class InviteAdminAccountRequest(BaseModel):
    email: str
    name: str
    role: str

    @field_validator("role")
    @classmethod
    def validate_role(cls, v: str) -> str:
        allowed = set(AdminRole.ALL)  # legacy(system_admin)는 할당 불가
        if v not in allowed:
            raise ValueError(f"초대 가능한 역할: {', '.join(sorted(allowed))}")
        return v


class InviteAdminAccountResponse(BaseModel):
    message: str
    invitation_link: str


class AcceptInvitationRequest(BaseModel):
    token: str
    password: str

    @field_validator("password")
    @classmethod
    def validate_password(cls, v: str) -> str:
        return validate_admin_password(v)


class UpdateAdminAccountRoleRequest(BaseModel):
    role: str

    @field_validator("role")
    @classmethod
    def validate_role(cls, v: str) -> str:
        allowed = set(AdminRole.ALL)  # legacy(system_admin)는 할당 불가
        if v not in allowed:
            raise ValueError(f"변경 가능한 역할: {', '.join(sorted(allowed))}")
        return v
