from dataclasses import asdict

from app.core.type import uuid_str
from app.infrastructure.persistence.unit_of_work import UnitOfWork
from app.modules.counseling.facade import (
    CounselingNoteAiDraftFacade,
    CounselingSessionFacade,
)
from app.modules.event import emit
from app.modules.field_note.facade import FieldNoteFacade, PipelineFacade
from app.modules.field_note.field_note.events import FieldNoteAtomic
from app.modules.field_note.pipeline.events import FieldNotePipelineDispatchAtomic
from app.modules.field_note.pipeline.schemas import PipelineStepResponse


async def generate_counseling_note_handler(
    field_note_id: str,
    center_id: str,
    author_id: str,
    uow: UnitOfWork,
    *,
    event_group_id: uuid_str,
    note_template_type: str | None = None,
) -> PipelineStepResponse:
    facade = PipelineFacade(uow)

    note_atomic, result = await facade.prepare_step(
        field_note_id,
        center_id,
        step="counseling_note",
        note_template_type=note_template_type,
    )

    if result.status != "started":
        return PipelineStepResponse(**asdict(result))

    note_data = await facade.collect_note_data(field_note_id, center_id)
    schedule_id = note_data["schedule_id"]

    session_facade = CounselingSessionFacade(uow)
    sessions = await session_facade.get_sessions_by_schedule_ids([schedule_id])
    if not sessions:
        clear_atomic = await _reset_note_status(uow, field_note_id, center_id)
        await emit(
            uow,
            "counseling_note_generation_rejected",
            event_group_id=event_group_id,
            atomics=[note_atomic, clear_atomic],
            center_id=center_id,
            actor_id=author_id,
        )
        return PipelineStepResponse(
            status="precondition_not_met",
            step="counseling_note",
            field_note_id=field_note_id,
            message="이 일정에 연결된 상담 회기가 없습니다. 상담 케이스에서 회기를 먼저 생성해주세요.",
        )

    c_session = sessions[0]
    client_ids = [p["participant_id"] for p in c_session.client_participants]
    if not client_ids:
        clear_atomic = await _reset_note_status(uow, field_note_id, center_id)
        await emit(
            uow,
            "counseling_note_generation_rejected",
            event_group_id=event_group_id,
            atomics=[note_atomic, clear_atomic],
            center_id=center_id,
            actor_id=author_id,
        )
        return PipelineStepResponse(
            status="precondition_not_met",
            step="counseling_note",
            field_note_id=field_note_id,
            message="이 회기에 등록된 내담자가 없습니다.",
        )

    session_id = c_session.session_id
    case_id = c_session.case_id

    atomic, _ = FieldNotePipelineDispatchAtomic.requested(
        field_note_id=field_note_id,
        job_type="counseling_note",
        params={
            "session_id": session_id,
            # client_ids가 빠지면 GenerateCounselingNoteService의 upsert 루프가 빈 채로 돌아
            # 단계는 completed로 찍히는데 일지는 한 건도 안 써진다(화면은 영원히 "전사 분석 중…").
            "client_ids": client_ids,
            "author_id": author_id,
            "transcript_text": note_data["transcript_text"],
            "entries_text": note_data["entries_text"],
            "summary_text": note_data["summary_text"],
            "total_duration": note_data["total_duration"],
            "note_template_type": note_data.get("note_template_type"),
        },
    )
    await emit(
        uow,
        "field_note_pipeline_requested",
        event_group_id=event_group_id,
        atomics=[note_atomic, atomic],
        center_id=center_id,
        actor_id=author_id,
    )

    return PipelineStepResponse(**asdict(result), counseling_case_id=case_id)


async def _reset_note_status(
    uow: UnitOfWork,
    field_note_id: str,
    center_id: str,
) -> FieldNoteAtomic:
    atomic, _ = await FieldNoteFacade(uow).clear_note_status(
        field_note_id=field_note_id,
        center_id=center_id,
    )
    return atomic


async def save_generated_counseling_note(
    uow: UnitOfWork,
    session_id: str,
    field_note_id: str,
    center_id: str,
    author_id: str,
    content: dict,
    summary: str | None,
    template_type: str,
    llm_call_id: str | None,
) -> None:
    # 백그라운드 워커가 경유하는 저장 진입점.
    # 생성 결과는 초안 이력으로만 적재하고 counseling_notes(상담사 작성분)는 건드리지 않는다.
    await CounselingNoteAiDraftFacade(uow).create_draft(
        center_id=center_id,
        session_id=session_id,
        field_note_id=field_note_id,
        content=content,
        summary=summary,
        template_type=template_type,
        author_id=author_id,
        llm_call_id=llm_call_id,
    )


TOOL = {
    "name": "generate_counseling_note_handler",
    "permission": "write:counseling_note",
    "purpose": "필드노트로부터 AI 상담 일지를 생성한다(파이프라인 단계).",
    "keywords": [
        "generate counseling note",
        "상담 일지 생성",
        "AI 노트 생성",
        "일지 자동작성",
        "counseling note 생성",
        "녹취 요약 일지",
    ],
    "boundaries": "필드노트 기반 AI '상담 일지' 생성. AI 추천 문구 생성은 generate_recommendation_handler.",
    "output": "일지 생성 파이프라인 단계 결과 (PipelineStepResponse).",
    "input_schema": {
        "type": "object",
        "properties": {
            "field_note_id": {
                "type": "string",
                "format": "uuid",
                "title": "대상 필드노트",
                "description": "일지를 생성할 필드노트의 UUID.",
            },
            "note_template_type": {
                "type": "string",
                "title": "일지 템플릿 유형",
                "description": "일지 서식 유형(선택).",
            },
        },
        "required": ["field_note_id"],
    },
}
