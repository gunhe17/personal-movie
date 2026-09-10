from app.core.type import typecheck, uuid_str
from app.infrastructure.persistence.new_repository import PostgresRepository

from .models import CenterLinkAudit


class CenterLinkAuditRepository(PostgresRepository[CenterLinkAudit]):
    model = CenterLinkAudit

    # #
    # command

    @typecheck
    async def add(
        self,
        center_id: uuid_str,
        actor_type: str,
        action: str,
        link_id: uuid_str | None = None,
        invitation_id: uuid_str | None = None,
        actor_id: uuid_str | None = None,
        snapshot: dict | None = None,
    ) -> CenterLinkAudit:
        return await super().add(
            CenterLinkAudit(
                center_id=center_id,
                actor_type=actor_type,
                action=action,
                link_id=link_id,
                invitation_id=invitation_id,
                actor_id=actor_id,
                snapshot=snapshot,
            )
        )
