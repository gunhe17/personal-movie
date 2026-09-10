from datetime import date

from app.core.type import uuid_str

from ..models import Profile
from ..repository import ProfileRepository


class CreateProfileService:
    def __init__(self, repo: ProfileRepository):
        self.repo = repo

    async def execute(
        self,
        *,
        family_id: uuid_str,
        display_name: str,
        relation: str = "child",
        birth_date: date | None = None,
        gender: str | None = None,
        image_url: str | None = None,
    ) -> Profile:
        # return
        return await self.repo.add(
            family_id=family_id,
            display_name=display_name,
            relation=relation,
            birth_date=birth_date,
            gender=gender,
            image_url=image_url,
        )
