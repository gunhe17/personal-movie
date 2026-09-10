from app.core.type import uuid_str
from app.infrastructure.persistence.unit_of_work import UnitOfWork
from app.modules.event import emit
from ..schemas import FieldNoteSpeakerMapUpdate, FieldNoteResponse
from ..repository import FieldNoteRepository
from ..services import UpdateSpeakerMapService


async def update_speaker_map_handler(
    *,
    event_group_id: uuid_str,
    field_note_id: str,
    center_id: str,
    data: FieldNoteSpeakerMapUpdate,
    uow: UnitOfWork,
    actor_id: str,
) -> FieldNoteResponse:
    field_note_atomic, field_note = await UpdateSpeakerMapService(
        uow.repo(FieldNoteRepository)
    ).execute(
        field_note_id,
        center_id,
        speaker_map=data.speaker_map,
        changed=data.model_dump(mode="json", exclude_unset=True),
    )
    await emit(
        uow,
        "field_note_updated",
        event_group_id=event_group_id,
        atomics=[field_note_atomic],
        center_id=center_id,
        actor_id=actor_id,
    )
    return FieldNoteResponse.model_validate(field_note)


TOOL = {
    "name": "update_speaker_map_handler",
    "permission": "write:counseling_note",
    "purpose": "필드노트의 화자(speaker) 매핑을 수정한다.",
    "keywords": [
        "update speaker map",
        "화자 매핑",
        "스피커 지정",
        "speaker map",
        "화자 구분 수정",
    ],
    "boundaries": "전사의 화자-실제인물 매핑을 수정한다.",
    "output": "화자 매핑이 갱신된 필드노트 (FieldNoteResponse).",
    "input_schema": {
        "type": "object",
        "properties": {
            "field_note_id": {
                "type": "string",
                "format": "uuid",
                "title": "대상 필드노트",
                "description": "화자 매핑을 수정할 필드노트의 UUID.",
            },
            "speaker_map": {
                "additionalProperties": {"type": "string"},
                "description": "화자 이름 매핑 {speaker_id: 표시이름}.",
                "title": "화자 매핑",
                "type": "object",
            },
        },
        "required": ["field_note_id", "speaker_map"],
    },
}
