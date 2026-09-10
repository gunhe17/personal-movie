from app.modules.billing.price_list.models import PriceList
from app.modules.billing.price_list.repository import PriceListRepository


class GetPriceListService:
    def __init__(self, repo: PriceListRepository):
        self.repo = repo

    async def execute(
        self,
        price_list_id: str,
        center_id: str,
    ) -> PriceList:
        record = await self.repo.get_in_center(
            price_list_id=price_list_id,
            center_id=center_id,
        )

        return record
