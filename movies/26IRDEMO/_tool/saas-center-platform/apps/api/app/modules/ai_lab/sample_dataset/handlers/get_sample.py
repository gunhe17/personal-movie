from app.core.exceptions import EntityNotFoundException
from app.infrastructure.persistence.unit_of_work import UnitOfWork

from ...facade import SampleFacade
from ..schemas import SampleDatasetResponse


async def get_sample_handler(
    sample_id: str,
    uow: UnitOfWork,
) -> SampleDatasetResponse:
    sample = await SampleFacade(uow).find_sample(sample_id)
    if not sample:
        raise EntityNotFoundException(f"Sample not found: {sample_id}")
    return SampleDatasetResponse.model_validate(sample)


TOOL = {
    "name": "get_sample_handler",
    "permission": None,
    "purpose": "샘플 데이터 한 건을 조회한다.",
    "keywords": ["샘플 조회", "sample 상세", "데이터 보기"],
    "boundaries": "단건 샘플 조회(읽기). 목록은 list_samples_handler, 오디오 URL은 get_sample_audio_url_handler.",
    "output": "샘플 상세 (SampleDatasetResponse).",
    "input_schema": {
        "type": "object",
        "properties": {
            "sample_id": {"type": "string", "format": "uuid", "title": "대상 샘플", "description": "조회할 샘플의 UUID."},
        },
        "required": ["sample_id"],
    },
}
