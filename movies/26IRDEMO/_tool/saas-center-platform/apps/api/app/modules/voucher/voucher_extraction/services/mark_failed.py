from app.core.datetime_utils import utc_now
from app.core.type import uuid_str

from ..models import VoucherExtraction, VoucherExtractionStatus
from ..repository import VoucherExtractionRepository


class MarkFailedService:
    def __init__(
        self,
        repo: VoucherExtractionRepository,
    ):
        self.repo = repo

    async def execute(
        self,
        *,
        extraction_id: uuid_str,
        reason: str,
    ) -> VoucherExtraction | None:
        # read — 없거나 삭제됐으면 no-op (실패 마킹은 best-effort)
        extraction = await self.repo.find_by_id_all_states(id=extraction_id)
        if extraction is None or extraction.deleted_at is not None:
            return None

        # return
        return await self.repo.update_in_place(
            id=extraction_id,
            status=VoucherExtractionStatus.FAILED,
            failed=reason,
            failed_at=utc_now(),
        )
