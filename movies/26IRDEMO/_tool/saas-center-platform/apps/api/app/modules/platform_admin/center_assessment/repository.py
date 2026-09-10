# 센터용 모듈의 Repository는 재사용하지 않는다 (API_ARCHITECTURE.md §8).
# Model만 참조하여 admin 전용 쿼리를 직접 작성.
from sqlalchemy import select, or_
from sqlalchemy.ext.asyncio import AsyncSession

from app.modules.assessment.assessment.models import Assessment
from app.modules.assessment.center_assessment.models import CenterAssessment


class AdminCenterAssessmentRepository:
    def __init__(self, session: AsyncSession):
        self._session = session

    async def find_in_center(self, center_id: str, assessment_id: str) -> CenterAssessment | None:
        stmt = select(CenterAssessment).where(
            CenterAssessment.center_id == center_id,
            CenterAssessment.assessment_id == assessment_id,
            CenterAssessment.deleted_at.is_(None),
        )
        return (await self._session.execute(stmt)).scalar_one_or_none()

    async def find_including_deleted(self, center_id: str, assessment_id: str) -> CenterAssessment | None:
        stmt = select(CenterAssessment).where(
            CenterAssessment.center_id == center_id,
            CenterAssessment.assessment_id == assessment_id,
        )
        return (await self._session.execute(stmt)).scalar_one_or_none()

    async def list_by_center(
        self,
        center_id: str,
        is_active: bool | None = None,
    ) -> list[CenterAssessment]:
        conditions = [
            CenterAssessment.center_id == center_id,
            CenterAssessment.deleted_at.is_(None),
        ]
        if is_active is not None:
            conditions.append(CenterAssessment.is_active.is_(is_active))

        stmt = (
            select(CenterAssessment)
            .where(*conditions)
            .order_by(CenterAssessment.created_at.desc())
        )
        return list((await self._session.execute(stmt)).scalars().all())

    async def list_assigned_assessment_ids(self, center_id: str) -> set[str]:
        stmt = select(CenterAssessment.assessment_id).where(
            CenterAssessment.center_id == center_id,
            CenterAssessment.deleted_at.is_(None),
        )
        return set((await self._session.execute(stmt)).scalars().all())

    async def list_unassigned_assessments(
        self,
        center_id: str,
        search: str | None = None,
    ) -> list[Assessment]:
        assigned_ids = await self.list_assigned_assessment_ids(center_id)

        conditions = [
            Assessment.deleted_at.is_(None),
            Assessment.status == "public",
        ]
        if assigned_ids:
            conditions.append(Assessment.id.notin_(assigned_ids))
        if search:
            term = f"%{search}%"
            conditions.append(or_(
                Assessment.kor_name.ilike(term),
                Assessment.eng_name.ilike(term),
                Assessment.code.ilike(term),
            ))

        stmt = select(Assessment).where(*conditions).order_by(Assessment.kor_name)
        return list((await self._session.execute(stmt)).scalars().all())

    async def find_assessment(self, assessment_id: str) -> Assessment | None:
        stmt = select(Assessment).where(
            Assessment.id == assessment_id,
            Assessment.deleted_at.is_(None),
        )
        return (await self._session.execute(stmt)).scalar_one_or_none()

    async def aggregate_assessments_by_ids(self, assessment_ids: list[str]) -> dict[str, Assessment]:
        if not assessment_ids:
            return {}
        stmt = select(Assessment).where(
            Assessment.id.in_(assessment_ids),
            Assessment.deleted_at.is_(None),
        )
        rows = (await self._session.execute(stmt)).scalars().all()
        return {a.id: a for a in rows}
