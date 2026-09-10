from app.core.exceptions import EntityNotFoundException
from app.infrastructure.persistence.unit_of_work import UnitOfWork

from ...facade import ExperimentFacade
from ..schemas import ExperimentRunResponse


async def get_experiment_handler(
    experiment_id: str,
    uow: UnitOfWork,
) -> ExperimentRunResponse:
    exp = await ExperimentFacade(uow).find_experiment(experiment_id)
    if not exp:
        raise EntityNotFoundException(f"Experiment not found: {experiment_id}")
    return ExperimentRunResponse.model_validate(exp)


TOOL = {
    "name": "get_experiment_handler",
    "permission": None,
    "purpose": "AI 실험 실행 한 건을 조회한다.",
    "keywords": ["실험 조회", "experiment 상세", "실행 결과 보기"],
    "boundaries": "단건 실험 조회(읽기). 목록은 list_experiments_handler.",
    "output": "실험 실행 상세 (ExperimentRunResponse).",
    "input_schema": {
        "type": "object",
        "properties": {
            "experiment_id": {"type": "string", "format": "uuid", "title": "대상 실험", "description": "조회할 실험의 UUID."},
        },
        "required": ["experiment_id"],
    },
}
