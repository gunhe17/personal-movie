from math import asin, cos, radians, sin, sqrt

from app.infrastructure.persistence.unit_of_work import UnitOfWork
from app.modules.client_app.schemas import AppDirectoryCenterItem
from app.modules.directory_center.facade.directory_center_facade import (
    DirectoryCenterFacade,
)

EARTH_RADIUS_M = 6_371_000


def _haversine_m(
    lat1: float,
    lng1: float,
    lat2: float,
    lng2: float,
) -> int:
    dlat = radians(lat2 - lat1)
    dlng = radians(lng2 - lng1)
    a = sin(dlat / 2) ** 2 + cos(radians(lat1)) * cos(radians(lat2)) * sin(dlng / 2) ** 2
    return round(2 * EARTH_RADIUS_M * asin(sqrt(a)))


async def list_app_directory_centers_handler(
    *,
    latitude: float,
    longitude: float,
    radius_m: int,
    limit: int,
    uow: UnitOfWork,
) -> list[AppDirectoryCenterItem]:
    centers = await DirectoryCenterFacade(uow).list_nearby(
        latitude=latitude,
        longitude=longitude,
        radius_m=radius_m,
        limit=limit,
    )

    # return
    return [
        AppDirectoryCenterItem(
            id=center.id,
            name=center.name,
            address=center.address,
            latitude=center.latitude,
            longitude=center.longitude,
            category=center.category,
            phone_number=center.phone_number,
            operating_hours_text=center.operating_hours_text,
            website_url=center.website_url,
            distance_m=_haversine_m(latitude, longitude, center.latitude, center.longitude),
        )
        for center in centers
    ]
