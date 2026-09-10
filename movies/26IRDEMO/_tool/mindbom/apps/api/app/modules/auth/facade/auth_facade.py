"""Auth Facade — 인증 비즈니스 로직 조합"""
from app.core.config import settings
from app.core.exceptions import (
    AccountLockedException,
    InvalidOperationException,
    UnauthorizedException,
)
from app.core.logger import get_logger
from app.core.mailer import send_email
from app.core.security import create_access_token
from app.core.unit_of_work import UnitOfWork
from app.modules.audit.repository import AuditLogRepository
from app.modules.audit.services import AuditLogger
from app.modules.auth.account.repository import AccountRepository
from app.modules.auth.account.services import (
    AuthenticateService,
    ChangePasswordService,
    CreateAccountService,
    GetAccountService,
)
from app.modules.auth.password_reset.repository import PasswordResetTokenRepository
from app.modules.auth.password_reset.services import (
    ConfirmPasswordResetService,
    IssuePasswordResetTokenService,
    build_reset_email,
)
from app.modules.auth.schemas import (
    InstitutionMembership,
    InstitutionResponse,
    LoginResponse,
    MeResponse,
    RefreshResponse,
    UserResponse,
)
from app.modules.auth.token.repository import RefreshTokenRepository
from app.modules.auth.token.services import (
    CreateRefreshTokenService,
    RevokeRefreshTokenService,
    ValidateRefreshTokenService,
)
from app.modules.institution.repository import InstitutionRepository
from app.modules.institution.services import CreateInstitutionService, GetInstitutionService
from app.modules.member.repository import MemberRepository
from app.modules.member.services import (
    CreateMemberService,
    GetMembersByAccountIdService,
)


logger = get_logger(__name__)




