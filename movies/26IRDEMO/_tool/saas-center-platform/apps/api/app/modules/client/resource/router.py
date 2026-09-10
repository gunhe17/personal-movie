"""Client Resource Router - 내담자 리소스 매핑 API (폼 인스턴스 + 문서)"""

from app.behavior import (
    behavior,
    ServerContext,
    authenticate,
    require_membership,
    require_permission,
    start_event_group,
    dispatch_events,
)
from fastapi import APIRouter, Depends, Query

from app.core.permissions import Permission
from app.application.schemas import (
    ClientFormInstanceItem,
    ClientFormInstanceListResponse,
    ClientDocumentItem,
    ClientDocumentListResponse,
)
from app.modules.client.resource.schemas import (
    ClientFormInstanceCreate,
    ClientDocumentCreate,
)

# Application Handlers (크로스 모듈)
from app.application.handlers.client.link_form_instance import (
    link_form_instance_handler,
)
from app.application.handlers.client.list_forms import list_forms_handler
from app.application.handlers.client.link_client_document import (
    link_client_document_handler,
)
from app.application.handlers.client.list_client_documents import (
    list_client_documents_handler,
)

# Module Handler (단일 모듈 — form/document 공통)
from app.modules.client.resource.handlers.unlink_resource import unlink_resource_handler

router = APIRouter(prefix="/centers/{center_id}/clients", tags=["Client - Resources"])


# Form Instance 엔드포인트


@router.post(
    "/{client_id}/form-instances",
    response_model=ClientFormInstanceItem,
    status_code=201,
)
async def link_form_instance(
    client_id: str,
    data: ClientFormInstanceCreate,
    *,
    ctx: ServerContext = Depends(
        behavior.request(
            start_event_group(),
            authenticate(),
            require_membership(),
            require_permission(Permission.WRITE_FORM_INSTANCE),
            dispatch_events(),
        )
    ),
):
    return await link_form_instance_handler(
        center_id=ctx.center_id,
        client_id=client_id,
        template_id=data.template_id,
        uow=ctx.uow,
        event_group_id=ctx.event_group_id,
        actor_id=ctx.actor_id,
    )


@router.get(
    "/{client_id}/form-instances",
    response_model=ClientFormInstanceListResponse,
)
async def list_forms(
    client_id: str,
    template_id: str | None = Query(None, description="템플릿 ID 필터"),
    status: str | None = Query(None, description="상태 필터 (draft | submitted)"),
    *,
    ctx: ServerContext = Depends(
        behavior.request(
            authenticate(),
            require_membership(),
            require_permission(Permission.READ_FORM_INSTANCE),
        )
    ),
):
    return await list_forms_handler(
        center_id=ctx.center_id,
        client_id=client_id,
        uow=ctx.uow,
        template_id=template_id,
        status=status,
    )


@router.delete(
    "/{client_id}/form-instances/{mapping_id}",
    status_code=204,
)
async def unlink_form_instance(
    client_id: str,
    mapping_id: str,
    *,
    ctx: ServerContext = Depends(
        behavior.request(
            start_event_group(),
            authenticate(),
            require_membership(),
            require_permission(Permission.DELETE_FORM_INSTANCE),
            dispatch_events(),
        )
    ),
):
    await unlink_resource_handler(
        mapping_id=mapping_id,
        center_id=ctx.center_id,
        uow=ctx.uow,
        event_group_id=ctx.event_group_id,
        actor_id=ctx.actor_id,
    )


# Document 엔드포인트


@router.post(
    "/{client_id}/documents",
    response_model=ClientDocumentItem,
    status_code=201,
)
async def link_client_document(
    client_id: str,
    data: ClientDocumentCreate,
    *,
    ctx: ServerContext = Depends(
        behavior.request(
            start_event_group(),
            authenticate(),
            require_membership(),
            require_permission(Permission.WRITE_DOCUMENT),
            dispatch_events(),
        )
    ),
):
    return await link_client_document_handler(
        center_id=ctx.center_id,
        client_id=client_id,
        document_id=data.document_id,
        resource_type=data.resource_type.value,
        uow=ctx.uow,
        event_group_id=ctx.event_group_id,
        actor_id=ctx.actor_id,
    )


@router.get(
    "/{client_id}/documents",
    response_model=ClientDocumentListResponse,
)
async def list_client_documents(
    client_id: str,
    resource_type: str | None = Query(
        None, description="리소스 유형 필터 (pre_admission, consent, assessment, other)"
    ),
    *,
    ctx: ServerContext = Depends(
        behavior.request(
            authenticate(),
            require_membership(),
            require_permission(Permission.READ_DOCUMENT),
        )
    ),
):
    return await list_client_documents_handler(
        center_id=ctx.center_id,
        client_id=client_id,
        uow=ctx.uow,
        resource_type=resource_type,
    )


@router.delete(
    "/{client_id}/documents/{mapping_id}",
    status_code=204,
)
async def unlink_client_document(
    client_id: str,
    mapping_id: str,
    *,
    ctx: ServerContext = Depends(
        behavior.request(
            start_event_group(),
            authenticate(),
            require_membership(),
            require_permission(Permission.DELETE_DOCUMENT),
            dispatch_events(),
        )
    ),
):
    await unlink_resource_handler(
        mapping_id=mapping_id,
        center_id=ctx.center_id,
        uow=ctx.uow,
        event_group_id=ctx.event_group_id,
        actor_id=ctx.actor_id,
    )
