from app.modules.voucher.client_voucher.models import ClientVoucher
from app.modules.voucher.client_voucher.repository import ClientVoucherRepository


class ListAllClientVouchersService:
    def __init__(self, repo: ClientVoucherRepository):
        self.repo = repo

    async def execute(self, *, center_id: str, cap: int) -> list[ClientVoucher]:
        return await self.repo.list_by_center(center_id=center_id, limit=cap)
