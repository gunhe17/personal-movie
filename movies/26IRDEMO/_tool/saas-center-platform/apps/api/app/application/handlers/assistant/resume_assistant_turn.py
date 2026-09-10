# assistant 재개 SSE 셸 — claim(원자 회수) → 취소/gate/ask → 엔진 재합류.
# 세션 하나 순차 커밋: claim 커밋 → gate 도메인 커밋 → 터미널 커밋(엔진). agent-resume-flow.md가 정본.
from __future__ import annotations

import json
from typing import Any, AsyncIterator
from uuid import uuid4

from fastapi.responses import StreamingResponse

from app.behavior.action.event import Event
from app.core.logger import get_logger
from app.infrastructure.persistence.unit_of_work import UnitOfWork
from app.modules.assistant.facade import AssistantFacade, AssistantTurnStatus
from app.modules.event import emit_actor_type
from app.runtime.assistant.catalog import specs_for
from app.runtime.assistant.engine import AssistantEngine
from app.runtime.assistant.execute import AssistantContext, run_write
from app.runtime.assistant.llm import ToolReturn
from app.runtime.assistant.sse import to_sse

logger = get_logger(__name__)

CANCELLED_TEXT = "취소했어요."
NO_PENDING_TEXT = "확인할 작업이 없어요. 무엇을 도와드릴까요?"


async def resume_assistant_turn_handler(
    *,
    center_id: str,
    member_id: str,
    account_id: str | None,
    permissions: tuple[str, ...],
    owner_scope: str | None,
    conversation_id: str,
    user_input: Any,
    is_form: bool,
    cancelled: bool,
    uow: UnitOfWork,
) -> StreamingResponse:
    facade = AssistantFacade(uow)

    # verify — 스트림 전 raise = HTTP 상태
    await facade.get_assistant_conversation(conversation_id, center_id)

    # claim — 답변 append + bookmark 회수 + running 전이가 UPDATE 한 문장. 커밋으로 확정
    answer_event = {
        "type": "checkpoint_answer",
        "value": user_input,
        "is_form": is_form,
        "cancelled": cancelled,
    }
    turn = await facade.claim_assistant_turn(
        conversation_id,
        center_id,
        answer_event=answer_event,
    )
    await uow.commit()

    # 0행 = 이미 처리됨(이중 클릭) — "할 일 없음"으로 종료
    if turn is None:
        return _single_event_response(
            {"type": "conversation_done", "message": NO_PENDING_TEXT}
        )

    bookmark = turn.bookmark or {}

    # 취소 — 아무것도 실행하지 않고 완주의 한 형태(done)로 종결
    if cancelled:
        await facade.finish_assistant_turn(
            turn.id,
            center_id,
            status=AssistantTurnStatus.DONE,
            events=turn.events,
            completion=CANCELLED_TEXT,
        )
        await uow.commit()
        return _single_event_response(
            {"type": "conversation_done", "message": CANCELLED_TEXT}
        )

    ctx = AssistantContext(
        center_id=center_id,
        member_id=member_id,
        account_id=account_id,
        permissions=permissions,
        owner_scope=owner_scope,
        uow=uow,
    )

    # 답 반영 — write_confirm이면 gate 실행(데이터가 바뀌는 유일한 지점), ask면 답이 곧 결과
    executed_event: dict[str, Any] | None = None
    if bookmark.get("kind") == "write_confirm":
        answer, executed_event = await _run_gate(ctx, bookmark, uow)
    else:
        content = (
            json.dumps(user_input, ensure_ascii=False)
            if is_form and isinstance(user_input, dict)
            else str(user_input)
        )
        answer = ToolReturn(bookmark.get("tool_use_id", ""), content)

    # 프로필 — 실패가 재개를 막으면 안 됨
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

    stream = AssistantEngine(ctx).resume(
        turn=turn,
        bookmark=bookmark,
        answer=answer,
        executed_event=executed_event,
        profile=profile,
    )
    return StreamingResponse(
        to_sse(stream, log_tag="[SSE assistant/resume]"),
        media_type="text/event-stream",
        headers={
            "Cache-Control": "no-cache",
            "X-Accel-Buffering": "no",
        },
    )


async def _run_gate(
    ctx: AssistantContext,
    bookmark: dict[str, Any],
    uow: UnitOfWork,
) -> tuple[ToolReturn, dict[str, Any]]:
    # 변경 handler 실행 + commit + dispatch — 실패는 rollback + 에러 결과로 수렴(스트림 안 죽음)
    tool = bookmark.get("tool", "")
    tool_use_id = bookmark.get("tool_use_id", "")
    # 스코프 밖(예: write) bookmark는 실행 불가로 수렴 — 스코프가 유일 진실원
    spec = next((s for s in specs_for(ctx.permissions) if s.name == tool), None)
    if spec is None or spec.kind != "write" or not spec.handler:
        answer = ToolReturn(tool_use_id, f"실행할 수 없는 도구: {tool}", is_error=True)
    else:
        event_group_id = str(uuid4())
        try:
            # R2 — 핸들러 안의 emit에 "AI 경유" 표식(actor_type=agent, actor_id는 member 유지)
            with emit_actor_type("agent"):
                answer = await run_write(
                    ctx,
                    spec,
                    bookmark.get("args", {}),
                    tool_use_id=tool_use_id,
                    event_group_id=event_group_id,
                    actor_id=ctx.member_id,
                )
            await uow.commit()
        except Exception as e:
            try:
                await uow.rollback()
            except Exception:
                pass
            logger.error("[assistant/gate] %s 실패: %s", tool, e, exc_info=True)
            answer = ToolReturn(tool_use_id, f"실행 실패: {e}", is_error=True)
        else:
            # commit 후 즉시 dispatch — 알림이 sweeper 주기를 기다리지 않는다
            try:
                await Event.dispatch_event(event_group_id)
            except Exception:
                logger.warning("[assistant/gate] dispatch deferred: %s", event_group_id)

    executed_event = {
        "type": "step_tool_result",
        "tool": tool,
        "args": bookmark.get("args", {}),
        "display": "card",
        "output": answer.content,
        "is_error": answer.is_error,
    }
    return answer, executed_event


def _single_event_response(event: dict[str, Any]) -> StreamingResponse:
    async def one() -> AsyncIterator[dict[str, Any]]:
        yield event

    return StreamingResponse(
        to_sse(one(), log_tag="[SSE assistant/resume]"),
        media_type="text/event-stream",
        headers={"Cache-Control": "no-cache", "X-Accel-Buffering": "no"},
    )
