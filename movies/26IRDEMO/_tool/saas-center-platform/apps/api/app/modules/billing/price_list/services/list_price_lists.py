from app.infrastructure.persistence.new_repository import Page
from app.modules.billing.price_list.models import PriceList
from app.modules.billing.price_list.repository import PriceListRepository
from app.modules.billing.price_list.models import ServiceType


class ListPriceListsService:
    def __init__(self, repo: PriceListRepository):
        self.repo = repo

    async def execute(
        self,
        *,
        center_id: str,
        service_type: ServiceType | None = None,
        is_active: bool | None = None,
        search: str | None = None,
        page: int = 1,
        size: int = 50,
    ) -> tuple[list[PriceList], Page]:
        return await self.repo.list_in_center_with_page(
            center_id=center_id,
            service_type=service_type,
            is_active=is_active,
            search=search,
            page=page,
            size=size,
        )
