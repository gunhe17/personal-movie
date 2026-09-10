from app.core.exceptions import EntityNotFoundException
from ..models import LabSampleDataset
from ..repository import LabSampleDatasetRepository


class DeleteSampleService:
    def __init__(self, repo: LabSampleDatasetRepository):
        self.repo = repo

    async def execute(self, sample_id: str) -> LabSampleDataset:
        # remove
        sample = await self.repo.remove_by_id(id=sample_id)
        if not sample:
            raise EntityNotFoundException(f"Sample not found: {sample_id}")
        return sample
