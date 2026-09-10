from app.core.exceptions import ConflictException
from ..events import CenterAssessmentAtomic
from ..repository import CenterAssessmentRepository
from ..models import CenterAssessment


class CreateCenterAssessmentService:
    def __init__(self, repo: CenterAssessmentRepository):
        self.repo = repo

    async def execute(
        self,
        center_id: str,
        assessment_id: str,
    ) -> tuple[CenterAssessmentAtomic, CenterAssessment]:
        # verify (soft-delete 포함 — full unique 슬롯이라 blind INSERT 시 IntegrityError §11)
        existing = await self.repo.find_including_deleted(
            center_id=center_id,
            assessment_id=assessment_id,
        )
        if existing:
            if existing.deleted_at is None:
                raise ConflictException(
                    f"이미 등록된 검사입니다 (center_id={center_id}, assessment_id={assessment_id})"
                )
            restored = await self.repo.restore(id=existing.id)
            return CenterAssessmentAtomic.created(center_assessment=restored)

        # return
        entity = await self.repo.add(
            center_id=center_id,
            assessment_id=assessment_id,
            is_active=True,
        )
        return CenterAssessmentAtomic.created(center_assessment=entity)
