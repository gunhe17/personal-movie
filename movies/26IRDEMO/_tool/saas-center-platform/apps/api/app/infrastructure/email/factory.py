from __future__ import annotations

from functools import lru_cache

from app.core.config import settings
from app.infrastructure.email.common.base import Mailer
from app.infrastructure.email.smtp.client import SmtpMailer


@lru_cache
def get_smtp_mailer() -> Mailer:
    return SmtpMailer(
        server=settings.SMTP_SERVER,
        port=settings.SMTP_PORT,
        username=settings.HOST_EMAIL,
        password=settings.HOST_PASSWORD,
    )
