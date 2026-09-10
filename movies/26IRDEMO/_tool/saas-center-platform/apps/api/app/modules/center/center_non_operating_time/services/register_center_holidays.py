from datetime import datetime

from ..events import NonOperatingTimeAtomic
from ..repository import NonOperatingTimeRepository
from ..models import NonOperatingTime


class RegisterCenterHolidaysService:
    def __init__(
        self,
        repo: NonOperatingTimeRepository,
    ):
        self.repo = repo

    async def execute(
        self,
        center_id: str,
        year: int,
        holidays: list[dict],
    ) -> tuple[list[NonOperatingTimeAtomic], list[NonOperatingTime]]:
        if not holidays:
            return [], []

        # load
        existing = await self.repo.list_system_created(
            center_id=center_id,
            year=year,
        )
        existing_keys = {(e.year, e.month, e.day) for e in existing}

        # create
        atomics: list[NonOperatingTimeAtomic] = []
        created: list[NonOperatingTime] = []
        for holiday in holidays:
            key = (holiday["year"], holiday["month"], holiday["day"])
            if key in existing_keys:
                continue

            atomic, non_op = NonOperatingTimeAtomic.created(
                non_op=await self.repo.add(
                    center_id=center_id,
                    year=holiday["year"],
                    month=holiday["month"],
                    day=holiday["day"],
                    reason=holiday["reason"],
                    created_by=None,
                    is_system_registered=True,
                    effective_from=datetime(year, 1, 1),
                    effective_to=datetime(year, 12, 31, 23, 59, 59),
                )
            )
            atomics.append(atomic)
            created.append(non_op)

        return atomics, created
