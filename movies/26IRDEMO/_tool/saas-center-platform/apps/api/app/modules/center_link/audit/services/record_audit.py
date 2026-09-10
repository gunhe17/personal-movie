from app.core.type import uuid_str

from ..models import CenterLinkAudit
from ..repository import CenterLinkAuditRepository


class RecordAuditService:
    def __init__(self, repo: CenterLinkAuditRepository):
        self.repo = repo

    async def execute(
        self,
        *,
        center_id: uuid_str,
        actor_type: str,
        action: str,
        link_id: uuid_str | None = None,
        invitation_id: uuid_str | None = None,
        actor_id: uuid_str | None = None,
        snapshot: dict | None = None,
    ) -> CenterLinkAudit:
        # return
        return await self.repo.add(
            center_id=center_id,
            actor_type=actor_type,
            action=action,
            link_id=link_id,
            invitation_id=invitation_id,
            actor_id=actor_id,
            snapshot=snapshot,
        )
