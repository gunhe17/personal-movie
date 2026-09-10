# assistant_turn_started reaction — 프로필 stale 분석 (payload에 member_id가 없어 대화에서 해소)
from __future__ import annotations

from app.application.handlers.person_profile.analyze_profile_if_stale import (
    analyze_profile_if_stale_handler,
)
from app.infrastructure.persistence.unit_of_work import UnitOfWork
from app.modules.assistant.facade import AssistantFacade


async def analyze_assistant_member_profile_handler(
    *,
    uow: UnitOfWork,
    center_id: str,
    event_group_id: str,
    conversation_id: str,
) -> None:
    conversation = await AssistantFacade(uow).get_assistant_conversation(
        conversation_id, center_id
    )
    await analyze_profile_if_stale_handler(
        uow=uow,
        center_id=center_id,
        event_group_id=event_group_id,
        member_id=conversation.member_id,
    )
