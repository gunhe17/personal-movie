from __future__ import annotations


class MessagingException(Exception):
    def __init__(self, message: str):
        self.message = message
        super().__init__(message)


class MessageSendException(MessagingException):
    pass


class AuthenticationException(MessagingException):
    pass


class RateLimitException(MessagingException):
    pass


class InvalidRecipientException(MessagingException):
    pass
