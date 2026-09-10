from datetime import datetime
from enum import Enum

from pydantic import BaseModel, Field, model_validator, ConfigDict


class ProgramType(str, Enum):
    INDIVIDUAL = "INDIVIDUAL"  # 개별
    GROUP = "GROUP"  # 그룹


class ProgramCreate(BaseModel):
    name: str = Field(..., min_length=1, max_length=100, description="프로그램명")
    member_ids: list[str] = Field(..., min_length=1, description="담당자 멤버 ID 목록")
    program_type: ProgramType = Field(..., description="프로그램 유형")
    description: str | None = Field(None, max_length=1000, description="프로그램 설명")
    price: int = Field(..., ge=0, le=100_000_000, description="가격 (원, 최대 1억)")
    duration_minutes: int = Field(..., ge=1, le=480, description="소요시간 (분)")

    model_config = ConfigDict(
        json_schema_extra={
            "example": {
                "name": "언어치료",
                "member_ids": ["member-uuid-1", "member-uuid-2"],
                "program_type": "INDIVIDUAL",
                "price": 30000,
                "duration_minutes": 120,
            }
        }
    )


class ProgramUpdate(BaseModel):
    name: str | None = Field(None, min_length=1, max_length=100, description="프로그램명")
    program_type: ProgramType | None = Field(None, description="프로그램 유형")
    description: str | None = Field(None, max_length=1000, description="프로그램 설명")
    price: int | None = Field(None, ge=0, le=100_000_000, description="가격 (원, 최대 1억)")
    duration_minutes: int | None = Field(
        None, ge=1, le=480, description="기본 상담 시간 (분)"
    )
    is_active: bool | None = None
    member_ids: list[str] | None = Field(
        None, description="담당자 멤버 ID 목록 (전달 시 전체 교체, 빈 목록이면 전원 해제)"
    )

    @model_validator(mode="after")
    def validate_patch_nulls(self):
        if "name" in self.model_fields_set and self.name is None:
            raise ValueError("name cannot be null (omit the field to keep unchanged)")
        if "program_type" in self.model_fields_set and self.program_type is None:
            raise ValueError(
                "program_type cannot be null (omit the field to keep unchanged)"
            )
        if "is_active" in self.model_fields_set and self.is_active is None:
            raise ValueError(
                "is_active cannot be null (omit the field to keep unchanged)"
            )
        return self

    model_config = ConfigDict(
        json_schema_extra={
            "example": {
                "price": 35000,
                "duration_minutes": 90,
            }
        }
    )


class ProgramResponse(BaseModel):
    id: str
    center_id: str
    name: str
    program_type: ProgramType
    description: str | None
    price: int
    duration_minutes: int
    is_active: bool
    created_at: datetime
    updated_at: datetime

    model_config = {"from_attributes": True}


class ProgramMemberSummary(BaseModel):
    member_id: str
    name: str

    model_config = {"from_attributes": True}


class ProgramSummary(BaseModel):
    id: str
    name: str
    program_type: ProgramType
    price: int
    duration_minutes: int
    is_active: bool
    members: list[ProgramMemberSummary] = []

    model_config = {"from_attributes": True}


class ProgramListResponse(BaseModel):
    items: list[ProgramSummary]
    total: int
    page: int
    size: int
    pages: int
