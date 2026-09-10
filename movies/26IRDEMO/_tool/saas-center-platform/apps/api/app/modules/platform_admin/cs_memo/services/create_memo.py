from app.modules.platform_admin.audit_log.events import AdminAuditAtomic
from app.modules.platform_admin.cs_memo.models import CSMemo
from app.modules.platform_admin.cs_memo.repository import CSMemoRepository


class CreateMemoService:
    def __init__(self, repo: CSMemoRepository):
        self.repo = repo

    async def execute(
        self,
        *,
        title: str,
        content: str,
        memo_type: str,
        center_id: str | None,
        actor_id: str,
    ) -> tuple[AdminAuditAtomic, CSMemo]:
        # load
        center_name = None
        if center_id:
            center_name = await self.repo.find_center_name(center_id=center_id)

        memo = await self.repo.add(
            title=title,
            content=content,
            memo_type=memo_type,
            created_by=actor_id,
            center_id=center_id,
            center_name=center_name,
        )

        # return
        atomic = AdminAuditAtomic(
            _act="created",
            _entity_name="cs_memo",
            _entity_id=memo.id,
            _payload={"data": {"id": memo.id, "title": memo.title}},
        )
        return atomic, memo
