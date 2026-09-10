"""종합보고서 Repository — 순수 쿼리 (commit/rollback 금지)"""
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.repository import BaseRepository
from app.modules.comprehensive_report.models import (
    ComprehensiveReport,
    ComprehensiveReportExamination,
)


class ComprehensiveReportRepository(BaseRepository[ComprehensiveReport]):
    def __init__(self, session: AsyncSession):
        super().__init__(ComprehensiveReport, session)

    async def list_by_client(
        self, institution_id: str, client_id: str
    ) -> list[ComprehensiveReport]:
        stmt = (
            select(ComprehensiveReport)
            .where(
                ComprehensiveReport.institution_id == institution_id,
                ComprehensiveReport.client_id == client_id,
                ComprehensiveReport.deleted_at.is_(None),
            )
            .order_by(ComprehensiveReport.created_at.desc())
        )
        result = await self._session.execute(stmt)
        return list(result.scalars().all())


class ComprehensiveReportExaminationRepository(BaseRepository[ComprehensiveReportExamination]):
    def __init__(self, session: AsyncSession):
        super().__init__(ComprehensiveReportExamination, session)

    async def list_by_report(self, report_id: str) -> list[ComprehensiveReportExamination]:
        stmt = (
            select(ComprehensiveReportExamination)
            .where(
                ComprehensiveReportExamination.report_id == report_id,
                ComprehensiveReportExamination.deleted_at.is_(None),
            )
            .order_by(ComprehensiveReportExamination.sort_order.asc())
        )
        result = await self._session.execute(stmt)
        return list(result.scalars().all())

    async def count_by_report(self, report_id: str) -> int:
        return await self.count(report_id=report_id)

    async def bulk_create(
        self, report_id: str, exams: list[tuple[str, str]]
    ) -> list[ComprehensiveReportExamination]:
        """exams: [(examination_id, exam_type), ...] 순서대로 링크 생성"""
        links: list[ComprehensiveReportExamination] = []
        for idx, (exam_id, exam_type) in enumerate(exams):
            link = ComprehensiveReportExamination(
                report_id=report_id,
                examination_id=exam_id,
                exam_type=exam_type,
                sort_order=idx,
            )
            self._session.add(link)
            links.append(link)
        await self._session.flush()
        return links
