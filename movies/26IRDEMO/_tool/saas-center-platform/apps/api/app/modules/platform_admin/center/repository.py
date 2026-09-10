from math import ceil
from datetime import timedelta
from app.core.datetime_utils import utc_now
from sqlalchemy import select, func, and_, or_
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.exceptions import EntityNotFoundException
from app.infrastructure.persistence.new_repository import Page
from app.modules.center.center.models import Center
from app.modules.center.member.models import Member
from app.modules.client.profile.models import Client
from app.modules.person.person.models import Person
from app.modules.role.role.models import Role
from app.modules.auth.account.models import Account
from app.modules.subscription.subscription.models import Subscription
from app.modules.role.role.schemas import RoleCode

# Role code for center admin
ADMIN_ROLE_CODE = RoleCode.ADMIN.value


class AdminCenterRepository:
    def __init__(self, session: AsyncSession):
        self._session = session

    async def find_center(self, center_id: str) -> Center | None:
        center = await self._session.get(Center, center_id)
        if center and center.deleted_at is not None:
            return None
        return center

    async def get_center(
        self,
        center_id: str,
    ) -> Center:
        center = await self.find_center(center_id)
        if not center:
            raise EntityNotFoundException(f"Center not found: {center_id}")
        return center


    async def list_admin_member_ids(self, center_id: str) -> list[str]:
        stmt = (
            select(Member.id)
            .join(Role, Member.role_id == Role.id)
            .where(
                Member.center_id == center_id,
                Member.deleted_at.is_(None),
                Role.deleted_at.is_(None),
                Role.code == ADMIN_ROLE_CODE,
            )
        )
        rows = (await self._session.execute(stmt)).scalars().all()
        return list(rows)

    async def list_centers_with_page(
        self,
        *,
        status: str | None = None,
        search: str | None = None,
        sort_by: str = "created_at",
        page: int = 1,
        size: int = 20,
    ) -> tuple[list[tuple[Center, int, str]], int]:
        # 서브쿼리: 센터별 활성 멤버 수
        member_count_subq = (
            select(func.count())
            .select_from(Member)
            .where(
                Member.center_id == Center.id,
                Member.deleted_at.is_(None),
            )
            .correlate(Center)
            .scalar_subquery()
            .label("member_count")
        )

        # 서브쿼리: 센터별 구독 플랜
        plan_subq = (
            select(Subscription.plan)
            .where(
                Subscription.center_id == Center.id,
                Subscription.deleted_at.is_(None),
            )
            .correlate(Center)
            .scalar_subquery()
            .label("plan")
        )

        # 기본 조건: soft delete 제외
        conditions = [Center.deleted_at.is_(None)]

        # 상태 필터
        if status == "active":
            conditions.append(Center.is_active.is_(True))
        elif status == "suspended":
            conditions.append(Center.is_active.is_(False))

        # 검색
        if search:
            search_pattern = f"%{search}%"
            conditions.append(
                or_(
                    Center.name.ilike(search_pattern),
                    Center.business_registration_number.ilike(search_pattern),
                )
            )

        # 총 개수
        count_stmt = (
            select(func.count())
            .select_from(Center)
            .where(*conditions)
        )
        total = (await self._session.execute(count_stmt)).scalar_one()

        # 정렬
        if sort_by == "name":
            order = Center.name.asc()
        elif sort_by == "member_count":
            order = member_count_subq.desc()
        else:
            order = Center.created_at.desc()

        # 페이징
        offset = (page - 1) * size

        # 메인 쿼리
        stmt = (
            select(Center, member_count_subq, plan_subq)
            .where(*conditions)
            .order_by(order)
            .offset(offset)
            .limit(size)
        )
        rows = (await self._session.execute(stmt)).all()
        return [(center, member_count, plan or "free") for center, member_count, plan in rows], total

    async def aggregate_members_with_details(
        self, center_id: str
    ) -> list[tuple[Member, Person, Role]]:
        stmt = (
            select(Member, Person, Role)
            .join(Person, Member.person_id == Person.id)
            .join(Role, Member.role_id == Role.id)
            .where(
                and_(
                    Member.center_id == center_id,
                    Member.deleted_at.is_(None),
                    Person.deleted_at.is_(None),
                    Role.deleted_at.is_(None),
                )
            )
            .order_by(Member.created_at.asc())
        )
        return list((await self._session.execute(stmt)).all())

    async def list_terminated_centers_with_page(
        self,
        *,
        status: str | None = None,
        search: str | None = None,
        expiring_soon: bool = False,
        page: int = 1,
        size: int = 20,
    ) -> tuple[list[Center], Page]:
        now = utc_now()
        retention_days = 30

        conditions = [Center.deleted_at.isnot(None)]

        # 상태 필터
        if status == "retention":
            # 보관 중: deleted_at + 30일 > now
            conditions.append(Center.deleted_at + timedelta(days=retention_days) > now)
        elif status == "expired":
            # 만료: deleted_at + 30일 <= now
            conditions.append(Center.deleted_at + timedelta(days=retention_days) <= now)

        # 만료 임박 (7일 이내)
        if expiring_soon:
            seven_days_later = now + timedelta(days=7)
            conditions.append(Center.deleted_at + timedelta(days=retention_days) > now)
            conditions.append(Center.deleted_at + timedelta(days=retention_days) <= seven_days_later)

        # 검색
        if search:
            search_pattern = f"%{search}%"
            conditions.append(
                or_(
                    Center.name.ilike(search_pattern),
                    Center.business_registration_number.ilike(search_pattern),
                )
            )

        # 총 개수
        count_stmt = select(func.count()).select_from(Center).where(*conditions)
        total = (await self._session.execute(count_stmt)).scalar_one()

        # 페이징
        offset = (page - 1) * size
        stmt = (
            select(Center)
            .where(*conditions)
            .order_by(Center.deleted_at.desc())
            .offset(offset)
            .limit(size)
        )
        rows = list((await self._session.execute(stmt)).scalars().all())
        return rows, Page(total=total, page=page, size=size, pages=ceil(total / size) if size else 0)

    async def aggregate_emails_by_person_ids(
        self, person_ids: list[str]
    ) -> dict[str, str]:
        if not person_ids:
            return {}
        stmt = (
            select(Person.id, Account.email)
            .join(Account, Person.account_id == Account.id)
            .where(
                Person.id.in_(person_ids),
                Person.deleted_at.is_(None),
                Account.deleted_at.is_(None),
            )
        )
        rows = (await self._session.execute(stmt)).all()
        return {pid: email for pid, email in rows}


