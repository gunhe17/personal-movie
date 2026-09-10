from ..events import CenterAtomic
from ..models import Center
from ..repository import CenterRepository


class TerminateCenterService:
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
        await self.repo.get_active(id=center_id)

        # update
        await self.repo.update_in_place(
            id=center_id,
            is_active=False,
        )

        # mutate
        removed = await self.repo.remove_by_id(id=center_id)
        assert removed is not None

        # return
        return CenterAtomic.terminated(center=removed)
