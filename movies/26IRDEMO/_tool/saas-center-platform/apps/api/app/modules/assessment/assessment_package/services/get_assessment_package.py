from ..repository import AssessmentPackageRepository
from ..models import AssessmentPackage


class GetAssessmentPackageService:
    def __init__(self, repo: AssessmentPackageRepository):
        self.repo = repo

    async def execute(self, center_id: str, package_id: str) -> AssessmentPackage:
        assessment_package = await self.repo.get_in_center(center_id=center_id, package_id=package_id)

        return assessment_package
