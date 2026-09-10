from app.core.type import uuid_str

from ..models import FamilyMember
from ..repository import FamilyMemberRepository


class ListFamilyMembersService:
    def __init__(
        self,
        repo: FamilyMemberRepository,
    ):
        self.repo = repo

    async def execute(
        self,
        *,
        family_id: uuid_str,
    ) -> list[FamilyMember]:
        # return
        return await self.repo.list_by_family(family_id=family_id)
