from ..repository import BillableItemRepository


class MapSessionToClientVoucherService:
    def __init__(
        self,
        repo: BillableItemRepository,
    ):
        self.repo = repo

    async def execute(
        self,
        *,
        session_ids: list[str],
    ) -> dict[str, str]:
        # return
        return await self.repo.map_session_to_client_voucher(session_ids=session_ids)
