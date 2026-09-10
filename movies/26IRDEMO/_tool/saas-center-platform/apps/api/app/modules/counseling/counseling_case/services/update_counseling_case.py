from app.modules.counseling.counseling_case.models import CounselingCaseStatus
from app.core.exceptions import InvalidOperationException
from app.core.type import unset
from ..repository import CounselingCaseRepository
from ..models import CounselingCase
from ..events import CounselingCaseAtomic


class UpdateCounselingCaseService:
    def __init__(self, repo: CounselingCaseRepository):
        self.repo = repo

    async def execute(
        self,
        case_id: str,
        center_id: str,
        owner_scope: str | None,
        *,
        changed: dict,
        counselor_id: str = unset,
        chief_complaint: str | None = unset,
        memo: str | None = unset,
        status: str = unset,
        total_sessions: int | None = unset,
    ) -> tuple[CounselingCaseAtomic, CounselingCase]:
        # load
        case = await self.repo.get_in_center(
            case_id=case_id,
            center_id=center_id,
            counselor_id=owner_scope,
        )

        # verify — 종결/취소된 케이스는 수정 불가 (재활성화만 허용)
        if case.status in [CounselingCaseStatus.COMPLETED, CounselingCaseStatus.CANCELLED] and status == CounselingCaseStatus.ACTIVE:
            pass
        elif case.status in ["completed", "cancelled"]:
            raise InvalidOperationException(
                f"Cannot modify a {case.status} case. "
                f"종결 또는 취소된 케이스는 수정할 수 없습니다."
            )

        # mutate
        updated = await self.repo.update_in_center(
            case_id=case_id,
            center_id=center_id,
            counselor_id=counselor_id,
            chief_complaint=chief_complaint,
            memo=memo,
            status=status,
            total_sessions=total_sessions,
        )
        assert updated is not None

        # return
        return CounselingCaseAtomic.updated(case=updated, changed=changed)
