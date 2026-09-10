from app.core.exceptions import ConflictException
from ..events import CenterAssessmentAtomic
from ..repository import CenterAssessmentRepository
from ..models import CenterAssessment


class AssignCenterAssessmentService:
    def __init__(
        self,
        repo: CenterAssessmentRepository,
    ):
        self.repo = repo

    async def execute(
        self,
        center_id: str,
        assessment_id: str,
    ) -> tuple[CenterAssessmentAtomic, CenterAssessment]:
        # verify (soft-delete 포함 조회)
        existing = await self.repo.find_including_deleted(
            center_id=center_id,
            assessment_id=assessment_id,
        )
        if existing:
            if existing.deleted_at is None:
                raise ConflictException(f"이미 할당된 검사입니다: {assessment_id}")
            restored = await self.repo.restore(id=existing.id)
            return CenterAssessmentAtomic.restored(center_assessment=restored)

        # persist
        entity = await self.repo.add(
            center_id=center_id,
            assessment_id=assessment_id,
            is_active=True,
        )

        # return
        return CenterAssessmentAtomic.created(center_assessment=entity)
