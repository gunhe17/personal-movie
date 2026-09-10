from app.core.type import unset
from ..events import AssessmentPackageAtomic
from ..repository import AssessmentPackageRepository
from ..models import AssessmentPackage


class UpdateAssessmentPackageService:
    def __init__(self, repo: AssessmentPackageRepository):
        self.repo = repo

    async def execute(
        self,
        *,
        center_id: str,
        package_id: str,
        changed: dict | None = None,
        name: str | None = unset,
        description: str | None = unset,
        assessment_summary: list[dict] | None = None,
        center_member_summary: list[dict] | None = None,
        package_price: int | None = unset,
        is_active: bool | None = unset,
    ) -> tuple[AssessmentPackageAtomic, AssessmentPackage]:
        # load
        assessment_package = await self.repo.get_in_center(center_id=center_id, package_id=package_id)

        # build
        update_data = {
            k: v
            for k, v in {
                "name": name,
                "description": description,
                "package_price": package_price,
                "is_active": is_active,
            }.items()
            if v is not unset
        }

        if assessment_summary is not None:
            update_data["assessment_summary"] = assessment_summary

        if center_member_summary is not None:
            update_data["center_member_summary"] = center_member_summary

        # save
        if update_data:
            updated = await self.repo.update_in_center(
                package_id=package_id,
                center_id=center_id,
                name=update_data.get("name", unset),
                description=update_data.get("description", unset),
                assessment_summary=update_data.get("assessment_summary", unset),
                center_member_summary=update_data.get("center_member_summary", unset),
                package_price=update_data.get("package_price", unset),
                is_active=update_data.get("is_active", unset),
            )
            if updated is not None:
                assessment_package = updated

        return AssessmentPackageAtomic.updated(assessment_package=assessment_package, changed=changed or {})
