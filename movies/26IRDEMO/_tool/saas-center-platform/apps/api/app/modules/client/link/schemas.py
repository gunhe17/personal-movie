from datetime import datetime
from pydantic import BaseModel, Field

from ..link_request.models import LinkRequestStatus


class ClientLinkRequestCreate(BaseModel):
    person_id: str = Field(..., description="Person UUID")
    phone: str = Field(..., min_length=1, max_length=20, description="매칭 키 (Person.phone)")
    requested_at: datetime = Field(..., description="요청 시각 (UTC)")

    model_config = {
        "json_schema_extra": {
            "examples": [
                {
                    "person_id": "550e8400-e29b-41d4-a716-446655440000",
                    "phone": "010-1234-5678",
                    "requested_at": "2024-01-15T09:30:00Z"
                }
            ]
        }
    }


class ClientLinkRequestUpdate(BaseModel):
    status: LinkRequestStatus = Field(..., description="상태")
    client_id: str | None = Field(None, description="승인 시 Client UUID")
    reviewed_at: datetime = Field(..., description="처리 시각 (UTC)")

    model_config = {
        "json_schema_extra": {
            "examples": [
                {
                    "status": "approved",
                    "client_id": "550e8400-e29b-41d4-a716-446655440001",
                    "reviewed_at": "2024-01-15T10:00:00Z"
                },
                {
                    "status": "rejected",
                    "client_id": None,
                    "reviewed_at": "2024-01-15T10:00:00Z"
                }
            ]
        }
    }


class ClientLinkRequestResponse(BaseModel):
    id: str
    center_id: str
    person_id: str
    phone: str
    client_id: str | None
    status: str
    requested_at: datetime
    reviewed_at: datetime | None
    created_at: datetime

    model_config = {"from_attributes": True}


class ClientLinkRequestListResponse(BaseModel):
    items: list[ClientLinkRequestResponse]
    total: int
    page: int
    size: int
    pages: int


