from ..events import ClientVoucherResourceAtomic
from ..models import ClientVoucherResource
from ..repository import ClientVoucherResourceRepository


class UnlinkVoucherResourceService:
    def __init__(
        self,
        repo: ClientVoucherResourceRepository,
    ):
        self.repo = repo

    async def execute(
        self,
        mapping_id: str,
        center_id: str,
    ) -> tuple[ClientVoucherResourceAtomic, ClientVoucherResource]:
        # load
        resource = await self.repo.get_by_id_and_center(
            mapping_id=mapping_id,
            center_id=center_id,
        )

        # remove
        await self.repo.hard_delete_by_id(id=mapping_id)

        # return
        return ClientVoucherResourceAtomic.unlinked(resource=resource)
