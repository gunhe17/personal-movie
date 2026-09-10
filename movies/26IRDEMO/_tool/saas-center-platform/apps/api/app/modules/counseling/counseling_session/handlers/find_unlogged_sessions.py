from app.infrastructure.persistence.unit_of_work import UnitOfWork
from app.infrastructure.persistence.new_repository import single_page
from ..schemas import (
    UnloggedSessionItem,
    UnloggedSessionListResponse,
)
from ...facade.counseling_session_facade import CounselingSessionFacade


async def find_unlogged_sessions_handler(
    center_id: str,
    counselor_id: str,
    uow: UnitOfWork,
) -> UnloggedSessionListResponse:
    facade = CounselingSessionFacade(uow)
    sessions = await facade.list_unlogged_completed_sessions_by_counselor(
        center_id=center_id, counselor_id=counselor_id
    )

    items = [
        UnloggedSessionItem(
            session_id=s.id,
            counseling_case_id=s.counseling_case_id,
            schedule_id=s.schedule_id,
            completed_at=s.completed_at,
        )
        for s in sessions
    ]
    return UnloggedSessionListResponse(items=items, **single_page(items))


TOOL = {
    "name": "find_unlogged_sessions_handler",
    "permission": "read:counseling",
    "purpose": "일지가 작성되지 않은 완료 회기를 찾는다.",
    "keywords": ["미작성 일지", "일지 누락 회기", "unlogged session"],
    "boundaries": "일지 '미작성' 회기 점검(읽기). 일지 작성은 counseling_note/create_note_handler.",
    "output": "일지 미작성 완료 회기 목록 (UnloggedSessionListResponse).",
    "input_schema": {
        "type": "object",
        "properties": {},
        "required": [],
    },
}
