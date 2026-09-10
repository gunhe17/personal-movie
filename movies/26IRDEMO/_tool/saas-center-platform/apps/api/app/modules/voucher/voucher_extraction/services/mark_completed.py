from app.core.datetime_utils import utc_now
from app.core.type import uuid_str

from ..models import VoucherExtraction, VoucherExtractionStatus
from ..repository import VoucherExtractionRepository


def build_completed_payload(
    existing: dict | None,
    *,
    meta: dict,
    vouchers: list,
    forms: list,
) -> dict:
    # started 시점에 채워진 type/source_url 은 보존, meta/vouchers/forms 는 교체(replace 시맨틱)
    existing = existing or {}
    return {
        "type": existing.get("type"),
        "source_url": existing.get("source_url"),
        "meta": meta,
        "vouchers": vouchers,
        "forms": forms,
    }


class MarkCompletedService:
    def __init__(
        self,
        repo: VoucherExtractionRepository,
    ):
        self.repo = repo

    async def execute(
        self,
        *,
        extraction_id: uuid_str,
        meta: dict,
        vouchers: list,
        forms: list,
    ) -> VoucherExtraction:
        # read
        extraction = await self.repo.get_for_update(id=extraction_id)

        # assemble
        completed = build_completed_payload(
            extraction.completed,
            meta=meta,
            vouchers=vouchers,
            forms=forms,
        )

        # return
        return await self.repo.update_in_place(
            id=extraction_id,
            status=VoucherExtractionStatus.COMPLETED,
            completed=completed,
            completed_at=utc_now(),
            failed=None,
            failed_at=None,
        )
