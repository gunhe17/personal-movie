import hashlib
import secrets


def generate_2fa_code(length: int = 6) -> str:
    """6자리 숫자 인증코드 생성 (균일 분포)"""
    return "".join([str(secrets.randbelow(10)) for _ in range(length)])


def hash_2fa_code(code: str) -> str:
    """2FA 코드 SHA-256 해싱"""
    return hashlib.sha256(code.encode()).hexdigest()
