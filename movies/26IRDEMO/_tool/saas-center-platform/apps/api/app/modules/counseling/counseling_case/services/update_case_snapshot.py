from ..events import CounselingCaseAtomic
from ..repository import CounselingCaseRepository
from ..models import CounselingCase


class UpdateCaseSnapshotService:
    def __init__(self, repo: CounselingCaseRepository):
        self.repo = repo

    async def execute(
        self,
        case_id: str,
        center_id: str,
        participant_snapshot: dict,
    ) -> tuple[CounselingCaseAtomic, CounselingCase]:
        # load
        await self.repo.get_in_center(
            case_id=case_id,
            center_id=center_id,
            counselor_id=None,
        )

        # save
        updated = await self.repo.update_in_center(
            case_id=case_id,
            center_id=center_id,
            participant_snapshot=participant_snapshot,
        )
        assert updated is not None

        # return
        return CounselingCaseAtomic.updated(
            case=updated,
            changed={"participant_snapshot": participant_snapshot},
        )
