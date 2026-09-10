"""Invitation Facade — 초대 생성/검증/수락/취소/재발송 조합

CDSS·SaMD 보안 요건:
- 토큰은 sha256 해시로만 DB 저장 (raw token은 메일 발송에만 사용)
- enumeration 방지: verify는 모든 무효 케이스에 단일 메시지 반환
- 재발송 시 기존 pending 초대를 revoked 처리 후 신규 행 생성 (이력 추적)
- 모든 작업이 audit log + UoW 트랜잭션 안에서 수행
"""
from app.core.config import settings
from app.core.dependencies import ClientInfo
from app.core.datetime_utils import utc_now
from app.core.exceptions import (
    ConflictException,
    EntityNotFoundException,
    InvalidOperationException,
    PermissionDeniedException,
    UnauthorizedException,
)
from app.core.logger import get_logger
from app.core.mailer import send_email
from app.core.security import create_access_token, verify_password
from app.core.unit_of_work import UnitOfWork
from app.modules.audit.repository import AuditLogRepository
from app.modules.audit.services import AuditLogger
from app.modules.auth.account.repository import AccountRepository
from app.modules.auth.account.services import CreateAccountService
from app.modules.auth.dependencies import InstitutionContext
from app.modules.auth.facade.auth_facade import AuthFacade
from app.modules.auth.schemas import (
    InstitutionResponse,
    LoginResponse,
    UserResponse,
)
from app.modules.auth.token.repository import RefreshTokenRepository
from app.modules.auth.token.services import CreateRefreshTokenService
from app.modules.institution.repository import InstitutionRepository
from app.modules.invitation.repository import InvitationRepository
from app.modules.invitation.schemas import (
    InvitationListResponse,
    InvitationSummary,
    InvitationVerifyResponse,
)
from app.modules.invitation.services import (
    CreateInvitationService,
    MarkInvitationAcceptedService,
    RevokeInvitationService,
    VerifyInvitationService,
    build_invite_email,
)
from app.modules.member.repository import MemberRepository
from app.modules.member.services import (
    CreateMemberService,
    GetMemberByAccountService,
)
from app.modules.notification.repository import NotificationRepository
from app.modules.notification.services import NotificationPublisher

logger = get_logger(__name__)


