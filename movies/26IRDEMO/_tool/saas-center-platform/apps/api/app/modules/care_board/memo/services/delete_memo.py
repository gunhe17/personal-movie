from app.core.exceptions import EntityNotFoundException, PermissionDeniedException

from ..events import CareMemoAtomic
from ..models import CareMemo
from ..repository import CareMemoRepository


class DeleteMemoService:
    def __init__(self, repo: CareMemoRepository):
        self.repo = repo

    async def execute(
        self,
        *,
        memo_id: str,
        center_id: str,
        member_id: str,
        is_manager: bool,
    ) -> tuple[CareMemoAtomic, CareMemo]:
        current = await self.repo.get_in_center(memo_id=memo_id, center_id=center_id)
        if current is None:
            raise EntityNotFoundException(f"메모를 찾을 수 없어요: {memo_id}")

        if current.author_id != member_id and not is_manager:
            raise PermissionDeniedException("본인이 작성한 메모만 삭제할 수 있어요")

        removed = await self.repo.remove_by_id(id=memo_id)
        assert removed is not None
        return CareMemoAtomic.deleted(memo=removed)
