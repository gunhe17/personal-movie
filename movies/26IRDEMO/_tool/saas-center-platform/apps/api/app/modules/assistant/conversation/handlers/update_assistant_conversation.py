from app.core.type import uuid_str
from app.infrastructure.persistence.unit_of_work import UnitOfWork

from ...facade import AssistantFacade
from ..schemas import AssistantConversationResponse, AssistantConversationUpdate


async def update_assistant_conversation_handler(
    *,
    conversation_id: uuid_str,
    center_id: uuid_str,
    data: AssistantConversationUpdate,
    uow: UnitOfWork,
) -> AssistantConversationResponse:
    # return (직렬화는 facade *_with_response — facade.md §2 경로 ①)
    return await AssistantFacade(uow).update_assistant_conversation_with_response(
        conversation_id=conversation_id,
        center_id=center_id,
        title=data.title,
    )
