from sqlalchemy import Date as SQLDate
from sqlalchemy import cast, func, or_, select, text
from sqlalchemy import update as sql_update

from app.infrastructure.persistence.agent_query import resolve_sort
from app.core.exceptions import EntityNotFoundException
from app.core.type import unset, utc_dt, uuid_str
from app.core.type import typecheck
from app.infrastructure.persistence.new_repository import PostgresRepository

from .models import Schedule

# 취소된 세션만 남은 schedule_id를 찾는 서브쿼리 (Model import 없이 SQL 참조).
# 크로스모듈 JOIN 금지(persistence-repository §6)의 명문 예외 — 승인 2026-07-08:
# 충돌 판정("세션 전부 취소된 일정은 충돌 아님")에 타모듈 세션 상태가 본질 입력이고,
# 호출이 반복일정 루프(×N)라 application 조립으로 빼면 +2N 왕복 + 판정 로직 유출 역위반.
# 이 1곳 한정, 확장 금지. 성능 이슈 시 재설계가 아니라 center 스코프/상관조건 추가로 대응.
_CANCELLED_ONLY_SCHEDULE_IDS = text("""(
    SELECT schedule_id FROM (
        SELECT schedule_id, status FROM assessment_sessions WHERE deleted_at IS NULL
        UNION ALL
        SELECT schedule_id, status FROM counseling_sessions WHERE deleted_at IS NULL
    ) _sessions
    GROUP BY schedule_id
    HAVING COUNT(*) = SUM(CASE WHEN status = 'cancelled' THEN 1 ELSE 0 END)
)""")


