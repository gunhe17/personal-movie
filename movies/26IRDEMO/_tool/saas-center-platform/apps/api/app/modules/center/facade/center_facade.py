from app.infrastructure.persistence.unit_of_work import UnitOfWork
from ..center.events import CenterAtomic
from ..center.repository import CenterRepository
from ..center.services import (
    GetCenterService,
    CreateCenterService,
    UpdateCenterService,
    GetCentersByIdsService,
    SuspendCenterService,
    ActivateCenterService,
    RestoreCenterService,
    TerminateCenterService,
)
from ..center.schemas import CenterCreate, CenterUpdate, CenterResponse
from ..center.models import Center


class CenterFacade:
    def __init__(self, uow: UnitOfWork):
        self._uow = uow

    async def get_active_by_ids(self, center_ids: list[str]) -> dict[str, Center]:
        if not center_ids:
            return {}

        repo = self._uow.repo(CenterRepository)
        service = GetCentersByIdsService(repo)
        centers = await service.execute(center_ids)

        return {center.id: center for center in centers}

    async def get_center(self, center_id: str) -> Center:
        repo = self._uow.repo(CenterRepository)
        service = GetCenterService(repo)
        return await service.execute(center_id)

    async def suspend(self, center_id: str) -> tuple[CenterAtomic, Center]:
        return await SuspendCenterService(self._uow.repo(CenterRepository)).execute(
            center_id
        )

    async def activate(self, center_id: str) -> tuple[CenterAtomic, Center]:
        return await ActivateCenterService(self._uow.repo(CenterRepository)).execute(
            center_id
        )

    async def restore(self, center_id: str) -> tuple[CenterAtomic, Center]:
        return await RestoreCenterService(self._uow.repo(CenterRepository)).execute(
            center_id
        )

    async def terminate(self, center_id: str) -> tuple[CenterAtomic, Center]:
        return await TerminateCenterService(self._uow.repo(CenterRepository)).execute(
            center_id
        )

    async def create_center(
        self,
        data: CenterCreate,
    ) -> tuple[CenterAtomic, Center]:
        repo = self._uow.repo(CenterRepository)
        service = CreateCenterService(repo)
        return await service.execute(
            name=data.name,
            phone=data.phone,
            address=data.address.model_dump() if data.address else None,
            description=data.description,
            logo_url=data.logo_url,
            business_registration_number=data.business_registration_number,
            representative_name=data.representative_name,
        )

    async def create_center_with_response(
        self,
        data: CenterCreate,
    ) -> tuple[CenterAtomic, CenterResponse]:
        atomic, center = await self.create_center(data)
        return atomic, CenterResponse.model_validate(center)

    async def get_center_with_response(self, center_id: str) -> CenterResponse:
        center = await self.get_center(center_id)
        return CenterResponse.model_validate(center)

    async def update_center(
        self,
        center_id: str,
        data: CenterUpdate,
    ) -> tuple[CenterAtomic, Center]:
        repo = self._uow.repo(CenterRepository)
        service = UpdateCenterService(repo)
        return await service.execute(
            center_id=center_id,
            changed=data.model_dump(mode="json", exclude_unset=True),
            **data.model_dump(exclude_unset=True),
        )
