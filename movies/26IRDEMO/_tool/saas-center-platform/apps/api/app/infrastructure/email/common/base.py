from __future__ import annotations

from abc import ABC, abstractmethod


class Mailer(ABC):
    @abstractmethod
    def send_email(
        self,
        recipient: str,
        subject: str,
        html_content: str,
        text_content: str | None = None,
        cc: list[str] | None = None,
        bcc: list[str] | None = None,
        reply_to: str | None = None,
    ) -> None: ...
