# assistant 턴 SSE 셸 — 크로스모듈 조립(assistant facade + 프로필 + runtime 엔진).
# 저장 계약: write-ahead INSERT+emit+커밋은 셸, 터미널 UPDATE는 엔진(agent-flow.md).
from __future__ import annotations

from uuid import uuid4

from fastapi.responses import StreamingResponse

from app.behavior.action.event import Event
from app.core.logger import get_logger
from app.infrastructure.persistence.unit_of_work import UnitOfWork
from app.modules.assistant.facade import AssistantFacade
from app.modules.event import emit
from app.runtime.assistant.engine import AssistantEngine
from app.runtime.assistant.execute import AssistantContext
from app.runtime.assistant.sse import to_sse

logger = get_logger(__name__)


async def stream_assistant_turn_handler(
    *,
    center_id: str,
    member_id: str,
    account_id: str | None,
    permissions: tuple[str, ...],
    owner_scope: str | None,
    conversation_id: str,
    message: str,
    uow: UnitOfWork,
) -> StreamingResponse:
    facade = AssistantFacade(uow)

    # verify — 스트림 전 raise = HTTP 상태 (없으면 404, 타 센터면 404 수렴)
    conversation = await facade.get_assistant_conversation(conversation_id, center_id)

    # 첫 발화 자동 제목 — 구 스택 _maybe_autotitle 이식(컷오버 누락분). write-ahead 커밋에 동승
    if not conversation.title and message.strip():
        await facade.update_assistant_conversation(
            conversation_id, center_id, title=message.strip()[:30]
        )

    # write-ahead — 턴 INSERT + turn_started emit + 커밋. 엔진 호출 전 입력 내구화
    event_group_id = str(uuid4())
    atomic, turn = await facade.create_assistant_turn(
        conversation_id=conversation_id,
        center_id=center_id,
        user_message=message,
    )
    await emit(
        uow,
        "assistant_turn_started",
        event_group_id=event_group_id,
        atomics=[atomic],
        center_id=center_id,
        actor_id=member_id,
    )
    await uow.commit()
    try:
        await Event.dispatch_event(event_group_id)
    except Exception:
        logger.warning("assistant turn_started dispatch deferred: %s", event_group_id)

    # 프로필 — 실패가 턴을 막으면 안 됨 (None이면 날짜만으로 진행)
    try:
        from app.application.handlers.person_profile.build_profile_snapshot import (
            build_profile_snapshot_handler,
        )

        profile = await build_profile_snapshot_handler(
            center_id=center_id,
            member_id=member_id,
            uow=uow,
        )
    except Exception:
        logger.warning("[assistant] 프로필 스냅샷 실패", exc_info=True)
        profile = None

    ctx = AssistantContext(
        center_id=center_id,
        member_id=member_id,
        account_id=account_id,
        permissions=permissions,
        owner_scope=owner_scope,
        uow=uow,
    )
    return StreamingResponse(
        to_sse(
            AssistantEngine(ctx).run(turn=turn, profile=profile),
            log_tag="[SSE assistant]",
        ),
        media_type="text/event-stream",
        headers={
            "Cache-Control": "no-cache",
            "X-Accel-Buffering": "no",
        },
    )
