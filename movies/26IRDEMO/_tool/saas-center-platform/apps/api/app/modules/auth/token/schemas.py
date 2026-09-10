from datetime import datetime
from pydantic import BaseModel, ConfigDict


class DeviceSessionSummary(BaseModel):
    id: str
    device_info: str | None
    ip_address: str | None
    created_at: datetime
    expires_at: datetime
    is_current: bool = False  # 현재 사용 중인 세션 여부

    model_config = {"from_attributes": True}


class DeviceSessionListResponse(BaseModel):
    sessions: list[DeviceSessionSummary]
    total: int


class RevokeDeviceRequest(BaseModel):
    session_id: str

    model_config = ConfigDict(
        json_schema_extra={
            "example": {
                "session_id": "550e8400-e29b-41d4-a716-446655440000"
            }
        }
    )


class RevokeDeviceResponse(BaseModel):
    message: str
