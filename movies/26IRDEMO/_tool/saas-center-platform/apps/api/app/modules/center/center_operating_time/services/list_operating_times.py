from ..models import OperatingTime
from ..repository import OperatingTimeRepository


class ListOperatingTimesService:
    def __init__(self, repo: OperatingTimeRepository):
        self.repo = repo

    async def execute(
        self,
        center_id: str,
        day_of_week: str | None = None,
        is_operating: bool | None = None,
    ) -> list[OperatingTime]:
        # return
        return await self.repo.list_by_center(
            center_id=center_id,
            day_of_week=day_of_week,
            is_operating=is_operating,
        )
