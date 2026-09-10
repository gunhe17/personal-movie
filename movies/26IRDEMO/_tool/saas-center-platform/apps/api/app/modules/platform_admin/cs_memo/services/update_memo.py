from app.core.exceptions import PermissionDeniedException
from app.core.type import unset
from app.modules.platform_admin.audit_log.events import AdminAuditAtomic
from app.modules.platform_admin.cs_memo.models import CSMemo
from app.modules.platform_admin.cs_memo.repository import CSMemoRepository


class UpdateMemoService:
    def __init__(self, repo: CSMemoRepository):
        self.repo = repo

    async def execute(
        self,
        *,
        memo_id: str,
        actor_id: str,
        can_access_all: bool = False,
        title: str = unset,
        content: str = unset,
        memo_type: str = unset,
        center_id: str | None = unset,
    ) -> tuple[AdminAuditAtomic, CSMemo]:
        # verify
        memo = await self.repo.get_active(memo_id=memo_id)

        if not can_access_all and memo.created_by != actor_id:
            raise PermissionDeniedException("본인이 작성한 메모만 수정할 수 있습니다")

        # load
        update_fields = {}
        if title is not unset:
            update_fields["title"] = title
        if content is not unset:
            update_fields["content"] = content
        if memo_type is not unset:
            update_fields["memo_type"] = memo_type
        if center_id is not unset:
            update_fields["center_id"] = center_id
            update_fields["center_name"] = (
                await self.repo.find_center_name(center_id=center_id) if center_id else None
            )

        updated = await self.repo.update_in_place(memo_id, **update_fields)

        # return
        atomic = AdminAuditAtomic(
            _act="updated",
            _entity_name="cs_memo",
            _entity_id=memo_id,
            _payload={"data": {"id": memo_id, "title": updated.title}},
        )
        return atomic, updated
