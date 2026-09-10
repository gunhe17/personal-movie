from datetime import date

from app.infrastructure.persistence.new_repository import Page
from app.modules.platform_admin.cs_memo.models import CSMemo
from app.modules.platform_admin.cs_memo.repository import CSMemoRepository


class ListMemosService:
    def __init__(self, repo: CSMemoRepository):
        self.repo = repo

    async def execute(
        self,
        *,
        actor_id: str,
        can_access_all: bool = False,
        search: str | None = None,
        memo_type: str | None = None,
        center_id: str | None = None,
        date_from: date | None = None,
        date_to: date | None = None,
        sort_order: str = "desc",
        page: int = 1,
        size: int = 20,
    ) -> tuple[list[CSMemo], Page]:
        # 전체 열람 권한 없으면 본인 메모만 (권한 판정은 handler)
        admin_id = None if can_access_all else actor_id

        return await self.repo.list_memos_with_page(
            admin_id=admin_id,
            search=search,
            memo_type=memo_type,
            center_id=center_id,
            date_from=date_from,
            date_to=date_to,
            sort_order=sort_order,
            page=page,
            size=size,
        )
