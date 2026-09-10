from app.modules.voucher.client_voucher.models import ClientVoucher
from app.modules.voucher.client_voucher.repository import ClientVoucherRepository


class GetVoucherClientsService:
    def __init__(
        self,
        repo: ClientVoucherRepository,
    ):
        self.repo = repo

    async def execute(
        self,
        *,
        center_voucher_id: str,
    ) -> list[ClientVoucher]:
        return await self.repo.list_by_center_voucher(
            center_voucher_id=center_voucher_id,
        )
