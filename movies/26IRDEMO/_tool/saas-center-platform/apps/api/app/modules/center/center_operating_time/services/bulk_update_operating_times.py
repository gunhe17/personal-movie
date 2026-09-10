from ..events import OperatingTimeAtomic
from ..models import OperatingTime
from ..repository import OperatingTimeRepository


class BulkUpdateOperatingTimesService:
    def __init__(self, repo: OperatingTimeRepository):
        self.repo = repo

    async def execute(
        self,
        center_id: str,
        items: list[dict],
        confirm: bool,
    ) -> tuple[OperatingTimeAtomic, list[OperatingTime]]:
        # replace
        await self.repo.hard_delete_by_center(center_id=center_id)

        created = []
        for item in items:
            operating_time = await self.repo.add(center_id=center_id, **item)
            created.append(operating_time)

        # return
        weekday_order = ["MON", "TUE", "WED", "THU", "FRI", "SAT", "SUN"]
        created.sort(key=lambda x: weekday_order.index(x.weekday))
        return OperatingTimeAtomic.updated(center_id=center_id, operating_times=created)
