from app.core.type import uuid_str

from ..models import FamilyMember
from ..repository import FamilyMemberRepository


class FindMembershipByPersonService:
    def __init__(self, repo: FamilyMemberRepository):
        self.repo = repo

    async def execute(
        self,
        *,
        person_id: uuid_str,
    ) -> FamilyMember | None:
        # return
        return await self.repo.find_by_person(person_id=person_id)