class InvitationFacade:
    def __init__(self, uow: UnitOfWork):
        self._uow = uow

    def _audit_logger(self) -> AuditLogger:
        return AuditLogger(self._uow.repo(AuditLogRepository))

    async def _send_invite_email(
        self,
        *,
        to: str,
        raw_token: str,
        institution_name: str,
        inviter_name: str | None,
        role: str,
    ) -> None:
        """메일 발송 — 실패는 로그만 남기고 swallow

        토큰 발급 직후 commit 전에 호출되므로 발송 시점 토큰 가시성 보장을 위해
        호출자(handler)에서 flush를 수행한다는 전제. 발송 실패가 트랜잭션을
        롤백하지 않도록 swallow.
        """
        invite_url = (
            f"{settings.FRONTEND_URL.rstrip('/')}/accept-invite?token={raw_token}"
        )
        subject, html_body = build_invite_email(
            invite_url,
            institution_name=institution_name,
            inviter_name=inviter_name,
            role=role,
        )
        try:
            await send_email(to=to, subject=subject, html_body=html_body)
        except Exception as exc:
            logger.error("Failed to send invite email to %s: %s", to, exc)

    async def list_pending(self, institution_id: str) -> InvitationListResponse:
        repo = self._uow.repo(InvitationRepository)
        rows = await repo.list_pending_with_inviter(institution_id)

        items: list[InvitationSummary] = []
        for inv, inviter_name in rows:
            summary = InvitationSummary.model_validate(inv)
            summary.inviter_name = inviter_name
            items.append(summary)
        return InvitationListResponse(items=items, total=len(items))

    async def invite(
        self,
        ctx: InstitutionContext,
        *,
        email: str,
        name: str,
        role: str,
        institution_name: str,
        inviter_name: str | None,
        client_info: ClientInfo,
    ) -> InvitationSummary:
        """관리자가 신규 직원 초대"""
        # 이미 같은 기관 멤버인지 확인 (계정 존재 + 이 기관 멤버 = 중복 초대 차단)
        account_repo = self._uow.repo(AccountRepository)
        member_repo = self._uow.repo(MemberRepository)
        existing_account = await account_repo.get_by_email(email)
        if existing_account is not None:
            existing_member = await GetMemberByAccountService(member_repo).execute(
                ctx.institution_id, existing_account.id
            )
            if existing_member is not None:
                raise ConflictException(
                    "이미 해당 기관에 소속된 계정입니다."
                )

        invitation_repo = self._uow.repo(InvitationRepository)
        invitation, raw_token = await CreateInvitationService(invitation_repo).execute(
            institution_id=ctx.institution_id,
            email=email,
            name=name,
            role=role,
            invited_by_account_id=ctx.account_id,
        )

        await self._audit_logger().log(
            action="invite",
            entity_type="invitation",
            entity_id=invitation.id,
            actor_id=ctx.account_id,
            actor_email=ctx.email,
            actor_role=ctx.role,
            institution_id=ctx.institution_id,
            ip_address=client_info.ip_address,
            user_agent=client_info.user_agent,
            new_value={
                "id": invitation.id,
                "email": invitation.email,
                "name": invitation.name,
                "role": invitation.role,
            },
        )

        # 메일 발송 전에 토큰 가시화
        await self._uow.flush()
        await self._send_invite_email(
            to=email,
            raw_token=raw_token,
            institution_name=institution_name,
            inviter_name=inviter_name,
            role=role,
        )

        summary = InvitationSummary.model_validate(invitation)
        summary.inviter_name = inviter_name
        return summary

    async def revoke(
        self,
        ctx: InstitutionContext,
        invitation_id: str,
        client_info: ClientInfo,
    ) -> None:
        repo = self._uow.repo(InvitationRepository)
        invitation = await RevokeInvitationService(repo).execute(
            invitation_id, ctx.institution_id
        )
        await self._audit_logger().log(
            action="revoke_invitation",
            entity_type="invitation",
            entity_id=invitation.id,
            actor_id=ctx.account_id,
            actor_email=ctx.email,
            actor_role=ctx.role,
            institution_id=ctx.institution_id,
            ip_address=client_info.ip_address,
            user_agent=client_info.user_agent,
            metadata={"email": invitation.email},
        )

    async def resend(
        self,
        ctx: InstitutionContext,
        invitation_id: str,
        *,
        institution_name: str,
        inviter_name: str | None,
        client_info: ClientInfo,
    ) -> InvitationSummary:
        """기존 토큰 무효화 + 신규 토큰/행 생성 + 메일 재발송"""
        repo = self._uow.repo(InvitationRepository)
        old = await repo.get(invitation_id)
        if old is None:
            raise EntityNotFoundException(f"초대를 찾을 수 없습니다: {invitation_id}")
        if old.institution_id != ctx.institution_id:
            raise PermissionDeniedException("해당 기관의 초대가 아닙니다.")
        if old.status == "accepted":
            raise InvalidOperationException("이미 수락된 초대입니다.")

        # 기존 pending 초대 무효화
        if old.status == "pending":
            old.status = "revoked"
            old.revoked_at = utc_now()
            await repo.flush()

        # 신규 초대 발급
        invitation, raw_token = await CreateInvitationService(repo).execute(
            institution_id=ctx.institution_id,
            email=old.email,
            name=old.name,
            role=old.role,
            invited_by_account_id=ctx.account_id,
        )

        await self._audit_logger().log(
            action="resend_invitation",
            entity_type="invitation",
            entity_id=invitation.id,
            actor_id=ctx.account_id,
            actor_email=ctx.email,
            actor_role=ctx.role,
            institution_id=ctx.institution_id,
            ip_address=client_info.ip_address,
            user_agent=client_info.user_agent,
            metadata={
                "previous_invitation_id": old.id,
                "email": invitation.email,
            },
        )

        await self._uow.flush()
        await self._send_invite_email(
            to=invitation.email,
            raw_token=raw_token,
            institution_name=institution_name,
            inviter_name=inviter_name,
            role=invitation.role,
        )

        summary = InvitationSummary.model_validate(invitation)
        summary.inviter_name = inviter_name
        return summary

    async def verify(self, raw_token: str) -> InvitationVerifyResponse:
        """수락 페이지 미리보기용"""
        invitation_repo = self._uow.repo(InvitationRepository)
        invitation = await VerifyInvitationService(invitation_repo).execute(raw_token)

        institution_repo = self._uow.repo(InstitutionRepository)
        institution = await institution_repo.get(invitation.institution_id)
        if institution is None:
            raise InvalidOperationException(VerifyInvitationService.GENERIC_ERROR)

        account_repo = self._uow.repo(AccountRepository)
        existing = await account_repo.get_by_email(invitation.email)

        return InvitationVerifyResponse(
            email=invitation.email,
            name=invitation.name,
            institution_name=institution.name,
            role=invitation.role,
            account_exists=existing is not None and existing.is_active,
        )

    async def accept(
        self,
        *,
        raw_token: str,
        password: str,
        client_info: ClientInfo,
    ) -> LoginResponse:
        """초대 수락 — account/member 생성·연결 + 자동 로그인 토큰 발급

        - account 미존재 → CreateAccountService(비밀번호 정책 검증) → 신규 계정 생성
        - account 존재 → 입력 비밀번호로 본인 확인 (브루트포스 방어 위해 verify_password 직접 사용)
        - 멤버십 race protection: 동일 기관 멤버 존재 시 409
        """
        invitation_repo = self._uow.repo(InvitationRepository)
        invitation = await VerifyInvitationService(invitation_repo).execute(raw_token)

        institution_repo = self._uow.repo(InstitutionRepository)
        institution = await institution_repo.get(invitation.institution_id)
        if institution is None:
            raise InvalidOperationException(VerifyInvitationService.GENERIC_ERROR)

        account_repo = self._uow.repo(AccountRepository)
        account = await account_repo.get_by_email(invitation.email)

        if account is None:
            # 신규 계정
            account = await CreateAccountService(account_repo).execute(
                invitation.email, password, invitation.name
            )
        else:
            # 기존 계정 — 본인 확인
            if not account.is_active:
                raise UnauthorizedException("비활성화된 계정입니다.")
            if not verify_password(password, account.password_hash):
                raise UnauthorizedException(
                    "이메일 또는 비밀번호가 올바르지 않습니다."
                )

        # 동일 기관 멤버십 중복 확인
        member_repo = self._uow.repo(MemberRepository)
        existing_member = await GetMemberByAccountService(member_repo).execute(
            invitation.institution_id, account.id
        )
        if existing_member is not None:
            raise ConflictException("이미 해당 기관에 소속된 계정입니다.")

        # 멤버 생성
        member = await CreateMemberService(member_repo).execute(
            institution_id=invitation.institution_id,
            account_id=account.id,
            name=invitation.name,
            role=invitation.role,
        )

        # 초대 수락 처리 (race 안에서 status 재확인)
        await MarkInvitationAcceptedService(invitation_repo).execute(invitation.id)

        # 자동 로그인 토큰 발급
        token_repo = self._uow.repo(RefreshTokenRepository)
        # 다중 세션 정책 — login과 동일하게 기존 RT 폐기
        existing_count = await token_repo.count_active_for_account(account.id)
        if existing_count > 0:
            await token_repo.revoke_all_for_account(account.id)

        raw_refresh_token, _ = await CreateRefreshTokenService(token_repo).execute(
            account.id, client_info.user_agent, client_info.ip_address
        )
        access_token = create_access_token(
            data={
                "sub": account.id,
                "email": account.email,
                "name": member.name,
                "role": member.role,
            },
            account_token_version=account.token_version,
        )

        # 감사: 초대 수락
        await self._audit_logger().log(
            action="accept_invitation",
            entity_type="member",
            entity_id=member.id,
            actor_id=account.id,
            actor_email=account.email,
            actor_role=member.role,
            institution_id=invitation.institution_id,
            ip_address=client_info.ip_address,
            user_agent=client_info.user_agent,
            metadata={
                "invitation_id": invitation.id,
                "account_existed": existing_member is None and account is not None,
            },
        )

        # 알림: 초대한 관리자에게 수락 알림 (가능하면)
        inviter_member = await GetMemberByAccountService(member_repo).execute(
            invitation.institution_id, invitation.invited_by_account_id
        )
        if inviter_member is not None:
            notifier = NotificationPublisher(self._uow.repo(NotificationRepository))
            await notifier.publish(
                institution_id=invitation.institution_id,
                recipient_member_id=inviter_member.id,
                type="invitation.accepted",
                title="초대가 수락되었습니다",
                body=f"{member.name}님이 가입을 완료했습니다.",
                entity_type="member",
                entity_id=member.id,
                link_path="/members",
                actor_member_id=member.id,
            )

        # 응답: LoginResponse 형태 — institutions 리스트는 AuthFacade 헬퍼 재사용
        auth_facade = AuthFacade(self._uow)
        memberships = await auth_facade._build_memberships(account.id)

        return LoginResponse(
            access_token=access_token,
            refresh_token=raw_refresh_token,
            user=UserResponse(
                id=account.id,
                email=account.email,
                name=member.name,
                role=member.role,
            ),
            institution=InstitutionResponse(
                id=institution.id,
                name=institution.name,
            ),
            institutions=memberships,
            requires_institution_choice=len(memberships) > 1,
        )
