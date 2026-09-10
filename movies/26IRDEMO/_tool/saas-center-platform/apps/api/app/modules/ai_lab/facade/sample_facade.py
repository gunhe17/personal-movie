from app.infrastructure.persistence.new_repository import Page
from app.infrastructure.persistence.unit_of_work import UnitOfWork

from ..sample_dataset.models import LabSampleDataset
from ..sample_dataset.repository import LabSampleDatasetRepository
from ..sample_dataset.services.create_text_sample import CreateTextSampleService
from ..sample_dataset.services.find_sample import FindSampleService
from ..sample_dataset.services.list_samples import ListSamplesService
from ..sample_dataset.services.upload_audio_sample import UploadAudioSampleService
from ..sample_dataset.services.update_sample import UpdateSampleService
from ..sample_dataset.services.update_reference_segments import UpdateReferenceSegmentsService
from ..sample_dataset.services.delete_sample import DeleteSampleService
from ..sample_dataset.services.list_field_note_candidates import ListFieldNoteCandidatesService
from ..sample_dataset.services.import_field_note_sample import ImportFieldNoteSampleService


class SampleFacade:
    def __init__(self, uow: UnitOfWork) -> None:
        self._uow = uow

    async def list_samples(self, **kwargs) -> tuple[list[LabSampleDataset], Page]:
        return await ListSamplesService(
            self._uow.repo(LabSampleDatasetRepository)
        ).execute(**kwargs)

    async def find_sample(self, sample_id: str) -> LabSampleDataset | None:
        return await FindSampleService(
            self._uow.repo(LabSampleDatasetRepository)
        ).execute(sample_id)

    async def create_text_sample(self, **kwargs) -> LabSampleDataset:
        repo = self._uow.repo(LabSampleDatasetRepository)
        return await CreateTextSampleService(repo).execute(**kwargs)

    async def upload_audio_sample(self, **kwargs) -> LabSampleDataset:
        repo = self._uow.repo(LabSampleDatasetRepository)
        return await UploadAudioSampleService(repo).execute(**kwargs)

    async def update_sample(self, sample_id: str, **fields) -> LabSampleDataset:
        repo = self._uow.repo(LabSampleDatasetRepository)
        return await UpdateSampleService(repo).execute(sample_id, **fields)

    async def delete_sample(self, sample_id: str) -> LabSampleDataset:
        repo = self._uow.repo(LabSampleDatasetRepository)
        return await DeleteSampleService(repo).execute(sample_id=sample_id)

    async def list_field_note_candidates(self, candidates: list[dict]) -> list[dict]:
        # candidates는 크로스 모듈(field_note) — application handler가 주입.
        repo = self._uow.repo(LabSampleDatasetRepository)
        return await ListFieldNoteCandidatesService(repo).execute(candidates)

    async def import_field_note_sample(
        self,
        *,
        field_note_id: str,
        audio: dict | None,
        name: str | None = None,
    ) -> LabSampleDataset:
        # audio는 크로스 모듈(field_note) — application handler가 주입.
        repo = self._uow.repo(LabSampleDatasetRepository)
        return await ImportFieldNoteSampleService(repo).execute(
            field_note_id=field_note_id,
            storage_path=audio["storage_path"] if audio else None,
            duration=audio["duration"] if audio else 0.0,
            name=name,
        )

    async def update_reference_segments(self, sample_id: str, segments_json: str) -> LabSampleDataset:
        repo = self._uow.repo(LabSampleDatasetRepository)
        return await UpdateReferenceSegmentsService(repo).execute(sample_id, segments_json)
