from datetime import date

from ..models import CredentialStatus
from app.core.exceptions import EntityNotFoundException
from app.core.type import unset

from ..events import CredentialAtomic
from ..models import PersonCredential
from ..repository import PersonCredentialRepository


class UpdateCredentialService:
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
        title: str = unset,
        organization: str = unset,
        description: str | None = unset,
        start_date: date | None = unset,
        end_date: date | None = unset,
        is_current: bool = unset,
        meta: dict | None = unset,
        changed: dict | None = None,
    ) -> tuple[CredentialAtomic | None, PersonCredential]:
        # load
        credential = await self.repo.get_by_person(credential_id, person_id=person_id)

        # compute
        fields = {
            "title": title,
            "organization": organization,
            "description": description,
            "start_date": start_date,
            "end_date": end_date,
            "is_current": is_current,
            "meta": meta,
        }
        if all(v is unset for v in fields.values()):
            return None, credential

        # return (수정 시 verification 리셋)
        updated = await self.repo.update_in_place(
            credential_id,
            **fields,
            status=CredentialStatus.UNVERIFIED,
            requested_at=None,
            reviewed_at=None,
            reviewed_by=None,
            reject_reason=None,
        )
        if not updated:
            raise EntityNotFoundException(f"Credential not found: {credential_id}")

        await self.repo.recompute_certification(person_id=updated.person_id)
        return CredentialAtomic.updated(credential=updated, changed=changed or {})
