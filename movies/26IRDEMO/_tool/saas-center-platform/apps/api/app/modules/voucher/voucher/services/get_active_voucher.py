from app.core.type import uuid_str

from ..models import Voucher
from ..repository import VoucherRepository


class GetActiveVoucherService:
    def __init__(
        self,
        repo: VoucherRepository,
    ):
        self.repo = repo

    async def execute(
        self,
        voucher_id: uuid_str,
    ) -> Voucher:
        # return
        return await self.repo.get_by_id(id=voucher_id)
