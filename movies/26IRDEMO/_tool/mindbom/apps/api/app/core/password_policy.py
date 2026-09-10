"""비밀번호 정책 (SaMD)

복잡도 검증, 이메일 부분 포함 금지.
회원가입/직원 초대/비밀번호 변경 진입점에서 호출.
"""
import re

from app.core.exceptions import InvalidOperationException

MIN_LENGTH = 8
MAX_LENGTH = 128


def validate_password(password: str, *, email: str | None = None) -> None:
    """비밀번호 정책 검증.

    Raises:
        InvalidOperationException: 정책 미충족 시 (HTTP 400)
    """
    if not isinstance(password, str):
        raise InvalidOperationException("비밀번호는 문자열이어야 합니다.")

    if len(password) < MIN_LENGTH:
        raise InvalidOperationException(
            f"비밀번호는 최소 {MIN_LENGTH}자 이상이어야 합니다."
        )
    if len(password) > MAX_LENGTH:
        raise InvalidOperationException(
            f"비밀번호는 최대 {MAX_LENGTH}자까지 허용됩니다."
        )

    has_lower = re.search(r"[a-z]", password) is not None
    has_upper = re.search(r"[A-Z]", password) is not None
    has_digit = re.search(r"\d", password) is not None
    has_symbol = re.search(r"[^A-Za-z0-9]", password) is not None

    missing: list[str] = []
    if not has_lower:
        missing.append("소문자")
    if not has_upper:
        missing.append("대문자")
    if not has_digit:
        missing.append("숫자")
    if not has_symbol:
        missing.append("특수문자")
    if missing:
        raise InvalidOperationException(
            f"비밀번호에 {', '.join(missing)}가 포함되어야 합니다."
        )

    if email:
        local = email.split("@", 1)[0].lower()
        if len(local) >= 4 and local in password.lower():
            raise InvalidOperationException(
                "비밀번호에 이메일 정보를 포함할 수 없습니다."
            )
