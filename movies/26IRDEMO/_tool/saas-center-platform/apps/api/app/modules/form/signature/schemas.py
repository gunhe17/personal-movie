from datetime import datetime

from pydantic import BaseModel, ConfigDict, Field


# Request


class SignatureCreate(BaseModel):
    instance_id: str = Field(..., description="인스턴스 ID")
    field_id: str = Field(..., max_length=100, description="서명 필드 ID")
    signature_data: str = Field(..., description="Base64 인코딩된 서명 이미지")
    signer_name: str = Field(..., max_length=100, description="서명자 이름")


# Response


class SignatureResponse(BaseModel):
    id: str
    instance_id: str
    field_id: str
    storage_type: str
    signature_data: str | None
    storage_path: str | None
    signer_name: str
    signer_ip: str | None
    signed_at: datetime
    created_at: datetime

    model_config = ConfigDict(from_attributes=True)