class ScheduleRepository(PostgresRepository[Schedule]):
    model = Schedule

    # #
    # command

    @typecheck
    async def add(
        self,
        center_id: uuid_str,
        schedule_type: str,
        start: utc_dt,
        end: utc_dt,
        member_id: uuid_str | None = None,
        title: str | None = None,
        room_id: uuid_str | None = None,
        memo: str | None = None,
    ) -> Schedule:
        return await super().add(
            Schedule(
                center_id=center_id,
                schedule_type=schedule_type,
                start=start,
                end=end,
                member_id=member_id,
                title=title,
                room_id=room_id,
                memo=memo,
            )
        )

    @typecheck
    async def update_in_center(
        self,
        id: uuid_str,
        center_id: uuid_str,
        *,
        member_id: uuid_str | None = unset,
        title: str | None = unset,
        room_id: uuid_str | None = unset,
        start: utc_dt = unset,
        end: utc_dt = unset,
        memo: str | None = unset,
    ) -> Schedule:
        await self.get_in_center(id=id, center_id=center_id)
        updated = await self.update_fields(
            id,
            member_id=member_id,
            title=title,
            room_id=room_id,
            start=start,
            end=end,
            memo=memo,
        )
        assert updated is not None
        return updated

    @typecheck
    async def remove_by_ids(self, schedule_ids: list[str]) -> list[Schedule]:
        if not schedule_ids:
            return []
        # bulk 전이 — 영향 행을 RETURNING으로 반환(per-row atomic의 사실 누락 방지)
        stmt = (
            sql_update(Schedule)
            .where(
                Schedule.id.in_(schedule_ids),
                Schedule.deleted_at.is_(None),
            )
            .values(deleted_at=func.now())
            .returning(Schedule)
        )
        removed = list((await self._session.execute(stmt)).scalars().all())
        await self._session.flush()
        return removed

    @typecheck
    async def restore_by_ids(self, schedule_ids: list[str]) -> list[Schedule]:
        if not schedule_ids:
            return []
        # bulk 복구 — RETURNING으로 전 컬럼 적재 행 반환(onupdate 만료 속성의 lazy-load 차단)
        stmt = (
            sql_update(Schedule)
            .where(
                Schedule.id.in_(schedule_ids),
                Schedule.deleted_at.isnot(None),
            )
            .values(deleted_at=None, updated_at=func.now())
            .returning(Schedule)
        )
        restored = list((await self._session.execute(stmt)).scalars().all())
        await self._session.flush()
        return restored

    @typecheck
    async def acquire_room_lock(
        self,
        center_id: uuid_str,
        room_id: uuid_str,
    ) -> None:
        stmt = (
            select(Schedule)
            .where(
                Schedule.center_id == center_id,
                Schedule.room_id == room_id,
                Schedule.deleted_at.is_(None),
            )
            .order_by(Schedule.start.desc())
            .limit(1)
            .with_for_update()
        )
        await self._session.execute(stmt)

    # #
    # query

    @typecheck
    async def get_in_center(self, id: uuid_str, center_id: uuid_str) -> Schedule:
        schedule = await self._find(
            where=[Schedule.id == id, Schedule.center_id == center_id]
        )
        if schedule is None:
            raise EntityNotFoundException(f"Schedule not found: {id}")
        return schedule

    @typecheck
    async def list_conflicting(
        self,
        center_id: uuid_str,
        start: utc_dt,
        end: utc_dt,
        room_id: uuid_str | None = None,
        member_id: uuid_str | None = None,
        exclude_id: uuid_str | None = None,
    ) -> list[Schedule]:
        if not room_id and not member_id:
            return []

        or_clauses = []
        if room_id:
            or_clauses.append(Schedule.room_id == room_id)
        if member_id:
            or_clauses.append(Schedule.member_id == member_id)

        where = [
            Schedule.center_id == center_id,
            or_(*or_clauses),
            Schedule.start < end,
            Schedule.end > start,
            Schedule.id.notin_(_CANCELLED_ONLY_SCHEDULE_IDS),
        ]
        if exclude_id:
            where.append(Schedule.id != exclude_id)
        return await self._filter(where=where)

    @typecheck
    async def list_filtered(
        self,
        center_id: uuid_str,
        start: utc_dt,
        end: utc_dt,
        schedule_types: list[str] | None = None,
        member_ids: list[str] | None = None,
        room_id: uuid_str | None = None,
        title: str | None = None,
        memo: str | None = None,
    ) -> list[Schedule]:
        where = [
            Schedule.center_id == center_id,
            Schedule.start < end,
            Schedule.end > start,
        ]
        if schedule_types:
            where.append(Schedule.schedule_type.in_(schedule_types))
        if member_ids:
            where.append(Schedule.member_id.in_(member_ids))
        if room_id:
            where.append(Schedule.room_id == room_id)
        if title:
            where.append(Schedule.title.ilike(f"%{title}%"))
        if memo:
            where.append(Schedule.memo.ilike(f"%{memo}%"))
        return await self._filter(where=where, order_by="start")

    @typecheck
    async def list_agent_filtered(
        self,
        center_id: uuid_str,
        *,
        sort: str | None = None,
        limit: int = 20,
        start: utc_dt | None = None,
        end: utc_dt | None = None,
        schedule_type: str | None = None,
        title: str | None = None,
        memo: str | None = None,
        ids: list[str] | None = None,
        member_ids: list[str] | None = None,
        room_ids: list[str] | None = None,
        include_schedule_ids: list[str] | None = None,
    ) -> tuple[list[Schedule], int]:
        where = [Schedule.center_id == center_id]
        if ids is not None:
            where.append(Schedule.id.in_(ids))
        if start is not None and end is not None:
            where.append(Schedule.start < end)
            where.append(Schedule.end > start)
        if schedule_type:
            where.append(Schedule.schedule_type == schedule_type)
        if member_ids and include_schedule_ids:
            # 일정 소유자(member_id)는 주담당 1인 — 공동 담당이 참여한 회기 일정은 id로 합류시킨다
            where.append(
                or_(
                    Schedule.member_id.in_(member_ids),
                    Schedule.id.in_(include_schedule_ids),
                )
            )
        elif member_ids:
            where.append(Schedule.member_id.in_(member_ids))
        if room_ids:
            where.append(Schedule.room_id.in_(room_ids))
        if title:
            where.append(Schedule.title.ilike(f"%{title}%"))
        if memo:
            where.append(Schedule.memo.ilike(f"%{memo}%"))
        col, descending = resolve_sort(sort, time_col="start", default_col="start")
        rows = await self._filter(
            where=where, order_by=col, descending=descending, limit=limit
        )
        total = await self._count(where=where)
        return rows, total

    @typecheck
    async def list_ids_by_date_range(
        self,
        center_id: uuid_str,
        schedule_type: str,
        start_date: str | None = None,
        end_date: str | None = None,
    ) -> list[str]:
        from app.core.datetime_utils import coerce_date

        where = [
            Schedule.center_id == center_id,
            Schedule.schedule_type == schedule_type,
            Schedule.deleted_at.is_(None),
        ]
        sd = coerce_date(start_date, "start_date")
        if sd:
            where.append(cast(Schedule.start, SQLDate) >= sd)
        ed = coerce_date(end_date, "end_date")
        if ed:
            where.append(cast(Schedule.start, SQLDate) <= ed)

        stmt = select(Schedule.id).where(*where)
        return list(await self._session.scalars(stmt))

    @typecheck
    async def list_by_ids(self, schedule_ids: list[str]) -> list[Schedule]:
        if not schedule_ids:
            return []
        return await self._filter(where=[Schedule.id.in_(schedule_ids)])

    @typecheck
    async def list_starting_in_range_all_centers(
        self,
        start_utc: utc_dt,
        end_utc: utc_dt,
        schedule_types: list[str],
    ) -> list[Schedule]:
        if not schedule_types:
            return []
        where = [
            Schedule.start >= start_utc,
            Schedule.start < end_utc,
            Schedule.schedule_type.in_(schedule_types),
        ]
        return await self._filter(where=where, order_by="start")

    @typecheck
    async def aggregate_usual_by_member(
        self,
        center_id: uuid_str,
        member_id: uuid_str,
        *,
        since: utc_dt,
        schedule_type: str = "counseling",
    ) -> tuple[str | None, int | None]:
        # 멤버의 최빈 상담실 id + 최빈 소요 분 — 프로필 defaults용. 데이터 없으면 (None, None)
        from sqlalchemy import func

        base_where = [
            Schedule.center_id == center_id,
            Schedule.member_id == member_id,
            Schedule.schedule_type == schedule_type,
            Schedule.start >= since,
            Schedule.deleted_at.is_(None),
        ]
        room_id = await self._session.scalar(
            select(Schedule.room_id)
            .where(*base_where, Schedule.room_id.is_not(None))
            .group_by(Schedule.room_id)
            .order_by(func.count().desc(), Schedule.room_id)
            .limit(1)
        )
        duration_min = func.floor(
            func.extract("epoch", Schedule.end - Schedule.start) / 60
        )
        duration = await self._session.scalar(
            select(duration_min.label("m"))
            .where(*base_where)
            .group_by("m")
            .order_by(func.count().desc(), "m")
            .limit(1)
        )
        return room_id, int(duration) if duration is not None else None
