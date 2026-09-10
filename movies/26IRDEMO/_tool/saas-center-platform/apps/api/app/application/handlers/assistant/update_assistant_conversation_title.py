# assistant_turn_started reaction — 첫 메시지로 auto-title (핫패스 밖, 멱등)
from __future__ import annotations

from app.infrastructure.persistence.unit_of_work import UnitOfWork
from app.modules.assistant.facade import AssistantFacade


async def update_assistant_conversation_title_handler(
    *,
    uow: UnitOfWork,
    center_id: str,
    event_group_id: str,
    conversation_id: str,
    user_message: str,
) -> None:
    facade = AssistantFacade(uow)
    conversation = await facade.get_assistant_conversation(conversation_id, center_id)
    title = user_message.strip()[:30]
    if conversation.title or not title:
        return
    await facade.update_assistant_conversation(
        conversation_id,
        center_id,
        title=title,
    )
