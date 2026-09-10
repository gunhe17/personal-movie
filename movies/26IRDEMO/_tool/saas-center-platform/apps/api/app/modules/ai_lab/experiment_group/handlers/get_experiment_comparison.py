from app.infrastructure.persistence.unit_of_work import UnitOfWork

from ...facade import ExperimentGroupFacade
from ...sample_dataset.schemas import SampleDatasetSummary
from ...experiment_run.schemas import ExperimentRunResponse
from ..schemas import (
    ComparisonResultResponse,
    ComparisonSummary,
    ExperimentGroupResponse,
)


async def get_experiment_comparison_handler(
    group_id: str,
    uow: UnitOfWork,
) -> ComparisonResultResponse:
    group, sample, runs, comparison_summary = await ExperimentGroupFacade(
        uow
    ).get_experiment_comparison(group_id)
    return ComparisonResultResponse(
        group=ExperimentGroupResponse.model_validate(group),
        sample=SampleDatasetSummary.model_validate(sample),
        runs=[ExperimentRunResponse.model_validate(r) for r in runs],
        comparison_summary=ComparisonSummary(**comparison_summary),
    )


TOOL = {
    "name": "get_experiment_comparison_handler",
    "permission": None,
    "purpose": "실험 그룹 내 실험들의 비교 결과를 조회한다.",
    "keywords": ["실험 비교", "결과 비교", "comparison 조회", "그룹 비교 결과"],
    "boundaries": "한 그룹의 실험들을 비교한 결과(읽기 전용). 그룹 자체는 get_experiment_group_handler.",
    "output": "그룹 내 실험들의 비교 결과 (ComparisonResultResponse).",
    "input_schema": {
        "type": "object",
        "properties": {
            "group_id": {"type": "string", "format": "uuid", "title": "대상 실험 그룹", "description": "비교 결과를 볼 실험 그룹의 UUID."},
        },
        "required": ["group_id"],
    },
}
