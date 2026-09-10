from app.modules.voucher.center_voucher.models import CenterVoucher
from app.modules.voucher.center_voucher.repository import CenterVoucherRepository


class ListCenterVouchersService:
    def __init__(self, repo: CenterVoucherRepository):
        self.repo = repo

    async def execute(
        self,
        center_id: str,
        is_active: bool | None,
        page: int,
        size: int,
    ) -> tuple[list[CenterVoucher], int]:
        rows, page_meta = await self.repo.list_center_vouchers_with_page(
            center_id=center_id,
            is_active=is_active,
            page=page,
            size=size,
        )
        return rows, page_meta["total"]
