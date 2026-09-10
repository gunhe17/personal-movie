from app.core.type import uuid_str
from app.infrastructure.persistence.unit_of_work import UnitOfWork

from ...facade import AssistantFacade


async def delete_assistant_conversation_handler(
    *,
    conversation_id: uuid_str,
    center_id: uuid_str,
    uow: UnitOfWork,
) -> None:
    # return
    await AssistantFacade(uow).delete_assistant_conversation(
        conversation_id,
        center_id,
    )
