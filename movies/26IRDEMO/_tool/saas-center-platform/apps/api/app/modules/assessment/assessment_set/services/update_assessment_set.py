from app.core.type import unset
from ..events import AssessmentSetAtomic
from ..repository import AssessmentSetRepository
from ..models import AssessmentSet


class UpdateAssessmentSetService:
    def __init__(self, repo: AssessmentSetRepository):
        self.repo = repo

    async def execute(
        self,
        *,
        center_id: str,
        set_id: str,
        changed: dict | None = None,
        name: str | None = unset,
        description: str | None = unset,
        assessment_summary: list[dict] | None = None,
        center_member_summary: list[dict] | None = None,
    ) -> tuple[AssessmentSetAtomic, AssessmentSet]:
        # load
        assessment_set = await self.repo.get_in_center(center_id=center_id, set_id=set_id)

        # build
        update_data = {
            k: v
            for k, v in {"name": name, "description": description}.items()
            if v is not unset
        }

        if assessment_summary is not None:
            update_data["assessment_summary"] = assessment_summary

        if center_member_summary is not None:
            update_data["center_member_summary"] = center_member_summary

        # save
        if update_data:
            updated = await self.repo.update_in_center(
                set_id=set_id,
                center_id=center_id,
                name=update_data.get("name", unset),
                description=update_data.get("description", unset),
                assessment_summary=update_data.get("assessment_summary", unset),
                center_member_summary=update_data.get("center_member_summary", unset),
            )
            if updated is not None:
                assessment_set = updated

        return AssessmentSetAtomic.updated(assessment_set=assessment_set, changed=changed or {})
