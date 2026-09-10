from datetime import date

from app.core.exceptions import ConflictException

from ..events import PersonAtomic
from ..models import Person
from ..repository import PersonRepository


class CreatePersonService:
    def __init__(self, repo: PersonRepository):
        self.repo = repo

    async def execute(
        self,
        account_id: str,
        name: str,
        phone: str,
        birth: date | None = None,
        gender: str | None = None,
    ) -> tuple[PersonAtomic, Person]:
        # verify
        if await self.repo.find_by_account_id(account_id=account_id):
            raise ConflictException("이미 등록된 계정입니다.")
        if await self.repo.list_by_phone(phone=phone):
            raise ConflictException("이미 사용 중인 전화번호입니다.")

        # return
        person = await self.repo.add(
            account_id=account_id,
            name=name,
            phone=phone,
            birth=birth,
            gender=gender,
        )
        return PersonAtomic.created(person=person)
