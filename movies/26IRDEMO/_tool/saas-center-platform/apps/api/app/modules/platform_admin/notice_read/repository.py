from sqlalchemy import select, func, case

from app.core.type import uuid_str
from app.core.type import typecheck
from app.infrastructure.persistence.new_repository import PostgresRepository
from app.modules.notice.notice_read.models import NoticeRead
from app.modules.center.center.models import Center
from app.modules.center.member.models import Member
from app.modules.person.person.models import Person
from app.modules.role.role.models import Role


class NoticeReadRepository(PostgresRepository[NoticeRead]):
    model = NoticeRead

    # #
    # query

    @typecheck
    async def aggregate_read_status_by_notice(
        self,
        notice_id: uuid_str,
        *,
        search: str | None = None,
        is_read: bool | None = None,
        page: int = 1,
        size: int = 10,
    ) -> tuple[list[dict], int]:
        # 서브쿼리: 센터별 읽음 집계
        read_sub = (
            select(
                NoticeRead.center_id,
                func.count(NoticeRead.id).label("read_count"),
                func.min(NoticeRead.created_at).label("first_read_at"),
            )
            .where(NoticeRead.notice_id == notice_id)
            .group_by(NoticeRead.center_id)
            .subquery()
        )

        # 서브쿼리: 센터별 활성 멤버 수
        member_count_sub = (
            select(
                Member.center_id,
                func.count(Member.id).label("member_count"),
            )
            .where(
                Member.deleted_at.is_(None),
                Member.status == "active",
            )
            .group_by(Member.center_id)
            .subquery()
        )

        # 공통 조건
        base_conditions = [
            Center.deleted_at.is_(None),
            Center.is_active.is_(True),
        ]

        if search:
            base_conditions.append(Center.name.ilike(f"%{search}%"))

        if is_read is True:
            base_conditions.append(read_sub.c.read_count > 0)
        elif is_read is False:
            base_conditions.append(
                func.coalesce(read_sub.c.read_count, 0) == 0
            )

        # 공통 FROM 절
        base_from = (
            select(Center.id)
            .outerjoin(read_sub, Center.id == read_sub.c.center_id)
            .where(*base_conditions)
        )

        # COUNT 쿼리
        count_stmt = select(func.count()).select_from(base_from.subquery())
        total = (await self._session.execute(count_stmt)).scalar() or 0

        # 메인 쿼리: 페이지네이션 적용
        stmt = (
            select(
                Center.id.label("center_id"),
                Center.name.label("center_name"),
                func.coalesce(read_sub.c.read_count, 0).label("read_count"),
                read_sub.c.first_read_at,
                func.coalesce(member_count_sub.c.member_count, 0).label("member_count"),
            )
            .outerjoin(read_sub, Center.id == read_sub.c.center_id)
            .outerjoin(member_count_sub, Center.id == member_count_sub.c.center_id)
            .where(*base_conditions)
            .order_by(
                # 미확인 센터 먼저, 그 다음 센터명 순
                case((read_sub.c.read_count > 0, 1), else_=0).asc(),
                Center.name.asc(),
            )
            .offset((page - 1) * size)
            .limit(size)
        )

        result = await self._session.execute(stmt)
        return [row._asdict() for row in result.all()], total

    @typecheck
    async def aggregate_center_read_detail(
        self,
        notice_id: uuid_str,
        center_id: uuid_str,
    ) -> list[dict]:
        stmt = (
            select(
                Member.id.label("member_id"),
                Person.name.label("name"),
                Role.name.label("role_name"),
                NoticeRead.created_at.label("read_at"),
            )
            .join(Person, Person.id == Member.person_id)
            .join(Role, Role.id == Member.role_id)
            .outerjoin(
                NoticeRead,
                (NoticeRead.member_id == Member.id)
                & (NoticeRead.notice_id == notice_id),
            )
            .where(
                Member.center_id == center_id,
                Member.deleted_at.is_(None),
                Member.status == "active",
                Person.deleted_at.is_(None),
                Role.deleted_at.is_(None),
            )
            .order_by(
                # 읽은 멤버 먼저, 읽은 시각 순
                case((NoticeRead.created_at.is_not(None), 0), else_=1).asc(),
                NoticeRead.created_at.asc(),
                Person.name.asc(),
            )
        )

        result = await self._session.execute(stmt)
        return [row._asdict() for row in result.all()]

    @typecheck
    async def find_center_name(self, center_id: uuid_str) -> str | None:
        stmt = select(Center.name).where(
            Center.id == center_id,
            Center.deleted_at.is_(None),
        )
        return (await self._session.execute(stmt)).scalar_one_or_none()
