from app.core.exceptions import EntityNotFoundException
from ..models import LabSampleDataset
from ..repository import LabSampleDatasetRepository


class UpdateReferenceSegmentsService:
    def __init__(self, repo: LabSampleDatasetRepository):
        self.repo = repo

    async def execute(self, sample_id: str, segments_json: str) -> LabSampleDataset:
        # load
        sample = await self.repo.find_by_id(id=sample_id)
        if not sample:
            raise EntityNotFoundException(f"Sample not found: {sample_id}")

        # return
        updated = await self.repo.update_in_place(
            id=sample_id, reference_segments=segments_json
        )
        assert updated is not None
        return updated
