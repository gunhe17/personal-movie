from datetime import date

from ..repository import NonOperatingTimeRepository
from ..models import NonOperatingTime


class ListMatchingByDateService:
    def __init__(self, repo: NonOperatingTimeRepository):
        self.repo = repo

    async def execute(
        self,
        center_id: str,
        target_date: date,
    ) -> list[NonOperatingTime]:
        return await self.repo.list_matching_by_date(
            center_id=center_id,
            target_date=target_date,
        )
