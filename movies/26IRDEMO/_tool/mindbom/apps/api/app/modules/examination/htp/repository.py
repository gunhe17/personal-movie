"""HTP 검사 리포지토리 — 순수 쿼리만 담당"""
from sqlalchemy import select, update
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.datetime_utils import utc_now
from app.core.repository import BaseRepository
from app.modules.examination.htp.models import HTPDrawing, HTPObject, HTPInterpretation


class HTPDrawingRepository(BaseRepository[HTPDrawing]):
    """HTP 그림 리포지토리"""

    def __init__(self, session: AsyncSession):
        super().__init__(HTPDrawing, session)

    async def list_by_examination(self, examination_id: str) -> list[HTPDrawing]:
        stmt = (
            select(HTPDrawing)
            .where(
                HTPDrawing.examination_id == examination_id,
                HTPDrawing.deleted_at.is_(None),
            )
            .order_by(HTPDrawing.sort_order)
        )
        result = await self._session.execute(stmt)
        return list(result.scalars().all())


class HTPObjectRepository(BaseRepository[HTPObject]):
    """HTP 객체 리포지토리"""

    def __init__(self, session: AsyncSession):
        super().__init__(HTPObject, session)

    async def list_by_examination(self, examination_id: str) -> list[HTPObject]:
        stmt = (
            select(HTPObject)
            .where(
                HTPObject.examination_id == examination_id,
                HTPObject.deleted_at.is_(None),
            )
            .order_by(HTPObject.sort_order)
        )
        result = await self._session.execute(stmt)
        return list(result.scalars().all())

    async def soft_delete_by_drawing(self, drawing_id: str) -> None:
        stmt = (
            update(HTPObject)
            .where(
                HTPObject.drawing_id == drawing_id,
                HTPObject.deleted_at.is_(None),
            )
            .values(deleted_at=utc_now())
        )
        await self._session.execute(stmt)


class HTPInterpretationRepository(BaseRepository[HTPInterpretation]):
    """HTP 해석 리포지토리"""

    def __init__(self, session: AsyncSession):
        super().__init__(HTPInterpretation, session)

    async def list_by_examination(self, examination_id: str) -> list[HTPInterpretation]:
        stmt = (
            select(HTPInterpretation)
            .where(
                HTPInterpretation.examination_id == examination_id,
                HTPInterpretation.deleted_at.is_(None),
            )
            .order_by(HTPInterpretation.sort_order)
        )
        result = await self._session.execute(stmt)
        return list(result.scalars().all())

    async def exists_by_examination(self, examination_id: str) -> bool:
        """해석이 하나라도 있는지 — 진행 표시용이라 행을 끌어오지 않는다."""
        stmt = (
            select(HTPInterpretation.id)
            .where(
                HTPInterpretation.examination_id == examination_id,
                HTPInterpretation.deleted_at.is_(None),
            )
            .limit(1)
        )
        result = await self._session.execute(stmt)
        return result.scalar_one_or_none() is not None

    async def soft_delete_by_examination(self, examination_id: str) -> None:
        stmt = (
            update(HTPInterpretation)
            .where(
                HTPInterpretation.examination_id == examination_id,
                HTPInterpretation.deleted_at.is_(None),
            )
            .values(deleted_at=utc_now())
        )
        await self._session.execute(stmt)

    async def soft_delete_by_objects(self, object_ids: list[str]) -> int:
        """지워진 객체에 딸린 해석을 함께 지운다.

        객체만 지우면 해석은 남아 결과 화면과 PDF에 계속 나온다 — 표현
        양상(sub_cond)은 object_id로 조회하므로 그 열만 빈칸이 되고,
        **근거 없는 해석 문장**이 보고서에 실린다. 임상가가 "이 탐지는
        틀렸다"고 지운 항목이 해석으로는 살아 있는 셈이라 위험하다.

        반환: 함께 지워진 해석 수 (호출부가 임상가에게 알릴 수 있도록)
        """
        if not object_ids:
            return 0
        stmt = (
            update(HTPInterpretation)
            .where(
                HTPInterpretation.object_id.in_(object_ids),
                HTPInterpretation.deleted_at.is_(None),
            )
            .values(deleted_at=utc_now())
        )
        result = await self._session.execute(stmt)
        return result.rowcount or 0
