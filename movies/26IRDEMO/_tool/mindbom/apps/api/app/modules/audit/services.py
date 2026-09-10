"""감사추적 Services — SaMD 2등급 필수"""
import json
import math
from datetime import datetime

from app.core.request_context import get_trace_id
from app.modules.audit.models import AuditLog
from app.modules.audit.repository import AuditLogRepository
from app.modules.audit.schemas import (
    AuditLogListResponse,
    AuditLogResponse,
)


def _to_json(value: dict | None) -> str | None:
    if value is None:
        return None
    return json.dumps(value, ensure_ascii=False, default=str)


class AuditLogger:
    """감사 로그 기록기

    핸들러/Facade에서 직접 호출 (UoW 헬퍼를 거치지 않음 → core 역의존성 제거).
    같은 세션을 공유하므로 commit은 호출자(handler) 책임.
    trace_id는 ContextVar에서 자동 캡처.
    """

    def __init__(self, repo: AuditLogRepository):
        self.repo = repo

    async def log(
        self,
        *,
        action: str,
        entity_type: str,
        entity_id: str,
        actor_id: str | None,
        actor_email: str,
        actor_role: str | None,
        institution_id: str | None,
        ip_address: str | None = None,
        user_agent: str | None = None,
        old_value: dict | None = None,
        new_value: dict | None = None,
        metadata: dict | None = None,
    ) -> AuditLog:
        return await self.repo.create({
            "action": action,
            "entity_type": entity_type,
            "entity_id": entity_id,
            "actor_id": actor_id,
            "actor_email": actor_email,
            "actor_role": actor_role,
            "institution_id": institution_id,
            "trace_id": get_trace_id(),
            "ip_address": ip_address,
            "user_agent": user_agent,
            "old_value": _to_json(old_value),
            "new_value": _to_json(new_value),
            "metadata_json": _to_json(metadata),
        })


class ListAuditLogsService:
    """감사 로그 목록 조회 (관리자 전용)"""

    def __init__(self, repo: AuditLogRepository):
        self.repo = repo

    async def execute(
        self,
        institution_id: str,
        *,
        page: int = 1,
        size: int = 50,
        entity_type: str | None = None,
        entity_id: str | None = None,
        action: str | None = None,
        actor_id: str | None = None,
        date_from: datetime | None = None,
        date_to: datetime | None = None,
    ) -> AuditLogListResponse:
        skip = (page - 1) * size
        items, total = await self.repo.list_with_filters(
            institution_id,
            skip=skip, size=size,
            entity_type=entity_type, entity_id=entity_id,
            action=action, actor_id=actor_id,
            date_from=date_from, date_to=date_to,
        )
        return AuditLogListResponse(
            items=[AuditLogResponse.model_validate(it) for it in items],
            total=total,
            page=page,
            size=size,
            pages=math.ceil(total / size) if total > 0 else 1,
        )
