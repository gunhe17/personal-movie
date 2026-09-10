from app.core.type import uuid_str

from ..models import CenterVoucher
from ..repository import CenterVoucherRepository


class FindCenterVoucherService:
    def __init__(
        self,
        repo: CenterVoucherRepository,
    ):
        self.repo = repo

    async def execute(
        self,
        center_voucher_id: uuid_str,
    ) -> CenterVoucher | None:
        # return
        return await self.repo.find_by_id(id=center_voucher_id)
