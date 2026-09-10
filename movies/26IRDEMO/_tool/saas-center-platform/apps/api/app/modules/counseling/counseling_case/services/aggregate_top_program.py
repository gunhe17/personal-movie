from app.core.type import utc_dt, uuid_str

from ..repository import CounselingCaseRepository


class AggregateTopProgramService:
    def __init__(self, repo: CounselingCaseRepository):
        self.repo = repo

    async def execute(
        self,
        center_id: uuid_str,
        counselor_id: uuid_str,
        *,
        since: utc_dt,
    ) -> str | None:
        # return
        return await self.repo.aggregate_top_program_by_counselor(
            center_id=center_id,
            counselor_id=counselor_id,
            since=since,
        )
