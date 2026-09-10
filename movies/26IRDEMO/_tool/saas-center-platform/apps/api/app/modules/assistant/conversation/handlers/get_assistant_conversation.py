from app.core.type import uuid_str
from app.infrastructure.persistence.unit_of_work import UnitOfWork

from ...facade import AssistantFacade
from ..schemas import AssistantConversationDetailResponse


async def get_assistant_conversation_handler(
    *,
    conversation_id: uuid_str,
    center_id: uuid_str,
    uow: UnitOfWork,
) -> AssistantConversationDetailResponse:
    # return (turns 포함 — 화면 복원용 전체)
    return await AssistantFacade(uow).get_assistant_conversation_with_response(
        conversation_id,
        center_id,
    )
