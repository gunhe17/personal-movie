from ..events import CenterAssessmentAtomic
from ..repository import CenterAssessmentRepository
from ..models import CenterAssessment


class UnassignCenterAssessmentService:
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
        # load
        entity = await self.repo.get_in_center(
            center_id=center_id,
            assessment_id=assessment_id,
        )

        # persist
        removed = await self.repo.remove_by_id(entity.id)
        assert removed is not None

        # return
        return CenterAssessmentAtomic.deleted(center_assessment=removed)
