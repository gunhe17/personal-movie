from dataclasses import dataclass

from app.core.datetime_utils import utc_now
from app.core.exceptions import InvalidOperationException
from app.core.logger import get_logger
from app.modules.auth.account.repository import AccountRepository
from app.modules.auth.account.services import FindAccountService
from app.modules.auth.account.services.update_account_status import (
    UpdateAccountStatusService,
)
from app.modules.auth.login_notification.repository import LoginNotificationRepository
from app.modules.auth.login_notification.services.get_recent_logins import (
    GetRecentLoginsService,
)
from app.modules.auth.suspicious_activity.services import CalculateRiskScoreService
from app.modules.auth.token.repository import RefreshTokenRepository
from app.modules.auth.token.services.revoke_all_tokens import RevokeAllTokensService

logger = get_logger(__name__)


@dataclass
class SuspiciousLoginResult:
    is_suspicious: bool
    risk_score: int
    reasons: list[str]
    should_lock: bool
    locked: bool
    revoked_sessions: int
    atomics: list


class DetectAndLockIfSuspiciousService:
    def __init__(
        self,
        login_repo: LoginNotificationRepository,
        account_repo: AccountRepository,
        token_repo: RefreshTokenRepository,
    ):
        self._login_repo = login_repo
        self._account_repo = account_repo
        self._token_repo = token_repo

    async def execute(
        self,
        account_id: str,
        current_ip: str,
    ) -> SuspiciousLoginResult:
        recent_logins = await GetRecentLoginsService(self._login_repo).execute(
            account_id,
            days=1,
            limit=50,
        )

        if not recent_logins:
            return SuspiciousLoginResult(
                is_suspicious=False,
                risk_score=0,
                reasons=[],
                should_lock=False,
                locked=False,
                revoked_sessions=0,
                atomics=[],
            )

        risk_result = CalculateRiskScoreService().execute(recent_logins)
        locked = False
        revoked_sessions = 0
        atomics: list = []

        if risk_result["should_lock"]:
            account = await FindAccountService(self._account_repo).execute(account_id)

            if account and account.is_active:
                status_atomic, _ = await UpdateAccountStatusService(
                    self._account_repo
                ).execute(account_id, is_active=False)
                revoke_atomics, revoked_sessions = await RevokeAllTokensService(
                    self._token_repo
                ).execute(account_id)
                locked = True
                atomics = [status_atomic, *revoke_atomics]

                logger.warning(
                    f"[AuthFacade] Account locked due to suspicious activity\n"
                    f"  Account: {account_id}\n"
                    f"  Risk Score: {risk_result['risk_score']}\n"
                    f"  Reasons: {', '.join(risk_result['reasons'])}\n"
                    f"  Revoked Sessions: {revoked_sessions}\n"
                    f"  Locked At: {utc_now()}"
                )

        elif risk_result["is_suspicious"]:
            logger.warning(
                f"[AuthFacade] Suspicious login detected (not locked)\n"
                f"  Account: {account_id}\n"
                f"  Risk Score: {risk_result['risk_score']}\n"
                f"  Reasons: {', '.join(risk_result['reasons'])}"
            )

        return SuspiciousLoginResult(
            is_suspicious=risk_result["is_suspicious"],
            risk_score=risk_result["risk_score"],
            reasons=risk_result["reasons"],
            should_lock=risk_result["should_lock"],
            locked=locked,
            revoked_sessions=revoked_sessions,
            atomics=atomics,
        )
