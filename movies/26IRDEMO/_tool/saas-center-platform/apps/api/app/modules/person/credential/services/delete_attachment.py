from ..models import CredentialStatus
from app.core.exceptions import EntityNotFoundException

from ..events import CredentialAtomic
from ..models import PersonCredential
from ..repository import PersonCredentialRepository


class DeleteAttachmentService:
    def __init__(
        self,
        repo: PersonCredentialRepository,
    ):
        self.repo = repo

    async def execute(
        self,
        credential_id: str,
        person_id: str,
    ) -> tuple[CredentialAtomic, PersonCredential]:
        # load
        await self.repo.get_by_person(credential_id, person_id=person_id)

        # return
        updated = await self.repo.update_in_place(
            credential_id,
            attachment_url=None,
            attachment_filename=None,
            attachment_content_type=None,
            attachment_size=None,
            status=CredentialStatus.UNVERIFIED,
            requested_at=None,
            reviewed_at=None,
            reviewed_by=None,
            reject_reason=None,
        )
        if not updated:
            raise EntityNotFoundException(f"Credential not found: {credential_id}")

        await self.repo.recompute_certification(person_id=person_id)
        return CredentialAtomic.attachment_removed(credential=updated)
