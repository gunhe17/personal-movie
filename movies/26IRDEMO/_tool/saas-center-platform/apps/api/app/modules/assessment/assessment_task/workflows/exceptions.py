from app.core.exceptions import EntityNotFoundException, InvalidOperationException


class WorkflowNotFoundError(EntityNotFoundException):
    pass


class WorkflowValidationError(InvalidOperationException):
    pass
