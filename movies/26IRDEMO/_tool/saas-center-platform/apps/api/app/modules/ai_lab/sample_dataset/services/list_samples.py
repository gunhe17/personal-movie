from app.infrastructure.persistence.new_repository import Page

from ..models import LabSampleDataset
from ..repository import LabSampleDatasetRepository


class ListSamplesService:
    def __init__(self, repo: LabSampleDatasetRepository):
        self.repo = repo

    async def execute(self, **kwargs) -> tuple[list[LabSampleDataset], Page]:
        # return
        return await self.repo.list_with_page(**kwargs)
