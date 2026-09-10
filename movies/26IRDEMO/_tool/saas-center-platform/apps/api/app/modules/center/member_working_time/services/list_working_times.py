from ..models import MemberWorkingTime
from ..repository import MemberWorkingTimeRepository


class ListMemberWorkingTimesService:
    def __init__(self, working_time_repo: MemberWorkingTimeRepository):
        self.working_time_repo = working_time_repo

    async def execute(
        self,
        member_id: str,
        weekday: str | None = None,
        is_working_day: bool | None = None,
    ) -> list[MemberWorkingTime]:
        # return
        return await self.working_time_repo.list_by_member(
            member_id=member_id,
            weekday=weekday,
            is_working_day=is_working_day,
        )
