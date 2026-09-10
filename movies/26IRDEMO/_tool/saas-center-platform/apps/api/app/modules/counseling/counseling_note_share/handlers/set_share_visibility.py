from app.core.type import uuid_str
from app.infrastructure.persistence.unit_of_work import UnitOfWork
from app.modules.event import emit

from ...facade import CounselingNoteShareFacade
from ..schemas import CounselingNoteShareResponse


async def set_share_visibility_handler(
    *,
    event_group_id: uuid_str,
    share_id: str,
    center_id: str,
    counselor_id: str | None,
    published: bool,
    uow: UnitOfWork,
    actor_id: str,
) -> CounselingNoteShareResponse:
    atomic, share = await CounselingNoteShareFacade(uow).set_share_visibility(
        share_id=share_id,
        center_id=center_id,
        counselor_id=counselor_id,
        published=published,
    )
    await emit(
        uow,
        "counseling_note_share_published" if published else "counseling_note_share_unpublished",
        event_group_id=event_group_id,
        atomics=[atomic],
        center_id=center_id,
        actor_id=actor_id,
    )
    return CounselingNoteShareResponse.model_validate(share)


TOOL = {
    "name": "set_share_visibility_handler",
    "permission": "write:counseling_note",
    "purpose": "공유문을 내담자 앱에 내보내거나 회수한다.",
    "keywords": [
        "publish note share",
        "공유문 발행",
        "보호자에게 공개",
        "공유 회수",
        "공유문 비공개",
    ],
    "boundaries": "앱 노출 스위치만. 문구 수정은 update_share_handler, 생성은 generate_guardian_share_handler.",
    "output": "전환된 공유문 (CounselingNoteShareResponse).",
    "input_schema": {
        "type": "object",
        "properties": {
            "share_id": {
                "type": "string",
                "format": "uuid",
                "title": "대상 공유문",
                "description": "발행·회수할 공유문의 UUID.",
            },
            "published": {
                "type": "boolean",
                "title": "발행 여부",
                "description": "true = 앱에 노출, false = 회수.",
            },
        },
        "required": ["share_id", "published"],
    },
}
