from datetime import datetime, time

from app.core.type import unset
from ..events import MemberNonWorkingTimeAtomic
from ..repository import MemberNonWorkingTimeRepository
from ..models import MemberNonWorkingTime


class UpdateMemberNonWorkingTimeService:
    def __init__(self, non_working_time_repo: MemberNonWorkingTimeRepository):
        self.non_working_time_repo = non_working_time_repo

    async def execute(
        self,
        *,
        member_id: str,
        non_working_time_id: str,
        changed: dict | None = None,
        start_time: time | None = unset,
        end_time: time | None = unset,
        effective_to: datetime | None = unset,
        reason: str = unset,
        description: str | None = unset,
    ) -> tuple[MemberNonWorkingTimeAtomic, MemberNonWorkingTime]:
        # load
        non_working_time = await self.non_working_time_repo.get_by_member(
            non_working_time_id=non_working_time_id,
            member_id=member_id,
        )

        # build
        update_data = {
            k: v
            for k, v in {
                "start_time": start_time,
                "end_time": end_time,
                "effective_to": effective_to,
                "reason": reason,
                "description": description,
            }.items()
            if v is not unset
        }
        if not update_data:
            return MemberNonWorkingTimeAtomic.updated(
                non_working_time=non_working_time, changed=changed or {}
            )

        # return
        updated = await self.non_working_time_repo.update_in_place(
            non_working_time_id,
            **update_data,
        )
        assert updated is not None
        return MemberNonWorkingTimeAtomic.updated(
            non_working_time=updated, changed=changed or {}
        )
