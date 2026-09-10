from ..events import CenterAssessmentAtomic
from ..repository import CenterAssessmentRepository
from ..models import CenterAssessment


class InitializeCenterAssessmentsService:
    def __init__(
        self,
        repo: CenterAssessmentRepository,
    ):
        self.repo = repo

    async def execute(
        self,
        center_id: str,
        assessment_ids: list[str],
    ) -> tuple[list[CenterAssessmentAtomic], list[CenterAssessment]]:
        atomics: list[CenterAssessmentAtomic] = []
        results: list[CenterAssessment] = []
        for assessment_id in assessment_ids:
            entity = await self.repo.add(
                center_id=center_id,
                assessment_id=assessment_id,
                is_active=True,
            )
            atomic, _ = CenterAssessmentAtomic.created(center_assessment=entity)
            atomics.append(atomic)
            results.append(entity)
        return atomics, results
