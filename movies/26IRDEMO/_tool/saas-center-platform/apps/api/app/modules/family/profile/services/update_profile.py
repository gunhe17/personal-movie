from datetime import date

from app.core.type import unset, uuid_str

from ..models import Profile
from ..repository import ProfileRepository


class UpdateProfileService:
    def __init__(self, repo: ProfileRepository):
        self.repo = repo

    async def execute(
        self,
        *,
        profile_id: uuid_str,
        family_id: uuid_str,
        display_name: str = unset,
        birth_date: date | None = unset,
        gender: str | None = unset,
        image_url: str | None = unset,
    ) -> Profile:
        # return
        return await self.repo.update_in_family(
            id=profile_id,
            family_id=family_id,
            display_name=display_name,
            birth_date=birth_date,
            gender=gender,
            image_url=image_url,
        )
