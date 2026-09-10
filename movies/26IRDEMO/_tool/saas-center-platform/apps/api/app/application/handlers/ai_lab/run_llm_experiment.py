from app.core.exceptions import EntityNotFoundException, InvalidOperationException
from app.core.type import uuid_str
from app.infrastructure.persistence.unit_of_work import UnitOfWork
from app.runtime.field_note.prompts import get_production_prompts

from app.modules.ai_lab.facade import ExperimentFacade, PromptFacade, SampleFacade
from app.modules.ai_lab.experiment_run.schemas import LLMExperimentRequest, ExperimentRunResponse
from app.modules.event import emit
from app.modules.llm.facade.ai_facade import create_ai_facade
from app.modules.platform_admin.audit_log.events import AdminAuditAtomic


async def run_llm_experiment_handler(
    data: LLMExperimentRequest,
    uow: UnitOfWork,
    *,
    event_group_id: uuid_str,
    actor_id: str,
    ip: str | None = None,
) -> ExperimentRunResponse:
    if data.sample_id:
        sample = await SampleFacade(uow).find_sample(data.sample_id)
        if not sample:
            raise EntityNotFoundException(f"Sample not found: {data.sample_id}")
        if sample.input_type != "text":
            raise InvalidOperationException("LLM 실험은 텍스트 샘플만 가능합니다.")
        input_text = sample.text_content or ""
    else:
        input_text = data.input_text or ""

    system_prompt, user_template = await PromptFacade(uow).resolve_prompt(
        experiment_type=data.experiment_type,
        system_prompt=data.system_prompt,
        user_prompt_template=data.user_prompt_template,
        prompt_version_id=data.prompt_version_id,
        fallback_prompts=get_production_prompts(),
    )
    user_prompt = (
        user_template.format(input=input_text) if user_template else input_text
    )

    result = await ExperimentFacade(uow, create_ai_facade()).run_llm_experiment(
        experiment_type=data.experiment_type,
        sample_id=data.sample_id,
        model_name=data.model_name,
        provider=data.provider,
        prompt_version_id=data.prompt_version_id,
        model_params=data.model_params,
        input_text=input_text,
        system_prompt=system_prompt,
        user_prompt=user_prompt,
        use_json_mode=data.experiment_type
        in ("llm_counseling_note", "llm_case_analysis"),
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
    "name": 'run_llm_experiment_handler',
    "permission": None,
    "agent_exposed": False,
    "purpose": '단일 LLM 프롬프트 실험을 실행한다.',
    "keywords": ['LLM 실험', 'prompt 실험', '모델 실행', 'llm 테스트'],
    "boundaries": '단일 LLM 실험 실행. 체인은 run_chain_experiment_handler, STT는 run_stt_experiment_handler.',
    "output": '실행된 LLM 실험 (ExperimentRunResponse).',
    "input_schema": {
        "type": "object",
        "properties": {
            'experiment_type': {'default': 'llm_summary', 'title': '실험 유형', 'type': 'string', 'description': '실험 유형(기본 llm_summary).'},
            'sample_id': {'anyOf': [{'type': 'string'}, {'type': 'null'}], 'default': None, 'title': '샘플', 'description': '입력으로 쓸 샘플의 UUID(input_text 대신, 선택).'},
            'input_text': {'anyOf': [{'type': 'string'}, {'type': 'null'}], 'default': None, 'title': '입력 텍스트', 'description': '직접 입력 텍스트(sample_id 대신, 선택).'},
            'system_prompt': {'anyOf': [{'type': 'string'}, {'type': 'null'}], 'default': None, 'title': '시스템 프롬프트', 'description': '시스템 프롬프트(선택).'},
            'user_prompt_template': {'anyOf': [{'type': 'string'}, {'type': 'null'}], 'default': None, 'title': '유저 프롬프트 템플릿', 'description': '유저 프롬프트 템플릿(선택).'},
            'model_name': {'default': 'gpt-4.1', 'title': '모델', 'type': 'string', 'description': 'LLM 모델명(기본 gpt-4.1).'},
            'provider': {'default': 'openai', 'title': '제공자', 'type': 'string', 'description': '모델 제공자(기본 openai).'},
            'prompt_version_id': {'anyOf': [{'type': 'string'}, {'type': 'null'}], 'default': None, 'title': '프롬프트 버전', 'description': '등록된 프롬프트 버전 UUID(선택).'},
            'model_params': {'anyOf': [{'additionalProperties': True, 'type': 'object'}, {'type': 'null'}], 'default': None, 'title': '모델 파라미터', 'description': 'temperature 등 모델 파라미터(선택).'},
            'tags': {'anyOf': [{'type': 'string'}, {'type': 'null'}], 'default': None, 'title': '태그', 'description': '분류 태그(선택).'},
            'memo': {'anyOf': [{'type': 'string'}, {'type': 'null'}], 'default': None, 'title': '메모', 'description': '메모(선택).'},
        },
        "required": [],
    },
}
