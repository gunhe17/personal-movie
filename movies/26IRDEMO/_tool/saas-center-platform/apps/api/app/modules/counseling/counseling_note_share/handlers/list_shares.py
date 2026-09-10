from app.infrastructure.persistence.unit_of_work import UnitOfWork

from ...facade import CounselingNoteShareFacade
from ..schemas import CounselingNoteShareResponse


async def list_shares_handler(
    *,
    session_id: str,
    center_id: str,
    counselor_id: str | None,
    uow: UnitOfWork,
) -> list[CounselingNoteShareResponse]:
    return await CounselingNoteShareFacade(uow).list_shares_by_session_with_response(
        session_id=session_id,
        center_id=center_id,
        counselor_id=counselor_id,
    )


TOOL = {
    "name": "list_shares_handler",
    "permission": "read:counseling_note",
    "purpose": "회기의 보호자·본인용 공유문을 참여자별로 조회한다.",
    "keywords": ["list note shares", "공유문 목록", "보호자 공유문 조회", "회기 공유문"],
    "boundaries": "회기 단위 공유문 조회. 생성은 generate_guardian_share_handler, 발행은 set_share_visibility_handler.",
    "output": "공유문 목록 (list[CounselingNoteShareResponse]).",
    "input_schema": {
        "type": "object",
        "properties": {
            "session_id": {
                "type": "string",
                "format": "uuid",
                "title": "대상 회기",
                "description": "공유문을 조회할 상담 회기의 UUID.",
            },
        },
        "required": ["session_id"],
    },
}
