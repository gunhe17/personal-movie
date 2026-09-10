from app.core.type import uuid_str

from ..models import FamilyMember
from ..repository import FamilyMemberRepository


class AddFamilyMemberService:
    def __init__(self, repo: FamilyMemberRepository):
        self.repo = repo

    async def execute(
        self,
        *,
        family_id: uuid_str,
        person_id: uuid_str,
        role: str = "owner",
    ) -> FamilyMember:
        # return
        return await self.repo.add(
            family_id=family_id,
            person_id=person_id,
            role=role,
        )
