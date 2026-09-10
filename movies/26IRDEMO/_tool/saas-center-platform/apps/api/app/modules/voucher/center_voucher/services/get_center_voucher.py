from app.core.exceptions import PermissionDeniedException
from app.modules.voucher.center_voucher.models import CenterVoucher
from app.modules.voucher.center_voucher.repository import CenterVoucherRepository


class GetCenterVoucherService:
    def __init__(self, repo: CenterVoucherRepository):
        self.repo = repo

    async def execute(
        self,
        center_voucher_id: str,
        center_id: str,
    ) -> CenterVoucher:
        # load
        record = await self.repo.get_by_id(id=center_voucher_id)
        if record.center_id != center_id:
            raise PermissionDeniedException("권한 없음")

        # return
        return record
