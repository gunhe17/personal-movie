"""Institution Facade — 기관 관리 + 감사 통합"""
from app.core.dependencies import ClientInfo
from app.modules.auth.dependencies import InstitutionContext
from app.core.exceptions import EntityNotFoundException
from app.core.unit_of_work import UnitOfWork
from app.modules.audit.repository import AuditLogRepository
from app.modules.audit.services import AuditLogger
from app.modules.institution.repository import InstitutionRepository
from app.modules.institution.schemas import (
    InstitutionResponse,
    InstitutionUpdate,
)
from app.modules.institution.services import (
    GetInstitutionService,
    UpdateInstitutionService,
)


class InstitutionFacade:
    def __init__(self, uow: UnitOfWork):
        self._uow = uow

    def _audit_logger(self) -> AuditLogger:
        return AuditLogger(self._uow.repo(AuditLogRepository))

    async def get_institution(self, institution_id: str) -> InstitutionResponse:
        repo = self._uow.repo(InstitutionRepository)
        institution = await GetInstitutionService(repo).execute(institution_id)
        if not institution:
            raise EntityNotFoundException(f"기관을 찾을 수 없습니다: {institution_id}")
        return InstitutionResponse.model_validate(institution)

    async def update_institution(
        self,
        ctx: InstitutionContext,
        data: InstitutionUpdate,
        client_info: ClientInfo,
    ) -> InstitutionResponse:
        repo = self._uow.repo(InstitutionRepository)
        old_entity = await GetInstitutionService(repo).execute(ctx.institution_id)
        old_snapshot = (
            InstitutionResponse.model_validate(old_entity).model_dump(mode="json")
            if old_entity else None
        )

        institution = await UpdateInstitutionService(repo).execute(
            ctx.institution_id, data
        )
        result = InstitutionResponse.model_validate(institution)

        await self._audit_logger().log(
            action="update",
            entity_type="institution",
            entity_id=ctx.institution_id,
            actor_id=ctx.account_id,
            actor_email=ctx.email,
            actor_role=ctx.role,
            institution_id=ctx.institution_id,
            ip_address=client_info.ip_address,
            user_agent=client_info.user_agent,
            old_value=old_snapshot,
            new_value=result.model_dump(mode="json"),
        )
        return result
