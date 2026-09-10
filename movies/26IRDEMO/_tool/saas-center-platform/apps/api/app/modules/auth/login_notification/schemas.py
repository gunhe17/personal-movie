from datetime import datetime
from pydantic import BaseModel


class LoginNotificationCreate(BaseModel):
    account_id: str
    device_info: str | None = None
    ip_address: str
    location: str | None = None
    login_at: datetime
    is_new_device: bool = False


class LoginNotificationResponse(BaseModel):
    id: str
    account_id: str
    device_info: str | None
    ip_address: str
    location: str | None
    login_at: datetime
    is_new_device: bool
    notified_at: datetime | None
    error_message: str | None
    created_at: datetime
    updated_at: datetime

    model_config = {"from_attributes": True}


class LoginNotificationSummary(BaseModel):
    id: str
    device_info: str | None
    ip_address: str
    login_at: datetime
    is_new_device: bool

    model_config = {"from_attributes": True}
