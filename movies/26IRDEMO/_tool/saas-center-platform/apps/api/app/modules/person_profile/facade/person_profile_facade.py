from app.core.type import unset, utc_dt
from app.infrastructure.persistence.unit_of_work import UnitOfWork

from ..person_profile.models import PersonProfile
from ..person_profile.repository import PersonProfileRepository
from ..person_profile.services.find_person_profile import FindPersonProfileService
from ..person_profile.services.upsert_person_profile import UpsertPersonProfileService


class PersonProfileFacade:
    def __init__(self, uow: UnitOfWork) -> None:
        self._uow = uow

    async def find_person_profile(
        self, *, center_id: str, member_id: str
    ) -> PersonProfile | None:
        repo = self._uow.repo(PersonProfileRepository)
        return await FindPersonProfileService(repo).execute(
            center_id=center_id, member_id=member_id
        )

    async def upsert_person_profile(
        self,
        *,
        center_id: str,
        member_id: str,
        content: dict,
        version: int = unset,
        analyzed_at: utc_dt | None = unset,
    ) -> PersonProfile:
        repo = self._uow.repo(PersonProfileRepository)
        return await UpsertPersonProfileService(repo).execute(
            center_id=center_id,
            member_id=member_id,
            content=content,
            version=version,
            analyzed_at=analyzed_at,
        )
