from ..models import CaseStatus
from app.core.exceptions import InvalidOperationException
from ..events import AssessmentCaseAtomic
from ..repository import AssessmentCaseRepository
from ..models import AssessmentCase


class RevertCancelAssessmentCaseService:
    def __init__(self, repo: AssessmentCaseRepository):
        self.repo = repo

    async def execute(self, center_id: str, case_id: str) -> tuple[AssessmentCaseAtomic, AssessmentCase]:
        # load (deleted_at IS NULL 자동 필터 → 삭제된 케이스는 NotFound)
        case = await self.repo.get_in_center(center_id=center_id, case_id=case_id)

        # verify — cancelled 상태만 롤백 가능
        if case.status != CaseStatus.CANCELLED:
            raise InvalidOperationException(
                f"취소된 케이스만 롤백할 수 있습니다 (현재 상태: {case.status})"
            )

        # update
        reverted = await self.repo.update_in_center(
            case_id=case_id,
            center_id=center_id,
            status=CaseStatus.PENDING,
        )

        # return
        return AssessmentCaseAtomic.cancel_reverted(case=reverted)
