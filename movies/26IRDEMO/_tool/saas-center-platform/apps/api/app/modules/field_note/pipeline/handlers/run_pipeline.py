from dataclasses import asdict

from app.core.type import uuid_str
from app.infrastructure.persistence.unit_of_work import UnitOfWork
from app.modules.event import emit
from ..events import FieldNotePipelineDispatchAtomic
from ..schemas import PipelineStepResponse
from ...facade import PipelineFacade


async def run_pipeline_handler(
    field_note_id: str,
    center_id: str,
    uow: UnitOfWork,
    *,
    event_group_id: uuid_str,
    member_id: str | None = None,
) -> PipelineStepResponse:
    facade = PipelineFacade(uow)
    note_atomic, result, start_from = await facade.prepare_run_pipeline(
        field_note_id, center_id
    )
    atomic = (
        FieldNotePipelineDispatchAtomic.requested(
            field_note_id=field_note_id,
            job_type="pipeline",
            params={"start_from": start_from, "member_id": member_id},
        )[0]
        if result.status == "started"
        else None
    )
    await emit(
        uow,
        "field_note_pipeline_requested",
        event_group_id=event_group_id,
        atomics=[note_atomic, atomic],
        center_id=center_id,
        actor_id=member_id,
    )

    return PipelineStepResponse(**asdict(result))


TOOL = {
    "name": "run_pipeline_handler",
    "permission": "write:counseling_note",
    "purpose": "필드노트 처리 파이프라인(전사·화자분리·정제·요약)을 실행한다.",
    "keywords": ["파이프라인 실행", "필드노트 처리", "run pipeline", "전체 처리"],
    "boundaries": "필드노트 전체 처리 파이프라인 실행. 단계별은 transcribe/diarize/refine/generate_summary_handler, 재시도는 retry_pipeline_handler.",
    "output": "파이프라인 실행 단계 결과 (PipelineStepResponse).",
    "input_schema": {
        "type": "object",
        "properties": {
            "field_note_id": {
                "type": "string",
                "format": "uuid",
                "title": "대상 필드노트",
                "description": "처리할 필드노트의 UUID.",
            },
        },
        "required": ["field_note_id"],
    },
}
