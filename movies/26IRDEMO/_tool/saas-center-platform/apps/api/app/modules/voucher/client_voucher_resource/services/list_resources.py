from ..models import ClientVoucherResource
from ..repository import ClientVoucherResourceRepository


class ListVoucherResourcesService:
    def __init__(self, repo: ClientVoucherResourceRepository):
        self.repo = repo

    async def execute(
        self,
        center_id: str,
        client_voucher_id: str,
        resource_type: str | None = None,
    ) -> list[ClientVoucherResource]:
        return await self.repo.list_by_voucher_and_type(
            center_id=center_id,
            client_voucher_id=client_voucher_id,
            resource_type=resource_type,
        )
