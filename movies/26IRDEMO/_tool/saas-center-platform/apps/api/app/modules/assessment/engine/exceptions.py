from app.core.exceptions import EntityNotFoundException, InvalidOperationException


class EngineNotFoundError(EntityNotFoundException):
    pass


class EngineValidationError(InvalidOperationException):
    pass
