"""Examination Repository"""
from datetime import date, datetime, timezone
from typing import NamedTuple

from sqlalchemy import select, func
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.repository import BaseRepository
from app.modules.client.models import Client
from app.modules.examination.common.models import Examination, ExaminationBattery
from app.modules.examination.common.state_machine import CONFIRMED_STATUSES
from app.modules.member.models import Member


def _as_naive(dt: datetime) -> datetime:
    """tz-aware datetime을 UTC 기준 naive로 바꾼다.

    검사 시각 컬럼은 TIMESTAMP WITHOUT TIME ZONE(naive)이라, 클라이언트가
    ISO 문자열(예: toISOString())로 보낸 aware 값을 그대로 비교하면
    asyncpg가 "can't subtract offset-naive and offset-aware datetimes"로 거절한다.
    """
    if dt.tzinfo is None:
        return dt
    return dt.astimezone(timezone.utc).replace(tzinfo=None)


class ExaminationWithNamesRow(NamedTuple):
    """List 쿼리 결과 — Examination + 조인된 이름 필드"""
    exam: Examination
    client_name: str | None
    client_birth_date: date | None
    client_gender: str | None
    examiner_name: str | None


class ExaminationBatteryRepository(BaseRepository[ExaminationBattery]):
    def __init__(self, session: AsyncSession):
        super().__init__(ExaminationBattery, session)


