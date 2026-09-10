# 파이프라인 스텝 러너 — 자체 세션(Track B leaf keeper), 상태 전이 소유.
# 메인 트랜잭션 실패 시에도 상태 기록이 보장되어야 하므로 상태 마킹은 별도 세션.
# DB 접근은 전부 PipelineFacade 경유(R1) — runtime은 도메인 model/repo를 모른다.
from dataclasses import dataclass
from enum import Enum
from uuid import uuid4

from app.behavior.action.event import Event
from app.core.logger import get_logger
from app.infrastructure.persistence.unit_of_work import UnitOfWork
from app.modules.event import emit
from app.modules.field_note.facade import (
    FieldNoteAudioTranscriptStatus,
    FieldNotePipelineStep,
    FieldNoteProcessingStatus,
    PipelineFacade,
)

logger = get_logger(__name__)


# 스텝 정체성 — status 필드명·성공/실패 enum 값·failed_step 어휘를 한 곳에 결합
# (과거의 status_field.replace("_status","") 파생 계산을 대체)
@dataclass(frozen=True)
class StepBinding:
    status_field: str
    completed: Enum
    failed: Enum
    step: FieldNotePipelineStep


class PipelineRunner:
    def __init__(
        self,
        session_factory,
    ):
        self._sf = session_factory

    async def run_step(
        self,
        field_note_id: str,
        center_id: str,
        binding: StepBinding,
        execute_fn,
        *,
        standalone: bool = True,
        event_name: str | None = None,
        actor_id: str | None = None,
    ):
        try:
            event_group_id = None
            async with self._sf() as session:
                uow = UnitOfWork(session)
                async with uow:
                    if event_name is None:
                        result = await execute_fn(uow)
                    else:
                        result, atomics = await execute_fn(uow)
                        event_group_id = str(uuid4())
                        await emit(
                            uow,
                            event_name,
                            event_group_id=event_group_id,
                            atomics=atomics,
                            center_id=center_id,
                            actor_id=actor_id,
                        )
                    await uow.commit()

            if event_group_id:
                await self._dispatch_event(event_group_id)
            await self._set_statuses(
                field_note_id,
                center_id,
                actor_id=actor_id,
                **{binding.status_field: binding.completed},
            )
            if standalone:
                await self.update_pipeline_status(
                    field_note_id,
                    center_id,
                    FieldNoteProcessingStatus.IDLE,
                    actor_id=actor_id,
                )
            logger.info(
                f"Step {binding.status_field} completed for field_note={field_note_id}"
            )
            return result

        except Exception as e:
            await self._set_statuses(
                field_note_id,
                center_id,
                actor_id=actor_id,
                **{binding.status_field: binding.failed},
            )
            if standalone:
                await self.update_pipeline_status(
                    field_note_id,
                    center_id,
                    FieldNoteProcessingStatus.FAILED,
                    failed_step=binding.step,
                    actor_id=actor_id,
                )
            logger.error(
                f"Step {binding.status_field} failed for field_note={field_note_id}: {e}",
                exc_info=True,
            )
            return None

    async def update_pipeline_status(
        self,
        field_note_id: str,
        center_id: str,
        status: FieldNoteProcessingStatus,
        step: FieldNotePipelineStep | None = None,
        failed_step: FieldNotePipelineStep | None = None,
        actor_id: str | None = None,
    ) -> None:
        await self._set_statuses(
            field_note_id,
            center_id,
            actor_id=actor_id,
            processing_status=status,
            processing_step=step,
            failed_step=failed_step,
        )

    async def set_audio_status(
        self,
        audio_id: str,
        transcript_status: FieldNoteAudioTranscriptStatus,
        *,
        center_id: str | None = None,
        actor_id: str | None = None,
    ) -> None:
        try:
            event_group_id = str(uuid4())
            async with self._sf() as session:
                uow = UnitOfWork(session)
                async with uow:
                    atomic, _ = await PipelineFacade(uow).set_audio_status(
                        audio_id,
                        transcript_status=transcript_status,
                    )
                    await emit(
                        uow,
                        "field_note_audio_status_updated",
                        event_group_id=event_group_id,
                        atomics=[atomic],
                        center_id=center_id,
                        actor_id=actor_id,
                    )
                    await uow.commit()
            await self._dispatch_event(event_group_id)
        except Exception as e:
            logger.warning(f"Audio status marking skipped: {audio_id}: {e}")

    async def set_audio_transcript(
        self,
        audio_id: str,
        text: str,
        model: str,
        *,
        center_id: str | None = None,
        actor_id: str | None = None,
    ) -> None:
        try:
            event_group_id = str(uuid4())
            async with self._sf() as session:
                uow = UnitOfWork(session)
                async with uow:
                    atomic, _ = await PipelineFacade(uow).set_audio_transcript(
                        audio_id,
                        text=text,
                        model=model,
                    )
                    await emit(
                        uow,
                        "field_note_audio_transcribed",
                        event_group_id=event_group_id,
                        atomics=[atomic],
                        center_id=center_id,
                        actor_id=actor_id,
                    )
                    await uow.commit()
            await self._dispatch_event(event_group_id)
        except Exception as e:
            logger.warning(f"Audio transcript save skipped: {audio_id}: {type(e).__name__}: {e}", exc_info=True)

    async def _set_statuses(
        self,
        field_note_id: str,
        center_id: str,
        actor_id: str | None = None,
        **fields,
    ) -> None:
        # 상태 마킹 실패가 executor를 죽이지 않는다 — 기존 raw update(부재=무시) 의미 보존
        try:
            event_group_id = str(uuid4())
            async with self._sf() as session:
                uow = UnitOfWork(session)
                async with uow:
                    atomic, _ = await PipelineFacade(uow).set_statuses(
                        field_note_id,
                        center_id,
                        **fields,
                    )
                    await emit(
                        uow,
                        "field_note_pipeline_status_updated",
                        event_group_id=event_group_id,
                        atomics=[atomic],
                        center_id=center_id,
                        actor_id=actor_id,
                    )
                    await uow.commit()
            await self._dispatch_event(event_group_id)
        except Exception as e:
            logger.warning(f"Status marking skipped: {field_note_id} {fields}: {e}")

    @staticmethod
    async def _dispatch_event(event_group_id: str) -> None:
        try:
            await Event.dispatch_event(event_group_id)
        except Exception as e:
            logger.warning(
                "field_note event dispatch failed: group=%s error=%s",
                event_group_id,
                e,
            )
