from app.modules.billing.price_list.models import PriceList
from app.modules.billing.price_list.repository import PriceListRepository


class ListPriceListsByReferenceIdsService:
    def __init__(
        self,
        repo: PriceListRepository,
    ):
        self.repo = repo

    async def execute(
        self,
        center_id: str,
        *,
        reference_ids: list[str],
    ) -> list[PriceList]:
        return await self.repo.list_by_reference_ids(
            center_id=center_id,
            reference_ids=reference_ids,
        )
