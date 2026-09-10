"""Password Reset Services"""
import hashlib
import secrets
from datetime import timedelta

from app.core.datetime_utils import utc_now
from app.core.exceptions import InvalidOperationException
from app.core.password_policy import validate_password
from app.core.security import get_password_hash
from app.modules.auth.account.models import Account
from app.modules.auth.account.repository import AccountRepository
from app.modules.auth.password_reset.repository import PasswordResetTokenRepository

TOKEN_TTL_MINUTES = 60
RATE_LIMIT_SECONDS = 60


def _hash_token(raw_token: str) -> str:
    """sha256 hex digest (64 chars) — DB 저장용"""
    return hashlib.sha256(raw_token.encode("utf-8")).hexdigest()


class IssuePasswordResetTokenService:
    """비밀번호 재설정 토큰 발급

    이메일에 해당하는 계정이 없으면 None을 반환 (호출자가 enumeration 방지를 위해
    동일 응답을 반환할 책임).
    동일 계정이 1분 내 재요청 시 None 반환 (rate limit).

    Returns:
        (account, raw_token) 또는 None
    """

    def __init__(
        self,
        account_repo: AccountRepository,
        token_repo: PasswordResetTokenRepository,
    ):
        self.account_repo = account_repo
        self.token_repo = token_repo

    async def execute(self, email: str) -> tuple[Account, str] | None:
        account = await self.account_repo.get_by_email(email)
        if not account or not account.is_active:
            return None

        # Rate limit: 동일 계정 1분 내 재요청 차단
        latest = await self.token_repo.get_latest_for_account(account.id)
        if latest:
            elapsed = (utc_now() - latest.created_at).total_seconds()
            if elapsed < RATE_LIMIT_SECONDS:
                return None

        raw_token = secrets.token_urlsafe(32)
        await self.token_repo.create({
            "account_id": account.id,
            "token_hash": _hash_token(raw_token),
            "expires_at": utc_now() + timedelta(minutes=TOKEN_TTL_MINUTES),
        })
        return account, raw_token


class ConfirmPasswordResetService:
    """비밀번호 재설정 확정

    토큰 검증 → 만료/사용 여부 확인 → 정책 검증 → 비밀번호 업데이트 →
    token_version 증가 (모든 기존 access token 무효화).

    Raises:
        InvalidOperationException: 유효하지 않은 토큰 / 만료 / 사용 완료 / 계정 비활성
    """

    def __init__(
        self,
        account_repo: AccountRepository,
        token_repo: PasswordResetTokenRepository,
    ):
        self.account_repo = account_repo
        self.token_repo = token_repo

    async def execute(self, raw_token: str, new_password: str) -> Account:
        token_record = await self.token_repo.get_by_token_hash(_hash_token(raw_token))
        if not token_record:
            raise InvalidOperationException(
                "유효하지 않은 재설정 링크입니다."
            )

        now = utc_now()
        if token_record.used_at is not None:
            raise InvalidOperationException(
                "이미 사용된 재설정 링크입니다. 다시 요청해주세요."
            )
        if token_record.expires_at <= now:
            raise InvalidOperationException(
                "만료된 재설정 링크입니다. 다시 요청해주세요."
            )

        account = await self.account_repo.get(token_record.account_id)
        if not account or not account.is_active:
            raise InvalidOperationException(
                "유효하지 않은 재설정 링크입니다."
            )

        validate_password(new_password, email=account.email)

        account.password_hash = get_password_hash(new_password)
        account.token_version += 1  # 기존 access token 즉시 무효화
        account.failed_login_attempts = 0
        account.lockout_until = None

        token_record.used_at = now

        await self.account_repo.flush()
        return account


def build_reset_email(reset_url: str, user_name: str) -> tuple[str, str]:
    """이메일 제목 + HTML 본문 생성

    Returns:
        (subject, html_body)
    """
    subject = "[마인드봄] 비밀번호 재설정 안내"
    html_body = f"""\
<!DOCTYPE html>
<html lang="ko">
<head><meta charset="utf-8"></head>
<body style="font-family: 'Apple SD Gothic Neo', system-ui, sans-serif; color:#1f2937; max-width:540px; margin:0 auto; padding:32px 24px;">
  <h2 style="font-size:20px; margin:0 0 16px;">비밀번호 재설정 요청</h2>
  <p style="font-size:14px; line-height:1.6;">
    안녕하세요, {user_name}님.<br>
    아래 버튼을 눌러 비밀번호를 재설정해주세요. 링크는 <strong>1시간 동안만 유효</strong>합니다.
  </p>
  <p style="margin:24px 0;">
    <a href="{reset_url}"
       style="display:inline-block; padding:12px 24px; background-color:#4f46e5; color:#ffffff;
              text-decoration:none; border-radius:8px; font-size:14px; font-weight:600;">
      비밀번호 재설정
    </a>
  </p>
  <p style="font-size:12px; color:#6b7280; line-height:1.6;">
    버튼이 작동하지 않으면 아래 링크를 브라우저에 직접 붙여넣어 주세요:<br>
    <a href="{reset_url}" style="color:#4f46e5; word-break:break-all;">{reset_url}</a>
  </p>
  <hr style="border:none; border-top:1px solid #e5e7eb; margin:24px 0;">
  <p style="font-size:12px; color:#9ca3af;">
    본인이 요청하지 않았다면 이 메일을 무시해주세요. 계정 비밀번호는 변경되지 않습니다.
  </p>
</body>
</html>"""
    return subject, html_body
