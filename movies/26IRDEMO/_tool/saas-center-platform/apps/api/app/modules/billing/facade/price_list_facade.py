from app.infrastructure.persistence.unit_of_work import UnitOfWork
from app.modules.billing.price_list.events import PriceListAtomic
from app.modules.billing.price_list.models import PriceList
from app.modules.billing.price_list.repository import PriceListRepository
from app.modules.billing.price_list.schemas import (
    PriceListCreate,
    PriceListListResponse,
    PriceListResponse,
    PriceListUpdate,
    ServiceType,
)
from app.modules.billing.price_list.services import (
    CreatePriceListService,
    DeletePriceListService,
    GetPriceListService,
    ListPriceListsByReferenceIdsService,
    ListPriceListsService,
    UpdatePriceListService,
)


class PriceListFacade:
    def __init__(self, uow: UnitOfWork):
        self._uow = uow

    def _repo(self) -> PriceListRepository:
        return self._uow.repo(PriceListRepository)

    async def create_price_list(
        self,
        *,
        center_id: str,
        data: PriceListCreate,
        account_id: str,
    ) -> tuple[PriceListAtomic, PriceList]:
        service = CreatePriceListService(self._repo())
        return await service.execute(
            center_id=center_id,
            service_type=data.service_type,
            service_name=data.service_name,
            reference_id=data.reference_id,
            unit_price=data.unit_price,
            is_active=data.is_active,
            memo=data.memo,
            source=data.source,
            account_id=account_id,
        )

    async def list_price_lists_with_response(
        self,
        *,
        center_id: str,
        service_type: ServiceType | None = None,
        is_active: bool | None = None,
        search: str | None = None,
        page: int = 1,
        size: int = 50,
    ) -> PriceListListResponse:
        service = ListPriceListsService(self._repo())
        rows, meta = await service.execute(
            center_id=center_id,
            service_type=service_type,
            is_active=is_active,
            search=search,
            page=page,
            size=size,
        )
        return PriceListListResponse.build(
            items=[PriceListResponse.model_validate(r) for r in rows],
            total=meta["total"],
            page=page,
            size=size,
        )

    async def get_price_list_with_response(
        self,
        *,
        center_id: str,
        price_list_id: str,
    ) -> PriceListResponse:
        service = GetPriceListService(self._repo())
        record = await service.execute(
            price_list_id=price_list_id,
            center_id=center_id,
        )
        return PriceListResponse.model_validate(record)

    async def update_price_list(
        self,
        *,
        center_id: str,
        price_list_id: str,
        data: PriceListUpdate,
    ) -> tuple[PriceListAtomic, PriceList]:
        # omit/null 판정은 HTTP 경계 한 곳 — set된 필드만 관통, non-nullable 명시 null은 드롭(유지)
        fields = {k: getattr(data, k) for k in data.model_fields_set}
        for key in ("service_type", "service_name", "unit_price", "is_active"):
            if key in fields and fields[key] is None:
                del fields[key]

        service = UpdatePriceListService(self._repo())
        return await service.execute(
            price_list_id=price_list_id,
            center_id=center_id,
            changed=data.model_dump(mode="json", exclude_unset=True),
            **fields,
        )

    async def delete_price_list(
        self,
        *,
        center_id: str,
        price_list_id: str,
    ) -> tuple[PriceListAtomic, PriceList]:
        service = DeletePriceListService(self._repo())
        return await service.execute(
            price_list_id=price_list_id,
            center_id=center_id,
        )

    async def list_by_reference_ids_with_response(
        self,
        *,
        center_id: str,
        reference_ids: list[str],
    ) -> list[PriceListResponse]:
        records = await ListPriceListsByReferenceIdsService(self._repo()).execute(
            center_id=center_id,
            reference_ids=reference_ids,
        )
        return [PriceListResponse.model_validate(r) for r in records]

