from app.infrastructure.persistence.unit_of_work import UnitOfWork

from ...facade import ExperimentFacade
from ..schemas import DiarizationAccuracyResponse


async def calculate_diarization_accuracy_handler(
    experiment_id: str,
    uow: UnitOfWork,
) -> DiarizationAccuracyResponse:
    return await ExperimentFacade(uow).calculate_diarization_accuracy(experiment_id)


TOOL = {
    "name": "calculate_diarization_accuracy_handler",
    "permission": None,
    "purpose": "화자분리(diarization) 실험의 정확도를 계산해 조회한다.",
    "keywords": ["화자분리 정확도", "diarization 정확도", "STT 화자 정확도", "정확도 평가"],
    "boundaries": "화자분리 실험의 '정확도' 산출(읽기). 텍스트 화자분리 평가는 run_text_diarize_eval_handler.",
    "output": "화자분리 정확도 산출 결과 (DiarizationAccuracyResponse).",
    "input_schema": {
        "type": "object",
        "properties": {
            "experiment_id": {"type": "string", "format": "uuid", "title": "대상 실험", "description": "정확도를 볼 실험의 UUID."},
        },
        "required": ["experiment_id"],
    },
}
