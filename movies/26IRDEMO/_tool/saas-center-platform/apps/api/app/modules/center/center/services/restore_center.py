from app.core.exceptions import EntityNotFoundException, InvalidOperationException

from ..events import CenterAtomic
from ..models import Center
from ..repository import CenterRepository


class RestoreCenterService:
    def __init__(
        self,
        repo: CenterRepository,
    ):
        self.repo = repo

    async def execute(
        self,
        center_id: str,
    ) -> tuple[CenterAtomic, Center]:
        # load
        center = await self.repo.find_by_id_including_deleted(id=center_id)
        if not center:
            raise EntityNotFoundException(f"센터를 찾을 수 없습니다: {center_id}")
        if center.deleted_at is None:
            raise InvalidOperationException("해지되지 않은 센터입니다")

        # mutate
        restored = await self.repo.restore_by_id(id=center_id)
        assert restored is not None

        # return
        return CenterAtomic.restored(center=restored)
