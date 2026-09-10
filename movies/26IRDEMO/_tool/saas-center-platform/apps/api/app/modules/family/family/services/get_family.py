from app.core.type import uuid_str

from ..models import Family
from ..repository import FamilyRepository


class GetFamilyService:
    def __init__(
        self,
        repo: FamilyRepository,
    ):
        self.repo = repo

    async def execute(
        self,
        *,
        family_id: uuid_str,
    ) -> Family:
        # return
        return await self.repo.get_by_id(id=family_id)
