from datetime import date, datetime

from ..repository import MemberRepository
from ..models import Member


class ListMembersByCenterService:
    def __init__(self, repo: MemberRepository):
        self.repo = repo

    async def execute(
        self,
        center_id: str,
        skip: int,
        limit: int,
        role_id: str | None = None,
        person_ids: list[str] | None = None,
        memo: str | None = None,
        employment_type: str | None = None,
        hire_date_from: date | None = None,
        hire_date_to: date | None = None,
        created_after: datetime | None = None,
    ) -> tuple[list[Member], int]:
        # load
        members = await self.repo.list_by_center(
            center_id=center_id,
            skip=skip,
            limit=limit,
            role_id=role_id,
            person_ids=person_ids,
            memo=memo,
            employment_type=employment_type,
            hire_date_from=hire_date_from,
            hire_date_to=hire_date_to,
            created_after=created_after,
        )
        total = await self.repo.count_by_center(
            center_id=center_id,
            role_id=role_id,
            person_ids=person_ids,
            memo=memo,
            employment_type=employment_type,
            hire_date_from=hire_date_from,
            hire_date_to=hire_date_to,
            created_after=created_after,
        )

        # return
        return members, total
