from app.core.exceptions import EntityNotFoundException
from app.infrastructure.persistence.unit_of_work import UnitOfWork

from ...facade import ExperimentGroupFacade
from ..schemas import ExperimentGroupResponse


async def get_experiment_group_handler(
    group_id: str,
    uow: UnitOfWork,
) -> ExperimentGroupResponse:
    group = await ExperimentGroupFacade(uow).find_experiment_group(group_id)
    if not group:
        raise EntityNotFoundException(f"Experiment group not found: {group_id}")
    return ExperimentGroupResponse.model_validate(group)


TOOL = {
    "name": "get_experiment_group_handler",
    "permission": None,
    "purpose": "AI 실험 그룹 한 건을 조회한다.",
    "keywords": ["실험 그룹 조회", "group 상세", "실험 묶음 정보"],
    "boundaries": "단건 그룹 조회(읽기 전용). 목록은 list_experiment_groups_handler, 비교는 get_experiment_comparison_handler.",
    "output": "실험 그룹 상세 (ExperimentGroupResponse).",
    "input_schema": {
        "type": "object",
        "properties": {
            "group_id": {"type": "string", "format": "uuid", "title": "대상 실험 그룹", "description": "조회할 실험 그룹의 UUID."},
        },
        "required": ["group_id"],
    },
}
