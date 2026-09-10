from datetime import date

from app.core.type import unset
from app.infrastructure.persistence.unit_of_work import UnitOfWork

from ..person.events import PersonAtomic
from ..person.models import Person
from ..person.repository import PersonRepository
from ..person.services.delete_person import DeletePersonService
from ..person.services.find_person_by_id import FindPersonByIdService
from ..person.services.find_person_by_account import FindPersonByAccountService
from ..person.services.get_persons_by_ids import GetPersonsByIdsService
from ..person.services.list_persons_by_account_ids import ListPersonsByAccountIdsService
from ..person.services.list_persons_by_name import ListPersonsByNameService
from ..person.services.list_persons_by_phone import ListPersonsByPhoneService
from ..person.services.update_person import UpdatePersonService
from ..person.services.create_person import CreatePersonService
from ..credential.events import CredentialAtomic
from ..credential.models import PersonCredential
from ..credential.presigned import attach_presigned_url, attach_presigned_urls
from ..credential.repository import PersonCredentialRepository
from ..credential.schemas import CredentialResponse
from ..credential.services.approve_credential import ApproveCredentialService
from ..credential.services.reject_credential import RejectCredentialService
from ..credential.services.list_credentials import ListCredentialsService


class PersonFacade:
    def __init__(self, uow: UnitOfWork):
        self._uow = uow

    async def get_persons_by_ids(self, person_ids: list[str]) -> dict[str, Person]:
        repo = self._uow.repo(PersonRepository)
        service = GetPersonsByIdsService(repo)
        return await service.execute(person_ids)

    async def get_account_summaries_by_ids(
        self, account_ids: list[str]
    ) -> dict[str, str]:
        if not account_ids:
            return {}
        repo = self._uow.repo(PersonRepository)
        service = ListPersonsByAccountIdsService(repo)
        persons = await service.execute(account_ids)
        return {p.account_id: p.name for p in persons}

    async def find_person_by_account(self, account_id: str) -> Person | None:
        repo = self._uow.repo(PersonRepository)
        service = FindPersonByAccountService(repo)
        return await service.execute(account_id)

    async def find_person(self, person_id: str) -> Person | None:
        repo = self._uow.repo(PersonRepository)
        service = FindPersonByIdService(repo)
        return await service.execute(person_id)

    async def list_persons_by_name(self, name: str) -> list[Person]:
        repo = self._uow.repo(PersonRepository)
        service = ListPersonsByNameService(repo)
        return await service.execute(name)

    async def list_by_phone(self, phone: str) -> list[Person]:
        repo = self._uow.repo(PersonRepository)
        service = ListPersonsByPhoneService(repo)
        return await service.execute(phone)

    async def update_person(
        self,
        person_id: str,
        *,
        name: str = unset,
        phone: str = unset,
        gender: str | None = unset,
        birth: date | None = unset,
    ) -> tuple[PersonAtomic, Person]:
        repo = self._uow.repo(PersonRepository)
        service = UpdatePersonService(repo)
        return await service.execute(
            person_id,
            name=name,
            phone=phone,
            gender=gender,
            birth=birth,
        )

    async def delete_person(self, person_id: str) -> tuple[PersonAtomic, Person]:
        repo = self._uow.repo(PersonRepository)
        service = DeletePersonService(repo)
        return await service.execute(person_id)

    async def approve_credential(
        self,
        credential_id: str,
        admin_account_id: str,
    ) -> tuple[CredentialAtomic, PersonCredential]:
        repo = self._uow.repo(PersonCredentialRepository)
        service = ApproveCredentialService(repo)
        return await service.execute(credential_id, admin_account_id)

    async def reject_credential(
        self,
        credential_id: str,
        admin_account_id: str,
        reason: str,
    ) -> tuple[CredentialAtomic, PersonCredential]:
        repo = self._uow.repo(PersonCredentialRepository)
        service = RejectCredentialService(repo)
        return await service.execute(credential_id, admin_account_id, reason)

    async def attach_credential_presigned_url(
        self, credential: CredentialResponse
    ) -> CredentialResponse:
        return await attach_presigned_url(credential)

    async def attach_credential_presigned_urls(
        self, credentials: list[CredentialResponse]
    ) -> list[CredentialResponse]:
        return await attach_presigned_urls(credentials)

    async def list_credentials_by_person(
        self, person_id: str
    ) -> list[PersonCredential]:
        repo = self._uow.repo(PersonCredentialRepository)
        service = ListCredentialsService(repo)
        return await service.execute(person_id)

    async def create_person(
        self,
        account_id: str,
        name: str,
        phone: str | None = None,
        birth: date | None = None,
        gender: str | None = None,
    ) -> tuple[PersonAtomic, Person]:
        repo = self._uow.repo(PersonRepository)
        service = CreatePersonService(repo)
        return await service.execute(
            account_id=account_id,
            name=name,
            phone=phone,
            birth=birth,
            gender=gender,
        )
