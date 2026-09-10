from app.infrastructure.persistence.unit_of_work import UnitOfWork

from ...facade import ExperimentFacade
from ..schemas import ExperimentRunListResponse, ExperimentRunSummary


async def list_experiments_handler(
    experiment_type: str | None,
    experiment_type_prefix: str | None,
    sample_id: str | None,
    status: str | None,
    page: int,
    size: int,
    uow: UnitOfWork,
) -> ExperimentRunListResponse:
    items, page_meta = await ExperimentFacade(uow).list_experiments(
        experiment_type=experiment_type,
        experiment_type_prefix=experiment_type_prefix,
        sample_id=sample_id,
        status=status,
        page=page,
        size=size,
    )
    return {
        "items": [ExperimentRunSummary.model_validate(i) for i in items],
        **page_meta,
    }


TOOL = {
    "name": "list_experiments_handler",
    "permission": None,
    "purpose": "AI 실험 실행 목록을 유형·샘플·상태로 거르고 조회한다.",
    "keywords": ["실험 목록", "experiment 리스트", "실행 기록 목록"],
    "boundaries": "실험 목록(읽기). 단건은 get_experiment_handler.",
    "output": "실험 실행 목록 (ExperimentRunListResponse).",
    "input_schema": {
        "type": "object",
        "properties": {
            "experiment_type": {"type": "string", "title": "유형 필터", "description": "유형 필터(선택)."},
            "experiment_type_prefix": {"type": "string", "title": "유형 접두 필터", "description": "유형 접두 필터(선택)."},
            "sample_id": {"type": "string", "format": "uuid", "title": "샘플 필터", "description": "샘플 필터(선택)."},
            "status": {"type": "string", "title": "상태 필터", "description": "상태 필터(선택)."},
            "page": {"type": "integer", "title": "페이지", "minimum": 1, "description": "페이지 번호(1부터)."},
            "size": {"type": "integer", "title": "페이지 크기", "description": "페이지당 개수."},
        },
        "required": ["page", "size"],
    },
}
