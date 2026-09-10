from ..repository import NonOperatingTimeRepository
from ..models import NonOperatingTime


class GetNonOperatingTimeService:
    def __init__(self, repo: NonOperatingTimeRepository):
        self.repo = repo

    async def execute(
        self,
        center_id: str,
        non_operating_time_id: str,
    ) -> NonOperatingTime:
        # load
        non_op = await self.repo.get_in_center(
            non_operating_time_id=non_operating_time_id,
            center_id=center_id,
        )

        return non_op
