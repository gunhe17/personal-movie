from app.core.exceptions import PermissionDeniedException
from app.modules.platform_admin.cs_memo.models import CSMemo
from app.modules.platform_admin.cs_memo.repository import CSMemoRepository


class GetMemoService:
    def __init__(self, repo: CSMemoRepository):
        self.repo = repo

    async def execute(
        self,
        *,
        memo_id: str,
        actor_id: str,
        can_access_all: bool = False,
    ) -> CSMemo:
        # verify
        memo = await self.repo.get_active(memo_id=memo_id)

        if not can_access_all and memo.created_by != actor_id:
            raise PermissionDeniedException("본인이 작성한 메모만 조회할 수 있습니다")

        return memo
