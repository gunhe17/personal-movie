"""감사추적 Handlers — 트랜잭션 관리"""
from datetime import datetime

from app.core.unit_of_work import UnitOfWork
from app.modules.audit.repository import AuditLogRepository
from app.modules.audit.schemas import AuditLogListResponse
from app.modules.audit.services import ListAuditLogsService


async def handle_list_audit_logs(
    institution_id: str,
    uow: UnitOfWork,
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
    async with uow:
        repo = uow.repo(AuditLogRepository)
        service = ListAuditLogsService(repo)
        return await service.execute(
            institution_id,
            page=page, size=size,
            entity_type=entity_type, entity_id=entity_id,
            action=action, actor_id=actor_id,
            date_from=date_from, date_to=date_to,
        )
