from app.core.type import uuid_str

from ..models import VoucherFormTemplate
from ..repository import VoucherFormTemplateRepository


class ListVoucherFormTemplatesService:
    def __init__(
        self,
        repo: VoucherFormTemplateRepository,
    ):
        self.repo = repo

    async def execute(self, voucher_id: uuid_str) -> list[VoucherFormTemplate]:
        # return
        return await self.repo.list_by_voucher(voucher_id=voucher_id)
