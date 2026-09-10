from __future__ import annotations


class EmailSendException(Exception):
    def __init__(self, message: str):
        self.message = message
        super().__init__(message)
