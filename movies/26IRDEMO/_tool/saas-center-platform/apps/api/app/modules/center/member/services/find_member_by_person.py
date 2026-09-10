from ..repository import MemberRepository
from ..models import Member


class FindMemberByPersonService:
    def __init__(self, repo: MemberRepository):
        self.repo = repo

    async def execute(self, center_id: str, person_id: str) -> Member | None:
        # return
        return await self.repo.find_by_person(
            center_id=center_id,
            person_id=person_id,
        )
