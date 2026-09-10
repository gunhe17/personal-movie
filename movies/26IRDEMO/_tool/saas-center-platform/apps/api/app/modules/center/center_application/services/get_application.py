from ..models import CenterApplication
from ..repository import CenterApplicationRepository


class GetApplicationService:
    def __init__(self, repo: CenterApplicationRepository):
        self.repo = repo

    async def execute(self, application_id: str) -> CenterApplication:
        # return
        return await self.repo.get_by_id(application_id)
