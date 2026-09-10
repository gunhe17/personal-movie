from ..repository import BillableItemRepository


class AggregateCoverageRowsService:
    def __init__(
        self,
        repo: BillableItemRepository,
    ):
        self.repo = repo

    async def execute(
        self,
        center_id: str,
        *,
        counseling_session_ids: set[str],
        assessment_session_ids: set[str],
        counseling_case_ids: set[str],
        assessment_case_ids: set[str],
    ) -> list[tuple]:
        return await self.repo.aggregate_coverage_rows(
            center_id=center_id,
            counseling_session_ids=counseling_session_ids,
            assessment_session_ids=assessment_session_ids,
            counseling_case_ids=counseling_case_ids,
            assessment_case_ids=assessment_case_ids,
        )
