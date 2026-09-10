from datetime import date

from ..events import CredentialAtomic
from ..models import PersonCredential
from ..repository import PersonCredentialRepository


class CreateCredentialService:
    def __init__(self, repo: PersonCredentialRepository):
        self.repo = repo

    async def execute(
        self,
        *,
        person_id: str,
        credential_type: str,
        title: str,
        organization: str,
        meta: dict,
        description: str | None = None,
        start_date: date | None = None,
        end_date: date | None = None,
        is_current: bool = False,
    ) -> tuple[CredentialAtomic, PersonCredential]:
        # return
        credential = await self.repo.add(
            person_id=person_id,
            credential_type=credential_type,
            title=title,
            organization=organization,
            description=description,
            start_date=start_date,
            end_date=end_date,
            is_current=is_current,
            meta=meta,
        )
        return CredentialAtomic.created(credential=credential)
