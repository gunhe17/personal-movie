from app.core.type import unset
from app.modules.billing.price_list.events import PriceListAtomic
from app.modules.billing.price_list.models import PriceList, ServiceType
from app.modules.billing.price_list.repository import PriceListRepository


class UpdatePriceListService:
    def __init__(self, repo: PriceListRepository):
        self.repo = repo

    async def execute(
        self,
        price_list_id: str,
        center_id: str,
        *,
        changed: dict,
        service_type: ServiceType = unset,
        service_name: str = unset,
        reference_id: str | None = unset,
        unit_price: int = unset,
        is_active: bool = unset,
        memo: str | None = unset,
    ) -> tuple[PriceListAtomic, PriceList]:
        record = await self.repo.get_in_center(
            price_list_id=price_list_id,
            center_id=center_id,
        )

        # 보낸 필드만 포함(미전달은 repo의 unset 기본값으로 유지). nullable은 명시 None=NULL clear.
        update_data: dict = {}
        if service_type is not unset:
            update_data["service_type"] = service_type
        if service_name is not unset:
            update_data["service_name"] = service_name
        if reference_id is not unset:
            update_data["reference_id"] = reference_id
        if unit_price is not unset:
            update_data["unit_price"] = unit_price
        if is_active is not unset:
            update_data["is_active"] = is_active
        if memo is not unset:
            update_data["memo"] = memo

        if update_data:
            # 사용자가 직접 수정하면 source를 manual로 변경
            if record.source == "synced":
                update_data["source"] = "manual"
            updated = await self.repo.update_in_center(
                price_list_id=price_list_id,
                center_id=center_id,
                **update_data,
            )
            assert updated is not None
            return PriceListAtomic.updated(price_list=updated, changed=changed)

        return PriceListAtomic.updated(price_list=record, changed=changed)
