from ..repository import NonOperatingTimeRepository
from ..models import NonOperatingTime


class ListNonOperatingTimesService:
    def __init__(self, repo: NonOperatingTimeRepository):
        self.repo = repo

    async def execute(
        self,
        center_id: str,
        skip: int = 0,
        limit: int = 100,
        active_only: bool = False,
        reason: str | None = None,
        year: int | None = None,
        month: int | None = None,
        created_by: str | None = None,
    ) -> list[NonOperatingTime]:
        return await self.repo.list_by_center(
            center_id=center_id,
            skip=skip,
            limit=limit,
            active_only=active_only,
            reason=reason,
            year=year,
            month=month,
            created_by=created_by,
        )
