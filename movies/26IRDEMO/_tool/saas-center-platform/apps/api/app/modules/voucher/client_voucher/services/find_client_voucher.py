from app.core.type import uuid_str

from ..models import ClientVoucher
from ..repository import ClientVoucherRepository


class FindClientVoucherService:
    def __init__(
        self,
        repo: ClientVoucherRepository,
    ):
        self.repo = repo

    async def execute(
        self,
        client_voucher_id: uuid_str,
    ) -> ClientVoucher | None:
        # return
        return await self.repo.find_by_id(id=client_voucher_id)
