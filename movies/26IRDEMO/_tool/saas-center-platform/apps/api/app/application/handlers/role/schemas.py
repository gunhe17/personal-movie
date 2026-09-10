from datetime import datetime

from pydantic import BaseModel, Field


class RoleSummaryWithCount(BaseModel):
    id: str
    code: str
    name: str
    is_preset: bool
    member_count: int = 0
    access_level: str


class AssignRoleMembersRequest(BaseModel):
    member_ids: list[str] = Field(..., min_length=1)


class MemberRoleChangeResult(BaseModel):
    member_id: str
    previous_role_code: str
    previous_role_name: str
    new_role_code: str
    new_role_name: str
    person_name: str


class AssignRoleMembersResponse(BaseModel):
    changed_count: int
    results: list[MemberRoleChangeResult]


class RoleMemberSummary(BaseModel):
    id: str
    name: str
    email: str | None = None
    last_login_at: datetime | None = None
    is_active: bool


class RoleMemberListResponse(BaseModel):
    items: list[RoleMemberSummary]
    total: int
    page: int
    size: int
    pages: int
