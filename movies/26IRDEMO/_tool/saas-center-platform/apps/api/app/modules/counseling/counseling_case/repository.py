from sqlalchemy import func, or_, select

from .models import CounselingCase, CounselingCaseStatus
from app.core.exceptions import EntityNotFoundException
from app.infrastructure.persistence.agent_query import resolve_sort
from app.core.type import unset, utc_dt, uuid_str
from app.core.type import typecheck
from app.infrastructure.persistence.new_repository import Page, PostgresRepository


class CounselingCaseRepository(PostgresRepository[CounselingCase]):
    model = CounselingCase

    # #
    # command

    @typecheck
    async def add(
        self,
        center_id: uuid_str,
        program_id: uuid_str,
        counselor_id: uuid_str,
        case_code: str,
        status: str,
        chief_complaint: str | None = None,
        memo: str | None = None,
        total_sessions: int | None = None,
        session_rule: dict | None = None,
    ) -> CounselingCase:
        return await super().add(
            CounselingCase(
                center_id=center_id,
                program_id=program_id,
                counselor_id=counselor_id,
                case_code=case_code,
                status=status,
                chief_complaint=chief_complaint,
                memo=memo,
                total_sessions=total_sessions,
                session_rule=session_rule,
            )
        )

    @typecheck
    async def update_in_center(
        self,
        case_id: uuid_str,
        center_id: uuid_str,
        *,
        counselor_id: uuid_str = unset,
        chief_complaint: str | None = unset,
        memo: str | None = unset,
        status: str = unset,
        total_sessions: int | None = unset,
        participant_snapshot: dict | None = unset,
    ) -> CounselingCase:
        await self.get_in_center(case_id=case_id, center_id=center_id)
        updated = await self.update_fields(
            case_id,
            counselor_id=counselor_id,
            chief_complaint=chief_complaint,
            memo=memo,
            status=status,
            total_sessions=total_sessions,
            participant_snapshot=participant_snapshot,
        )
        assert updated is not None
        return updated

    # #
    # query

    @typecheck
    async def list_by_center_with_page(
        self,
        center_id: uuid_str,
        status: str | None = None,
        *,
        page: int = 1,
        size: int = 20,
    ) -> tuple[list[CounselingCase], Page]:
        conditions = [CounselingCase.center_id == center_id]

        if status:
            conditions.append(CounselingCase.status == status)

        return await self._page(
            where=conditions,
            order_by="created_at",
            descending=True,
            page=page,
            size=size,
        )


    @typecheck
    async def list_all_case_ids_by_counselor(
        self,
        center_id: uuid_str,
        counselor_id: uuid_str,
    ) -> list[str]:
        stmt = select(CounselingCase.id).where(
            CounselingCase.center_id == center_id,
            CounselingCase.counselor_id == counselor_id,
            CounselingCase.deleted_at.is_(None),
        )
        result = await self._session.execute(stmt)
        return list(result.scalars().all())

    @typecheck
    async def list_case_ids_by_counselor_field(
        self,
        center_id: uuid_str,
        counselor_id: uuid_str,
    ) -> list[str]:
        stmt = select(CounselingCase.id).where(
            CounselingCase.center_id == center_id,
            CounselingCase.counselor_id == counselor_id,
            CounselingCase.deleted_at.is_(None),
        )
        result = await self._session.execute(stmt)
        return list(result.scalars().all())

    @typecheck
    async def list_filtered_with_page(
        self,
        center_id: uuid_str,
        counselor_id: uuid_str | None = None,
        status: str | None = None,
        program_ids: list[str] | None = None,
        case_ids: list[str] | None = None,
        start_date: str | None = None,
        end_date: str | None = None,
        keyword: str | None = None,
        case_code: str | None = None,
        total_sessions_min: int | None = None,
        total_sessions_max: int | None = None,
        sort: str = "desc",
        *,
        page: int = 1,
        size: int = 20,
    ) -> tuple[list[CounselingCase], Page]:
        from sqlalchemy import Date as SQLDate
        from sqlalchemy import cast

        conditions = [CounselingCase.center_id == center_id]

        if counselor_id:
            # 담당자 다중 선택은 콤마 조인된 ID 문자열로 전달된다 (단일=원소 1개)
            conditions.append(
                CounselingCase.counselor_id.in_(counselor_id.split(","))
            )
        if status:
            conditions.append(CounselingCase.status == status)
        if program_ids is not None:
            conditions.append(CounselingCase.program_id.in_(program_ids))
        if case_ids is not None:
            conditions.append(CounselingCase.id.in_(case_ids))
        from app.core.datetime_utils import coerce_date
        sd = coerce_date(start_date, "start_date")
        if sd:
            conditions.append(cast(CounselingCase.created_at, SQLDate) >= sd)
        ed = coerce_date(end_date, "end_date")
        if ed:
            conditions.append(cast(CounselingCase.created_at, SQLDate) <= ed)
        if keyword:
            conditions.append(
                or_(
                    CounselingCase.chief_complaint.ilike(f"%{keyword}%"),
                    CounselingCase.memo.ilike(f"%{keyword}%"),
                )
            )
        if case_code:
            conditions.append(CounselingCase.case_code == case_code)
        if total_sessions_min is not None:
            conditions.append(CounselingCase.total_sessions >= total_sessions_min)
        if total_sessions_max is not None:
            conditions.append(CounselingCase.total_sessions <= total_sessions_max)

        return await self._page(
            where=conditions,
            order_by="created_at",
            descending=sort != "asc",
            page=page,
            size=size,
        )

    @typecheck
    async def list_agent_filtered(
        self,
        center_id: uuid_str,
        *,
        sort: str | None = None,
        limit: int = 20,
        case_code: str | None = None,
        status: str | None = None,
        keyword: str | None = None,
        total_sessions_min: int | None = None,
        total_sessions_max: int | None = None,
        date_from: str | None = None,
        date_to: str | None = None,
        program_ids: list[str] | None = None,
        counselor_ids: list[str] | None = None,
        ids: list[str] | None = None,
    ) -> tuple[list[CounselingCase], int]:
        from sqlalchemy import Date as SQLDate
        from sqlalchemy import cast

        from app.core.datetime_utils import coerce_date

        where = [CounselingCase.center_id == center_id]
        if ids is not None:
            where.append(CounselingCase.id.in_(ids))
        if counselor_ids:
            where.append(CounselingCase.counselor_id.in_(counselor_ids))
        if status:
            where.append(CounselingCase.status == status)
        if program_ids:
            where.append(CounselingCase.program_id.in_(program_ids))
        sd = coerce_date(date_from, "date_from")
        if sd:
            where.append(cast(CounselingCase.created_at, SQLDate) >= sd)
        ed = coerce_date(date_to, "date_to")
        if ed:
            where.append(cast(CounselingCase.created_at, SQLDate) <= ed)
        if keyword:
            where.append(
                or_(
                    CounselingCase.chief_complaint.ilike(f"%{keyword}%"),
                    CounselingCase.memo.ilike(f"%{keyword}%"),
                )
            )
        if case_code:
            where.append(CounselingCase.case_code == case_code)
        if total_sessions_min is not None:
            where.append(CounselingCase.total_sessions >= total_sessions_min)
        if total_sessions_max is not None:
            where.append(CounselingCase.total_sessions <= total_sessions_max)
        col, descending = resolve_sort(sort, columns=frozenset({"total_sessions"}))
        rows = await self._filter(
            where=where, order_by=col, descending=descending, limit=limit
        )
        total = await self._count(where=where)
        return rows, total

    @typecheck
    async def find_in_center(
        self,
        case_id: uuid_str,
        center_id: uuid_str,
        counselor_id: uuid_str | None = None,
    ) -> CounselingCase | None:
        conditions = [
            CounselingCase.id == case_id,
            CounselingCase.center_id == center_id,
            CounselingCase.deleted_at.is_(None),
        ]

        if counselor_id:
            conditions.append(CounselingCase.counselor_id == counselor_id)

        stmt = select(CounselingCase).where(*conditions)
        result = await self._session.execute(stmt)
        return result.scalar_one_or_none()

    @typecheck
    async def get_in_center(
        self,
        case_id: uuid_str,
        center_id: uuid_str,
        counselor_id: uuid_str | None = None,
    ) -> CounselingCase:
        case = await self.find_in_center(
            case_id=case_id,
            center_id=center_id,
            counselor_id=counselor_id,
        )
        if case is None:
            raise EntityNotFoundException(f"CounselingCase not found: {case_id}")
        return case

    @typecheck
    async def list_by_ids(self, case_ids: list[str]) -> list[CounselingCase]:
        if not case_ids:
            return []

        stmt = select(CounselingCase).where(
            CounselingCase.id.in_(case_ids),
            CounselingCase.deleted_at.is_(None),
        )
        result = await self._session.execute(stmt)
        return list(result.scalars().all())

    @typecheck
    async def next_case_code(self, center_id: uuid_str) -> str:
        from sqlalchemy import text

        lock_key = abs(hash(center_id)) % (2**31)

        await self._session.execute(
            text("SELECT pg_advisory_xact_lock(:lock_key)"),
            {"lock_key": lock_key},
        )

        stmt = (
            select(func.max(CounselingCase.case_code))
            .where(CounselingCase.center_id == center_id)
        )
        result = await self._session.execute(stmt)
        max_code = result.scalar_one_or_none()

        if not max_code:
            return "C00001"

        number = int(max_code[1:])
        return f"C{number + 1:05d}"

    @typecheck
    async def aggregate_top_program_by_counselor(
        self,
        center_id: uuid_str,
        counselor_id: uuid_str,
        *,
        since: utc_dt,
    ) -> str | None:
        # 상담사의 최빈 program_id — 프로필 defaults용. 데이터 없으면 None.
        return await self._session.scalar(
            select(CounselingCase.program_id)
            .where(
                CounselingCase.center_id == center_id,
                CounselingCase.counselor_id == counselor_id,
                CounselingCase.created_at >= since,
                CounselingCase.deleted_at.is_(None),
            )
            .group_by(CounselingCase.program_id)
            .order_by(func.count().desc(), CounselingCase.program_id)
            .limit(1)
        )

    @typecheck
    async def aggregate_all_by_counselor_summary(
        self,
        center_id: uuid_str,
        counselor_id: uuid_str,
    ) -> list[tuple[str, str]]:
        stmt = (
            select(CounselingCase.id, CounselingCase.program_id)
            .where(
                CounselingCase.center_id == center_id,
                CounselingCase.counselor_id == counselor_id,
                CounselingCase.deleted_at.is_(None),
            )
        )
        result = await self._session.execute(stmt)
        return list(result.tuples().all())

    @typecheck
    async def find_recent_duplicate(
        self,
        center_id: uuid_str,
        program_id: uuid_str,
        counselor_id: uuid_str,
        minutes_threshold: int = 5,
    ) -> CounselingCase | None:
        from datetime import timedelta

        from app.core.datetime_utils import utc_now

        threshold_time = utc_now() - timedelta(minutes=minutes_threshold)

        stmt = (
            select(CounselingCase)
            .where(
                CounselingCase.center_id == center_id,
                CounselingCase.program_id == program_id,
                CounselingCase.counselor_id == counselor_id,
                CounselingCase.created_at >= threshold_time,
                CounselingCase.status == CounselingCaseStatus.ACTIVE,
                CounselingCase.deleted_at.is_(None),
            )
            .order_by(CounselingCase.created_at.desc())
            .limit(1)
        )
        result = await self._session.execute(stmt)
        return result.scalar_one_or_none()
