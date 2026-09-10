from ..events import CredentialAtomic
from ..models import PersonCredential
from ..repository import PersonCredentialRepository


class DeleteCredentialService:
    def __init__(self, repo: PersonCredentialRepository):
        self.repo = repo

    async def execute(
        self,
        credential_id: str,
        person_id: str,
    ) -> tuple[CredentialAtomic, PersonCredential]:
        # load
        credential = await self.repo.get_by_person(credential_id, person_id=person_id)

        # remove
        await self.repo.remove_by_id(credential_id)
        await self.repo.recompute_certification(person_id=person_id)

        # return
        return CredentialAtomic.deleted(credential=credential)
