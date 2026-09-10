from datetime import datetime
from pydantic import BaseModel


class PushTokenRegister(BaseModel):
    token: str
    device_info: str | None = None
    platform: str = "web"


class PushTokenResponse(BaseModel):
    id: str
    token: str
    device_info: str | None
    platform: str
    is_active: bool
    created_at: datetime

    model_config = {"from_attributes": True}
