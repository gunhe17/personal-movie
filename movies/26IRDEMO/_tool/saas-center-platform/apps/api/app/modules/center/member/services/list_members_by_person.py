from ..repository import MemberRepository
from ..models import Member


class ListMembersByPersonService:
    def __init__(self, repo: MemberRepository):
        self.repo = repo

    async def execute(self, person_id: str) -> list[Member]:
        # return
        return await self.repo.list_by_person(person_id=person_id)
