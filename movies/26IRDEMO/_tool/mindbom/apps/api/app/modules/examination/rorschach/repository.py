"""로르샤하 Repository

관계 역전(§4-1) 이후: Response가 세션에 직접 달리고, Region은 Response에 달린다.
예전에는 Response가 Region을 거쳐야 세션에 닿았다(join 한 단계).
"""
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.repository import BaseRepository
from app.modules.examination.rorschach.models import (
    RorschachCardAdministration,
    RorschachIntervention,
    RorschachRegion,
    RorschachResponse,
    RorschachSession,
)


class RorschachSessionRepository(BaseRepository[RorschachSession]):
    def __init__(self, session: AsyncSession):
        super().__init__(RorschachSession, session)

    async def get_by_examination_id(self, examination_id: str) -> RorschachSession | None:
        stmt = select(RorschachSession).where(
            RorschachSession.examination_id == examination_id,
            RorschachSession.deleted_at.is_(None),
        )
        result = await self._session.execute(stmt)
        return result.scalar_one_or_none()


class RorschachRegionRepository(BaseRepository[RorschachRegion]):
    def __init__(self, session: AsyncSession):
        super().__init__(RorschachRegion, session)

    async def list_by_session(self, session_id: str) -> list[RorschachRegion]:
        """세션의 모든 영역 조각.

        card_no로 정렬하던 것을 걷어냈다 — Region.card_no는 삭제됐다(§4-5).
        카드 순서가 필요하면 Response를 기준으로 조회한다(list_by_responses).
        """
        stmt = select(RorschachRegion).where(
            RorschachRegion.session_id == session_id,
            RorschachRegion.deleted_at.is_(None),
        ).order_by(RorschachRegion.created_at)
        result = await self._session.execute(stmt)
        return list(result.scalars().all())

    async def list_by_response(self, response_id: str) -> list[RorschachRegion]:
        """한 반응에 딸린 조각들 — 0..N개."""
        stmt = select(RorschachRegion).where(
            RorschachRegion.response_id == response_id,
            RorschachRegion.deleted_at.is_(None),
        ).order_by(RorschachRegion.created_at)
        result = await self._session.execute(stmt)
        return list(result.scalars().all())

    async def list_by_response_ids(self, response_ids: list[str]) -> list[RorschachRegion]:
        """여러 반응의 조각을 한 번에 — 반응마다 따로 조회하면 N+1이 된다."""
        if not response_ids:
            return []
        stmt = select(RorschachRegion).where(
            RorschachRegion.response_id.in_(response_ids),
            RorschachRegion.deleted_at.is_(None),
        ).order_by(RorschachRegion.created_at)
        result = await self._session.execute(stmt)
        return list(result.scalars().all())


class RorschachResponseRepository(BaseRepository[RorschachResponse]):
    def __init__(self, session: AsyncSession):
        super().__init__(RorschachResponse, session)

    async def list_by_session(self, session_id: str) -> list[RorschachResponse]:
        """세션의 모든 반응 — 카드·반응번호 순.

        **이것이 새 정본 조회다.** 예전 코드가 region을 순회하던 자리는
        전부 여기로 온다. region을 순회하면 영역 0개인 반응(거부·미완성)이
        조용히 빠지고, R이 틀어진다(§7).
        """
        stmt = select(RorschachResponse).where(
            RorschachResponse.session_id == session_id,
            RorschachResponse.deleted_at.is_(None),
        ).order_by(
            RorschachResponse.card_no,
            # sort_seq만으로는 값이 겹칠 때 순서가 매번 달라진다(실데이터에 중복이
            # 있었다). 표시 번호가 이 순서에서 파생되므로 결정적이어야 한다.
            RorschachResponse.sort_seq,
            RorschachResponse.created_at,
            RorschachResponse.id,
        )
        result = await self._session.execute(stmt)
        return list(result.scalars().all())

    async def list_formal_by_session(self, session_id: str) -> list[RorschachResponse]:
        """정식 반응만 — R 집계 대상. 한계검증(is_formal=False)은 빠진다(§4-1)."""
        stmt = select(RorschachResponse).where(
            RorschachResponse.session_id == session_id,
            RorschachResponse.is_formal.is_(True),
            RorschachResponse.deleted_at.is_(None),
        ).order_by(
            RorschachResponse.card_no,
            # sort_seq만으로는 값이 겹칠 때 순서가 매번 달라진다(실데이터에 중복이
            # 있었다). 표시 번호가 이 순서에서 파생되므로 결정적이어야 한다.
            RorschachResponse.sort_seq,
            RorschachResponse.created_at,
            RorschachResponse.id,
        )
        result = await self._session.execute(stmt)
        return list(result.scalars().all())

    async def exists_scored_in_session(self, session_id: str) -> bool:
        """세션에 AI 채점된 응답이 하나라도 있는지 — 진행 표시용.

        관계 역전 후 Response가 세션에 직접 달리므로 조인이 필요 없다.
        """
        stmt = (
            select(RorschachResponse.id)
            .where(
                RorschachResponse.session_id == session_id,
                RorschachResponse.ai_coding_json.is_not(None),
                RorschachResponse.deleted_at.is_(None),
            )
            .limit(1)
        )
        result = await self._session.execute(stmt)
        return result.scalar_one_or_none() is not None


class RorschachCardAdministrationRepository(BaseRepository[RorschachCardAdministration]):
    """카드 실시 기록 — 거부와 미입력을 구분한다(§5-2)."""

    def __init__(self, session: AsyncSession):
        super().__init__(RorschachCardAdministration, session)

    async def list_by_session(self, session_id: str) -> list[RorschachCardAdministration]:
        stmt = select(RorschachCardAdministration).where(
            RorschachCardAdministration.session_id == session_id,
            RorschachCardAdministration.deleted_at.is_(None),
        ).order_by(RorschachCardAdministration.card_no)
        result = await self._session.execute(stmt)
        return list(result.scalars().all())

    async def get_by_card(
        self, session_id: str, card_no: int
    ) -> RorschachCardAdministration | None:
        stmt = select(RorschachCardAdministration).where(
            RorschachCardAdministration.session_id == session_id,
            RorschachCardAdministration.card_no == card_no,
            RorschachCardAdministration.deleted_at.is_(None),
        )
        result = await self._session.execute(stmt)
        return result.scalar_one_or_none()


class RorschachInterventionRepository(BaseRepository[RorschachIntervention]):
    """검사자 개입 — 촉구·한계검증 등(§4-1)."""

    def __init__(self, session: AsyncSession):
        super().__init__(RorschachIntervention, session)

    async def list_by_session(self, session_id: str) -> list[RorschachIntervention]:
        stmt = select(RorschachIntervention).where(
            RorschachIntervention.session_id == session_id,
            RorschachIntervention.deleted_at.is_(None),
        ).order_by(RorschachIntervention.card_no, RorschachIntervention.created_at)
        result = await self._session.execute(stmt)
        return list(result.scalars().all())
