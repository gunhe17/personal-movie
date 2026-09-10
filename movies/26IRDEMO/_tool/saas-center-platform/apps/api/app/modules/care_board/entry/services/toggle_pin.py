from app.core.datetime_utils import utc_now
from app.core.exceptions import EntityNotFoundException

from ..events import CareBoardEntryAtomic
from ..models import CareBoardEntry
from ..repository import CareBoardEntryRepository


class TogglePinService:
    def __init__(self, repo: CareBoardEntryRepository):
        self.repo = repo

    async def execute(
        self,
        *,
        entry_id: str,
        center_id: str,
        member_id: str,
        pinned: bool,
    ) -> tuple[CareBoardEntryAtomic, CareBoardEntry]:
        current = await self.repo.get_in_center(entry_id=entry_id, center_id=center_id)
        if current is None:
            raise EntityNotFoundException(f"케어보드 항목을 찾을 수 없어요: {entry_id}")

        changed = {
            "pinned": pinned,
            "pinned_at": utc_now() if pinned else None,
            "pinned_by": member_id if pinned else None,
        }
        updated = await self.repo.update_by_id(entry_id, **changed)
        assert updated is not None
        return CareBoardEntryAtomic.updated(entry=updated, changed=changed)
