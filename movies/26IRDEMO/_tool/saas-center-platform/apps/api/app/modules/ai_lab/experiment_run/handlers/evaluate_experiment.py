from app.core.exceptions import EntityNotFoundException
from app.core.type import uuid_str
from app.infrastructure.persistence.unit_of_work import UnitOfWork

from ..._audit import emit_admin_audit
from ...facade import ExperimentFacade
from ..schemas import ExperimentEvaluationUpdate, ExperimentRunResponse


async def evaluate_experiment_handler(
    experiment_id: str,
    data: ExperimentEvaluationUpdate,
    uow: UnitOfWork,
    *,
    event_group_id: uuid_str,
    actor_id: str,
    ip: str | None = None,
) -> ExperimentRunResponse:
    exp = await ExperimentFacade(uow).evaluate_experiment(
        experiment_id,
        data.quality_score,
        data.quality_note,
    )
    if not exp:
        raise EntityNotFoundException(f"Experiment not found: {experiment_id}")
    await emit_admin_audit(
        uow, "experiment_run_updated",
        act="updated", entity_name="experiment_run", entity_id=experiment_id,
        payload={"input": data.model_dump(mode="json", exclude_unset=True)},
        event_group_id=event_group_id, actor_id=actor_id, ip=ip,
    )
    return ExperimentRunResponse.model_validate(exp)


TOOL = {
    "name": 'evaluate_experiment_handler',
    "permission": None,
    "purpose": '실험 결과에 평가(점수·코멘트)를 기록한다.',
    "keywords": ['실험 평가', '결과 채점', 'experiment 평가', '평가 입력'],
    "boundaries": "실험 결과에 사람 '평가'를 남긴다. 자동 정확도는 calculate_diarization_accuracy_handler.",
    "output": '평가가 반영된 실험 (ExperimentRunResponse).',
    "input_schema": {
        "type": "object",
        "properties": {
            'experiment_id': {'type': 'string', 'format': 'uuid', 'title': '대상 실험', 'description': '평가할 실험의 UUID.'},
            'quality_score': {'maximum': 5, 'minimum': 1, 'title': '품질 점수', 'type': 'integer', 'description': '실험 결과 품질 점수(1~5).'},
            'quality_note': {'anyOf': [{'type': 'string'}, {'type': 'null'}], 'default': None, 'title': '품질 메모', 'description': '평가 코멘트(선택).'},
        },
        "required": ['experiment_id', 'quality_score'],
    },
}
