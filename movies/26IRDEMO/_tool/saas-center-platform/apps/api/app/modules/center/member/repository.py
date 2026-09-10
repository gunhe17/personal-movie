from datetime import datetime, date

from sqlalchemy import and_, func, select, update

from app.infrastructure.persistence.agent_query import resolve_sort
from app.core.exceptions import EntityNotFoundException
from app.core.type import unset, utc_dt, uuid_str
from app.core.type import typecheck
from app.infrastructure.persistence.new_repository import PostgresRepository

from .models import Member


class MemberRepository(PostgresRepository[Member]):
    model = Member

    # #
    # command

    @typecheck
    async def add(
        self,
        center_id: uuid_str,
        person_id: uuid_str,
        role_id: uuid_str,
        employment_type: str | None = None,
        color: str | None = None,
        profile_image_url: str | None = None,
    ) -> Member:
        return await super().add(
            Member(
                center_id=center_id,
                person_id=person_id,
                role_id=role_id,
                employment_type=employment_type,
                color=color,
                profile_image_url=profile_image_url,
            )
        )

    @typecheck
    async def update_in_place(
        self,
        id: uuid_str,
        *,
        role_id: uuid_str = unset,
        employment_type: str | None = unset,
        hire_date: date | None = unset,
        profile_image_url: str | None = unset,
        color: str | None = unset,
        memo: str | None = unset,
        careers: list | None = unset,
        educations: list | None = unset,
        certifications: list | None = unset,
        status: str = unset,
    ) -> Member | None:
        return await self.update_fields(
            id,
            role_id=role_id,
            employment_type=employment_type,
            hire_date=hire_date,
            profile_image_url=profile_image_url,
            color=color,
            memo=memo,
            careers=careers,
            educations=educations,
            certifications=certifications,
            status=status,
        )

    @typecheck
    async def update_role_by_ids(
        self,
        center_id: uuid_str,
        member_ids: list[str],
        new_role_id: uuid_str,
    ) -> list[Member]:
        if not member_ids:
            return []

        await self._session.execute(
            update(Member)
            .where(
                Member.id.in_(member_ids),
                Member.center_id == center_id,
                Member.deleted_at.is_(None),
            )
            .values(role_id=new_role_id)
        )
        return await self._filter(
            where=[
                Member.id.in_(member_ids),
                Member.center_id == center_id,
            ]
        )

    # #
    # query

    @typecheck
    async def list_by_center(
        self,
        center_id: uuid_str,
        role_id: uuid_str | None = None,
        person_ids: list[str] | None = None,
        memo: str | None = None,
        employment_type: str | None = None,
        hire_date_from: date | None = None,
        hire_date_to: date | None = None,
        created_after: utc_dt | None = None,
        *,
        skip: int = 0,
        limit: int = 100,
    ) -> list[Member]:
        conditions = self._build_member_filters(
            center_id=center_id,
            role_id=role_id,
            person_ids=person_ids,
            memo=memo,
            employment_type=employment_type,
            hire_date_from=hire_date_from,
            hire_date_to=hire_date_to,
            created_after=created_after,
        )
        if conditions is None:
            return []

        return await self._filter(
            where=conditions,
            order_by="created_at",
            descending=True,
            limit=limit,
            offset=skip,
        )

    @typecheck
    async def count_by_center(
        self,
        center_id: uuid_str,
        role_id: uuid_str | None = None,
        person_ids: list[str] | None = None,
        memo: str | None = None,
        employment_type: str | None = None,
        hire_date_from: date | None = None,
        hire_date_to: date | None = None,
        created_after: utc_dt | None = None,
    ) -> int:
        conditions = self._build_member_filters(
            center_id=center_id,
            role_id=role_id,
            person_ids=person_ids,
            memo=memo,
            employment_type=employment_type,
            hire_date_from=hire_date_from,
            hire_date_to=hire_date_to,
            created_after=created_after,
        )
        if conditions is None:
            return 0

        return await self._count(where=conditions)

    @staticmethod
    def _build_member_filters(
        center_id: str,
        role_id: str | None,
        person_ids: list[str] | None,
        memo: str | None,
        employment_type: str | None = None,
        hire_date_from: date | None = None,
        hire_date_to: date | None = None,
        created_after: datetime | None = None,
    ):
        conditions = [Member.center_id == center_id, Member.deleted_at.is_(None)]

        if role_id is not None:
            conditions.append(Member.role_id == role_id)

        if person_ids is not None:
            if not person_ids:
                return None
            conditions.append(Member.person_id.in_(person_ids))

        if memo is not None:
            conditions.append(Member.memo.ilike(f"%{memo}%"))

        if employment_type is not None:
            conditions.append(Member.employment_type == employment_type)

        if hire_date_from is not None:
            conditions.append(Member.hire_date >= hire_date_from)

        if hire_date_to is not None:
            conditions.append(Member.hire_date <= hire_date_to)

        if created_after is not None:
            conditions.append(Member.created_at >= created_after)

        return conditions

    @typecheck
    async def list_agent_filtered(
        self,
        center_id: uuid_str,
        *,
        sort: str | None = None,
        limit: int = 20,
        role_id: str | None = None,
        status: str | None = None,
        employment_type: str | None = None,
        memo: str | None = None,
        hire_date_from: date | None = None,
        hire_date_to: date | None = None,
        ids: list[str] | None = None,
    ) -> tuple[list[Member], int]:
        where = [Member.center_id == center_id]
        if ids is not None:
            where.append(Member.id.in_(ids))
        if role_id:
            where.append(Member.role_id == role_id)
        if status:
            where.append(Member.status == status)
        if employment_type:
            where.append(Member.employment_type == employment_type)
        if memo:
            where.append(Member.memo.ilike(f"%{memo}%"))
        if hire_date_from:
            where.append(Member.hire_date >= hire_date_from)
        if hire_date_to:
            where.append(Member.hire_date <= hire_date_to)
        col, descending = resolve_sort(
            sort, event_columns={"hire": "hire_date"}
        )
        rows = await self._filter(
            where=where, order_by=col, descending=descending, limit=limit
        )
        total = await self._count(where=where)
        return rows, total

    @typecheck
    async def get_in_center(
        self,
        member_id: uuid_str,
        center_id: uuid_str,
    ) -> Member:
        member = await self._find(
            where=[
                Member.id == member_id,
                Member.center_id == center_id,
            ]
        )
        if member is None:
            raise EntityNotFoundException(f"멤버를 찾을 수 없습니다: {member_id}")
        return member

    @typecheck
    async def find_by_person(
        self,
        center_id: uuid_str,
        person_id: uuid_str,
    ) -> Member | None:
        return await self._find(
            where=[
                Member.center_id == center_id,
                Member.person_id == person_id,
            ]
        )

    @typecheck
    async def get_by_person(
        self,
        center_id: uuid_str,
        person_id: uuid_str,
    ) -> Member:
        member = await self.find_by_person(center_id=center_id, person_id=person_id)
        if member is None:
            raise EntityNotFoundException("해당 센터의 멤버십을 찾을 수 없습니다.")
        return member

    @typecheck
    async def list_by_person(self, person_id: uuid_str) -> list[Member]:
        return await self._filter(
            where=[Member.person_id == person_id],
            order_by="created_at",
            descending=True,
        )

    @typecheck
    async def list_by_ids(self, member_ids: list[str]) -> list[Member]:
        if not member_ids:
            return []

        return await self._filter(where=[Member.id.in_(member_ids)])

    @typecheck
    async def list_used_colors(self, center_id: uuid_str) -> list[str]:
        stmt = select(Member.color).where(
            and_(
                Member.center_id == center_id,
                Member.deleted_at.is_(None),
                Member.color.isnot(None),
            )
        )
        result = await self._session.execute(stmt)
        return [row[0] for row in result.all()]

    @typecheck
    async def aggregate_by_roles(self, center_id: uuid_str) -> dict[str, int]:
        stmt = (
            select(Member.role_id, func.count())
            .where(
                and_(
                    Member.center_id == center_id,
                    Member.deleted_at.is_(None),
                )
            )
            .group_by(Member.role_id)
        )
        result = await self._session.execute(stmt)
        return dict(result.all())

    @typecheck
    async def count_by_role_id(
        self,
        center_id: uuid_str,
        role_id: uuid_str,
    ) -> int:
        return await self._count(
            where=[
                Member.center_id == center_id,
                Member.role_id == role_id,
            ]
        )
