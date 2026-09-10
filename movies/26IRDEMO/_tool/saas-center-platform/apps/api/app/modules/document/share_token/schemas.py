from dataclasses import dataclass
from datetime import datetime
from pydantic import BaseModel, Field, ConfigDict


class ShareTokenCreate(BaseModel):
    document_id: str
    created_by: str
    expires_at: datetime
    max_downloads: int | None = None
    password: str | None = None  # 평문 비밀번호 (해시 처리됨)

    model_config = ConfigDict(
        json_schema_extra={
            "example": {
                "document_id": "550e8400-e29b-41d4-a716-446655440000",
                "created_by": "6ba7b810-9dad-11d1-80b4-00c04fd430c8",
                "expires_at": "2024-12-31T23:59:59",
                "max_downloads": 10,
                "password": "secure123"
            }
        }
    )


class ShareTokenResponse(BaseModel):
    id: str
    token: str
    document_id: str
    created_by: str
    expires_at: datetime
    max_downloads: int | None
    download_count: int
    created_at: datetime

    model_config = {"from_attributes": True}


class ShareTokenValidate(BaseModel):
    token: str = Field(..., max_length=64)
    password: str | None = None  # 비밀번호가 설정된 경우 필수

    model_config = ConfigDict(
        json_schema_extra={
            "example": {
                "token": "a1b2c3d4e5f6g7h8i9j0k1l2m3n4o5p6q7r8s9t0u1v2w3x4y5z6",
                "password": "secure123"
            }
        }
    )


class ShareTokenSummary(BaseModel):
    id: str
    token: str
    expires_at: datetime
    download_count: int
    created_at: datetime

    model_config = {"from_attributes": True}


class ShareTokenValidateResponse(BaseModel):
    valid: bool
    document_id: str | None
    message: str


class ShareTokenListResponse(BaseModel):
    items: list[ShareTokenSummary]  # 목록은 Summary 사용
    total: int
    page: int
    size: int
    pages: int


class ShareTokenDownloadUrlResponse(BaseModel):
    download_url: str
    expires_in: int
    document_id: str
    document_name: str


@dataclass
class CreateShareTokenCommand:
    document_id: str
    created_by: str
    expires_at: datetime
    max_downloads: int | None
    password: str | None  # 평문 비밀번호 (Service에서 해시 처리)
