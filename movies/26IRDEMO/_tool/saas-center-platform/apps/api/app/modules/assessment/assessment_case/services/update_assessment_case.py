from app.core.exceptions import InvalidOperationException
from app.core.type import unset
from ..events import AssessmentCaseAtomic
from ..repository import AssessmentCaseRepository
from ..models import AssessmentCase


class UpdateAssessmentCaseService:
    def __init__(self, repo: AssessmentCaseRepository):
        self.repo = repo

    async def execute(
        self,
        *,
        center_id: str,
        case_id: str,
        tags: list[str] | None = None,
        is_final_report_required: bool | None = None,
    ) -> tuple[AssessmentCaseAtomic, AssessmentCase]:
        # load
        case = await self.repo.get_in_center(center_id=center_id, case_id=case_id)

        # verify
        if case.status in ("completed", "cancelled"):
            raise InvalidOperationException(
                f"완료되거나 취소된 케이스는 수정할 수 없습니다 (status={case.status})"
            )

        # build (None = 변경하지 않음 — NOT NULL 컬럼에 null 넣지 않음)
        update_data = {
            k: v
            for k, v in {
                "tags": tags,
                "is_final_report_required": is_final_report_required,
            }.items()
            if v is not None
        }

        if update_data:
            updated = await self.repo.update_in_center(
                case_id=case_id,
                center_id=center_id,
                tags=update_data.get("tags", unset),
                is_final_report_required=update_data.get("is_final_report_required", unset),
            )
            if updated is not None:
                case = updated

        # return
        return AssessmentCaseAtomic.updated(case=case, changed=update_data)
