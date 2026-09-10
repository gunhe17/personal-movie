from sqlalchemy import select, func, or_
from sqlalchemy.ext.asyncio import AsyncSession

from app.modules.center.center_application.models import CenterApplication
from app.modules.person.person.models import Person
from app.modules.auth.account.models import Account


class AdminApplicationRepository:
    def __init__(self, session: AsyncSession):
        self._session = session

    async def list_applications_with_page(
        self,
        *,
        status: str | None = None,
        search: str | None = None,
        page: int = 1,
        size: int = 20,
    ) -> tuple[list[tuple[CenterApplication, str, str]], int]:
        conditions = [
            CenterApplication.deleted_at.is_(None),
            Person.deleted_at.is_(None),
        ]

        if status:
            conditions.append(
                func.upper(CenterApplication.status) == status.upper()
            )

        if search:
            search_pattern = f"%{search}%"
            conditions.append(
                or_(
                    CenterApplication.name.ilike(search_pattern),
                    Person.name.ilike(search_pattern),
                )
            )

        # 총 개수
        count_stmt = (
            select(func.count())
            .select_from(CenterApplication)
            .join(Account, CenterApplication.created_by == Account.id)
            .join(Person, Person.account_id == Account.id)
            .where(*conditions, Account.deleted_at.is_(None))
        )
        total = (await self._session.execute(count_stmt)).scalar_one()

        # 메인 쿼리
        offset = (page - 1) * size
        stmt = (
            select(CenterApplication, Person.name, Account.email)
            .join(Account, CenterApplication.created_by == Account.id)
            .join(Person, Person.account_id == Account.id)
            .where(*conditions, Account.deleted_at.is_(None))
            .order_by(CenterApplication.created_at.desc())
            .offset(offset)
            .limit(size)
        )
        rows = (await self._session.execute(stmt)).all()
        return [(app, name, email) for app, name, email in rows], total

    async def aggregate_application_with_details(
        self, application_id: str
    ) -> tuple[CenterApplication, str, str] | None:
        stmt = (
            select(CenterApplication, Person.name, Account.email)
            .join(Account, CenterApplication.created_by == Account.id)
            .join(Person, Person.account_id == Account.id)
            .where(
                CenterApplication.id == application_id,
                CenterApplication.deleted_at.is_(None),
                Person.deleted_at.is_(None),
                Account.deleted_at.is_(None),
            )
        )
        return (await self._session.execute(stmt)).first()
