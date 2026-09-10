from ..models import DirectoryCenter
from ..repository import DirectoryCenterRepository


class ListNearbyDirectoryCentersService:
    def __init__(
        self,
        repo: DirectoryCenterRepository,
    ):
        self.repo = repo

    async def execute(
        self,
        *,
        latitude: float,
        longitude: float,
        radius_m: int,
        limit: int,
    ) -> list[DirectoryCenter]:
        # return
        return await self.repo.list_nearby(
            latitude=latitude,
            longitude=longitude,
            radius_m=radius_m,
            limit=limit,
        )
