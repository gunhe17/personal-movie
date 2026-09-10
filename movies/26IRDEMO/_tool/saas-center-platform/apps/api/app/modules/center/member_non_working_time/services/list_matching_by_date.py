from datetime import date

from ..repository import MemberNonWorkingTimeRepository
from ..models import MemberNonWorkingTime


class ListMatchingByDateService:
    def __init__(self, non_working_time_repo: MemberNonWorkingTimeRepository):
        self.non_working_time_repo = non_working_time_repo

    async def execute(
        self,
        member_id: str,
        target_date: date,
    ) -> list[MemberNonWorkingTime]:
        # return
        return await self.non_working_time_repo.list_matching_by_date(
            member_id=member_id,
            target_date=target_date,
        )
