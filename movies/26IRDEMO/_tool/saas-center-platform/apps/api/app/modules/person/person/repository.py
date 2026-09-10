from datetime import date

from app.core.type import unset, uuid_str
from app.core.type import typecheck
from app.infrastructure.persistence.new_repository import Page, PostgresRepository

from .models import Person


class PersonRepository(PostgresRepository[Person]):
    model = Person

    # #
    # command

    @typecheck
    async def add(
        self,
        account_id: uuid_str,
        name: str,
        phone: str,
        birth: date | None = None,
        gender: str | None = None,
    ) -> Person:
        return await super().add(
            Person(
                account_id=account_id,
                name=name,
                phone=phone,
                birth=birth,
                gender=gender,
            )
        )

    @typecheck
    async def update_in_place(
        self,
        id: uuid_str,
        *,
        name: str = unset,
        phone: str = unset,
        birth: date | None = unset,
        gender: str | None = unset,
    ) -> Person | None:
        return await self.update_fields(
            id,
            name=name,
            phone=phone,
            birth=birth,
            gender=gender,
        )

    # #
    # query

    @typecheck
    async def find_by_account_id(self, account_id: uuid_str) -> Person | None:
        return await self._find_by(column="account_id", value=account_id)

    @typecheck
    async def list_by_phone(self, phone: str) -> list[Person]:
        # phone 은 유니크 아님 — 같은 번호의 모든 Person 반환(빈=[]). 선택은 호출부 몫.
        return await self._filter(where=[Person.phone == phone])

    @typecheck
    async def list_by_ids(self, person_ids: list[str]) -> list[Person]:
        if not person_ids:
            return []
        return await self._filter(where=[Person.id.in_(person_ids)])

    @typecheck
    async def list_by_account_ids(self, account_ids: list[str]) -> list[Person]:
        if not account_ids:
            return []
        return await self._filter(where=[Person.account_id.in_(account_ids)])

    @typecheck
    async def list_by_name(self, name: str) -> list[Person]:
        return await self._filter(where=[Person.name.ilike(f"%{name}%")])

    @typecheck
    async def list_with_page(
        self,
        *,
        page: int = 1,
        size: int = 100,
    ) -> tuple[list[Person], Page]:
        return await self._page(page=page, size=size)
