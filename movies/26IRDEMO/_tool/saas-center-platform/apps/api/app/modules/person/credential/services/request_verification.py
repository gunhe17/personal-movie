from ..models import CredentialStatus
from app.core.datetime_utils import utc_now
from app.core.exceptions import EntityNotFoundException, InvalidOperationException

from ..events import CredentialAtomic
from ..models import PersonCredential
from ..repository import PersonCredentialRepository


class RequestVerificationService:
    def __init__(self, repo: PersonCredentialRepository):
        self.repo = repo

    async def execute(
        self,
        credential_id: str,
        person_id: str,
    ) -> tuple[CredentialAtomic, PersonCredential]:
        # load
        credential = await self.repo.get_by_person(credential_id, person_id=person_id)

        # verify
        if credential.status not in (CredentialStatus.UNVERIFIED, CredentialStatus.REJECTED):
            raise InvalidOperationException(
                "이미 검증 대기 또는 완료된 항목입니다. "
                f"(현재 상태: {credential.status})"
            )

        # return
        update_data = {
            "status": CredentialStatus.PENDING,
            "requested_at": utc_now(),
            "reviewed_at": None,
            "reviewed_by": None,
            "reject_reason": None,
        }
        updated = await self.repo.update_in_place(credential_id, **update_data)
        if not updated:
            raise EntityNotFoundException(f"Credential not found: {credential_id}")
        return CredentialAtomic.verification_requested(credential=updated)
