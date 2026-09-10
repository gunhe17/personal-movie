from datetime import timedelta

from app.infrastructure.token.factory import get_token
from app.modules.platform_admin.admin_account.models import AdminAccount
from app.modules.platform_admin.auth.utils import generate_2fa_code, hash_2fa_code

PENDING_TOKEN_EXPIRE_MINUTES = 5


class Generate2FATokenService:
    # 2FA 인증코드 생성 + pending_token 발급 서비스
    #
    # 6자리 랜덤 코드를 생성하고, SHA-256 해시를 JWT pending_token에 포함합니다.

    def execute(self, admin: AdminAccount) -> tuple[str, str]:
        # 1. 6자리 랜덤 코드 생성
        code = generate_2fa_code()
        code_hash = hash_2fa_code(code)

        # 2. pending_token 발급 (code_hash 포함)
        pending_token = get_token().create_access_token(
            data={
                "admin_account_id": admin.id,
                "email": admin.email,
                "role": admin.role,
                "type": "admin_2fa_pending",
                "token_type": "admin",
                "code_hash": code_hash,
            },
            account_token_version=admin.token_version,
            expires_delta=timedelta(minutes=PENDING_TOKEN_EXPIRE_MINUTES),
        )

        return code, pending_token
