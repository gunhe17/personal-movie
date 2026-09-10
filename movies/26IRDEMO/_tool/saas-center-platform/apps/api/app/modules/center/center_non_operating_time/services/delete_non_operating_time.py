from app.core.exceptions import (
    PermissionDeniedException,
)
from ..events import NonOperatingTimeAtomic
from ..models import NonOperatingTime
from ..repository import NonOperatingTimeRepository


class DeleteNonOperatingTimeService:
    def __init__(self, repo: NonOperatingTimeRepository):
        self.repo = repo

    async def execute(
        self,
        center_id: str,
        non_operating_time_id: str,
    ) -> tuple[NonOperatingTimeAtomic, NonOperatingTime]:
        # verify
        non_op = await self.repo.get_in_center(
            non_operating_time_id=non_operating_time_id,
            center_id=center_id,
        )

        if non_op.is_system_registered:
            raise PermissionDeniedException("시스템 등록 비영업시간은 삭제할 수 없습니다")

        # remove
        await self.repo.remove_by_id(id=non_operating_time_id)
        return NonOperatingTimeAtomic.deleted(non_op=non_op)
