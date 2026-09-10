from ..models import LabSampleDataset
from ..repository import LabSampleDatasetRepository


class FindSampleService:
    def __init__(self, repo: LabSampleDatasetRepository):
        self.repo = repo

    async def execute(self, sample_id: str) -> LabSampleDataset | None:
        # return
        return await self.repo.find_by_id(id=sample_id)
