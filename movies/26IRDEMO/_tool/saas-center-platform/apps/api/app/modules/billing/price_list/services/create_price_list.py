from app.modules.billing.price_list.events import PriceListAtomic
from app.modules.billing.price_list.models import PriceList, ServiceType
from app.modules.billing.price_list.repository import PriceListRepository


class CreatePriceListService:
    def __init__(self, repo: PriceListRepository):
        self.repo = repo

    async def execute(
        self,
        *,
        center_id: str,
        service_type: ServiceType,
        service_name: str,
        reference_id: str | None,
        unit_price: int,
        is_active: bool,
        memo: str | None,
        source: str,
        account_id: str,
    ) -> tuple[PriceListAtomic, PriceList]:
        record = await self.repo.add(
            center_id=center_id,
            service_type=service_type,
            service_name=service_name,
            reference_id=reference_id,
            unit_price=unit_price,
            is_active=is_active,
            memo=memo,
            source=source,
            created_by=account_id,
        )
        return PriceListAtomic.created(price_list=record)
