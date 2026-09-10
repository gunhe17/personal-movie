from datetime import date

from app.core.exceptions import ConflictException
from app.core.type import unset

from ..events import PersonAtomic
from ..models import Person
from ..repository import PersonRepository


class UpdatePersonService:
    def __init__(
        self,
        repo: PersonRepository,
    ):
        self.repo = repo

    async def execute(
        self,
        person_id: str,
        *,
        changed: dict | None = None,
        name: str = unset,
        phone: str = unset,
        birth: date | None = unset,
        gender: str | None = unset,
    ) -> tuple[PersonAtomic | None, Person]:
        # load
        person = await self.repo.get_by_id(person_id)

        # verify
        if phone is not unset and phone != person.phone:
            if await self.repo.list_by_phone(phone=phone):
                raise ConflictException(f"Phone number {phone} is already in use")

        # return (변경 필드 없음 = 사실 없음 → atomic None)
        if all(v is unset for v in (name, phone, birth, gender)):
            return None, person

        updated = await self.repo.update_in_place(
            person_id,
            name=name,
            phone=phone,
            birth=birth,
            gender=gender,
        )
        assert updated is not None
        return PersonAtomic.updated(person=updated, changed=changed or {})
