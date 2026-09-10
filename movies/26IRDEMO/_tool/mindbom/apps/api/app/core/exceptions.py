"""Domain Exceptions

도메인 비즈니스 로직에서 발생하는 예외.
FastAPI 전역 예외 핸들러에서 HTTP 예외로 자동 변환됨.
"""


class DomainException(Exception):
    """Base domain exception"""

    def __init__(self, message: str):
        self.message = message
        super().__init__(message)


class EntityNotFoundException(DomainException):
    """Entity not found (404)"""
    pass


class PermissionDeniedException(DomainException):
    """Permission denied (403)"""
    pass


class InvalidOperationException(DomainException):
    """Invalid operation (400)"""
    pass


class ConflictException(DomainException):
    """Resource conflict (409)"""
    pass


class UnauthorizedException(DomainException):
    """Authentication failed (401)"""
    pass


class InvalidStateTransitionException(DomainException):
    """검사 상태 전이 오류 (400) — SaMD 상태 머신 위반"""
    pass


class AccountLockedException(DomainException):
    """계정 잠금 (423) — 로그인 실패 누적 / 무차별 대입 방어"""
    pass


class ExternalServiceException(DomainException):
    """외부 서비스(AI 서버 등) 사용 불가 (503)

    400과 나누는 이유: 요청은 옳았고 **우리 쪽 의존 서비스가 못 한 것**이다.
    임상가에게 "입력이 잘못됐다"로 보이면 고칠 수 없는 것을 고치려 든다.

    이 예외가 생긴 배경: AI 채점이 실패하면 룰베이스 목업을 대신 돌려주고
    있었다. 실패를 성공으로 바꿔 반환한 것이라, 임상가가 AI가 본 적 없는
    부호를 검토하고 확정할 수 있었다(2026-08-26). CDSS에서 가장 나쁜 실패다.
    **못 하면 못 했다고 한다.**
    """
    pass
