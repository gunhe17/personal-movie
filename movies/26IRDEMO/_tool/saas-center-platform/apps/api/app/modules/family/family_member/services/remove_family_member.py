from app.core.type import uuid_str

from ..models import FamilyMember
from ..repository import FamilyMemberRepository


class RemoveFamilyMemberService:
    def __init__(
        self,
        repo: FamilyMemberRepository,
    ):
        self.repo = repo

    async def execute(
        self,
        *,
        member_id: uuid_str,
    ) -> FamilyMember | None:
        # return
        return await self.repo.remove_by_id(id=member_id)
