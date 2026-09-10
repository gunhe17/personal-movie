from ..events import AssessmentPackageAtomic
from ..repository import AssessmentPackageRepository
from ..models import AssessmentPackage


class DeleteAssessmentPackageService:
    def __init__(self, repo: AssessmentPackageRepository):
        self.repo = repo

    async def execute(self, center_id: str, package_id: str) -> tuple[AssessmentPackageAtomic, AssessmentPackage]:
        # verify
        assessment_package = await self.repo.get_in_center(center_id=center_id, package_id=package_id)

        # return
        removed = await self.repo.remove_in_center(package_id=package_id, center_id=center_id)

        return AssessmentPackageAtomic.deleted(assessment_package=removed if removed is not None else assessment_package)
