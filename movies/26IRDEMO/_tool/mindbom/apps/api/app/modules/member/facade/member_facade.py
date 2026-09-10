"""Member Facade — 직원 조회/수정 (생성은 invitation 모듈에서)"""
import math

from app.core.dependencies import ClientInfo
from app.core.exceptions import EntityNotFoundException
from app.core.unit_of_work import UnitOfWork
from app.modules.audit.repository import AuditLogRepository
from app.modules.audit.services import AuditLogger
from app.modules.auth.dependencies import InstitutionContext
from app.modules.member.repository import MemberRepository
from app.modules.member.schemas import (
    MemberListResponse,
    MemberResponse,
    MemberSummary,
    MemberUpdate,
)
from app.modules.member.services import GetMemberByIdService

__all__ = ["MemberFacade"]


class MemberFacade:
    """직원 도메인 — 조회·수정·감사 추적"""

    def __init__(self, uow: UnitOfWork):
        self._uow = uow

    def _audit_logger(self) -> AuditLogger:
        return AuditLogger(self._uow.repo(AuditLogRepository))

    async def list_members(
        self,
        institution_id: str,
        *,
        page: int = 1,
        size: int = 20,
        search: str | None = None,
        role: str | None = None,
    ) -> MemberListResponse:
        repo = self._uow.repo(MemberRepository)
        skip = (page - 1) * size

        rows = await repo.list_paged_with_emails(
            institution_id, skip=skip, limit=size, search=search, role=role,
        )
        total = await repo.count_filtered(
            institution_id, search=search, role=role,
        )

        items = []
        for member, email in rows:
            summary = MemberSummary.model_validate(member)
            summary.email = email
            items.append(summary)

        return MemberListResponse(
            items=items,
            total=total,
            page=page,
            size=size,
            pages=math.ceil(total / size) if total > 0 else 1,
        )

    async def get_member(
        self, institution_id: str, member_id: str
    ) -> MemberResponse:
        repo = self._uow.repo(MemberRepository)
        row = await repo.get_with_email_by_institution(institution_id, member_id)
        if row is None:
            raise EntityNotFoundException(f"직원을 찾을 수 없습니다: {member_id}")
        member, email = row
        response = MemberResponse.model_validate(member)
        response.email = email
        return response

    async def update_member(
        self,
        ctx: InstitutionContext,
        member_id: str,
        data: MemberUpdate,
        client_info: ClientInfo,
    ) -> MemberResponse:
        repo = self._uow.repo(MemberRepository)
        # GetMemberByIdService가 institution 권한도 검증
        member = await GetMemberByIdService(repo).execute(
            member_id, ctx.institution_id
        )

        old_role = member.role
        old_snapshot = MemberResponse.model_validate(member).model_dump(mode="json")

        update_data = data.model_dump(exclude_unset=True)
        if update_data:
            for key, value in update_data.items():
                setattr(member, key, value)
            await repo.flush()
            await repo.refresh(member)

        new_snapshot = MemberResponse.model_validate(member).model_dump(mode="json")

        is_role_change = data.role is not None and data.role != old_role
        await self._audit_logger().log(
            action="role_change" if is_role_change else "update",
            entity_type="member",
            entity_id=member_id,
            actor_id=ctx.account_id,
            actor_email=ctx.email,
            actor_role=ctx.role,
            institution_id=ctx.institution_id,
            ip_address=client_info.ip_address,
            user_agent=client_info.user_agent,
            old_value=old_snapshot,
            new_value=new_snapshot,
            metadata={"from": old_role, "to": data.role} if is_role_change else None,
        )
        return MemberResponse.model_validate(member)
