from app.infrastructure.persistence.unit_of_work import UnitOfWork
from app.core.exceptions import InvalidOperationException
from app.infrastructure.token.factory import get_token
from ..center.repository import CenterRepository
from ..center.services import GetCenterService
from ..member.default_avatars import resolve_member_default_avatar
from ..member.models import Member
from ..member.repository import MemberRepository
from ..member.services import CreateMemberFromInvitationService
from ..member_invitation.events import MemberInvitationAtomic
from ..member_invitation.models import MemberInvitation
from ..member_invitation.repository import MemberInvitationRepository
from ..member_invitation.schemas import (
    MemberInvitationResponse,
    MemberInvitationSummary,
    MemberInvitationListResponse,
)
from ..member_invitation.services import (
    CreateMemberInvitationService,
    AcceptMemberInvitationService,
    CancelMemberInvitationService,
    ListMemberInvitationsService,
    GetMemberInvitationService,
)


class MemberInvitationFacade:
    def __init__(self, uow: UnitOfWork):
        self._uow = uow

    async def create_invitation(
        self,
        center_id: str,
        invited_by: str,
        name: str,
        email: str,
        role_id: str,
        employment_type: str | None = None,
    ) -> tuple[MemberInvitationAtomic, MemberInvitation]:
        repo = self._uow.repo(MemberInvitationRepository)
        service = CreateMemberInvitationService(repo)
        return await service.execute(
            center_id=center_id,
            invited_by=invited_by,
            name=name,
            email=email,
            role_id=role_id,
            employment_type=employment_type,
        )

    async def create_with_response(
        self,
        center_id: str,
        invited_by: str,
        name: str,
        email: str,
        role_id: str,
        role_code: str,
        role_name: str,
        center_name: str,
        inviter_name: str,
        employment_type: str | None = None,
    ) -> tuple[MemberInvitationAtomic, MemberInvitationResponse, dict]:
        atomic, invitation = await self.create_invitation(
            center_id=center_id,
            invited_by=invited_by,
            name=name,
            email=email,
            role_id=role_id,
            employment_type=employment_type,
        )

        token = get_token().create_invitation_token(
            invitation_id=invitation.id,
            center_id=center_id,
            center_name=center_name,
            role_name=role_name,
            inviter_name=inviter_name,
            invitee_name=name,
            invitee_email=email,
            employment_type=employment_type,
            expires_at=invitation.expires_at,
        )

        response = MemberInvitationResponse(
            id=invitation.id,
            center_id=invitation.center_id,
            invited_by=invitation.invited_by,
            name=invitation.name,
            email=invitation.email,
            role_code=role_code,
            role_name=role_name,
            employment_type=invitation.employment_type,
            member_id=invitation.member_id,
            accepted_at=invitation.accepted_at,
            expires_at=invitation.expires_at,
            created_at=invitation.created_at,
        )
        email_context = {
            "inviter_name": inviter_name,
            "center_name": center_name,
            "role_name": role_name,
            "employment_type": employment_type,
            "token": token,
        }
        return atomic, response, email_context

    async def list_with_response(
        self,
        center_id: str,
        role_map: dict,
        status: str | None = None,
        search: str | None = None,
        role_id: str | None = None,
        skip: int = 0,
        limit: int = 100,
        page: int = 1,
        size: int = 20,
    ) -> MemberInvitationListResponse:
        repo = self._uow.repo(MemberInvitationRepository)
        service = ListMemberInvitationsService(repo)
        invitations, total = await service.execute(
            center_id=center_id,
            status=status,
            search=search,
            role_id=role_id,
            skip=skip,
            limit=limit,
        )

        if not invitations:
            return MemberInvitationListResponse(
                items=[], total=0, page=page, size=size, pages=0
            )

        pages = (total + size - 1) // size if total > 0 else 1
        items = []
        for inv in invitations:
            role = role_map.get(inv.role_id)
            items.append(
                MemberInvitationSummary(
                    id=inv.id,
                    name=inv.name,
                    email=inv.email,
                    role_code=role.code if role else "Unknown",
                    role_name=role.name if role else "Unknown",
                    employment_type=inv.employment_type,
                    member_id=inv.member_id,
                    accepted_at=inv.accepted_at,
                    expires_at=inv.expires_at,
                    created_at=inv.created_at,
                )
            )

        return MemberInvitationListResponse(
            items=items, total=total, page=page, size=size, pages=pages
        )

    async def list_invitation_role_ids(
        self,
        center_id: str,
        status: str | None = None,
        search: str | None = None,
        role_id: str | None = None,
        skip: int = 0,
        limit: int = 100,
    ) -> list[str]:
        repo = self._uow.repo(MemberInvitationRepository)
        service = ListMemberInvitationsService(repo)
        invitations, _ = await service.execute(
            center_id=center_id,
            status=status,
            search=search,
            role_id=role_id,
            skip=skip,
            limit=limit,
        )
        return list({inv.role_id for inv in invitations})

    async def cancel(
        self, center_id: str, invitation_id: str
    ) -> tuple[MemberInvitationAtomic, MemberInvitation]:
        repo = self._uow.repo(MemberInvitationRepository)
        service = CancelMemberInvitationService(repo)
        return await service.execute(center_id, invitation_id)

    async def accept(
        self,
        invitation_id: str,
        person_id: str,
        is_admin_role: bool,
    ) -> tuple[list, MemberInvitation, Member]:
        repo = self._uow.repo(MemberInvitationRepository)

        get_service = GetMemberInvitationService(repo)
        invitation = await get_service.execute(invitation_id)

        if is_admin_role:
            raise InvalidOperationException("관리자 역할은 초대로 할당할 수 없습니다.")

        member_repo = self._uow.repo(MemberRepository)
        from app.modules.center.member.services.assign_member_color import (
            AssignMemberColorService,
        )

        color_service = AssignMemberColorService(member_repo)
        color = await color_service.execute(invitation.center_id)

        member_service = CreateMemberFromInvitationService(member_repo)
        member_atomic, member = await member_service.execute(
            center_id=invitation.center_id,
            person_id=person_id,
            role_id=invitation.role_id,
            employment_type=invitation.employment_type or "FULLTIME",
            color=color,
            profile_image_url=await resolve_member_default_avatar(self._uow, person_id),
        )

        accept_service = AcceptMemberInvitationService(repo)
        invitation_atomic, updated = await accept_service.execute(
            invitation_id, member.id
        )

        return [invitation_atomic, member_atomic], updated, member

    async def get_invitation_role_id(self, invitation_id: str) -> str:
        repo = self._uow.repo(MemberInvitationRepository)
        service = GetMemberInvitationService(repo)
        invitation = await service.execute(invitation_id)
        return invitation.role_id

    async def get_center_name(self, center_id: str) -> str:
        center_repo = self._uow.repo(CenterRepository)
        center_service = GetCenterService(center_repo)
        center = await center_service.execute(center_id)
        return center.name
