"""감사추적 Schemas"""
from datetime import datetime
from pydantic import BaseModel


class AuditLogResponse(BaseModel):
    """감사추적 로그 응답"""
    id: str
    entity_type: str
    entity_id: str
    action: str
    actor_id: str | None = None
    actor_email: str
    actor_role: str | None = None
    institution_id: str | None = None
    trace_id: str | None = None
    ip_address: str | None = None
    user_agent: str | None = None
    old_value: str | None = None
    new_value: str | None = None
    metadata_json: str | None = None
    created_at: datetime

    model_config = {"from_attributes": True}


class AuditLogSummary(BaseModel):
    """감사추적 목록용"""
    id: str
    entity_type: str
    entity_id: str
    action: str
    actor_email: str
    created_at: datetime

    model_config = {"from_attributes": True}


class AuditLogListResponse(BaseModel):
    """감사추적 페이지 응답"""
    items: list[AuditLogResponse]
    total: int
    page: int
    size: int
    pages: int
