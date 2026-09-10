from app.core.exceptions import EntityNotFoundException
from app.core.type import uuid_str

from ..repository import VoucherDocumentRepository


class UnlinkVoucherDocumentService:
    def __init__(
        self,
        repo: VoucherDocumentRepository,
    ):
        self.repo = repo

    async def execute(
        self,
        voucher_id: uuid_str,
        global_document_id: uuid_str,
    ) -> str:
        # load
        link = await self.repo.find_pair(
            voucher_id=voucher_id,
            global_document_id=global_document_id,
        )
        if link is None:
            raise EntityNotFoundException(
                f"연결을 찾을 수 없습니다: voucher={voucher_id} "
                f"document={global_document_id}"
            )

        # remove
        link_id = link.id
        await self.repo.remove_by_id(id=link_id)
        return link_id
