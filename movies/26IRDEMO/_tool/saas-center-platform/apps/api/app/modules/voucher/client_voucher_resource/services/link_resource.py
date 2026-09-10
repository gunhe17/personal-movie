from app.core.exceptions import ConflictException

from ..events import ClientVoucherResourceAtomic
from ..models import ClientVoucherResource
from ..repository import ClientVoucherResourceRepository


class LinkVoucherResourceService:
    def __init__(
        self,
        repo: ClientVoucherResourceRepository,
    ):
        self.repo = repo

    async def execute(
        self,
        center_id: str,
        client_voucher_id: str,
        resource_id: str,
        resource_type: str,
    ) -> tuple[ClientVoucherResourceAtomic, ClientVoucherResource]:
        # verify
        existing = await self.repo.find_by_voucher_and_resource(
            client_voucher_id=client_voucher_id,
            resource_id=resource_id,
        )
        if existing:
            raise ConflictException(
                f"Resource {resource_id} is already linked to "
                f"client voucher {client_voucher_id}"
            )

        # mutate
        resource = await self.repo.add(
            center_id=center_id,
            client_voucher_id=client_voucher_id,
            resource_id=resource_id,
            resource_type=resource_type,
        )

        # return
        return ClientVoucherResourceAtomic.linked(resource=resource)
