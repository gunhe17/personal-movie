from app.core.type import uuid_str
from app.infrastructure.persistence.unit_of_work import UnitOfWork
from app.modules.event import emit

from ...facade import CounselingNoteShareFacade
from ..schemas import CounselingNoteShareResponse, NoteShareUpdateRequest


async def update_share_handler(
    *,
    event_group_id: uuid_str,
    share_id: str,
    center_id: str,
    counselor_id: str | None,
    data: NoteShareUpdateRequest,
    uow: UnitOfWork,
    actor_id: str,
) -> CounselingNoteShareResponse:
    atomic, share = await CounselingNoteShareFacade(uow).update_share(
        share_id=share_id,
        center_id=center_id,
        counselor_id=counselor_id,
        content=data.content.model_dump(mode="json"),
    )
    await emit(
        uow,
        "counseling_note_share_updated",
        event_group_id=event_group_id,
        atomics=[atomic],
        center_id=center_id,
        actor_id=actor_id,
    )
    return CounselingNoteShareResponse.model_validate(share)


TOOL = {
    "name": "update_share_handler",
    "permission": "write:counseling_note",
    "purpose": "공유문 문구를 상담사가 직접 고친다.",
    "keywords": ["update note share", "공유문 수정", "보호자 공유문 편집"],
    "boundaries": "공유문 본문 수정. 앱 노출 전환은 set_share_visibility_handler.",
    "output": "수정된 공유문 (CounselingNoteShareResponse).",
    "input_schema": {
        "type": "object",
        "properties": {
            "share_id": {
                "type": "string",
                "format": "uuid",
                "title": "대상 공유문",
                "description": "수정할 공유문의 UUID.",
            },
            "content": {
                "type": "object",
                "title": "공유문 내용",
                "description": "summary·focus·progress·next_plan·home_tip 다섯 항목.",
            },
        },
        "required": ["share_id", "content"],
    },
}
