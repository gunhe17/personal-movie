from fastapi import APIRouter, Depends

from app.behavior import (
    behavior,
    AdminContext,
    UnscopedContext,
    authenticate,
    authenticate_admin,
    require_role,
    require_self,
    start_event_group,
    dispatch_events,
)
from app.modules.platform_admin.admin_account.models import AdminRole
from app.core.schemas import MessageResponse
from .schemas import (
    PersonCreate,
    PersonUpdate,
    PersonResponse,
    PersonListResponse,
)
from .handlers import (
    create_person_handler,
    get_person_handler,
    list_persons_handler,
    update_person_handler,
    delete_person_handler,
)

router = APIRouter(prefix="/persons", tags=["person"])


# 전역 Person 관리(생성·전체목록·삭제)는 admin 전용. 본인 프로필 조회/수정은 account.
@router.post("", status_code=201, response_model=PersonResponse)
async def create_person(
    data: PersonCreate,
    ctx: AdminContext = Depends(
        behavior.request_admin(
            authenticate_admin(),
            require_role(*AdminRole.ADMIN_PLUS),
            start_event_group(),
            dispatch_events(),
        )
    ),
):
    return await create_person_handler(
        data,
        ctx.uow,
        event_group_id=ctx.event_group_id,
        actor_id=ctx.admin_account_id,
        ip=ctx.ip,
    )


@router.get("", response_model=PersonListResponse)
async def list_persons(
    page: int = 1,
    size: int = 100,
    ctx: AdminContext = Depends(
        behavior.request_admin(
            authenticate_admin(),
            require_role(*AdminRole.ADMIN_PLUS),
        )
    ),
):
    return await list_persons_handler(page, size, ctx.uow)


@router.get("/{person_id}", response_model=PersonResponse)
async def get_person(
    person_id: str,
    ctx: UnscopedContext = Depends(
        behavior.request_unscoped(
            authenticate(),
            require_self(),
        )
    ),
):
    return await get_person_handler(person_id, ctx.uow)


@router.patch("/{person_id}", response_model=PersonResponse)
async def update_person(
    person_id: str,
    data: PersonUpdate,
    ctx: UnscopedContext = Depends(
        behavior.request_unscoped(
            authenticate(),
            require_self(),
            start_event_group(),
            dispatch_events(),
        )
    ),
):
    return await update_person_handler(
        person_id,
        data,
        ctx.uow,
        event_group_id=ctx.event_group_id,
        actor_id=ctx.person_id,
    )


@router.delete("/{person_id}", response_model=MessageResponse)
async def delete_person(
    person_id: str,
    ctx: AdminContext = Depends(
        behavior.request_admin(
            authenticate_admin(),
            require_role(*AdminRole.ADMIN_PLUS),
            start_event_group(),
            dispatch_events(),
        )
    ),
):
    return await delete_person_handler(
        person_id,
        ctx.uow,
        event_group_id=ctx.event_group_id,
        actor_id=ctx.admin_account_id,
        ip=ctx.ip,
    )


