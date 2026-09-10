import os

from app.core.exceptions import EntityNotFoundException, InvalidOperationException
from app.core.type import uuid_str
from app.infrastructure.persistence.unit_of_work import UnitOfWork
from app.infrastructure.storage import get_storage_client
from app.runtime.field_note.prompts import get_production_prompts

from app.modules.ai_lab import build_experiment_types
from app.modules.ai_lab.facade import ExperimentFacade, SampleFacade
from app.modules.ai_lab.experiment_run.schemas import ChainExperimentRequest, ExperimentRunResponse
from app.modules.event import emit
from app.modules.llm.facade.ai_facade import create_ai_facade
from app.modules.platform_admin.audit_log.events import AdminAuditAtomic


async def run_chain_experiment_handler(
    data: ChainExperimentRequest,
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
        raise InvalidOperationException("체인 실험은 오디오 샘플만 가능합니다.")

    audio_bytes = await get_storage_client().download_file(sample.s3_key)

    # 시스템 프롬프트: 요청에 없으면 chain_stt_refine 프로덕션 기본값 사용
    system_prompt = data.system_prompt or ""
    if not system_prompt:
        experiment_types = build_experiment_types(get_production_prompts())
        chain_meta = next(
            (e for e in experiment_types if e.key == "chain_stt_refine"), None
        )
        system_prompt = chain_meta.default_system_prompt if chain_meta else ""

    result = await ExperimentFacade(uow, create_ai_facade()).run_chain_experiment(
        sample_id=data.sample_id,
        stt_model_name=data.stt_model_name,
        llm_model_name=data.llm_model_name,
        provider=data.provider,
        system_prompt=system_prompt,
        model_params=data.model_params,
        audio_bytes=audio_bytes,
        audio_duration=sample.audio_duration or 0.0,
        audio_filename=os.path.basename(sample.s3_key) if sample.s3_key else "audio.webm",
        tags=data.tags,
        memo=data.memo,
    )
    await emit(
        uow,
        "experiment_run_created",
        event_group_id=event_group_id,
        atomics=[AdminAuditAtomic(
            _act="created",
            _entity_name="experiment_run",
            _entity_id=result.id,
            _payload={"data": {"experiment_type": result.experiment_type}},
        )],
        actor_id=actor_id,
        actor_type="admin",
        ip_address=ip,
    )
    return ExperimentRunResponse.model_validate(result)


TOOL = {
    "name": 'run_chain_experiment_handler',
    "permission": None,
    "agent_exposed": False,
    "purpose": '여러 단계를 연결한 체인 실험을 실행한다.',
    "keywords": ['체인 실험', 'chain 실행', '파이프라인 실험', '연결 실험'],
    "boundaries": "다단계 '체인' 실험 실행. 단일 LLM 실험은 run_llm_experiment_handler.",
    "output": '실행된 체인 실험 (ExperimentRunResponse).',
    "input_schema": {
        "type": "object",
        "properties": {
            'sample_id': {'title': '샘플', 'type': 'string', 'description': '사용할 샘플(오디오)의 UUID.'},
            'stt_model_name': {'default': 'gpt-4o-transcribe-diarize', 'title': 'STT 모델', 'type': 'string', 'description': 'STT(음성인식) 모델명(기본 gpt-4o-transcribe-diarize).'},
            'llm_model_name': {'default': 'gpt-4.1', 'title': 'LLM 모델', 'type': 'string', 'description': 'LLM 모델명(기본 gpt-4.1).'},
            'provider': {'default': 'openai', 'title': '제공자', 'type': 'string', 'description': '모델 제공자(기본 openai).'},
            'system_prompt': {'anyOf': [{'type': 'string'}, {'type': 'null'}], 'default': None, 'title': '시스템 프롬프트', 'description': '시스템 프롬프트(선택).'},
            'model_params': {'anyOf': [{'additionalProperties': True, 'type': 'object'}, {'type': 'null'}], 'default': None, 'title': '모델 파라미터', 'description': 'temperature 등 모델 파라미터(선택).'},
            'tags': {'anyOf': [{'type': 'string'}, {'type': 'null'}], 'default': None, 'title': '태그', 'description': '분류 태그(선택).'},
            'memo': {'anyOf': [{'type': 'string'}, {'type': 'null'}], 'default': None, 'title': '메모', 'description': '메모(선택).'},
        },
        "required": ['sample_id'],
    },
}
