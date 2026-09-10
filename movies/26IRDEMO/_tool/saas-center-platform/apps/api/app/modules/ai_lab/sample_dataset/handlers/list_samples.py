from app.infrastructure.persistence.unit_of_work import UnitOfWork

from ...facade import SampleFacade
from ..schemas import SampleDatasetListResponse, SampleDatasetSummary


async def list_samples_handler(
    input_type: str | None,
    tags: str | None,
    page: int,
    size: int,
    uow: UnitOfWork,
) -> SampleDatasetListResponse:
    items, page_meta = await SampleFacade(uow).list_samples(
        input_type=input_type,
        tags=tags,
        page=page,
        size=size,
    )
    return {
        "items": [SampleDatasetSummary.model_validate(s) for s in items],
        **page_meta,
    }


TOOL = {
    "name": "list_samples_handler",
    "permission": None,
    "purpose": "샘플 데이터 목록을 입력유형·태그로 거르고 조회한다.",
    "keywords": ["샘플 목록", "sample 리스트", "데이터셋 목록"],
    "boundaries": "샘플 목록(읽기). 단건은 get_sample_handler.",
    "output": "샘플 목록 (SampleDatasetListResponse).",
    "input_schema": {
        "type": "object",
        "properties": {
            "input_type": {"type": "string", "title": "입력유형 필터", "enum": ["text", "audio"], "description": "입력 유형 필터(text/audio, 선택)."},
            "tags": {"type": "string", "title": "태그 필터", "description": "태그 필터(선택)."},
            "page": {"type": "integer", "title": "페이지", "minimum": 1, "description": "페이지 번호(1부터)."},
            "size": {"type": "integer", "title": "페이지 크기", "description": "페이지당 개수."},
        },
        "required": ["page", "size"],
    },
}
