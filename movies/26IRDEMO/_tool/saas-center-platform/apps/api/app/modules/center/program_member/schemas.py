from datetime import datetime

from pydantic import BaseModel, Field, ConfigDict


class ProgramMemberAssign(BaseModel):
    member_ids: list[str] = Field(
        ..., min_length=1, description="배정할 멤버 ID 목록"
    )

    model_config = ConfigDict(
        json_schema_extra={
            "example": {
                "member_ids": [
                    "550e8400-e29b-41d4-a716-446655440001",
                    "550e8400-e29b-41d4-a716-446655440002",
                ]
            }
        }
    )


class ProgramMemberResponse(BaseModel):
    id: str
    program_id: str
    member_id: str
    created_at: datetime

    model_config = {"from_attributes": True}


class ProgramMemberListResponse(BaseModel):
    items: list[ProgramMemberResponse]
    total: int
    page: int
    size: int
    pages: int