class AuthFacade:
    def __init__(self, uow: UnitOfWork):
        self._uow = uow

    async def _build_memberships(
        self, account_id: str
    ) -> list[InstitutionMembership]:
        """계정의 모든 활성 멤버십 + 각 기관 이름 조인.

        멀티 기관 로그인 응답·기관 선택 화면 데이터로 사용된다.
        """
        member_repo = self._uow.repo(MemberRepository)
        institution_repo = self._uow.repo(InstitutionRepository)
        members_service = GetMembersByAccountIdService(member_repo)
        members = await members_service.execute(account_id)

        memberships: list[InstitutionMembership] = []
        for m in members:
            institution = await institution_repo.get(m.institution_id)
            if institution is None:
                continue
            memberships.append(
                InstitutionMembership(
                    institution_id=institution.id,
                    institution_name=institution.name,
                    member_id=m.id,
                    name=m.name,
                    role=m.role,
                )
            )
        return memberships

    async def _audit_login(
        self,
        *,
        action: str,
        actor_id: str | None,
        actor_email: str,
        actor_role: str | None,
        institution_id: str | None,
        ip_address: str | None,
        user_agent: str | None,
        metadata: dict | None = None,
    ) -> None:
        """로그인 이벤트 감사 기록 (ctx 없이 직접 호출, trace_id 자동 캡처)

        actor_id/role/institution_id가 미상이면 None — DB 레벨에서 nullable.
        """
        repo = self._uow.repo(AuditLogRepository)
        logger = AuditLogger(repo)
        await logger.log(
            action=action,
            entity_type="account",
            entity_id=actor_id or "anonymous",
            actor_id=actor_id,
            actor_email=actor_email,
            actor_role=actor_role,
            institution_id=institution_id,
            ip_address=ip_address,
            user_agent=user_agent,
            metadata=metadata,
        )

    async def _persist_login_failure_audit(
        self,
        *,
        actor_id: str | None,
        actor_email: str,
        ip_address: str | None,
        user_agent: str | None,
        metadata: dict | None = None,
    ) -> None:
        """로그인 실패 audit을 즉시 영속화 (예외 raise 직전 호출).

        SaMD 2등급 규제상 보안 이벤트(인증 실패, 잠금 등)는
        후속 예외 처리와 무관하게 반드시 DB에 기록되어야 한다.
        예외가 던져진 뒤에는 핸들러의 정상 commit 경로가 실행되지 않으므로,
        Facade 레이어에서 직접 commit하는 것은 의도적인 예외다.
        ("commit은 핸들러 책임" 일반 원칙의 SaMD-driven exception)
        """
        await self._audit_login(
            action="login_failed",
            actor_id=actor_id,
            actor_email=actor_email,
            actor_role=None,
            institution_id=None,
            ip_address=ip_address,
            user_agent=user_agent,
            metadata=metadata,
        )
        await self._uow.commit()

    async def login(
        self,
        email: str,
        password: str,
        user_agent: str | None = None,
        ip_address: str | None = None,
    ) -> LoginResponse:
        """로그인: 인증 → 멤버/기관 조회 → 토큰 발급"""
        account_repo = self._uow.repo(AccountRepository)
        auth_service = AuthenticateService(account_repo)

        # 1. 인증 (잠금 정책 포함)
        try:
            account = await auth_service.execute(email, password, ip_address)
        except AccountLockedException:
            existing = await account_repo.get_by_email(email)
            if existing:
                await self._persist_login_failure_audit(
                    actor_id=existing.id,
                    actor_email=existing.email,
                    ip_address=ip_address,
                    user_agent=user_agent,
                    metadata={"reason": "locked_out"},
                )
            raise
        except UnauthorizedException:
            # 인증 실패도 audit (이메일이 존재하면 account.id, 아니면 anonymous)
            existing = await account_repo.get_by_email(email)
            if existing:
                attempts = existing.failed_login_attempts
                is_lockout = attempts >= 5
                reason = "wrong_password_lockout" if is_lockout else "wrong_password"
                # 잠금이 방금 트리거된 경우 별도 action 기록 (검색/감사 가시성)
                if is_lockout and existing.lockout_until:
                    await self._audit_login(
                        action="account_locked",
                        actor_id=existing.id,
                        actor_email=existing.email,
                        actor_role=None,
                        institution_id=None,
                        ip_address=ip_address,
                        user_agent=user_agent,
                        metadata={
                            "attempts": attempts,
                            "lockout_until": existing.lockout_until.isoformat(),
                        },
                    )
                await self._persist_login_failure_audit(
                    actor_id=existing.id,
                    actor_email=existing.email,
                    ip_address=ip_address,
                    user_agent=user_agent,
                    metadata={"reason": reason, "attempts": attempts},
                )
            else:
                await self._persist_login_failure_audit(
                    actor_id=None,
                    actor_email=email,
                    ip_address=ip_address,
                    user_agent=user_agent,
                    metadata={"reason": "account_not_found"},
                )
            raise

        # 2. 멤버십 조회
        member_repo = self._uow.repo(MemberRepository)
        members_service = GetMembersByAccountIdService(member_repo)
        members = await members_service.execute(account.id)
        if not members:
            raise InvalidOperationException("소속 기관이 없습니다. 관리자에게 문의하세요.")
        member = members[0]

        # 3. 기관 조회
        institution_repo = self._uow.repo(InstitutionRepository)
        institution_service = GetInstitutionService(institution_repo)
        institution = await institution_service.execute(member.institution_id)
        if not institution:
            raise InvalidOperationException("기관 정보를 찾을 수 없습니다.")

        # 4. 기존 세션 모두 폐기 (단일 세션 정책)
        token_repo = self._uow.repo(RefreshTokenRepository)
        existing_count = await token_repo.count_active_for_account(account.id)
        if existing_count > 0:
            await token_repo.revoke_all_for_account(account.id)
            await self._audit_login(
                action="concurrent_session_invalidated",
                actor_id=account.id,
                actor_email=account.email,
                actor_role=member.role,
                institution_id=institution.id,
                ip_address=ip_address,
                user_agent=user_agent,
                metadata={"revoked_count": existing_count},
            )

        # 5. Refresh Token 생성
        create_rt_service = CreateRefreshTokenService(token_repo)
        raw_refresh_token, _ = await create_rt_service.execute(
            account.id, user_agent, ip_address
        )

        # 6. Access Token 생성
        access_token = create_access_token(
            data={
                "sub": account.id,
                "email": account.email,
                "name": member.name,
                "role": member.role,
            },
            account_token_version=account.token_version,
        )

        # 7. 성공 audit
        await self._audit_login(
            action="login_success",
            actor_id=account.id,
            actor_email=account.email,
            actor_role=member.role,
            institution_id=institution.id,
            ip_address=ip_address,
            user_agent=user_agent,
        )

        memberships = await self._build_memberships(account.id)
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

    async def signup(
        self,
        email: str,
        password: str,
        name: str,
        institution_name: str,
    ) -> LoginResponse:
        """회원가입: 계정 + 기관 + 멤버(admin) 생성 → 자동 로그인"""
        # 1. 계정 생성
        account_repo = self._uow.repo(AccountRepository)
        create_account_service = CreateAccountService(account_repo)
        account = await create_account_service.execute(email, password, name)

        # 2. 기관 생성
        institution_repo = self._uow.repo(InstitutionRepository)
        create_institution_service = CreateInstitutionService(institution_repo)
        institution = await create_institution_service.execute(institution_name)

        # 3. 멤버 생성 (admin)
        member_repo = self._uow.repo(MemberRepository)
        create_member_service = CreateMemberService(member_repo)
        member = await create_member_service.execute(
            institution_id=institution.id,
            account_id=account.id,
            name=name,
            role="admin",
        )

        # 4. 토큰 발급
        token_repo = self._uow.repo(RefreshTokenRepository)
        create_rt_service = CreateRefreshTokenService(token_repo)
        raw_refresh_token, _ = await create_rt_service.execute(account.id)

        access_token = create_access_token(
            data={
                "sub": account.id,
                "email": account.email,
                "name": name,
                "role": "admin",
            },
            account_token_version=account.token_version,
        )

        return LoginResponse(
            access_token=access_token,
            refresh_token=raw_refresh_token,
            user=UserResponse(
                id=account.id,
                email=account.email,
                name=name,
                role="admin",
            ),
            institution=InstitutionResponse(
                id=institution.id,
                name=institution.name,
            ),
            institutions=[
                InstitutionMembership(
                    institution_id=institution.id,
                    institution_name=institution.name,
                    member_id=member.id,
                    name=name,
                    role="admin",
                )
            ],
            requires_institution_choice=False,
        )

    async def refresh(
        self,
        raw_refresh_token: str,
        user_agent: str | None = None,
        ip_address: str | None = None,
    ) -> RefreshResponse:
        """토큰 갱신: 기존 RT 검증 → 폐기 → 새 토큰 쌍 발급"""
        token_repo = self._uow.repo(RefreshTokenRepository)

        # 1. 기존 토큰 검증
        validate_service = ValidateRefreshTokenService(token_repo)
        token_record = await validate_service.execute(raw_refresh_token)

        # 2. 계정 확인
        account_repo = self._uow.repo(AccountRepository)
        account_service = GetAccountService(account_repo)
        account = await account_service.execute(token_record.account_id)
        if not account or not account.is_active:
            raise UnauthorizedException("계정이 비활성화되었습니다.")

        # 3. 멤버 조회 (JWT payload용)
        member_repo = self._uow.repo(MemberRepository)
        members_service = GetMembersByAccountIdService(member_repo)
        members = await members_service.execute(account.id)
        member = members[0] if members else None

        # 4. 기존 토큰 폐기
        revoke_service = RevokeRefreshTokenService(token_repo)
        await revoke_service.execute(raw_refresh_token)

        # 5. 새 토큰 발급
        create_rt_service = CreateRefreshTokenService(token_repo)
        new_raw_token, _ = await create_rt_service.execute(
            account.id, user_agent, ip_address
        )

        access_token = create_access_token(
            data={
                "sub": account.id,
                "email": account.email,
                "name": member.name if member else account.name,
                "role": member.role if member else "clinician",
            },
            account_token_version=account.token_version,
        )

        return RefreshResponse(
            access_token=access_token,
            refresh_token=new_raw_token,
            expires_in=settings.ACCESS_TOKEN_EXPIRE_MINUTES * 60,
        )

    async def get_me(
        self,
        account_id: str,
        *,
        current_institution_id: str | None = None,
    ) -> MeResponse:
        """현재 사용자 프로필 조회

        current_institution_id가 주어지면 해당 기관의 멤버십을 user.role/institution에
        반영. 없으면 첫 번째 멤버십 사용.
        """
        account_repo = self._uow.repo(AccountRepository)
        account = await account_repo.get(account_id)
        if not account:
            raise UnauthorizedException("계정을 찾을 수 없습니다.")

        memberships = await self._build_memberships(account_id)

        # 현재 기관 결정 — 쿠키 기반 institution_id 우선, 없으면 첫 번째
        current = None
        if current_institution_id:
            current = next(
                (m for m in memberships if m.institution_id == current_institution_id),
                None,
            )
        if current is None and memberships:
            current = memberships[0]

        institution_response = (
            InstitutionResponse(id=current.institution_id, name=current.institution_name)
            if current else None
        )

        return MeResponse(
            user=UserResponse(
                id=account.id,
                email=account.email,
                name=current.name if current else account.name,
                role=current.role if current else "clinician",
            ),
            institution=institution_response,
            institutions=memberships,
        )

    async def logout(
        self,
        raw_refresh_token: str,
        *,
        user_agent: str | None = None,
        ip_address: str | None = None,
    ) -> None:
        """로그아웃: refresh token 폐기 + audit 기록"""
        token_repo = self._uow.repo(RefreshTokenRepository)
        revoke_service = RevokeRefreshTokenService(token_repo)
        account_id = await revoke_service.execute(raw_refresh_token)

        if account_id:
            account_repo = self._uow.repo(AccountRepository)
            account = await account_repo.get(account_id)
            if account:
                await self._audit_login(
                    action="logout",
                    actor_id=account_id,
                    actor_email=account.email,
                    actor_role=None,
                    institution_id=None,
                    ip_address=ip_address,
                    user_agent=user_agent,
                )

    async def verify_password(self, account_id: str, password: str) -> None:
        """본인 비밀번호 재확인 — 일치하지 않으면 PermissionDenied(403).

        시크릿 모드 해제 등 본인 확인이 필요한 클라이언트 흐름에서 사용.
        """
        from app.core.exceptions import PermissionDeniedException
        from app.core.security import verify_password as verify_pw

        account_repo = self._uow.repo(AccountRepository)
        account = await account_repo.get(account_id)
        if not account or not verify_pw(password, account.password_hash):
            raise PermissionDeniedException("비밀번호가 일치하지 않습니다.")

    async def change_password(
        self,
        account_id: str,
        current_password: str,
        new_password: str,
        user_agent: str | None = None,
        ip_address: str | None = None,
    ) -> None:
        """비밀번호 변경: 현재 검증 + 정책 적용 + 모든 세션 무효화

        - token_version 증가로 모든 access token 즉시 무효화
        - 모든 refresh token 폐기 (재로그인 강제)
        - audit "password_change" 기록
        """
        account_repo = self._uow.repo(AccountRepository)
        change_service = ChangePasswordService(account_repo)
        account = await change_service.execute(
            account_id, current_password, new_password
        )

        # 모든 refresh token 폐기 (다른 기기 강제 로그아웃)
        token_repo = self._uow.repo(RefreshTokenRepository)
        await token_repo.revoke_all_for_account(account_id)

        # 멤버 정보 (audit용)
        member_repo = self._uow.repo(MemberRepository)
        members_service = GetMembersByAccountIdService(member_repo)
        members = await members_service.execute(account_id)
        member = members[0] if members else None

        await self._audit_login(
            action="password_change",
            actor_id=account.id,
            actor_email=account.email,
            actor_role=member.role if member else None,
            institution_id=member.institution_id if member else None,
            ip_address=ip_address,
            user_agent=user_agent,
        )

        # 알림: 본인에게 비밀번호 변경 보안 알림 (멤버십이 있을 때만)
        if member is not None:
            from app.modules.notification.repository import NotificationRepository
            from app.modules.notification.services import NotificationPublisher
            notifier = NotificationPublisher(self._uow.repo(NotificationRepository))
            await notifier.publish(
                institution_id=member.institution_id,
                recipient_member_id=member.id,
                type="account.password_changed",
                title="비밀번호가 변경되었습니다",
                body="본인이 변경하지 않았다면 즉시 관리자에게 문의해주세요.",
                entity_type="account",
                entity_id=account.id,
                link_path="/settings",
                actor_member_id=member.id,
                metadata={"ip_address": ip_address} if ip_address else None,
            )

    async def request_password_reset(self, email: str) -> None:
        """비밀번호 재설정 요청

        - 등록된 이메일이면 토큰 발급 + 메일 발송
        - 미등록/비활성/rate-limit 등 모든 케이스에서 None 반환 (enumeration 방지)
        - 메일 발송 실패는 로그만 남기고 swallow (호출자에게는 동일 응답)

        토큰 발급 후 commit은 핸들러 책임이지만,
        메일 발송이 트랜잭션과 무관하게 외부 효과이므로 발송 시점에 토큰이 DB에 보장되어야 한다.
        → 발송 직전 flush로 토큰 row가 가시화되도록 보장.
        """
        account_repo = self._uow.repo(AccountRepository)
        token_repo = self._uow.repo(PasswordResetTokenRepository)
        issue_service = IssuePasswordResetTokenService(account_repo, token_repo)

        result = await issue_service.execute(email)
        if result is None:
            return  # enumeration 방지: 동일 응답
        account, raw_token = result

        # commit 전에 메일 발송하면 발송 후 commit 실패 시 토큰만 DB에 없는 상황 방지를 위해
        # flush만 수행 (트랜잭션 가시성). 핸들러가 commit을 담당.
        await self._uow.flush()

        reset_url = f"{settings.FRONTEND_URL.rstrip('/')}/reset-password?token={raw_token}"
        subject, html_body = build_reset_email(reset_url=reset_url, user_name=account.name)
        try:
            await send_email(to=account.email, subject=subject, html_body=html_body)
        except Exception as exc:
            logger.error(
                "Failed to send password reset email to %s: %s",
                account.email, exc,
            )

    async def confirm_password_reset(
        self,
        raw_token: str,
        new_password: str,
        *,
        user_agent: str | None = None,
        ip_address: str | None = None,
    ) -> None:
        """비밀번호 재설정 확정

        토큰 검증 → 비밀번호 정책 적용 → 변경 → 모든 세션 무효화 → audit 기록.
        """
        account_repo = self._uow.repo(AccountRepository)
        token_repo = self._uow.repo(PasswordResetTokenRepository)
        confirm_service = ConfirmPasswordResetService(account_repo, token_repo)
        account = await confirm_service.execute(raw_token, new_password)

        # 모든 refresh token 폐기 (다른 기기 강제 로그아웃)
        rt_repo = self._uow.repo(RefreshTokenRepository)
        await rt_repo.revoke_all_for_account(account.id)

        # 멤버 정보 (audit용)
        member_repo = self._uow.repo(MemberRepository)
        members_service = GetMembersByAccountIdService(member_repo)
        members = await members_service.execute(account.id)
        member = members[0] if members else None

        await self._audit_login(
            action="password_reset",
            actor_id=account.id,
            actor_email=account.email,
            actor_role=member.role if member else None,
            institution_id=member.institution_id if member else None,
            ip_address=ip_address,
            user_agent=user_agent,
        )
