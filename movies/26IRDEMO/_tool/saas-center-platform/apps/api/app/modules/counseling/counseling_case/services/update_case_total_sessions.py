from ..events import CounselingCaseAtomic
from ..models import CounselingCase
from ..repository import CounselingCaseRepository


class UpdateCaseTotalSessionsService:
    def __init__(
        self,
        repo: CounselingCaseRepository,
    ):
        self.repo = repo

    async def execute(
        self,
        case_id: str,
        center_id: str,
        *,
        total_sessions: int,
    ) -> tuple[CounselingCaseAtomic, CounselingCase]:
        # save
        updated = await self.repo.update_in_center(
            case_id=case_id,
            center_id=center_id,
            total_sessions=total_sessions,
        )

        # return
        return CounselingCaseAtomic.updated(
            case=updated,
            changed={"total_sessions": total_sessions},
        )
