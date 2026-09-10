from app.core.exceptions import PermissionDeniedException
from app.modules.voucher.client_voucher.models import ClientVoucher
from app.modules.voucher.client_voucher.repository import ClientVoucherRepository


class GetClientVoucherService:
    def __init__(self, repo: ClientVoucherRepository):
        self.repo = repo

    async def execute(
        self,
        client_voucher_id: str,
        center_id: str,
    ) -> ClientVoucher:
        # load
        record = await self.repo.get_by_id(id=client_voucher_id)
        if record.center_id != center_id:
            raise PermissionDeniedException("권한 없음")

        # return
        return record
