from app.core.datetime_utils import utc_now
from app.core.exceptions import EntityNotFoundException, PermissionDeniedException

from ..events import CareMemoAtomic
from ..models import CareMemo
from ..repository import CareMemoRepository


class UpdateMemoService:
    def __init__(self, repo: CareMemoRepository):
        self.repo = repo

    async def execute(
        self,
        *,
        memo_id: str,
        center_id: str,
        member_id: str,
        body: str,
        is_manager: bool,
    ) -> tuple[CareMemoAtomic, CareMemo]:
        current = await self.repo.get_in_center(memo_id=memo_id, center_id=center_id)
        if current is None:
            raise EntityNotFoundException(f"메모를 찾을 수 없어요: {memo_id}")

        is_author = current.author_id == member_id
        if not is_author and not is_manager:
            raise PermissionDeniedException("본인이 작성한 메모만 수정할 수 있어요")

        # 남이 고친 흔적만 남긴다 — 작성자 이름은 그대로인데 내용이 바뀌는 상황의 고지
        changed: dict = {"body": body.strip()}
        if not is_author:
            changed["edited_by"] = member_id
            changed["edited_at"] = utc_now()

        updated = await self.repo.update_in_center(memo_id, center_id, **changed)
        assert updated is not None
        return CareMemoAtomic.updated(memo=updated, changed=changed)
