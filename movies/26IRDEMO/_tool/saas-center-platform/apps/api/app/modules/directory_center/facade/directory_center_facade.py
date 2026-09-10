from app.infrastructure.persistence.unit_of_work import UnitOfWork
from app.modules.directory_center.directory_center.models import DirectoryCenter
from app.modules.directory_center.directory_center.repository import (
    DirectoryCenterRepository,
)
from app.modules.directory_center.directory_center.services.list_nearby_directory_centers import (
    ListNearbyDirectoryCentersService,
)


class DirectoryCenterFacade:
    def __init__(
        self,
        uow: UnitOfWork,
    ):
        self._uow = uow

    async def list_nearby(
        self,
        *,
        latitude: float,
        longitude: float,
        radius_m: int,
        limit: int,
    ) -> list[DirectoryCenter]:
        repo = self._uow.repo(DirectoryCenterRepository)
        return await ListNearbyDirectoryCentersService(repo).execute(
            latitude=latitude,
            longitude=longitude,
            radius_m=radius_m,
            limit=limit,
        )
