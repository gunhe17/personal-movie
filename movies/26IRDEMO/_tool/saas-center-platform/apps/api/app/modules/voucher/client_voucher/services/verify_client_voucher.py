from app.core.exceptions import PermissionDeniedException
from app.modules.voucher.client_voucher.repository import ClientVoucherRepository


class VerifyClientVoucherService:
    def __init__(self, voucher_repo: ClientVoucherRepository):
        self.voucher_repo = voucher_repo

    async def execute(
        self,
        *,
        center_id: str,
        client_voucher_id: str,
    ) -> None:
        voucher = await self.voucher_repo.get_by_id(id=client_voucher_id,
        )
        if voucher.center_id != center_id:
            raise PermissionDeniedException("권한 없음")