class AdminCenterClientRepository:
    def __init__(self, session: AsyncSession):
        self._session = session

    async def find_center(self, center_id: str) -> Center | None:
        center = await self._session.get(Center, center_id)
        if center and center.deleted_at is not None:
            return None
        return center

    async def get_center(
        self,
        center_id: str,
    ) -> Center:
        center = await self.find_center(center_id)
        if not center:
            raise EntityNotFoundException(f"Center not found: {center_id}")
        return center

    async def list_clients_with_page(
        self,
        *,
        center_id: str,
        status: str | None = None,
        page: int = 1,
        size: int = 10,
    ) -> tuple[list[Client], Page]:
        conditions = [
            Client.center_id == center_id,
            Client.deleted_at.is_(None),
        ]

        if status:
            conditions.append(Client.status == status)

        # 총 건수
        count_stmt = select(func.count()).select_from(Client).where(*conditions)
        total = (await self._session.execute(count_stmt)).scalar_one()

        # 페이지네이션 적용 조회
        offset = (page - 1) * size
        stmt = (
            select(Client)
            .where(*conditions)
            .order_by(Client.created_at.desc())
            .offset(offset)
            .limit(size)
        )
        rows = list((await self._session.execute(stmt)).scalars().all())
        return rows, Page(total=total, page=page, size=size, pages=ceil(total / size) if size else 0)

    async def get_client_stats(self, center_id: str) -> tuple[int, int, int]:
        base_conditions = [
            Client.center_id == center_id,
            Client.deleted_at.is_(None),
        ]

        stats_stmt = (
            select(
                func.count().label("total"),
                func.count().filter(Client.status == "active").label("active"),
                func.count().filter(Client.status.in_(["inactive", "archived"])).label("inactive"),
            )
            .where(*base_conditions)
        )
        row = (await self._session.execute(stats_stmt)).one()
        return row.total, row.active, row.inactive
