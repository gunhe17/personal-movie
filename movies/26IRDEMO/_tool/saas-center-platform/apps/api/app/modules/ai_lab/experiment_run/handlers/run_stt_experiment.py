import os

from app.core.exceptions import EntityNotFoundException, InvalidOperationException
from app.core.type import uuid_str
from app.infrastructure.persistence.unit_of_work import UnitOfWork
from app.infrastructure.storage import get_storage_client

from ..._audit import emit_admin_audit
from ...facade import ExperimentFacade, SampleFacade
from ..schemas import STTExperimentRequest, ExperimentRunResponse
from app.modules.llm.facade.ai_facade import create_ai_facade


async def run_stt_experiment_handler(
    data: STTExperimentRequest,
    uow: UnitOfWork,
    *,
    event_group_id: uuid_str,
    actor_id: str,
    ip: str | None = None,
) -> ExperimentRunResponse:
    sample = await SampleFacade(uow).find_sample(data.sample_id)
    if not sample:
        raise EntityNotFoundException(f"Sample not found: {data.sample_id}")
    if sample.input_type != "audio":
        raise InvalidOperationException("STT 실험은 오디오 샘플만 가능합니다.")

    audio_bytes = await get_storage_client().download_file(sample.s3_key)

    result = await ExperimentFacade(uow, create_ai_facade()).run_stt_experiment(
        experiment_type=data.experiment_type,
        sample_id=data.sample_id,
        model_name=data.model_name,
        provider=data.provider,
        model_params=data.model_params,
        audio_bytes=audio_bytes,
        audio_duration=sample.audio_duration or 0.0,
        audio_filename=os.path.basename(sample.s3_key)
        if sample.s3_key
        else "audio.webm",
        system_prompt=data.system_prompt,
        tags=data.tags,
        memo=data.memo,
    )
    await emit_admin_audit(
        uow, "experiment_run_created",
        act="created", entity_name="experiment_run", entity_id=result.id,
        payload={"experiment_type": result.experiment_type},
        event_group_id=event_group_id, actor_id=actor_id, ip=ip,
    )
    return ExperimentRunResponse.model_validate(result)


TOOL = {
    "name": 'run_stt_experiment_handler',
    "permission": None,
    "purpose": '음성인식(STT) 실험을 실행한다.',
    "keywords": ['STT 실험', '음성인식 테스트', 'stt 실행', '받아쓰기 실험'],
    "boundaries": '음성→텍스트(STT) 실험 실행. LLM 실험은 run_llm_experiment_handler.',
    "output": '실행된 STT 실험 (ExperimentRunResponse).',
    "input_schema": {
        "type": "object",
        "properties": {
            'experiment_type': {'default': 'stt_diarize', 'title': '실험 유형', 'type': 'string', 'description': '실험 유형(기본 stt_diarize).'},
            'sample_id': {'title': '샘플', 'type': 'string', 'description': '사용할 샘플(오디오)의 UUID.'},
            'model_name': {'default': 'gpt-4o-transcribe-diarize', 'title': '모델', 'type': 'string', 'description': 'STT 모델명(기본 gpt-4o-transcribe-diarize).'},
            'provider': {'default': 'openai', 'title': '제공자', 'type': 'string', 'description': '모델 제공자(기본 openai).'},
            'model_params': {'anyOf': [{'additionalProperties': True, 'type': 'object'}, {'type': 'null'}], 'default': None, 'title': '모델 파라미터', 'description': '모델 파라미터(선택).'},
            'system_prompt': {'anyOf': [{'type': 'string'}, {'type': 'null'}], 'default': None, 'title': '시스템 프롬프트', 'description': '시스템 프롬프트(선택).'},
            'tags': {'anyOf': [{'type': 'string'}, {'type': 'null'}], 'default': None, 'title': '태그', 'description': '분류 태그(선택).'},
            'memo': {'anyOf': [{'type': 'string'}, {'type': 'null'}], 'default': None, 'title': '메모', 'description': '메모(선택).'},
        },
        "required": ['sample_id'],
    },
}
