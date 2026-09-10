from math import cos, radians

from sqlalchemy import func, select

from app.core.type import typecheck, unset, uuid_str
from app.infrastructure.persistence.new_repository import PostgresRepository

from .models import DirectoryCenter

EARTH_RADIUS_M = 6_371_000
# 위도 1도 ≈ 111,320m (경도는 위도별 cos 보정)
METERS_PER_DEGREE_LAT = 111_320


class DirectoryCenterRepository(PostgresRepository[DirectoryCenter]):
    model = DirectoryCenter

    # #
    # command

    @typecheck
    async def add(
        self,
        source_id: int,
        name: str,
        address: str,
        latitude: float,
        longitude: float,
        category: str,
        phone_number: str | None = None,
        operating_hours_text: str | None = None,
        website_url: str | None = None,
    ) -> DirectoryCenter:
        return await super().add(
            DirectoryCenter(
                source_id=source_id,
                name=name,
                address=address,
                latitude=latitude,
                longitude=longitude,
                category=category,
                phone_number=phone_number,
                operating_hours_text=operating_hours_text,
                website_url=website_url,
            )
        )

    @typecheck
    async def update_in_place(
        self,
        id: uuid_str,
        *,
        name: str = unset,
        address: str = unset,
        latitude: float = unset,
        longitude: float = unset,
        category: str = unset,
        phone_number: str | None = unset,
        operating_hours_text: str | None = unset,
        website_url: str | None = unset,
    ) -> DirectoryCenter:
        updated = await self.update_fields(
            id,
            name=name,
            address=address,
            latitude=latitude,
            longitude=longitude,
            category=category,
            phone_number=phone_number,
            operating_hours_text=operating_hours_text,
            website_url=website_url,
        )
        assert updated is not None
        return updated

    # #
    # query

    @typecheck
    async def find_by_source_id(
        self,
        source_id: int,
    ) -> DirectoryCenter | None:
        return await self._find(where=[DirectoryCenter.source_id == source_id])

    @typecheck
    async def list_nearby(
        self,
        *,
        latitude: float,
        longitude: float,
        radius_m: int,
        limit: int,
    ) -> list[DirectoryCenter]:
        lat_delta = radius_m / METERS_PER_DEGREE_LAT
        lng_delta = radius_m / (METERS_PER_DEGREE_LAT * cos(radians(latitude)))

        distance_m = (
            2
            * EARTH_RADIUS_M
            * func.asin(
                func.sqrt(
                    func.pow(func.sin(func.radians(DirectoryCenter.latitude - latitude) / 2), 2)
                    + func.cos(func.radians(latitude))
                    * func.cos(func.radians(DirectoryCenter.latitude))
                    * func.pow(func.sin(func.radians(DirectoryCenter.longitude - longitude) / 2), 2)
                )
            )
        )

        stmt = (
            select(DirectoryCenter)
            .where(
                DirectoryCenter.deleted_at.is_(None),
                DirectoryCenter.latitude.between(latitude - lat_delta, latitude + lat_delta),
                DirectoryCenter.longitude.between(longitude - lng_delta, longitude + lng_delta),
                distance_m <= radius_m,
            )
            .order_by(distance_m.asc())
            .limit(limit)
        )
        return await self._scalars(stmt)
