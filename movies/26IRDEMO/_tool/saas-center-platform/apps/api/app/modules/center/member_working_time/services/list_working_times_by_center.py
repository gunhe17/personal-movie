from ..models import MemberWorkingTime
from ..repository import MemberWorkingTimeRepository


class ListMemberWorkingTimesByCenterService:
    def __init__(self, repo: MemberWorkingTimeRepository):
        self.repo = repo

    async def execute(
        self,
        center_id: str,
        weekday: str | None = None,
        is_working_day: bool | None = None,
    ) -> list[MemberWorkingTime]:
        # return
        return await self.repo.list_by_center(
            center_id=center_id,
            weekday=weekday,
            is_working_day=is_working_day,
        )
