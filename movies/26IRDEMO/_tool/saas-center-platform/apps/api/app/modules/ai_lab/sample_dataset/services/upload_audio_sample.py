from ..models import LabSampleDataset
from ..repository import LabSampleDatasetRepository


class UploadAudioSampleService:
    def __init__(self, repo: LabSampleDatasetRepository):
        self.repo = repo

    async def execute(
        self,
        *,
        name: str,
        s3_key: str,
        audio_duration: float,
        audio_file_size: int,
        description: str | None = None,
        tags: str | None = None,
        source_type: str = "manual",
        source_id: str | None = None,
        author_id: str | None = None,
    ) -> LabSampleDataset:
        # return
        return await self.repo.add(
            name=name,
            input_type="audio",
            s3_key=s3_key,
            audio_duration=audio_duration,
            audio_file_size=audio_file_size,
            description=description,
            tags=tags,
            source_type=source_type,
            field_note_id=source_id,
            author_id=author_id,
        )
