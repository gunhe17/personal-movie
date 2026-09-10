from app.core.exceptions import PermissionDeniedException
from app.modules.platform_admin.audit_log.events import AdminAuditAtomic
from app.modules.platform_admin.cs_memo.repository import CSMemoRepository


class DeleteMemoService:
    def __init__(self, repo: CSMemoRepository):
        self.repo = repo

    async def execute(
        self,
        *,
        memo_id: str,
        actor_id: str,
        can_access_all: bool = False,
    ) -> tuple[AdminAuditAtomic, str]:
        # verify
        memo = await self.repo.get_active(memo_id=memo_id)

        if not can_access_all and memo.created_by != actor_id:
            raise PermissionDeniedException("본인이 작성한 메모만 삭제할 수 있습니다")

        # return
        await self.repo.remove_by_id(id=memo_id)
        atomic = AdminAuditAtomic(
            _act="deleted",
            _entity_name="cs_memo",
            _entity_id=memo_id,
            _payload={"data": {"id": memo_id, "title": memo.title}},
        )
        return atomic, memo.title
