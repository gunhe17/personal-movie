from app.core.datetime_utils import utc_now

from ..models import FormExtractionStatus
from ..repository import FormExtractionRepository


class RetryFormExtractionService:
    def __init__(self, repo: FormExtractionRepository):
        self.repo = repo

    async def execute(self, extraction_id: str) -> None:
        # lock (동시 mark_completed 경합 방지 — 원본 관례 유지)
        await self.repo.get_for_update(extraction_id)

        # reset
        await self.repo.update_fields(
            extraction_id,
            status=FormExtractionStatus.PROCESSING,
            started_at=utc_now(),
            completed_at=None,
            completed=None,
            failed=None,
            failed_at=None,
        )
