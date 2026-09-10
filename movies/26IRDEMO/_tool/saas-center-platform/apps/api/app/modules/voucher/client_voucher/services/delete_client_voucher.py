from app.core.exceptions import PermissionDeniedException
from app.modules.voucher.client_voucher.models import ClientVoucher
from app.modules.voucher.client_voucher.repository import ClientVoucherRepository
from app.modules.voucher.client_voucher.events import ClientVoucherAtomic


class DeleteClientVoucherService:
    def __init__(self, repo: ClientVoucherRepository):
        self.repo = repo

    async def execute(
        self,
        client_voucher_id: str,
        center_id: str,
    ) -> tuple[ClientVoucherAtomic, ClientVoucher]:
        # load
        record = await self.repo.get_by_id(id=client_voucher_id)
        if record.center_id != center_id:
            raise PermissionDeniedException("권한 없음")

        # remove
        await self.repo.remove_in_center(
            client_voucher_id=client_voucher_id,
            center_id=center_id,
        )
        return ClientVoucherAtomic.deleted(client_voucher=record)
