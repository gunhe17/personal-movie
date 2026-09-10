from dataclasses import dataclass
from datetime import datetime
from enum import Enum
from pydantic import BaseModel, Field, ConfigDict


class AccessAction(str, Enum):
    UPLOAD = "upload"
    DOWNLOAD = "download"
    DELETE = "delete"
    RESTORE = "restore"
    SHARE = "share"


class DocumentAccessCreate(BaseModel):
    document_id: str = Field(..., max_length=36, description="문서 ID (UUID)")
    s3_version_id: str | None = None
    account_id: str | None = Field(None, max_length=36, description="계정 ID (UUID)")
    action: AccessAction
    ip_address: str | None = Field(None, max_length=45)
    user_agent: str | None = None

    model_config = ConfigDict(
        json_schema_extra={
            "example": {
                "document_id": "550e8400-e29b-41d4-a716-446655440000",
                "s3_version_id": "v1a2b3c4d5e6f7g8h9",
                "account_id": "a1b2c3d4-e5f6-7g8h-9i0j-1k2l3m4n5o6p",
                "action": "download",
                "ip_address": "192.168.1.100",
                "user_agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) Chrome/120.0.0.0"
            }
        }
    )


class DocumentAccessResponse(BaseModel):
    id: str
    document_id: str
    s3_version_id: str | None
    account_id: str | None
    action: AccessAction
    ip_address: str | None
    user_agent: str | None
    accessed_at: datetime

    model_config = {"from_attributes": True}


class DocumentAccessSummary(BaseModel):
    id: str
    account_id: str | None
    action: AccessAction
    accessed_at: datetime

    model_config = {"from_attributes": True}


class DocumentAccessListResponse(BaseModel):
    items: list[DocumentAccessSummary]  # 목록은 Summary 사용
    total: int
    page: int
    size: int
    pages: int


@dataclass
class CreateAccessLogCommand:
    document_id: str
    s3_version_id: str | None
    account_id: str | None
    action: str  # Enum value (str)
    ip_address: str | None
    user_agent: str | None
