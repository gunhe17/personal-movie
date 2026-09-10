from fastapi import APIRouter, Depends

from app.behavior import behavior, UnscopedContext, authenticate
from .handlers import get_role_handler, list_roles_handler
from .schemas import RoleResponse, RoleSummary

router = APIRouter(prefix="/role/roles", tags=["role"])


@router.get(
    "/",
    response_model=list[RoleSummary],
)
async def list_roles(
    ctx: UnscopedContext = Depends(behavior.request_unscoped(authenticate())),
):
    return await list_roles_handler(ctx.uow)


@router.get(
    "/{role_id}",
    response_model=RoleResponse,
)
async def get_role(
    role_id: str,
    ctx: UnscopedContext = Depends(behavior.request_unscoped(authenticate())),
):
    return await get_role_handler(role_id, ctx.uow)
