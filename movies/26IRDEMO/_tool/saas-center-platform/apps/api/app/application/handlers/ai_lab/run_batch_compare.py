from app.core.exceptions import EntityNotFoundException, InvalidOperationException
from app.core.type import uuid_str
from app.infrastructure.persistence.unit_of_work import UnitOfWork
from app.modules.event import emit
from app.modules.ai_lab.facade import ExperimentGroupFacade, SampleFacade
from app.modules.ai_lab.experiment_group.schemas import (
    BatchCompareRequest,
    ExperimentGroupResponse,
)


# D3 분해(2026-07-08): 변형별 장시간 실행은 워커(runtime/ai_lab)로 — 여기서는 그룹 생성·
# 사전 검증·emit만. 실행은 반응(enqueue_lab_batch_compare)→batch 큐. 응답은 status=pending 그룹.
async def run_batch_compare_handler(
    *,
    event_group_id: uuid_str,
    data: BatchCompareRequest,
    uow: UnitOfWork,
    actor_id: str | None = None,
) -> ExperimentGroupResponse:
    sample = await SampleFacade(uow).find_sample(data.sample_id)
    if not sample:
        raise EntityNotFoundException(f"Sample not found: {data.sample_id}")
    if data.experiment_type.startswith("stt") and sample.input_type != "audio":
        raise InvalidOperationException("STT 실험은 오디오 샘플만 가능합니다.")

    atomic, group = await ExperimentGroupFacade(uow).create_experiment_group(
        name=data.name,
        description=data.description,
        experiment_type=data.experiment_type,
        sample_id=data.sample_id,
        variants=[v.model_dump() for v in data.variants],
        tags=data.tags,
        memo=data.memo,
    )
    await emit(
        uow,
        "experiment_group_created",
        event_group_id=event_group_id,
        atomics=[atomic],
        actor_id=actor_id,
        actor_type="admin",
    )

    return ExperimentGroupResponse.model_validate(group)


TOOL = {
    "name": "run_batch_compare_handler",
    "permission": None,
    "agent_exposed": False,
    "purpose": "여러 실험을 일괄 실행해 비교 그룹을 만든다.",
    "keywords": ["일괄 비교 실행", "배치 비교", "batch compare", "실험 일괄 실행"],
    "boundaries": "여러 실험을 한 번에 돌려 비교 그룹을 생성·실행한다.",
    "output": "생성·워커 실행 예약된 비교 실험 그룹 (ExperimentGroupResponse, status=pending — 진행은 그룹 조회로 확인).",
    "input_schema": {
        "type": "object",
        "properties": {
            "name": {
                "maxLength": 200,
                "minLength": 1,
                "title": "실험 그룹명",
                "type": "string",
                "description": "배치 비교 실험 그룹 이름.",
            },
            "description": {
                "anyOf": [{"type": "string"}, {"type": "null"}],
                "default": None,
                "title": "설명",
                "description": "실험 그룹 설명(선택).",
            },
            "experiment_type": {
                "minLength": 1,
                "title": "실험 유형",
                "type": "string",
                "description": "실험 유형(llm_summary/stt_diarize 등).",
            },
            "sample_id": {
                "title": "샘플",
                "type": "string",
                "description": "사용할 샘플 데이터셋의 UUID.",
            },
            "variants": {
                "items": {"$ref": "#/$defs/ExperimentVariant"},
                "maxItems": 10,
                "minItems": 2,
                "title": "비교 변형",
                "type": "array",
                "description": "비교할 모델·프롬프트 변형 목록(2~10개).",
            },
            "tags": {
                "anyOf": [{"maxLength": 500, "type": "string"}, {"type": "null"}],
                "default": None,
                "title": "태그",
                "description": "분류 태그(선택).",
            },
            "memo": {
                "anyOf": [{"type": "string"}, {"type": "null"}],
                "default": None,
                "title": "메모",
                "description": "메모(선택).",
            },
        },
        "required": ["name", "experiment_type", "sample_id", "variants"],
    },
}
