from ..models import CredentialStatus
from app.core.datetime_utils import utc_now
from app.core.exceptions import EntityNotFoundException, InvalidOperationException

from ..events import CredentialAtomic
from ..models import PersonCredential
from ..repository import PersonCredentialRepository


class RejectCredentialService:
    def __init__(
        self,
        repo: PersonCredentialRepository,
    ):
        self.repo = repo

    async def execute(
        self,
        credential_id: str,
        admin_account_id: str,
        reason: str,
    ) -> tuple[CredentialAtomic, PersonCredential]:
        # verify
        if not reason or not reason.strip():
            raise InvalidOperationException("반려 사유를 입력해주세요.")
        credential = await self.repo.get_by_id(credential_id)
        if credential.status != CredentialStatus.PENDING:
            raise InvalidOperationException(
                f"검증 대기 상태가 아닙니다. (현재 상태: {credential.status})"
            )

        # mutate
        update_data = {
            "status": CredentialStatus.REJECTED,
            "reviewed_at": utc_now(),
            "reviewed_by": admin_account_id,
            "reject_reason": reason.strip(),
        }
        updated = await self.repo.update_in_place(credential_id, **update_data)
        if not updated:
            raise EntityNotFoundException(f"Credential not found: {credential_id}")

        await self.repo.recompute_certification(person_id=updated.person_id)

        # return
        return CredentialAtomic.rejected(credential=updated)
