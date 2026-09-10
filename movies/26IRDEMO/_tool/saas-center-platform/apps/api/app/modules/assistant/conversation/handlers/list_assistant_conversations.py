from app.core.type import uuid_str
from app.infrastructure.persistence.unit_of_work import UnitOfWork

from ...facade import AssistantFacade
from ..schemas import AssistantConversationListResponse


async def list_assistant_conversations_handler(
    *,
    center_id: uuid_str,
    member_id: uuid_str,
    page: int,
    size: int,
    uow: UnitOfWork,
) -> AssistantConversationListResponse:
    # return
    return await AssistantFacade(uow).list_assistant_conversations_with_response(
        center_id=center_id,
        member_id=member_id,
        page=page,
        size=size,
    )
