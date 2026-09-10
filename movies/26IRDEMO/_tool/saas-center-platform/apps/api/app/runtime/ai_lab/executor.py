import os
from uuid import uuid4

from app.behavior.action.event import Event
from app.core.datetime_utils import utc_now

from app.core.exceptions import EntityNotFoundException, InvalidOperationException
from app.core.logger import get_logger
from app.infrastructure.persistence.database import AsyncSessionLocal
from app.infrastructure.persistence.unit_of_work import UnitOfWork, transactional_uow
from app.modules.event import emit
from app.infrastructure.storage import get_storage_client
from app.modules.ai_lab.facade import (
    ExperimentFacade,
    ExperimentGroupFacade,
    PromptFacade,
    SampleFacade,
)
from app.runtime.field_note import get_production_prompts
from app.modules.llm.facade.ai_facade import create_ai_facade

logger = get_logger(__name__)


async def process_lab_batch_compare(
    group_id: str,
    center_id: str,
    **params,
) -> None:
    variants: list[dict] = params.get("variants") or []
    logger.info("lab_batch_compare 시작: group=%s variants=%d", group_id, len(variants))

    try:
        event_group_id = str(uuid4())
        async with transactional_uow() as uow:
            atomic, group = await ExperimentGroupFacade(uow).start_group(
                group_id, started_at=utc_now()
            )
            sample_id = group.sample_id
            experiment_type = group.experiment_type
            await emit(
                uow,
                "lab_batch_compare_started",
                event_group_id=event_group_id,
                atomics=[atomic],
                center_id=center_id,
                actor_type="machine",
            )
        await _dispatch_event(event_group_id)

        async with AsyncSessionLocal() as session:
            uow = UnitOfWork(session)
            async with uow:
                sample = await SampleFacade(uow).find_sample(sample_id)
                if not sample:
                    raise EntityNotFoundException(f"Sample not found: {sample_id}")

                prompt_facade = PromptFacade(uow)
                experiment_facade = ExperimentFacade(uow, create_ai_facade())

                for variant in variants:
                    system_prompt, user_template = await prompt_facade.resolve_prompt(
                        experiment_type=experiment_type,
                        system_prompt=variant.get("system_prompt"),
                        user_prompt_template=variant.get("user_prompt_template"),
                        prompt_version_id=variant.get("prompt_version_id"),
                        fallback_prompts=get_production_prompts(),
                    )

                    if experiment_type.startswith("llm"):
                        user_prompt = (
                            user_template.format(input=sample.text_content)
                            if user_template
                            else sample.text_content or ""
                        )
                        await experiment_facade.run_llm_experiment(
                            experiment_type=experiment_type,
                            sample_id=sample.id,
                            group_id=group_id,
                            model_name=variant["model_name"],
                            provider=variant.get("provider", "openai"),
                            prompt_version_id=variant.get("prompt_version_id"),
                            model_params=variant.get("model_params"),
                            input_text=sample.text_content or "",
                            system_prompt=system_prompt,
                            user_prompt=user_prompt,
                            use_json_mode=experiment_type.endswith("_counseling_note"),
                        )
                    elif experiment_type.startswith("stt"):
                        if sample.input_type != "audio":
                            raise InvalidOperationException(
                                "STT 실험은 오디오 샘플만 가능합니다."
                            )
                        audio_bytes = await get_storage_client().download_file(
                            sample.s3_key
                        )
                        await experiment_facade.run_stt_experiment(
                            experiment_type=experiment_type,
                            sample_id=sample.id,
                            group_id=group_id,
                            model_name=variant["model_name"],
                            provider=variant.get("provider", "openai"),
                            model_params=variant.get("model_params"),
                            audio_bytes=audio_bytes,
                            audio_duration=sample.audio_duration or 0.0,
                            audio_filename=os.path.basename(sample.s3_key)
                            if sample.s3_key
                            else "audio.webm",
                        )

                    # 변형별 점진 커밋 — 부분 실패에도 완료분 보존 (기존 계약 유지)
                    await uow.commit()

        event_group_id = str(uuid4())
        async with transactional_uow() as uow:
            atomic, _ = await ExperimentGroupFacade(uow).finalize_group_stats(group_id)
            await emit(
                uow,
                "lab_batch_compare_completed",
                event_group_id=event_group_id,
                atomics=[atomic],
                center_id=center_id,
                actor_type="machine",
            )
        await _dispatch_event(event_group_id)
        logger.info("lab_batch_compare 완료: group=%s", group_id)

    except Exception as e:
        logger.error("lab_batch_compare 실패: group=%s: %s", group_id, e, exc_info=True)
        # 실패 마킹은 별도 세션 — 메인 tx 실패 후에도 상태 기록 보장
        try:
            event_group_id = str(uuid4())
            async with transactional_uow() as uow:
                atomic, _ = await ExperimentGroupFacade(uow).fail_group(
                    group_id, completed_at=utc_now()
                )
                await emit(
                    uow,
                    "lab_batch_compare_failed",
                    event_group_id=event_group_id,
                    atomics=[atomic],
                    center_id=center_id,
                    actor_type="machine",
                )
            await _dispatch_event(event_group_id)
        except Exception as mark_err:
            logger.warning("failed-마킹 실패: group=%s: %s", group_id, mark_err)


async def _dispatch_event(event_group_id: str) -> None:
    try:
        await Event.dispatch_event(event_group_id)
    except Exception as e:
        logger.warning(
            "lab_batch_compare event dispatch failed: group=%s error=%s",
            event_group_id,
            e,
        )
