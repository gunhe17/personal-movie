from datetime import datetime
from typing import Any

from pydantic import BaseModel


class AdminAuditLogResponse(BaseModel):
    id: str
    admin_account_id: str
    admin_email: str
    action: str
    target_type: str
    target_id: str
    summary: str
    ip_address: str | None
    extra: dict[str, Any] | None
    created_at: datetime

    model_config = {"from_attributes": True}


class AdminAuditLogListResponse(BaseModel):
    items: list[AdminAuditLogResponse]
    total: int
    page: int
    size: int
    pages: int
