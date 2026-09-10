from datetime import datetime
from pydantic import BaseModel, Field, model_validator, ConfigDict


class RoomCreate(BaseModel):
    name: str = Field(..., min_length=1, max_length=100)
    description: str | None = Field(None, max_length=500)
    memo: str | None = None
    thumbnail_url: str | None = Field(None, max_length=500)
    is_active: bool = True
    inactive_reason: str | None = Field(None, max_length=200)

    model_config = ConfigDict(
        json_schema_extra={
            "example": {
                "name": "1번 상담실",
                "description": "개인 상담 전용 공간입니다.",
                "memo": "조용한 환경 유지 필요",
                "thumbnail_url": "https://example.com/rooms/room1.jpg",
                "is_active": True
            }
        }
    )


class RoomUpdate(BaseModel):
    name: str | None = Field(None, min_length=1, max_length=100)
    description: str | None = Field(None, max_length=500)
    memo: str | None = None
    thumbnail_url: str | None = Field(None, max_length=500)
    is_active: bool | None = None
    inactive_reason: str | None = Field(None, max_length=200)

    @model_validator(mode="after")
    def validate_patch_nulls(self):
        if "name" in self.model_fields_set and self.name is None:
            raise ValueError("name cannot be null (omit the field to keep unchanged)")
        if "is_active" in self.model_fields_set and self.is_active is None:
            raise ValueError(
                "is_active cannot be null (omit the field to keep unchanged)"
            )
        return self

    model_config = ConfigDict(
        json_schema_extra={
            "example": {
                "name": "VIP 상담실",
                "description": "고급 인테리어의 프리미엄 상담 공간입니다.",
                "is_active": True
            }
        }
    )


class RoomResponse(BaseModel):
    id: str
    center_id: str
    name: str
    description: str | None
    memo: str | None
    thumbnail_url: str | None
    is_active: bool
    inactive_reason: str | None
    created_at: datetime
    updated_at: datetime

    model_config = {"from_attributes": True}


class RoomSummary(BaseModel):
    id: str
    name: str
    is_active: bool
    thumbnail_url: str | None
    description: str | None
    memo: str | None

    model_config = {"from_attributes": True}
