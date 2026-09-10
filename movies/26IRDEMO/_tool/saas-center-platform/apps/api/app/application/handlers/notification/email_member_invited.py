from datetime import datetime

from app.infrastructure.persistence.unit_of_work import UnitOfWork
from app.infrastructure.email.factory import get_smtp_mailer
from app.infrastructure.email.templates.member_invitation import member_invitation_email
from app.infrastructure.token.factory import get_token
from app.modules.center.facade import MemberInvitationFacade
from app.modules.person.facade import PersonFacade
from app.modules.role.facade import RoleFacade


async def email_member_invited_handler(
    *,
    uow: UnitOfWork,
    center_id: str,
    event_group_id: str,
    invitation_id: str,
    invitee_name: str,
    invitee_email: str,
    invited_by: str,
    role_id: str,
    employment_type: str | None,
    expires_at: str | None,
) -> None:
    # load — 토큰(민감값)·표시명은 payload에 없어 재조회로 구성
    center_name = await MemberInvitationFacade(uow).get_center_name(center_id)
    inviter = await PersonFacade(uow).find_person(invited_by)
    inviter_name = inviter.name if inviter else "관리자"
    roles = await RoleFacade(uow).get_roles_by_ids([role_id])
    role = roles.get(role_id)
    role_name = role.name if role else "Unknown"
    expires = datetime.fromisoformat(expires_at) if expires_at else None

    token = get_token().create_invitation_token(
        invitation_id=invitation_id,
        center_id=center_id,
        center_name=center_name,
        role_name=role_name,
        inviter_name=inviter_name,
        invitee_name=invitee_name,
        invitee_email=invitee_email,
        employment_type=employment_type,
        expires_at=expires,
    )

    # send — 예외를 삼키지 않는다(반응 실패 → 워커 재시도, 재발송 무해)
    html_content, text_content = member_invitation_email(
        invitee_name=invitee_name,
        invitee_email=invitee_email,
        inviter_name=inviter_name,
        center_name=center_name,
        token=token,
        expires_at=expires,
        role_name=role_name,
        employment_type=employment_type,
    )
    get_smtp_mailer().send_email(
        recipient=invitee_email,
        subject=f"[{center_name}] 멤버 초대",
        html_content=html_content,
        text_content=text_content,
    )
