from pydantic import BaseModel, ConfigDict, Field

from app.modules.person.credential.schemas import CredentialResponse


class AdminCredentialResponse(CredentialResponse):
    person_name: str | None = None
    person_email: str | None = None


class AdminCredentialListResponse(BaseModel):
    items: list[AdminCredentialResponse]
    total: int
    page: int = Field(..., ge=1)
    size: int = Field(..., ge=1)
    pages: int


class CredentialRejectRequest(BaseModel):
    reason: str = Field(..., min_length=1, max_length=1000, description="반려 사유")

    model_config = ConfigDict(
        json_schema_extra={"example": {"reason": "첨부된 자격증 파일을 식별할 수 없습니다."}}
    )
