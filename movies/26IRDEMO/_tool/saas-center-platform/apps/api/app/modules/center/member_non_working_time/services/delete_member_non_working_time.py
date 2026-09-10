from ..events import MemberNonWorkingTimeAtomic
from ..models import MemberNonWorkingTime
from ..repository import MemberNonWorkingTimeRepository


class DeleteMemberNonWorkingTimeService:
    def __init__(self, non_working_time_repo: MemberNonWorkingTimeRepository):
        self.non_working_time_repo = non_working_time_repo

    async def execute(
        self,
        member_id: str,
        non_working_time_id: str,
    ) -> tuple[MemberNonWorkingTimeAtomic, MemberNonWorkingTime]:
        # load
        record = await self.non_working_time_repo.get_by_member(
            non_working_time_id=non_working_time_id,
            member_id=member_id,
        )

        # remove
        await self.non_working_time_repo.remove_by_id(id=non_working_time_id)
        return MemberNonWorkingTimeAtomic.deleted(non_working_time=record)
