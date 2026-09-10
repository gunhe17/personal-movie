from ..repository import MemberNonWorkingTimeRepository
from ..models import MemberNonWorkingTime


class GetMemberNonWorkingTimeService:
    def __init__(self, non_working_time_repo: MemberNonWorkingTimeRepository):
        self.non_working_time_repo = non_working_time_repo

    async def execute(
        self,
        member_id: str,
        non_working_time_id: str,
    ) -> MemberNonWorkingTime:
        # load
        non_working_time = await self.non_working_time_repo.get_by_member(
            non_working_time_id=non_working_time_id,
            member_id=member_id,
        )

        # return
        return non_working_time
