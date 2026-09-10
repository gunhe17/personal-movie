from app.modules.counseling.counseling_case.models import CounselingCaseStatus
from app.core.exceptions import InvalidOperationException
from ..repository import CounselingCaseRepository
from ..models import CounselingCase
from ..events import CounselingCaseAtomic


class DeleteCounselingCaseService:
    def __init__(self, repo: CounselingCaseRepository):
        self.repo = repo

    async def execute(
        self,
        case_id: str,
        center_id: str,
        counselor_id: str | None,
    ) -> tuple[CounselingCaseAtomic, CounselingCase]:
        # load
        case = await self.repo.get_in_center(
            case_id=case_id,
            center_id=center_id,
            counselor_id=counselor_id,
        )

        # 종결/취소된 케이스는 삭제 불가 (기록 보존)
        if case.status in ["completed", "cancelled"]:
            status_label = "종결" if case.status == CounselingCaseStatus.COMPLETED else "취소"
            raise InvalidOperationException(
                f"{status_label}된 상담은 삭제할 수 없어요.\n"
                f"기록 보존을 위해 삭제 대신 보관됩니다."
            )

        # mutate
        removed = await self.repo.remove_by_id(id=case.id)

        # return
        return CounselingCaseAtomic.deleted(case=removed if removed is not None else case)

        return case
