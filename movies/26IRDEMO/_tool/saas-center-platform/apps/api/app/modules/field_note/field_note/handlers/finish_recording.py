from app.core.type import unset, uuid_str
from app.infrastructure.persistence.unit_of_work import UnitOfWork
from app.modules.event import emit
from ...pipeline.events import FieldNotePipelineDispatchAtomic
from ..schemas import FieldNoteFinish, FieldNoteResponse
from ..repository import FieldNoteRepository
from ..services import FinishRecordingService, SkipPipelineService, StartPipelineService


async def finish_recording_handler(
    field_note_id: str,
    center_id: str,
    data: FieldNoteFinish,
    uow: UnitOfWork,
    *,
    event_group_id: uuid_str,
    member_id: str | None = None,
) -> FieldNoteResponse:
    note_repo = uow.repo(FieldNoteRepository)

    # finish
    finish_atomic, _ = await FinishRecordingService(note_repo).execute(
        field_note_id,
        center_id,
        total_duration=data.total_duration,
        note_template_type=(
            data.note_template_type
            if "note_template_type" in data.model_fields_set
            else unset
        ),
    )

    if data.skip_pipeline:
        skip_atomic, field_note = await SkipPipelineService(note_repo).execute(
            field_note_id, center_id
        )
        await emit(
            uow,
            "field_note_updated",
            event_group_id=event_group_id,
            atomics=[finish_atomic, skip_atomic],
            center_id=center_id,
            actor_id=member_id,
        )
        return FieldNoteResponse.model_validate(field_note)

    # emit (파이프라인 시작 상태 + dispatch 사실 기록)
    start_atomic, field_note = await StartPipelineService(note_repo).execute(
        field_note_id, center_id
    )

    if data.auto_pipeline:
        job_type = "pipeline"
        params = {"skip_refine": data.skip_refine, "member_id": member_id}
    else:
        job_type = "transcribe"
        params = {"member_id": member_id}
    atomic, _ = FieldNotePipelineDispatchAtomic.requested(
        field_note_id=field_note_id,
        job_type=job_type,
        params=params,
    )
    await emit(
        uow,
        "field_note_pipeline_requested",
        event_group_id=event_group_id,
        atomics=[finish_atomic, start_atomic, atomic],
        center_id=center_id,
        actor_id=member_id,
    )

    return FieldNoteResponse.model_validate(field_note)


TOOL = {
    "name": "finish_recording_handler",
    "permission": "write:counseling_note",
    "purpose": "필드노트의 녹음을 종료하고 후처리를 시작한다.",
    "keywords": [
        "finish recording",
        "녹음 종료",
        "녹음 완료",
        "recording 종료",
        "녹음 마치기",
    ],
    "boundaries": "녹음을 '종료'하고 전사/분석 파이프라인을 띄운다. 청크 업로드는 upload_audio_chunk_handler.",
    "output": "녹음 종료 후 필드노트 (FieldNoteResponse).",
    "input_schema": {
        "type": "object",
        "properties": {
            "field_note_id": {
                "type": "string",
                "format": "uuid",
                "title": "대상 필드노트",
                "description": "녹음을 종료할 필드노트의 UUID.",
            },
            "total_duration": {
                "description": "총 녹음 시간(초).",
                "minimum": 0,
                "title": "총 녹음 시간(초)",
                "type": "number",
            },
            "skip_pipeline": {
                "default": False,
                "description": "True면 후처리 파이프라인을 건너뜀(기본 False).",
                "title": "파이프라인 건너뛰기",
                "type": "boolean",
            },
            "auto_pipeline": {
                "default": False,
                "description": "True면 전체 파이프라인 자동 실행(기본 False).",
                "title": "자동 파이프라인",
                "type": "boolean",
            },
            "skip_refine": {
                "default": True,
                "description": "True(기본)면 LLM 보정 단계 건너뜀, False면 보정 포함.",
                "title": "LLM 보정 건너뛰기",
                "type": "boolean",
            },
            "note_template_type": {
                "anyOf": [
                    {
                        "enum": ["default", "soap", "dap", "birp", "family_center"],
                        "type": "string",
                    },
                    {"type": "null"},
                ],
                "default": None,
                "description": "노트 서식 타입: default/soap/dap/birp/family_center(선택).",
                "title": "노트 서식",
            },
        },
        "required": ["field_note_id", "total_duration"],
    },
}
