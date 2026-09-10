from dataclasses import dataclass, field

from app.infrastructure.persistence.unit_of_work import UnitOfWork
from ..account.models import Account
from ..account.events import AccountAtomic
from ..account.repository import AccountRepository
from ..account.services import (
    FindAccountService,
    LoginAccountService,
    UpdateLastLoginService,
    DeactivateAccountService,
    VerifyPasswordService,
)
from ..token.repository import RefreshTokenRepository
from ..token.services import CreateRefreshTokenService
from ..login_notification.repository import LoginNotificationRepository
from ..login_notification.events import LoginNotificationAtomic
from ..login_notification.models import LoginNotification
from ..login_notification.services import (
    CreateLoginNotificationService,
    FindLoginNotificationService,
    MarkLoginNotificationNotifiedService,
)
from ..suspicious_activity.services import DetectAndLockIfSuspiciousService


@dataclass
class LoginResult:
    account: Account
    refresh_token: str
    locked_reasons: list[str] | None
    atomics: list = field(default_factory=list)


@dataclass
class SignupResult:
    account: Account
    refresh_token: str
    atomics: list = field(default_factory=list)


class AuthFacade:
    def __init__(self, uow: UnitOfWork):
        self._uow = uow

    async def login(
        self,
        email: str,
        password: str,
        device_info: str | None,
        ip_address: str | None,
    ) -> LoginResult:
        account_repo = self._uow.repo(AccountRepository)
        login_service = LoginAccountService(account_repo)
        account = await login_service.execute(email=email, password=password)

        token_repo = self._uow.repo(RefreshTokenRepository)
        create_token_service = CreateRefreshTokenService(token_repo)
        (
            token_atomic,
            refresh_token_str,
            refresh_token,
        ) = await create_token_service.execute(
            account_id=account.id,
            device_info=device_info,
            ip_address=ip_address,
            expires_days=30,
        )

        login_notification_repo = self._uow.repo(LoginNotificationRepository)
        create_login_notification_service = CreateLoginNotificationService(
            login_notification_repo
        )
        (
            new_device_atomic,
            login_notification,
        ) = await create_login_notification_service.execute(
            account_id=account.id,
            device_info=device_info,
            ip_address=ip_address or "unknown",
            location=None,
        )

        suspicious_result = await DetectAndLockIfSuspiciousService(
            login_notification_repo,
            account_repo,
            token_repo,
        ).execute(
            account_id=account.id,
            current_ip=ip_address or "unknown",
        )

        if suspicious_result.locked:
            return LoginResult(
                account=account,
                refresh_token="",
                locked_reasons=suspicious_result.reasons,
                atomics=[
                    token_atomic,
                    new_device_atomic,
                    *suspicious_result.atomics,
                ],
            )

        update_login_service = UpdateLastLoginService(account_repo)
        login_atomic, _ = await update_login_service.execute(account.id)

        return LoginResult(
            account=account,
            refresh_token=refresh_token_str,
            locked_reasons=None,
            atomics=[token_atomic, new_device_atomic, login_atomic],
        )

    async def find_login_notification_with_email(
        self,
        notification_id: str,
    ) -> tuple["LoginNotification | None", str | None]:
        login_notification_repo = self._uow.repo(LoginNotificationRepository)
        find_notification_service = FindLoginNotificationService(
            login_notification_repo
        )
        notification = await find_notification_service.execute(notification_id)
        if notification is None:
            return None, None
        account_repo = self._uow.repo(AccountRepository)
        find_account_service = FindAccountService(account_repo)
        account = await find_account_service.execute(notification.account_id)
        return notification, account.email if account else None

    async def mark_login_notification_notified(
        self,
        notification_id: str,
    ) -> "LoginNotificationAtomic":
        login_notification_repo = self._uow.repo(LoginNotificationRepository)
        mark_service = MarkLoginNotificationNotifiedService(login_notification_repo)
        atomic, _ = await mark_service.execute(notification_id)
        return atomic

    async def validate_refresh_token(
        self,
        refresh_token: str,
    ) -> Account:
        from app.core.exceptions import EntityNotFoundException
        from ..token.services import ValidateRefreshTokenService

        token_repo = self._uow.repo(RefreshTokenRepository)
        validate_service = ValidateRefreshTokenService(token_repo)
        refresh_token_model = await validate_service.execute(token=refresh_token)

        account_repo = self._uow.repo(AccountRepository)
        account_servcie = FindAccountService(account_repo)
        account = await account_servcie.execute(refresh_token_model.account_id)
        if not account:
            raise EntityNotFoundException(
                f"Account not found: {refresh_token_model.account_id}"
            )

        return account

    async def signup(
        self,
        email: str,
        password: str,
        device_info: str | None,
        ip_address: str | None,
    ) -> SignupResult:
        from app.modules.auth.account.services import CreateAccountService

        account_repo = self._uow.repo(AccountRepository)
        create_account_service = CreateAccountService(account_repo)
        account_atomic, account = await create_account_service.execute(
            email=email, password=password
        )

        token_repo = self._uow.repo(RefreshTokenRepository)
        create_token_service = CreateRefreshTokenService(token_repo)
        token_atomic, refresh_token_str, _ = await create_token_service.execute(
            account_id=account.id,
            device_info=device_info,
            ip_address=ip_address,
            expires_days=30,
        )

        return SignupResult(
            account=account,
            refresh_token=refresh_token_str,
            atomics=[account_atomic, token_atomic],
        )

    async def get_account(self, account_id: str) -> Account:
        from app.core.exceptions import EntityNotFoundException

        account_repo = self._uow.repo(AccountRepository)
        account_service = FindAccountService(account_repo)
        account = await account_service.execute(account_id)
        if not account:
            raise EntityNotFoundException(f"Account not found: {account_id}")

        return account

    async def withdraw(
        self, account_id: str, person_id: str
    ) -> tuple[list, "AccountAtomic"]:
        from ..token.services.revoke_all_tokens import RevokeAllTokensService

        token_repo = self._uow.repo(RefreshTokenRepository)
        revoke_service = RevokeAllTokensService(token_repo)
        revoke_atomics, _ = await revoke_service.execute(account_id)

        account_repo = self._uow.repo(AccountRepository)
        deactivate_service = DeactivateAccountService(account_repo)
        atomic, _account = await deactivate_service.execute(account_id)
        return revoke_atomics, atomic

    async def change_password(
        self,
        account_id: str,
        current_password: str,
        new_password: str,
    ) -> tuple[AccountAtomic, list, int]:
        from ..account.services import ChangePasswordService
        from ..password_history.repository import PasswordHistoryRepository

        account_repo = self._uow.repo(AccountRepository)
        password_history_repo = self._uow.repo(PasswordHistoryRepository)

        change_service = ChangePasswordService(account_repo, password_history_repo)
        atomic, _account = await change_service.execute(
            account_id,
            current_password=current_password,
            new_password=new_password,
        )

        from ..token.services.revoke_all_tokens import RevokeAllTokensService

        token_repo = self._uow.repo(RefreshTokenRepository)
        revoke_service = RevokeAllTokensService(token_repo)
        revoke_atomics, revoked_count = await revoke_service.execute(account_id)

        return atomic, revoke_atomics, revoked_count

    async def verify_password(self, account_id: str, password: str) -> bool:
        account_repo = self._uow.repo(AccountRepository)
        service = VerifyPasswordService(account_repo)
        return await service.execute(account_id, password)
