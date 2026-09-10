from app.core.exceptions import PermissionDeniedException
from app.modules.platform_admin.audit_log.events import AdminAuditAtomic
from app.modules.platform_admin.cs_memo.repository import CSMemoRepository


class DeleteMemosService:
    def __init__(self, repo: CSMemoRepository):
        self.repo = repo

    async def execute(
        self,
        *,
        memo_ids: list[str],
        actor_id: str,
        can_access_all: bool = False,
    ) -> tuple[AdminAuditAtomic, int]:
        # verify
        memos = await self.repo.list_active_many(memo_ids=memo_ids)

        if not can_access_all:
            for memo in memos:
                if memo.created_by != actor_id:
                    raise PermissionDeniedException("본인이 작성한 메모만 삭제할 수 있습니다")

        # return
        for memo in memos:
            await self.repo.remove_by_id(id=memo.id)
        deleted_count = len(memos)
        atomic = AdminAuditAtomic(
            _act="bulk_deleted",
            _entity_name="cs_memo",
            _entity_id=memo_ids[0],
            _payload={"data": {"memo_ids": memo_ids, "deleted_count": deleted_count}},
        )
        return atomic, deleted_count
