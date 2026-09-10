from ..models import CaseStatus
from app.core.datetime_utils import utc_now
from app.core.exceptions import InvalidOperationException
from ..events import AssessmentCaseAtomic
from ..repository import AssessmentCaseRepository
from ..models import AssessmentCase


class CompleteAssessmentCaseService:
    def __init__(
        self,
        repo: AssessmentCaseRepository,
    ):
        self.repo = repo

    async def execute(
        self,
        center_id: str,
        case_id: str,
    ) -> tuple[AssessmentCaseAtomic, AssessmentCase]:
        # load
        case = await self.repo.get_in_center(center_id=center_id, case_id=case_id)

        # verify
        if case.status == CaseStatus.COMPLETED:
            raise InvalidOperationException("이미 완료된 케이스입니다")

        if case.status == CaseStatus.CANCELLED:
            raise InvalidOperationException("취소된 케이스는 완료할 수 없습니다")

        # persist
        completed = await self.repo.update_in_center(
            case_id=case_id,
            center_id=center_id,
            status=CaseStatus.COMPLETED,
            completed_at=utc_now(),
        )

        # return
        return AssessmentCaseAtomic.completed(case=completed)
