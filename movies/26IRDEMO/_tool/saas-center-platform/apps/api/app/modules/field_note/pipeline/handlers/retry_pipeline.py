from app.core.type import uuid_str
from app.infrastructure.persistence.unit_of_work import UnitOfWork
from app.modules.event import emit
from ..events import FieldNotePipelineDispatchAtomic
from ...field_note.schemas import FieldNoteDetailResponse
from ...facade import PipelineFacade


async def retry_pipeline_handler(
    field_note_id: str,
    center_id: str,
    uow: UnitOfWork,
    *,
    event_group_id: uuid_str,
    member_id: str | None = None,
) -> FieldNoteDetailResponse:
    facade = PipelineFacade(uow)
    note_atomic, response, start_from = await facade.retry_pipeline_with_response(
        field_note_id=field_note_id,
        center_id=center_id,
    )
    atomic, _ = FieldNotePipelineDispatchAtomic.requested(
        field_note_id=field_note_id,
        job_type="pipeline",
        params={"start_from": start_from, "member_id": member_id},
    )
    await emit(
        uow,
        "field_note_pipeline_requested",
        event_group_id=event_group_id,
        atomics=[note_atomic, atomic],
        center_id=center_id,
        actor_id=member_id,
    )

    return response


TOOL = {
    "name": "retry_pipeline_handler",
    "permission": "write:counseling_note",
    "purpose": "실패한 필드노트 처리 파이프라인을 재시도한다.",
    "keywords": ["retry pipeline", "파이프라인 재시도", "재처리", "retry", "다시 처리"],
    "boundaries": "실패 단계부터 파이프라인 '재시도'. 처음부터는 run_pipeline_handler.",
    "output": "재시도 후 필드노트 상세 (FieldNoteDetailResponse).",
    "input_schema": {
        "type": "object",
        "properties": {
            "field_note_id": {
                "type": "string",
                "format": "uuid",
                "title": "대상 필드노트",
                "description": "파이프라인을 재시도할 필드노트의 UUID.",
            },
        },
        "required": ["field_note_id"],
    },
}
