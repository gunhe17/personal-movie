from __future__ import annotations


class STTError(Exception):
    def __init__(self, message: str):
        self.message = message
        super().__init__(message)


class STTConfigError(STTError):
    pass


class STTProviderError(STTError):
    pass
