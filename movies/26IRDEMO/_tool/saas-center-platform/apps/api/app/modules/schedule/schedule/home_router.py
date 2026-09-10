from fastapi import APIRouter, Depends
from app.behavior import (
    behavior,
    ServerContext,
    authenticate,
    require_membership,
    require_permission,
)
from app.core.permissions import Permission
from app.application.handlers.home.schemas import HomeSignalsResponse

home_router = APIRouter(prefix="/centers/{center_id}", tags=["Home"])


@home_router.get(
    "/home-signals",
    response_model=HomeSignalsResponse,
)
async def get_home_signals(
    ctx: ServerContext = Depends(
        behavior.request(
            authenticate(),
            require_membership(),
            require_permission(Permission.READ_SCHEDULE),
        )
    ),
):
    from app.application.handlers.home import get_home_signals_handler

    return await get_home_signals_handler(
        center_id=ctx.center_id,
        counselor_id=ctx.actor_id,
        uow=ctx.uow,
    )


# ─── 변경 요청(내담자 앱 → 센터 승인) — /{schedule_id} 매칭에 삼켜지지 않게 별도 마운트 ───

