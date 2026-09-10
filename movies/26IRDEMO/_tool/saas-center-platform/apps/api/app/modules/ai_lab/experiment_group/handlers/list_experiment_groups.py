from app.infrastructure.persistence.unit_of_work import UnitOfWork

from ...facade import ExperimentGroupFacade
from ..schemas import ExperimentGroupListResponse, ExperimentGroupSummary


async def list_experiment_groups_handler(
    experiment_type: str | None,
    status: str | None,
    page: int,
    size: int,
    uow: UnitOfWork,
) -> ExperimentGroupListResponse:
    items, page_meta = await ExperimentGroupFacade(uow).list_experiment_groups(
        experiment_type=experiment_type,
        status=status,
        page=page,
        size=size,
    )
    return {
        "items": [ExperimentGroupSummary.model_validate(g) for g in items],
        **page_meta,
    }


TOOL = {
    "name": "list_experiment_groups_handler",
    "permission": None,
    "purpose": "AI 실험 그룹 목록을 유형·상태로 거르고 조회한다.",
    "keywords": ["실험 그룹 목록", "group 리스트", "실험 묶음 목록"],
    "boundaries": "실험 그룹 목록(읽기 전용). 단건은 get_experiment_group_handler.",
    "output": "실험 그룹 목록 (ExperimentGroupListResponse).",
    "input_schema": {
        "type": "object",
        "properties": {
            "experiment_type": {"type": "string", "title": "유형 필터", "description": "실험 유형 필터(선택)."},
            "status": {"type": "string", "title": "상태 필터", "description": "상태 필터(선택)."},
            "page": {"type": "integer", "title": "페이지", "minimum": 1, "description": "페이지 번호(1부터)."},
            "size": {"type": "integer", "title": "페이지 크기", "description": "페이지당 개수."},
        },
        "required": ["page", "size"],
    },
}
