from datetime import datetime, time

from ..events import NonOperatingTimeAtomic
from ..repository import NonOperatingTimeRepository
from ..models import NonOperatingTime


class UpdateNonOperatingTimeService:
    def __init__(self, repo: NonOperatingTimeRepository):
        self.repo = repo

    async def execute(
        self,
        center_id: str,
        non_operating_time_id: str,
        start_time: time | None = None,
        end_time: time | None = None,
        effective_to: datetime | None = None,
        reason: str | None = None,
        confirm: bool = False,
        changed: dict | None = None,
    ) -> tuple[NonOperatingTimeAtomic, NonOperatingTime]:
        # verify
        non_op = await self.repo.get_in_center(
            non_operating_time_id=non_operating_time_id,
            center_id=center_id,
        )

        # build
        update_data = {}
        if start_time is not None:
            update_data["start_time"] = start_time
        if end_time is not None:
            update_data["end_time"] = end_time
        if effective_to is not None:
            update_data["effective_to"] = effective_to
        if reason is not None:
            update_data["reason"] = reason

        if not update_data:
            return NonOperatingTimeAtomic.updated(non_op=non_op, changed=changed or {})

        # return
        updated = await self.repo.update_in_place(
            non_operating_time_id,
            **update_data,
        )
        assert updated is not None
        return NonOperatingTimeAtomic.updated(non_op=updated, changed=changed or {})
