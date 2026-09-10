"""AI 분석 작업 리포지토리 — 순수 쿼리만."""
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.repository import BaseRepository
from app.modules.examination.common.ai_job_models import (
    JOB_RUNNING,
    AIAnalysisJob,
)


class AIAnalysisJobRepository(BaseRepository[AIAnalysisJob]):
    def __init__(self, session: AsyncSession):
        super().__init__(AIAnalysisJob, session)

    async def list_by_examination(self, examination_id: str) -> list[AIAnalysisJob]:
        """최근 실행 순 — 재분석 이력을 보여줄 때 쓴다."""
        stmt = (
            select(AIAnalysisJob)
            .where(
                AIAnalysisJob.examination_id == examination_id,
                AIAnalysisJob.deleted_at.is_(None),
            )
            .order_by(AIAnalysisJob.started_at.desc())
        )
        result = await self._session.execute(stmt)
        return list(result.scalars().all())

    async def has_running(self, examination_id: str) -> bool:
        """진행 중인 분석이 있는지 — 행을 끌어오지 않는다."""
        stmt = (
            select(AIAnalysisJob.id)
            .where(
                AIAnalysisJob.examination_id == examination_id,
                AIAnalysisJob.status == JOB_RUNNING,
                AIAnalysisJob.deleted_at.is_(None),
            )
            .limit(1)
        )
        result = await self._session.execute(stmt)
        return result.scalar_one_or_none() is not None
