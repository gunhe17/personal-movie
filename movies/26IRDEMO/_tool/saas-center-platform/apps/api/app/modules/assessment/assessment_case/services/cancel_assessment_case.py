from ..models import CaseStatus
from app.core.exceptions import InvalidOperationException
from ..events import AssessmentCaseAtomic
from ..repository import AssessmentCaseRepository
from ..models import AssessmentCase


class CancelAssessmentCaseService:
    def __init__(self, repo: AssessmentCaseRepository):
        self.repo = repo

    async def execute(self, center_id: str, case_id: str) -> tuple[AssessmentCaseAtomic, AssessmentCase]:
        # load
        case = await self.repo.get_in_center(center_id=center_id, case_id=case_id)

        # verify
        if case.status == CaseStatus.COMPLETED:
            raise InvalidOperationException("완료된 케이스는 취소할 수 없습니다")

        if case.status == CaseStatus.CANCELLED:
            raise InvalidOperationException("이미 취소된 케이스입니다")

        # update
        cancelled = await self.repo.update_in_center(
            case_id=case_id,
            center_id=center_id,
            status=CaseStatus.CANCELLED,
        )

        # return
        return AssessmentCaseAtomic.cancelled(case=cancelled)
