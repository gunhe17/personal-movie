from dataclasses import dataclass
from datetime import datetime
from enum import Enum
from pydantic import BaseModel, Field, ConfigDict


class AccessLevel(str, Enum):
    CENTER = "center"  # 센터 멤버 전체
    PUBLIC = "public"  # 외부 공유 가능


class DocumentCreate(BaseModel):
    center_id: str = Field(..., max_length=36, description="센터 ID (UUID)")
    uploader_id: str = Field(..., max_length=36, description="업로더 Member ID (UUID)")
    name: str = Field(..., max_length=255)
    description: str | None = None
    file_type: str = Field(..., max_length=100)
    file_size: int = Field(..., gt=0)
    checksum: str = Field(..., max_length=64)
    access_level: AccessLevel = AccessLevel.CENTER

    model_config = ConfigDict(
        json_schema_extra={
            "example": {
                "center_id": "550e8400-e29b-41d4-a716-446655440000",
                "uploader_id": "6ba7b810-9dad-11d1-80b4-00c04fd430c8",
                "name": "상담 동의서_김철수.pdf",
                "description": "내담자 김철수 초기 상담 동의서",
                "file_type": "application/pdf",
                "file_size": 524288,
                "checksum": "a3b2c1d4e5f6g7h8i9j0k1l2m3n4o5p6",
                "access_level": "center"
            }
        }
    )


class DocumentUpdate(BaseModel):
    name: str | None = Field(None, max_length=255)
    description: str | None = None
    file_type: str | None = Field(None, max_length=100)
    file_size: int | None = Field(None, gt=0)
    checksum: str | None = Field(None, max_length=64)
    access_level: AccessLevel | None = None

    model_config = ConfigDict(
        json_schema_extra={
            "example": {
                "description": "내담자 김철수 초기 상담 동의서 (수정됨)",
                "access_level": "public"
            }
        }
    )


class DocumentResponse(BaseModel):
    id: str
    center_id: str
    uploader_id: str
    name: str
    original_name: str | None
    description: str | None
    storage_path: str
    file_type: str
    file_size: int
    checksum: str
    access_level: AccessLevel
    deleted_at: datetime | None
    created_at: datetime
    updated_at: datetime

    model_config = {"from_attributes": True}


class DocumentSummary(BaseModel):
    id: str
    name: str
    original_name: str | None
    file_type: str
    file_size: int
    storage_path: str
    created_at: datetime

    model_config = {"from_attributes": True}


class DocumentListResponse(BaseModel):
    items: list[DocumentSummary]
    total: int
    page: int
    size: int
    pages: int


@dataclass
class UploadDocumentCommand:
    center_id: str
    uploader_id: str
    name: str
    original_name: str | None
    description: str | None
    file_type: str
    file_size: int
    checksum: str
    access_level: str  # Enum value (str)


class DownloadUrlResponse(BaseModel):
    download_url: str
    expires_in: int
    document_id: str
    document_name: str
