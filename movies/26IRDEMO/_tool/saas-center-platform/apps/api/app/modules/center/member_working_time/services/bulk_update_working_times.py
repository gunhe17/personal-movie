from ..events import MemberWorkingTimeAtomic
from ..models import MemberWorkingTime
from ..repository import MemberWorkingTimeRepository


class BulkUpdateMemberWorkingTimesService:
    def __init__(self, working_time_repo: MemberWorkingTimeRepository):
        self.working_time_repo = working_time_repo

    async def execute(
        self,
        *,
        center_id: str,
        member_id: str,
        items: list[dict],
    ) -> tuple[MemberWorkingTimeAtomic, list[MemberWorkingTime]]:
        # replace
        await self.working_time_repo.hard_delete_by_member(member_id=member_id)

        # create
        created = []
        for item in items:
            working_time = await self.working_time_repo.add(
                center_id=center_id,
                member_id=member_id,
                weekday=item["weekday"],
                start_time=item["start_time"],
                end_time=item["end_time"],
                break_start_time=item["break_start_time"],
                break_end_time=item["break_end_time"],
            )
            created.append(working_time)

        # return
        return MemberWorkingTimeAtomic.updated(member_id=member_id, working_times=created)
