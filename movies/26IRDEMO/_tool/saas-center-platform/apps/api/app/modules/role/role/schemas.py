from datetime import datetime
from pydantic import BaseModel, Field

from .models import RoleAccessLevel, RoleCode

__all__ = ["RoleCode", "RoleAccessLevel", "RoleResponse", "RoleSummary", "RoleCreate", "RoleUpdate"]


class RoleResponse(BaseModel):
    id: str
    code: str
    name: str
    description: str | None
    created_at: datetime
    updated_at: datetime

    model_config = {"from_attributes": True}


class RoleSummary(BaseModel):
    id: str
    code: str
    name: str

    model_config = {"from_attributes": True}


class RoleCreate(BaseModel):
    name: str = Field(..., min_length=1, max_length=100)
    description: str | None = Field(None, max_length=500)
    permission_ids: list[int] = Field(..., description="권한 ID 목록")
    access_level: RoleAccessLevel = Field(RoleAccessLevel.OWN, description="데이터 접근 범위: all(전체) | own(담당만)")


class RoleUpdate(BaseModel):
    name: str | None = Field(None, min_length=1, max_length=100)
    description: str | None = Field(None, max_length=500)
    permission_ids: list[int] = Field(..., description="권한 ID 목록")
    access_level: RoleAccessLevel | None = Field(None, description="데이터 접근 범위: all(전체) | own(담당만)")
    expected_version: int | None = Field(None, description="낙관적 동시성 가드 (생략 시 미적용)")
