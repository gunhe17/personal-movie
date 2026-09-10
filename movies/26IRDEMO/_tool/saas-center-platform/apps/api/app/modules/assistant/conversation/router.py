from fastapi import APIRouter, Depends, Query
from fastapi.responses import StreamingResponse

from app.application.handlers.assistant import (
    resume_assistant_turn_handler,
    stream_assistant_turn_handler,
)
from app.behavior import (
    ServerContext,
    authenticate,
    behavior,
    require_feature,
    require_membership,
    require_quota,
    throttle,
)
from app.core.config import settings
from app.modules.assistant.conversation.handlers.create_assistant_conversation import (
    create_assistant_conversation_handler,
)
from app.modules.assistant.conversation.handlers.delete_assistant_conversation import (
    delete_assistant_conversation_handler,
)
from app.modules.assistant.conversation.handlers.get_assistant_conversation import (
    get_assistant_conversation_handler,
)
from app.modules.assistant.conversation.handlers.list_assistant_conversations import (
    list_assistant_conversations_handler,
)
from app.modules.assistant.conversation.handlers.update_assistant_conversation import (
    update_assistant_conversation_handler,
)
from app.modules.assistant.conversation.schemas import (
    AssistantConversationDetailResponse,
    AssistantConversationListResponse,
    AssistantConversationResponse,
    AssistantConversationUpdate,
    AssistantResumeRequest,
    AssistantStreamRequest,
)
from app.modules.llm.credit_balance.plan_config import AIPurpose

router = APIRouter(prefix="/centers/{center_id}/assistant", tags=["Assistant"])


@router.post("/conversations", response_model=AssistantConversationResponse)
async def create_assistant_conversation(
    *,
    ctx: ServerContext = Depends(
        behavior.request(
            authenticate(),
            require_membership(),
            require_feature("ai_agent"),
        )
    ),
):
    return await create_assistant_conversation_handler(
        center_id=ctx.center_id,
        member_id=ctx.actor_id,
        uow=ctx.uow,
    )


@router.get("/conversations", response_model=AssistantConversationListResponse)
async def list_assistant_conversations(
    page: int = Query(1, ge=1),
    size: int = Query(20, ge=1, le=100),
    *,
    ctx: ServerContext = Depends(
        behavior.request(
            authenticate(),
            require_membership(),
            require_feature("ai_agent"),
        )
    ),
):
    return await list_assistant_conversations_handler(
        center_id=ctx.center_id,
        member_id=ctx.actor_id,
        page=page,
        size=size,
        uow=ctx.uow,
    )


@router.get(
    "/conversations/{conversation_id}",
    response_model=AssistantConversationDetailResponse,
)
async def get_assistant_conversation(
    conversation_id: str,
    *,
    ctx: ServerContext = Depends(
        behavior.request(
            authenticate(),
            require_membership(),
            require_feature("ai_agent"),
        )
    ),
):
    return await get_assistant_conversation_handler(
        conversation_id=conversation_id,
        center_id=ctx.center_id,
        uow=ctx.uow,
    )


@router.patch(
    "/conversations/{conversation_id}",
    response_model=AssistantConversationResponse,
)
async def update_assistant_conversation(
    conversation_id: str,
    data: AssistantConversationUpdate,
    *,
    ctx: ServerContext = Depends(
        behavior.request(
            authenticate(),
            require_membership(),
            require_feature("ai_agent"),
        )
    ),
):
    return await update_assistant_conversation_handler(
        conversation_id=conversation_id,
        center_id=ctx.center_id,
        data=data,
        uow=ctx.uow,
    )


@router.delete("/conversations/{conversation_id}", status_code=204)
async def delete_assistant_conversation(
    conversation_id: str,
    *,
    ctx: ServerContext = Depends(
        behavior.request(
            authenticate(),
            require_membership(),
            require_feature("ai_agent"),
        )
    ),
):
    await delete_assistant_conversation_handler(
        conversation_id=conversation_id,
        center_id=ctx.center_id,
        uow=ctx.uow,
    )


@router.post(
    "/conversations/{conversation_id}/stream", response_class=StreamingResponse
)
async def stream_assistant_turn(
    conversation_id: str,
    data: AssistantStreamRequest,
    *,
    ctx: ServerContext = Depends(
        behavior.stream(
            authenticate(),
            require_membership(),
            require_feature("ai_agent"),
            throttle(
                scope="assistant",
                per_minute=settings.AGENT_RATE_LIMIT_PER_MINUTE,
                enabled=settings.AGENT_RATE_LIMIT_ENABLED,
            ),
            require_quota(AIPurpose.AGENT_MESSAGE),
        )
    ),
):
    return await stream_assistant_turn_handler(
        center_id=ctx.center_id,
        member_id=ctx.actor_id,
        account_id=ctx.account_id,
        permissions=ctx.permissions,
        owner_scope=ctx.owner_scope,
        conversation_id=conversation_id,
        message=data.message,
        uow=ctx.uow,
    )


@router.post(
    "/conversations/{conversation_id}/resume", response_class=StreamingResponse
)
async def resume_assistant_turn(
    conversation_id: str,
    data: AssistantResumeRequest,
    *,
    ctx: ServerContext = Depends(
        behavior.stream(
            authenticate(),
            require_membership(),
            require_feature("ai_agent"),
            throttle(
                scope="assistant",
                per_minute=settings.AGENT_RATE_LIMIT_PER_MINUTE,
                enabled=settings.AGENT_RATE_LIMIT_ENABLED,
            ),
            require_quota(AIPurpose.AGENT_MESSAGE),
        )
    ),
):
    return await resume_assistant_turn_handler(
        center_id=ctx.center_id,
        member_id=ctx.actor_id,
        account_id=ctx.account_id,
        permissions=ctx.permissions,
        owner_scope=ctx.owner_scope,
        conversation_id=conversation_id,
        user_input=data.input,
        is_form=data.is_form,
        cancelled=data.cancelled,
        uow=ctx.uow,
    )
