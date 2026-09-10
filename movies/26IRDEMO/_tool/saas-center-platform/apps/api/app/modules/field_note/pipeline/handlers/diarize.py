# 온디맨드 유료 스텝 — 오디오 길이 기반 크레딧 소비, 사용자가 상세 화면에서 명시 요청할 때만 실행.
from dataclasses import asdict

from app.core.type import uuid_str
from app.infrastructure.persistence.unit_of_work import UnitOfWork
from app.core.exceptions import QuotaExceededException
from app.modules.event import emit
from ..events import FieldNotePipelineDispatchAtomic
from ..schemas import PipelineStepResponse
from ...facade import PipelineFacade
from ...field_note.models import FieldNoteDiarizationStatus
from app.modules.llm.facade.ai_facade import create_ai_facade
from app.modules.llm.credit_balance.plan_config import AIPurpose


async def diarize_handler(
    field_note_id: str,
    center_id: str,
    uow: UnitOfWork,
    *,
    event_group_id: uuid_str,
    member_id: str | None = None,
) -> PipelineStepResponse:
    async with uow:
        facade = PipelineFacade(uow)
        note_atomic, result = await facade.prepare_step(
            field_note_id,
            center_id,
            step="diarize",
        )
        # tx 예외: started 상태를 사전체크 전 커밋 — 쿼터 실패 시 리셋 보상·워커 관측의 기준점
        await uow.commit()

    if result.status != "started":
        return PipelineStepResponse(**asdict(result))

    # 사전 크레딧 체크 — 잔량 부족 시 백그라운드 진입 전 즉시 피드백 + 상태 롤백
    try:
        await create_ai_facade().verify_quota(
            center_id, AIPurpose.FIELD_NOTE_STT_DIARIZE
        )
    except QuotaExceededException as e:
        async with uow:
            reset_atomic, _ = await PipelineFacade(uow).set_statuses(
                field_note_id,
                center_id,
                diarization_status=FieldNoteDiarizationStatus.NONE,
            )
            await emit(
                uow,
                "field_note_diarization_rejected",
                event_group_id=event_group_id,
                atomics=[note_atomic, reset_atomic],
                center_id=center_id,
                actor_id=member_id,
            )
            # tx 예외: 쿼터 실패 상태 리셋을 early-return 넘어 보존(거부하되 남김)
            await uow.commit()
        return PipelineStepResponse(
            status="insufficient_credit",
            step="diarize",
            field_note_id=field_note_id,
            message=str(e),
        )

    async with uow:
        atomic, _ = FieldNotePipelineDispatchAtomic.requested(
            field_note_id=field_note_id,
            job_type="diarize",
            params={"member_id": member_id},
        )
        await emit(
            uow,
            "field_note_pipeline_requested",
            event_group_id=event_group_id,
            atomics=[note_atomic, atomic],
            center_id=center_id,
            actor_id=member_id,
        )
        # tx 예외: 워커 dispatch 전 커밋 — 워커가 요청 tx 밖에서 행 관측
        await uow.commit()

    return PipelineStepResponse(**asdict(result))
