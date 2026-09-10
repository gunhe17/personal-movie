"""Client Facade — Service 조합 + 감사 통합"""
from app.core.dependencies import ClientInfo
from app.modules.auth.dependencies import InstitutionContext
from app.core.unit_of_work import UnitOfWork
from app.modules.audit.repository import AuditLogRepository
from app.modules.audit.services import AuditLogger
from app.modules.client.repository import ClientRepository
from app.modules.client.schemas import (
    ClientCreate,
    ClientListResponse,
    ClientResponse,
    ClientUpdate,
)
from app.modules.client.services import (
    CreateClientService,
    DeleteClientService,
    GetClientService,
    ListClientsService,
    UpdateClientService,
)


class ClientFacade:
    """내담자 도메인 비즈니스 로직 조합 + 감사 추적"""

    def __init__(self, uow: UnitOfWork):
        self._uow = uow

    def _audit_logger(self) -> AuditLogger:
        return AuditLogger(self._uow.repo(AuditLogRepository))

    async def list_clients(
        self,
        institution_id: str,
        *,
        page: int = 1,
        size: int = 20,
        search: str | None = None,
        status: str | None = None,
        gender: str | None = None,
    ) -> ClientListResponse:
        repo = self._uow.repo(ClientRepository)
        return await ListClientsService(repo).execute(
            institution_id, page=page, size=size,
            search=search, status=status, gender=gender,
        )

    async def get_client(
        self, client_id: str, institution_id: str
    ) -> ClientResponse:
        repo = self._uow.repo(ClientRepository)
        return await GetClientService(repo).execute(client_id, institution_id)

    async def create_client(
        self,
        ctx: InstitutionContext,
        data: ClientCreate,
        client_info: ClientInfo,
    ) -> ClientResponse:
        repo = self._uow.repo(ClientRepository)
        result = await CreateClientService(repo).execute(ctx.institution_id, data)
        await self._audit_logger().log(
            action="create",
            entity_type="client",
            entity_id=result.id,
            actor_id=ctx.account_id,
            actor_email=ctx.email,
            actor_role=ctx.role,
            institution_id=ctx.institution_id,
            ip_address=client_info.ip_address,
            user_agent=client_info.user_agent,
            new_value=result.model_dump(mode="json"),
        )
        return result

    async def update_client(
        self,
        ctx: InstitutionContext,
        client_id: str,
        data: ClientUpdate,
        client_info: ClientInfo,
    ) -> ClientResponse:
        repo = self._uow.repo(ClientRepository)
        # GetClientService가 institution 권한도 검증
        old_response = await GetClientService(repo).execute(
            client_id, ctx.institution_id
        )
        old_status = old_response.status
        old_snapshot = old_response.model_dump(mode="json")

        result = await UpdateClientService(repo).execute(
            client_id, ctx.institution_id, data
        )

        is_status_change = data.status is not None and data.status != old_status
        if is_status_change:
            action = "deactivate" if data.status == "inactive" else "activate"
        else:
            action = "update"

        await self._audit_logger().log(
            action=action,
            entity_type="client",
            entity_id=client_id,
            actor_id=ctx.account_id,
            actor_email=ctx.email,
            actor_role=ctx.role,
            institution_id=ctx.institution_id,
            ip_address=client_info.ip_address,
            user_agent=client_info.user_agent,
            old_value=old_snapshot,
            new_value=result.model_dump(mode="json"),
            metadata={"from": old_status, "to": data.status} if is_status_change else None,
        )
        return result

    async def delete_client(
        self,
        ctx: InstitutionContext,
        client_id: str,
        client_info: ClientInfo,
    ) -> None:
        repo = self._uow.repo(ClientRepository)
        # GetClientService가 not found / 권한도 검증
        old_response = await GetClientService(repo).execute(
            client_id, ctx.institution_id
        )
        old_snapshot = old_response.model_dump(mode="json")

        await DeleteClientService(repo).execute(client_id, ctx.institution_id)

        await self._audit_logger().log(
            action="delete",
            entity_type="client",
            entity_id=client_id,
            actor_id=ctx.account_id,
            actor_email=ctx.email,
            actor_role=ctx.role,
            institution_id=ctx.institution_id,
            ip_address=client_info.ip_address,
            user_agent=client_info.user_agent,
            old_value=old_snapshot,
        )
