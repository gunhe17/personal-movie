from app.core.exceptions import PermissionDeniedException
from app.modules.voucher.center_voucher.models import CenterVoucher
from app.modules.voucher.center_voucher.repository import CenterVoucherRepository
from app.modules.voucher.center_voucher.events import CenterVoucherAtomic


class DeleteCenterVoucherService:
    def __init__(self, repo: CenterVoucherRepository):
        self.repo = repo

    async def execute(
        self,
        center_voucher_id: str,
        center_id: str,
    ) -> tuple[CenterVoucherAtomic, CenterVoucher]:
        # load
        record = await self.repo.get_by_id(id=center_voucher_id)
        if record.center_id != center_id:
            raise PermissionDeniedException("권한 없음")

        # remove
        await self.repo.remove_in_center(
            center_voucher_id=center_voucher_id,
            center_id=center_id,
        )
        return CenterVoucherAtomic.deleted(center_voucher=record)