class ExaminationRepository(BaseRepository[Examination]):
    def __init__(self, session: AsyncSession):
        super().__init__(Examination, session)

    async def list_by_institution(
        self,
        institution_id: str,
        *,
        skip: int = 0,
        limit: int = 20,
        search: str | None = None,
        status: str | None = None,
        exam_type: str | None = None,
        client_id: str | None = None,
    ) -> list[Examination]:
        stmt = self._build_filter_query(
            institution_id, search=search, status=status,
            exam_type=exam_type, client_id=client_id,
        )
        stmt = stmt.order_by(Examination.created_at.desc()).offset(skip).limit(limit)
        result = await self._session.execute(stmt)
        return list(result.scalars().all())

    async def count_by_institution(
        self,
        institution_id: str,
        *,
        search: str | None = None,
        status: str | None = None,
        exam_type: str | None = None,
        client_id: str | None = None,
    ) -> int:
        base = self._build_filter_query(
            institution_id, search=search, status=status,
            exam_type=exam_type, client_id=client_id,
        )
        stmt = select(func.count()).select_from(base.subquery())
        result = await self._session.execute(stmt)
        return result.scalar_one()

    async def list_with_names_by_institution(
        self,
        institution_id: str,
        *,
        skip: int = 0,
        limit: int = 20,
        status: str | None = None,
        exam_type: str | None = None,
        client_id: str | None = None,
        examiner_id: str | None = None,
        search: str | None = None,
        date_from: datetime | None = None,
        date_to: datetime | None = None,
    ) -> list[ExaminationWithNamesRow]:
        """검사 목록 + 내담자/검사자 이름 조인 (search: 내담자 이름 부분 일치)"""
        stmt = (
            select(
                Examination,
                Client.name.label("client_name"),
                Client.birth_date.label("client_birth_date"),
                Client.gender.label("client_gender"),
                Member.name.label("member_name"),
            )
            .outerjoin(Client, Examination.client_id == Client.id)
            .outerjoin(Member, Examination.examiner_id == Member.id)
            .where(
                Examination.institution_id == institution_id,
                Examination.deleted_at.is_(None),
            )
        )
        stmt = self._apply_filters(
            stmt, status, exam_type, client_id, examiner_id, search, date_from, date_to
        )
        stmt = stmt.order_by(Examination.created_at.desc()).offset(skip).limit(limit)

        result = await self._session.execute(stmt)
        return [
            ExaminationWithNamesRow(
                exam=exam,
                client_name=c_name,
                client_birth_date=c_birth,
                client_gender=c_gender,
                examiner_name=m_name,
            )
            for exam, c_name, c_birth, c_gender, m_name in result.all()
        ]

    async def count_with_search(
        self,
        institution_id: str,
        *,
        status: str | None = None,
        exam_type: str | None = None,
        client_id: str | None = None,
        examiner_id: str | None = None,
        search: str | None = None,
        date_from: datetime | None = None,
        date_to: datetime | None = None,
    ) -> int:
        """search 포함 카운트 — Client join은 search 있을 때만 추가"""
        stmt = select(func.count(Examination.id)).where(
            Examination.institution_id == institution_id,
            Examination.deleted_at.is_(None),
        )
        if search:
            stmt = stmt.join(Client, Examination.client_id == Client.id)
        stmt = self._apply_filters(
            stmt, status, exam_type, client_id, examiner_id, search, date_from, date_to
        )

        result = await self._session.execute(stmt)
        return result.scalar_one()

    @staticmethod
    def _apply_filters(
        stmt,
        status,
        exam_type,
        client_id,
        examiner_id,
        search,
        date_from=None,
        date_to=None,
    ):
        if status:
            stmt = stmt.where(Examination.status == status)
        if exam_type:
            stmt = stmt.where(Examination.exam_type == exam_type)
        if client_id:
            stmt = stmt.where(Examination.client_id == client_id)
        if examiner_id:
            stmt = stmt.where(Examination.examiner_id == examiner_id)
        if search:
            stmt = stmt.where(Client.name.ilike(f"%{search}%"))

        # 기간 필터 — 기준은 예정일 하나다.
        #
        # 예전에는 coalesce(scheduled_at, created_at)를 썼다. 그건 "일정 미정"을
        # "등록한 날에 일정 있음"으로 위장하는 것이어서, 잡은 적 없는 예정이
        # 타임라인에 '예정' 라벨로 떴다. 일정이 없으면 없는 것으로 남기고
        # 기간 조회에서 빠진다(NULL은 비교에서 자연히 탈락).
        #
        # 프론트도 같은 컬럼을 본다(timeline/transforms.ts) — 다른 걸 고르면
        # 조회는 되는데 화면에서 사라지는 검사가 생긴다.
        if date_from is not None:
            stmt = stmt.where(Examination.scheduled_at >= _as_naive(date_from))
        if date_to is not None:
            stmt = stmt.where(Examination.scheduled_at < _as_naive(date_to))
        return stmt

    async def count_by_status(
        self,
        institution_id: str,
        *,
        examiner_id: str | None = None,
    ) -> dict[str, int]:
        """상태별 검사 건수 (대시보드용)"""
        stmt = (
            select(Examination.status, func.count())
            .where(
                Examination.institution_id == institution_id,
                Examination.deleted_at.is_(None),
            )
        )
        if examiner_id:
            stmt = stmt.where(Examination.examiner_id == examiner_id)
        stmt = stmt.group_by(Examination.status)
        result = await self._session.execute(stmt)
        return dict(result.all())

    async def count_scheduled_between(
        self,
        institution_id: str,
        start: datetime,
        end: datetime,
        *,
        examiner_id: str | None = None,
    ) -> int:
        """예정일이 [start, end) 구간인 미시작 검사 수.

        기간 집계는 DB에서 센다 — 목록 일부(예: 최근 50건)를 받아 앱에서 세면
        그 범위 밖의 건이 통째로 빠진다.
        """
        stmt = select(func.count()).where(
            Examination.institution_id == institution_id,
            Examination.deleted_at.is_(None),
            Examination.status == "created",
            Examination.scheduled_at >= _as_naive(start),
            Examination.scheduled_at < _as_naive(end),
        )
        if examiner_id:
            stmt = stmt.where(Examination.examiner_id == examiner_id)
        return (await self._session.execute(stmt)).scalar_one()

    async def count_completed_since(
        self,
        institution_id: str,
        since: datetime,
        *,
        examiner_id: str | None = None,
    ) -> int:
        """since 이후 완료된 검사 수. 완료군(확정·보고서·완료)을 함께 센다."""
        stmt = select(func.count()).where(
            Examination.institution_id == institution_id,
            Examination.deleted_at.is_(None),
            Examination.status.in_(CONFIRMED_STATUSES),
            Examination.completed_at.is_not(None),
            Examination.completed_at >= _as_naive(since),
        )
        if examiner_id:
            stmt = stmt.where(Examination.examiner_id == examiner_id)
        return (await self._session.execute(stmt)).scalar_one()

    async def count_stale_reviews(
        self,
        institution_id: str,
        cutoff: datetime,
        *,
        examiner_id: str | None = None,
    ) -> int:
        """검토 대기 상태로 cutoff 이전부터 머물러 있는 검사 수."""
        stmt = select(func.count()).where(
            Examination.institution_id == institution_id,
            Examination.deleted_at.is_(None),
            Examination.status.in_(("ai_draft_ready", "under_review")),
            Examination.created_at < _as_naive(cutoff),
        )
        if examiner_id:
            stmt = stmt.where(Examination.examiner_id == examiner_id)
        return (await self._session.execute(stmt)).scalar_one()

    def _build_filter_query(
        self,
        institution_id: str,
        *,
        search: str | None = None,
        status: str | None = None,
        exam_type: str | None = None,
        client_id: str | None = None,
    ):
        stmt = select(Examination).where(
            Examination.institution_id == institution_id,
            Examination.deleted_at.is_(None),
        )
        if status:
            stmt = stmt.where(Examination.status == status)
        if exam_type:
            stmt = stmt.where(Examination.exam_type == exam_type)
        if client_id:
            stmt = stmt.where(Examination.client_id == client_id)
        return stmt
