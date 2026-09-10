from app.core.exceptions import InvalidOperationException
from ..repository import CenterAssessmentRepository


class ValidateCenterAssessmentsService:
    def __init__(self, repo: CenterAssessmentRepository):
        self.repo = repo

    async def execute(self, center_id: str, assessment_ids: list[str]) -> None:
        if not assessment_ids:
            return

        # load
        active_ids = set(await self.repo.list_active_assessment_ids(center_id=center_id))

        # compute
        inactive_ids = [aid for aid in assessment_ids if aid not in active_ids]

        if inactive_ids:
            raise InvalidOperationException(
                f"센터에서 사용할 수 없는 검사입니다: {', '.join(inactive_ids)}"
            )
