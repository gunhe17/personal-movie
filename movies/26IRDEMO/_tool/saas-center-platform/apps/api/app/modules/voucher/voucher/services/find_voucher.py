from app.core.type import uuid_str

from ..models import Voucher
from ..repository import VoucherRepository


class FindVoucherService:
    def __init__(
        self,
        repo: VoucherRepository,
    ):
        self.repo = repo

    async def execute(
        self,
        voucher_id: uuid_str,
    ) -> Voucher | None:
        # return
        return await self.repo.find_by_id(id=voucher_id)
