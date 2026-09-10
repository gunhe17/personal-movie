from app.core.type import uuid_str
from app.infrastructure.persistence.unit_of_work import UnitOfWork

from ...facade import AssistantFacade
from ..schemas import AssistantConversationResponse


async def create_assistant_conversation_handler(
    *,
    center_id: uuid_str,
    member_id: uuid_str,
    uow: UnitOfWork,
) -> AssistantConversationResponse:
    # return (직렬화는 facade *_with_response 소유 — facade.md §2 경로 ①)
    return await AssistantFacade(uow).create_assistant_conversation_with_response(
        center_id=center_id,
        member_id=member_id,
    )
