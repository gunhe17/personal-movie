from app.infrastructure.persistence.unit_of_work import UnitOfWork
from ..schemas import FieldNoteDetailResponse
from ..repository import FieldNoteRepository
from ..services import FindFieldNoteByScheduleService
from ...field_note_audio.repository import FieldNoteAudioRepository
from ...field_note_audio.services import ListAudiosService
from ...field_note_entry.repository import FieldNoteEntryRepository
from ...field_note_entry.services import ListEntriesService


async def get_field_note_by_schedule_handler(
    schedule_id: str,
    center_id: str,
    uow: UnitOfWork,
) -> FieldNoteDetailResponse | None:
    field_note = await FindFieldNoteByScheduleService(
        uow.repo(FieldNoteRepository)
    ).execute(schedule_id, center_id)
    if not field_note:
        return None
    audios = await ListAudiosService(uow.repo(FieldNoteAudioRepository)).execute(
        field_note.id
    )
    entries = await ListEntriesService(uow.repo(FieldNoteEntryRepository)).execute(
        field_note.id
    )
    return FieldNoteDetailResponse.build(field_note, audios, entries)


TOOL = {
    "name": "get_field_note_by_schedule_handler",
    "permission": "read:counseling_note",
    "purpose": "일정에 연결된 필드노트를 조회한다.",
    "keywords": ["일정 필드노트", "스케줄 노트 조회", "by schedule"],
    "boundaries": "한 일정에 연결된 필드노트 조회(읽기, 없으면 None). 작업 기준은 get_field_notes_by_task_handler.",
    "output": "일정에 연결된 필드노트 상세, 없으면 null (FieldNoteDetailResponse).",
    "input_schema": {
        "type": "object",
        "properties": {
            "schedule_id": {
                "type": "string",
                "format": "uuid",
                "title": "대상 일정",
                "description": "필드노트를 조회할 일정의 UUID.",
            },
        },
        "required": ["schedule_id"],
    },
}
