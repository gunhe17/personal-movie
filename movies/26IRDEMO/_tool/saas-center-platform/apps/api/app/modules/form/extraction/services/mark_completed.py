from app.core.datetime_utils import utc_now
from app.core.type import uuid_str

from ..models import FormExtraction, FormExtractionStatus
from ..repository import FormExtractionRepository


class MarkCompletedService:
    def __init__(
        self,
        repo: FormExtractionRepository,
    ):
        self.repo = repo

    async def execute(
        self,
        *,
        extraction_id: uuid_str,
        completed: dict,
    ) -> FormExtraction:
        # read
        await self.repo.get_for_update(id=extraction_id)

        # return
        return await self.repo.update_in_place(
            id=extraction_id,
            status=FormExtractionStatus.COMPLETED,
            completed=completed,
            completed_at=utc_now(),
            failed=None,
            failed_at=None,
        )
