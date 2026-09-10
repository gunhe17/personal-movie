class DomainException(Exception):
    def __init__(self, message: str):
        self.message = message
        super().__init__(message)


class EntityNotFoundException(DomainException):
    pass


class PermissionDeniedException(DomainException):
    pass


class InvalidOperationException(DomainException):
    pass


class ConflictException(DomainException):
    pass


class UnauthorizedException(DomainException):
    pass


class RateLimitException(DomainException):
    pass


class QuotaExceededException(DomainException):
    pass
