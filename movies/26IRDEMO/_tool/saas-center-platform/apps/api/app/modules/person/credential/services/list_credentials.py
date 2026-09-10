from ..models import PersonCredential
from ..repository import PersonCredentialRepository


class ListCredentialsService:
    def __init__(self, repo: PersonCredentialRepository):
        self.repo = repo

    async def execute(
        self,
        person_id: str,
        *,
        credential_type: str | None = None,
    ) -> list[PersonCredential]:
        # return
        return await self.repo.list_by_person(person_id, credential_type=credential_type)
