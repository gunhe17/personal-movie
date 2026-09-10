from ..models import CredentialStatus
from app.core.exceptions import EntityNotFoundException

from ..events import CredentialAtomic
from ..models import PersonCredential
from ..repository import PersonCredentialRepository


class UploadAttachmentService:
    def __init__(
        self,
        repo: PersonCredentialRepository,
    ):
        self.repo = repo

    async def execute(
        self,
        credential_id: str,
        person_id: str,
        *,
        url: str,
        filename: str,
        content_type: str,
        size: int,
    ) -> tuple[CredentialAtomic, PersonCredential]:
        # load
        await self.repo.get_by_person(credential_id, person_id=person_id)

        # return
        updated = await self.repo.update_in_place(
            credential_id,
            attachment_url=url,
            attachment_filename=filename,
            attachment_content_type=content_type,
            attachment_size=size,
            status=CredentialStatus.UNVERIFIED,
            requested_at=None,
            reviewed_at=None,
            reviewed_by=None,
            reject_reason=None,
        )
        if not updated:
            raise EntityNotFoundException(f"Credential not found: {credential_id}")

        await self.repo.recompute_certification(person_id=person_id)
        return CredentialAtomic.attachment_uploaded(credential=updated)
