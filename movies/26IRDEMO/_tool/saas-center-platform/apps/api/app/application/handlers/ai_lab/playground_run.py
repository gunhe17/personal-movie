import os

from app.core.type import uuid_str
from app.infrastructure.persistence.unit_of_work import UnitOfWork
from app.infrastructure.storage import get_storage_client
from app.core.exceptions import EntityNotFoundException, InvalidOperationException
from app.modules.ai_lab.facade import ExperimentFacade, PromptFacade, SampleFacade
from app.runtime.field_note.prompts import get_production_prompts
from app.modules.ai_lab.experiment_run.schemas import (
    PlaygroundRunRequest,
    ExperimentRunResponse,
)
from app.modules.event import emit
from app.modules.llm.facade.ai_facade import create_ai_facade
from app.modules.platform_admin.audit_log.events import AdminAuditAtomic


async def playground_run_handler(
    data: PlaygroundRunRequest,
    uow: UnitOfWork,
    *,
    event_group_id: uuid_str,
    actor_id: str,
    ip: str | None = None,
) -> ExperimentRunResponse:
    sample_facade = SampleFacade(uow)
    prompt_facade = PromptFacade(uow)
    experiment_facade = ExperimentFacade(uow, create_ai_facade())

    if data.experiment_type.startswith("llm"):
        result = await _run_llm_playground(
            data,
            sample_facade,
            prompt_facade,
            experiment_facade,
        )
    elif data.experiment_type.startswith("stt"):
        result = await _run_stt_playground(data, sample_facade, experiment_facade)
    else:
        raise InvalidOperationException(
            f"지원하지 않는 실험 타입: {data.experiment_type}"
        )

    if data.save_result:
        await emit(
            uow,
            "experiment_run_created",
            event_group_id=event_group_id,
            atomics=[AdminAuditAtomic(
                _act="created",
                _entity_name="experiment_run",
                _entity_id=result.id,
                _payload={"data": {
                    "experiment_type": data.experiment_type,
                    "source": "playground",
                }},
            )],
            actor_id=actor_id,
            actor_type="admin",
            ip_address=ip,
        )
        await uow.session.refresh(result)
    else:
        # tx 예외: save_result=False면 speculative write 폐기(behavior 커밋 전 롤백)
        await uow.rollback()

    return ExperimentRunResponse.model_validate(result)


async def _run_llm_playground(
    data: PlaygroundRunRequest,
    sample_facade: SampleFacade,
    prompt_facade: PromptFacade,
    experiment_facade: ExperimentFacade,
):
    if data.sample_id:
        sample = await sample_facade.find_sample(data.sample_id)
        if not sample:
            raise EntityNotFoundException(f"Sample not found: {data.sample_id}")
        if sample.input_type != "text":
            raise InvalidOperationException("LLM 실험은 텍스트 샘플만 가능합니다.")
        input_text = sample.text_content or ""
    else:
        input_text = data.input_text or ""

    system_prompt, user_template = await prompt_facade.resolve_prompt(
        experiment_type=data.experiment_type,
        system_prompt=data.system_prompt,
        user_prompt_template=data.user_prompt_template,
        prompt_version_id=data.prompt_version_id,
        fallback_prompts=get_production_prompts(),
    )
    user_prompt = (
        user_template.format(input=input_text) if user_template else input_text
    )

    return await experiment_facade.run_llm_experiment(
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
        tags="playground",
    )


async def _run_stt_playground(
    data: PlaygroundRunRequest,
    sample_facade: SampleFacade,
    experiment_facade: ExperimentFacade,
):
    sample = await sample_facade.find_sample(data.sample_id)
    if not sample:
        raise EntityNotFoundException(f"Sample not found: {data.sample_id}")
    if sample.input_type != "audio":
        raise InvalidOperationException("STT 실험은 오디오 샘플만 가능합니다.")

    storage = get_storage_client()
    audio_bytes = await storage.download_file(sample.s3_key)

    return await experiment_facade.run_stt_experiment(
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
        tags="playground",
    )
