from app.core.type import uuid_str

from ..models import Profile
from ..repository import ProfileRepository


class ListProfilesService:
    def __init__(self, repo: ProfileRepository):
        self.repo = repo

    async def execute(
        self,
        *,
        family_id: uuid_str,
    ) -> list[Profile]:
        # return
        return await self.repo.list_by_family(family_id=family_id)
