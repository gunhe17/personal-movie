from ..events import AssessmentPackageAtomic
from ..repository import AssessmentPackageRepository
from ..models import AssessmentPackage


class CreateAssessmentPackageService:
    def __init__(self, repo: AssessmentPackageRepository):
        self.repo = repo

    async def execute(
        self,
        *,
        center_id: str,
        name: str,
        description: str | None = None,
        assessment_summary: list[dict],
        center_member_summary: list[dict] | None = None,
        package_price: int | None = None,
        is_active: bool = True,
    ) -> tuple[AssessmentPackageAtomic, AssessmentPackage]:
        # return
        assessment_package = await self.repo.add(
            center_id=center_id,
            name=name,
            assessment_summary=assessment_summary,
            description=description,
            center_member_summary=center_member_summary,
            package_price=package_price,
            is_active=is_active,
        )
        return AssessmentPackageAtomic.created(assessment_package=assessment_package)
