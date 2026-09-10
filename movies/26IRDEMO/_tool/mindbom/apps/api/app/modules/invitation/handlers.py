"""Invitation Handlers — UoW 트랜잭션 경계 + Facade 호출"""
from app.core.dependencies import ClientInfo
from app.core.exceptions import EntityNotFoundException
from app.core.unit_of_work import UnitOfWork
from app.modules.auth.account.repository import AccountRepository
from app.modules.auth.dependencies import InstitutionContext
from app.modules.institution.repository import InstitutionRepository
from app.modules.invitation.facade import InvitationFacade
from app.modules.invitation.schemas import (
    InvitationAcceptResponse,
    InvitationCreate,
    InvitationListResponse,
    InvitationSummary,
    InvitationVerifyResponse,
)


async def handle_list_pending_invitations(
    institution_id: str, uow: UnitOfWork,
) -> InvitationListResponse:
    async with uow:
        return await InvitationFacade(uow).list_pending(institution_id)


async def handle_create_invitation(
    ctx: InstitutionContext,
    body: InvitationCreate,
    client_info: ClientInfo,
    uow: UnitOfWork,
) -> InvitationSummary:
    async with uow:
        # 기관·발송자 이름은 메일 본문/응답용
        institution = await uow.repo(InstitutionRepository).get(ctx.institution_id)
        if institution is None:
            raise EntityNotFoundException(
                f"기관을 찾을 수 없습니다: {ctx.institution_id}"
            )
        inviter_account = await uow.repo(AccountRepository).get(ctx.account_id)
        inviter_name = inviter_account.name if inviter_account else None

        result = await InvitationFacade(uow).invite(
            ctx,
            email=body.email,
            name=body.name,
            role=body.role,
            institution_name=institution.name,
            inviter_name=inviter_name,
            client_info=client_info,
        )
        await uow.commit()
        return result


async def handle_revoke_invitation(
    ctx: InstitutionContext,
    invitation_id: str,
    client_info: ClientInfo,
    uow: UnitOfWork,
) -> None:
    async with uow:
        await InvitationFacade(uow).revoke(ctx, invitation_id, client_info)
        await uow.commit()


async def handle_resend_invitation(
    ctx: InstitutionContext,
    invitation_id: str,
    client_info: ClientInfo,
    uow: UnitOfWork,
) -> InvitationSummary:
    async with uow:
        institution = await uow.repo(InstitutionRepository).get(ctx.institution_id)
        if institution is None:
            raise EntityNotFoundException(
                f"기관을 찾을 수 없습니다: {ctx.institution_id}"
            )
        inviter_account = await uow.repo(AccountRepository).get(ctx.account_id)
        inviter_name = inviter_account.name if inviter_account else None

        result = await InvitationFacade(uow).resend(
            ctx, invitation_id,
            institution_name=institution.name,
            inviter_name=inviter_name,
            client_info=client_info,
        )
        await uow.commit()
        return result


async def handle_verify_invitation(
    raw_token: str, uow: UnitOfWork,
) -> InvitationVerifyResponse:
    async with uow:
        return await InvitationFacade(uow).verify(raw_token)


async def handle_accept_invitation(
    raw_token: str,
    password: str,
    client_info: ClientInfo,
    uow: UnitOfWork,
) -> InvitationAcceptResponse:
    async with uow:
        result = await InvitationFacade(uow).accept(
            raw_token=raw_token,
            password=password,
            client_info=client_info,
        )
        await uow.commit()
        return InvitationAcceptResponse.model_validate(result.model_dump())
