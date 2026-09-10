from app.core.type import uuid_str

from ..models import Profile
from ..repository import ProfileRepository


class RemoveProfileService:
    def __init__(self, repo: ProfileRepository):
        self.repo = repo

    async def execute(
        self,
        *,
        profile_id: uuid_str,
        family_id: uuid_str,
    ) -> Profile | None:
        # return
        return await self.repo.remove_in_family(id=profile_id, family_id=family_id)
