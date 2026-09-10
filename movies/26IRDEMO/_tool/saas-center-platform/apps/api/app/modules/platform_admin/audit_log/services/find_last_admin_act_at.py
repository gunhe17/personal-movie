from datetime import datetime

from ..repository import AdminAuditReadRepository


class FindLastAdminActAtService:
    def __init__(
        self,
        repo: AdminAuditReadRepository,
    ):
        self.repo = repo

    async def execute(
        self,
        entity_id: str,
        *,
        entity_name: str,
        acts: list,
    ) -> datetime | None:
        # return (타임스탬프만 — event 모듈 ORM을 표면에 노출하지 않는다)
        atomic = await self.repo.find_last_admin_atomic(
            entity_name=entity_name,
            acts=acts,
            entity_id=entity_id,
        )
        return atomic.created_at if atomic else None
