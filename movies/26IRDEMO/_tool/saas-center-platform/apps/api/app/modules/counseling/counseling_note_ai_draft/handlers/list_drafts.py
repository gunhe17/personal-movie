from app.infrastructure.persistence.unit_of_work import UnitOfWork

from ...facade import CounselingNoteAiDraftFacade
from ..schemas import CounselingNoteAiDraftResponse


async def list_drafts_handler(
    *,
    session_id: str,
    center_id: str,
    uow: UnitOfWork,
) -> list[CounselingNoteAiDraftResponse]:
    return await CounselingNoteAiDraftFacade(uow).list_drafts_by_session_with_response(
        session_id=session_id,
        center_id=center_id,
    )
