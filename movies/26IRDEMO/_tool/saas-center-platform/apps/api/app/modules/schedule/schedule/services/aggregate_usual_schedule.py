from app.core.type import utc_dt, uuid_str

from ..repository import ScheduleRepository


class AggregateUsualScheduleService:
    def __init__(self, repo: ScheduleRepository):
        self.repo = repo

    async def execute(
        self,
        center_id: uuid_str,
        member_id: uuid_str,
        *,
        since: utc_dt,
    ) -> tuple[str | None, int | None]:
        # return
        return await self.repo.aggregate_usual_by_member(
            center_id=center_id,
            member_id=member_id,
            since=since,
        )
