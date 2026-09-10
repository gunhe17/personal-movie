"""cross-module READ 전용 표면 — DTO 반환(entity 미노출). write는 facade 경유."""
from dataclasses import dataclass

from app.core.type import uuid_str
from app.infrastructure.persistence.unit_of_work import UnitOfWork
from app.modules.person.person.models import Person
from app.modules.person.person.repository import PersonRepository


@dataclass(frozen=True)
class PersonRef:
    id: uuid_str
    account_id: uuid_str | None
    name: str
    phone: str
    gender: str | None


def _to_ref(person: Person) -> PersonRef:
    return PersonRef(
        id=person.id,
        account_id=person.account_id,
        name=person.name,
        phone=person.phone,
        gender=person.gender,
    )


class PersonClient:
    def __init__(
        self,
        uow: UnitOfWork,
    ):
        self._repo = uow.repo(PersonRepository)

    async def find_by_id(
        self,
        person_id: uuid_str,
    ) -> PersonRef | None:
        person = await self._repo.find_by_id(person_id)
        return _to_ref(person) if person else None

    async def find_by_account_id(
        self,
        account_id: uuid_str,
    ) -> PersonRef | None:
        person = await self._repo.find_by_account_id(account_id)
        return _to_ref(person) if person else None

    async def list_by_ids(
        self,
        person_ids: list[uuid_str],
    ) -> list[PersonRef]:
        return [_to_ref(p) for p in await self._repo.list_by_ids(person_ids)]
