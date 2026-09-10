from datetime import datetime

from ..repository import MemberNonWorkingTimeRepository
from ..models import MemberNonWorkingTime


class ListMemberNonWorkingTimesService:
    def __init__(self, non_working_time_repo: MemberNonWorkingTimeRepository):
        self.non_working_time_repo = non_working_time_repo

    async def execute(
        self,
        member_id: str,
        year: int | None = None,
        reason: str | None = None,
        skip: int = 0,
        limit: int = 20,
        month: int | None = None,
        day: int | None = None,
        weekday: str | None = None,
        effective_from: datetime | None = None,
        effective_to: datetime | None = None,
        description: str | None = None,
    ) -> tuple[list[MemberNonWorkingTime], int]:
        # load
        items = await self.non_working_time_repo.list_by_member(
            member_id=member_id,
            year=year,
            reason=reason,
            skip=skip,
            limit=limit,
            month=month,
            day=day,
            weekday=weekday,
            effective_from=effective_from,
            effective_to=effective_to,
            description=description,
        )
        total = await self.non_working_time_repo.count_by_member(
            member_id=member_id,
            year=year,
            reason=reason,
            month=month,
            day=day,
            weekday=weekday,
            effective_from=effective_from,
            effective_to=effective_to,
            description=description,
        )

        # return
        return items, total
