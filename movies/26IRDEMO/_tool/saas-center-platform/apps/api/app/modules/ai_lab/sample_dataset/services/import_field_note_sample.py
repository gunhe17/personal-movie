from app.core.exceptions import EntityNotFoundException
from ..models import LabSampleDataset
from ..repository import LabSampleDatasetRepository
from .upload_audio_sample import UploadAudioSampleService


class ImportFieldNoteSampleService:
    def __init__(self, repo: LabSampleDatasetRepository):
        self.repo = repo

    async def execute(
        self,
        *,
        field_note_id: str,
        storage_path: str | None,
        duration: float,
        name: str | None = None,
    ) -> LabSampleDataset:
        # verify
        if not storage_path:
            raise EntityNotFoundException(f"필드노트 오디오를 찾을 수 없습니다: {field_note_id}")

        # return
        return await UploadAudioSampleService(self.repo).execute(
            name=name or f"[필드노트] {field_note_id[:8]}",
            s3_key=storage_path,
            audio_duration=float(duration or 0),
            audio_file_size=0,
            description="필드노트 녹음에서 가져온 샘플",
            tags="field-note",
            source_type="field_note",
            source_id=field_note_id,
        )
