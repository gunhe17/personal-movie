from ..events import CenterAssessmentAtomic
from ..repository import CenterAssessmentRepository
from ..models import CenterAssessment


class BulkUpdateCenterAssessmentsService:
    def __init__(self, repo: CenterAssessmentRepository):
        self.repo = repo

    async def execute(
        self,
        *,
        center_id: str,
        items: list[tuple[str, bool]],
    ) -> tuple[list[CenterAssessmentAtomic], list[CenterAssessment]]:
        # apply
        atomics: list[CenterAssessmentAtomic] = []
        entities: list[CenterAssessment] = []
        for assessment_id, is_active in items:
            entity = await self.repo.upsert_active(
                center_id=center_id,
                assessment_id=assessment_id,
                is_active=is_active,
            )
            atomic, _ = CenterAssessmentAtomic.updated(
                center_assessment=entity, changed={"is_active": is_active}
            )
            atomics.append(atomic)
            entities.append(entity)

        # return
        return atomics, entities
