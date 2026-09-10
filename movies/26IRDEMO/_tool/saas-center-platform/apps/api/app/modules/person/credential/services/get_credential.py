from ..models import PersonCredential
from ..repository import PersonCredentialRepository


class GetCredentialService:
    def __init__(self, repo: PersonCredentialRepository):
        self.repo = repo

    async def execute(
        self,
        credential_id: str,
        person_id: str,
    ) -> PersonCredential:
        # return
        return await self.repo.get_by_person(credential_id, person_id=person_id)
