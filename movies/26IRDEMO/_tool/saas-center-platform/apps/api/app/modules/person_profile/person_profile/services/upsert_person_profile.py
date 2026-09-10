from app.core.type import unset, utc_dt

from ..models import PersonProfile
from ..repository import PersonProfileRepository


class UpsertPersonProfileService:
    def __init__(self, repo: PersonProfileRepository) -> None:
        self.repo = repo

    async def execute(
        self,
        *,
        center_id: str,
        member_id: str,
        content: dict,
        version: int = unset,
        analyzed_at: utc_dt | None = unset,
    ) -> PersonProfile:
        # load
        found = await self.repo.find_by_member(center_id=center_id, member_id=member_id)

        # upsert (version·analyzed_at 미전달 시 기존 값 유지)
        if found is not None:
            return await self.repo.update_in_center(
                id=found.id,
                center_id=center_id,
                content=content,
                version=version,
                analyzed_at=analyzed_at,
            )
        return await self.repo.add(
            center_id=center_id,
            member_id=member_id,
            content=content,
            version=0 if version is unset else version,
            analyzed_at=None if analyzed_at is unset else analyzed_at,
        )
