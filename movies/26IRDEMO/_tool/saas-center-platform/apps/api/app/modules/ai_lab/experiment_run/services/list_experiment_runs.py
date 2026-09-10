from app.infrastructure.persistence.new_repository import Page

from ..models import LabExperimentRun
from ..repository import LabExperimentRunRepository


class ListExperimentRunsService:
    def __init__(self, repo: LabExperimentRunRepository):
        self.repo = repo

    async def execute(self, **kwargs) -> tuple[list[LabExperimentRun], Page]:
        # return
        return await self.repo.list_with_page(**kwargs)
