from app.modules.billing.price_list.events import PriceListAtomic
from app.modules.billing.price_list.models import PriceList
from app.modules.billing.price_list.repository import PriceListRepository


class DeletePriceListService:
    def __init__(self, repo: PriceListRepository):
        self.repo = repo

    async def execute(
        self,
        price_list_id: str,
        center_id: str,
    ) -> tuple[PriceListAtomic, PriceList]:
        record = await self.repo.get_in_center(
            price_list_id=price_list_id,
            center_id=center_id,
        )

        await self.repo.remove_in_center(
            price_list_id=price_list_id,
            center_id=center_id,
        )
        return PriceListAtomic.deleted(price_list=record)
