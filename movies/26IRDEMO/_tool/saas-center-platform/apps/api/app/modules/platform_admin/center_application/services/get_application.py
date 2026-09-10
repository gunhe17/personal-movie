from app.core.exceptions import EntityNotFoundException
from app.modules.center.center_application.models import CenterApplication
from app.modules.platform_admin.center_application.repository import AdminApplicationRepository


class GetApplicationService:
    def __init__(self, repo: AdminApplicationRepository):
        self.repo = repo

    async def execute(self, *, application_id: str) -> tuple[CenterApplication, str, str]:
        row = await self.repo.aggregate_application_with_details(application_id)
        if not row:
            raise EntityNotFoundException(f"신청을 찾을 수 없습니다: {application_id}")

        return row
