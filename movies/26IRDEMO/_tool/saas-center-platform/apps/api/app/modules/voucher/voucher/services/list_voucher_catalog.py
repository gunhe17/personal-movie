from ..models import Voucher
from ..repository import VoucherRepository


class ListVoucherCatalogService:
    def __init__(
        self,
        repo: VoucherRepository,
    ):
        self.repo = repo

    async def execute(self) -> list[Voucher]:
        # return
        return await self.repo.list_catalog()
