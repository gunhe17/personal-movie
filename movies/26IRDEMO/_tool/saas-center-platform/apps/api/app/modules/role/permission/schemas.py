from dataclasses import dataclass
from datetime import datetime
from pydantic import BaseModel, Field



class PermissionUpdate(BaseModel):
    name: str | None = Field(None, min_length=1, max_length=100, description="권한 이름")
    description: str | None = Field(None, max_length=500, description="권한 설명")
    category: str | None = Field(None, min_length=1, max_length=50, description="카테고리")
    is_new: bool | None = Field(None, description="신규 권한 여부")


class PermissionResponse(BaseModel):
    id: int
    code: str
    name: str
    description: str | None
    category: str
    is_new: bool
    added_at: datetime
    created_at: datetime
    updated_at: datetime

    model_config = {"from_attributes": True}


class PermissionSummary(BaseModel):
    id: int
    code: str
    name: str
    category: str

    model_config = {"from_attributes": True}


@dataclass
class CreatePermissionCommand:
    code: str
    name: str
    description: str | None
    category: str


@dataclass
class UpdatePermissionCommand:
    name: str | None = None
    description: str | None = None
    category: str | None = None
    is_new: bool | None = None
