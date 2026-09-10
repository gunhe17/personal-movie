from ..repository import BillableItemRepository


class ListBilledSessionIdsService:
    def __init__(
        self,
        repo: BillableItemRepository,
    ):
        self.repo = repo

    async def execute(
        self,
        center_id: str,
        client_id: str,
        *,
        related_type: str,
    ) -> set[str]:
        return await self.repo.list_billed_session_ids(
            center_id=center_id,
            client_id=client_id,
            related_type=related_type,
        )
