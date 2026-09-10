from app.core.exceptions import InvalidOperationException

from ..events import CenterAtomic
from ..models import Center
from ..repository import CenterRepository


class ActivateCenterService:
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
        center = await self.repo.get_active(id=center_id)
        if center.is_active:
            raise InvalidOperationException("이미 활성 상태인 센터입니다")

        # mutate
        updated = await self.repo.update_in_place(
            id=center_id,
            is_active=True,
        )
        assert updated is not None

        # return
        return CenterAtomic.activated(center=updated)
