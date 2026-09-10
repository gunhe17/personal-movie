from app.core.type import uuid_str

from ..models import VoucherDocument
from ..repository import VoucherDocumentRepository


class ListVoucherDocumentsService:
    def __init__(
        self,
        repo: VoucherDocumentRepository,
    ):
        self.repo = repo

    async def execute(
        self,
        voucher_id: uuid_str,
    ) -> list[VoucherDocument]:
        # return
        return await self.repo.list_by_voucher(voucher_id=voucher_id)
