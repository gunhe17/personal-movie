from ..events import CenterAssessmentAtomic
from ..repository import CenterAssessmentRepository
from ..models import CenterAssessment


class UpdateCenterAssessmentService:
    def __init__(self, repo: CenterAssessmentRepository):
        self.repo = repo

    async def execute(
        self,
        center_id: str,
        assessment_id: str,
        is_active: bool,
    ) -> tuple[CenterAssessmentAtomic, CenterAssessment]:
        # load
        await self.repo.get_in_center(
            center_id=center_id,
            assessment_id=assessment_id,
        )

        # return
        entity = await self.repo.update_in_center(
            center_id=center_id,
            assessment_id=assessment_id,
            is_active=is_active,
        )
        return CenterAssessmentAtomic.updated(
            center_assessment=entity, changed={"is_active": is_active}
        )
