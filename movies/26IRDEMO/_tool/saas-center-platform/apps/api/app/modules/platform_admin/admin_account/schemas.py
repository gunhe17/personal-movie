import re
from datetime import datetime
from pydantic import BaseModel, ConfigDict


class AdminAccountSummary(BaseModel):
    id: str
    email: str
    name: str
    role: str
    is_active: bool
    last_login_at: datetime | None

    model_config = ConfigDict(from_attributes=True)


class AdminAccountResponse(BaseModel):
    id: str
    email: str
    name: str
    role: str
    is_active: bool
    failed_login_count: int
    locked_until: datetime | None
    last_login_at: datetime | None
    created_at: datetime
    updated_at: datetime

    model_config = ConfigDict(from_attributes=True)


class AdminLoginTokenResponse(BaseModel):
    admin_account: AdminAccountSummary
    access_token: str
    refresh_token: str
    token_type: str = "Bearer"
    expires_in: int


# --- Password Validation ---

PASSWORD_MIN_LENGTH = 12
PASSWORD_PATTERN_UPPER = re.compile(r"[A-Z]")
PASSWORD_PATTERN_LOWER = re.compile(r"[a-z]")
PASSWORD_PATTERN_SPECIAL = re.compile(r"[!@#$%^&*()_+\-=\[\]{};':\"\\|,.<>/?`~]")
PASSWORD_PATTERN_CONSECUTIVE = re.compile(r"(\d)\1{2,}|012|123|234|345|456|567|678|789|890")


def validate_admin_password(password: str) -> str:
    """어드민 비밀번호 정책 검증"""
    if len(password) < PASSWORD_MIN_LENGTH:
        raise ValueError(f"비밀번호는 {PASSWORD_MIN_LENGTH}자 이상이어야 합니다")
    if not PASSWORD_PATTERN_UPPER.search(password):
        raise ValueError("비밀번호에 영문 대문자가 포함되어야 합니다")
    if not PASSWORD_PATTERN_LOWER.search(password):
        raise ValueError("비밀번호에 영문 소문자가 포함되어야 합니다")
    if not PASSWORD_PATTERN_SPECIAL.search(password):
        raise ValueError("비밀번호에 특수문자가 포함되어야 합니다")
    if PASSWORD_PATTERN_CONSECUTIVE.search(password):
        raise ValueError("비밀번호에 연속된 숫자(예: 123, 111)를 사용할 수 없습니다")
    return password
