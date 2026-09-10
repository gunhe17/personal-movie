from app.core.type import uuid_str
from app.infrastructure.persistence.range import Range

from ..models import VoucherDocument
from ..repository import VoucherDocumentRepository


class LinkVoucherDocumentService:
    def __init__(
        self,
        repo: VoucherDocumentRepository,
    ):
        self.repo = repo

    async def execute(
        self,
        voucher_id: uuid_str,
        global_document_id: uuid_str,
        *,
        page_range: Range | None = None,
    ) -> tuple[VoucherDocument, bool]:
        # load (soft-delete 슬롯 점유 대비 — 있으면 복원, unique 재생성 깨짐 방지)
        existing = await self.repo.find_pair_including_deleted(
            voucher_id=voucher_id,
            global_document_id=global_document_id,
        )
        if existing is not None:
            if existing.deleted_at is None:
                return existing, False
            restored = await self.repo.restore_pair(
                id=existing.id,
                page_range=page_range,
            )
            return restored, True

        # return
        link = await self.repo.add(
            voucher_id=voucher_id,
            global_document_id=global_document_id,
            page_range=page_range,
        )
        return link, True
